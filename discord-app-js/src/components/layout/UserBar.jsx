import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import useAudioDevices from '../../hooks/useAudioDevices';
import VolumeSlider from './VolumeSlider';
import {
  getMessageNotificationsMuted,
  setMessageNotificationsMuted,
} from '../../utils/messageNotifications';
import { requestDesktopNotificationPermission } from '../../utils/desktopNotifications';

/**
 * UserBar — sol alt köşede floating duran, sayfadan bağımsız kullanıcı çubuğu.
 *
 * Daha önce bu blok ChannelSidebar (klan seçili/seçili değil için iki kopya) ve
 * FriendsSidebar içinde ayrı ayrı kopyalanmıştı; artık MainLayout'ta bir kez
 * render edilir, böylece Arkadaşlar/klan/DM sayfaları arasında geçerken çubuk
 * kimliği ve açık menüleri korunur.
 *
 * Performans notları:
 * - Menüler (mikrofon/kulaklık/kullanıcı) kendi memo'lu alt bileşenlerinde;
 *   birinin state'i değişince diğerleri yeniden render olmaz.
 * - Ses kaydırıcıları sürükleme sırasında yerel state kullanır (VolumeSlider).
 * - Aygıt listesi tek bir useAudioDevices örneğinden gelir; her menü açılışında
 *   yeniden enumerate edilmez.
 * - Dışarı-tıklama dinleyicisi yalnızca bir menü açıkken bağlanır.
 */

const MicSettingsMenu = memo(function MicSettingsMenu({
  inputDevices,
  selectedInputDevice,
  onSelectInputDevice,
  inputVolume,
  onInputVolumeChange,
  noiseSuppressionEnabled,
  onNoiseSuppressionChange,
}) {
  return (
    <div className="audio-settings-menu audio-settings-menu--mic">
      <h4 className="audio-settings-menu__title">Giriş Ayarları</h4>

      <label className="audio-settings-menu__label" htmlFor="user-bar-input-device">
        Giriş Aygıtı
      </label>
      <select
        id="user-bar-input-device"
        className="audio-settings-menu__select"
        value={selectedInputDevice}
        onChange={(e) => onSelectInputDevice(e.target.value)}
      >
        <option value="">Varsayılan</option>
        {inputDevices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Mikrofon ${d.deviceId.slice(0, 5)}`}
          </option>
        ))}
      </select>

      <label className="audio-settings-menu__label">Giriş Sesi — {inputVolume}%</label>
      <VolumeSlider value={inputVolume} onChange={onInputVolumeChange} />

      <label className="audio-settings-menu__checkbox">
        <input
          type="checkbox"
          checked={noiseSuppressionEnabled ?? true}
          onChange={(e) => onNoiseSuppressionChange?.(e.target.checked)}
        />
        AI Gürültü İzolasyonu
      </label>
      <p className="audio-settings-menu__hint">
        Klavye, fan ve arka plan gürültüsünü bastırır.
      </p>
    </div>
  );
});

const OutputSettingsMenu = memo(function OutputSettingsMenu({
  outputDevices,
  selectedOutputDevice,
  onSelectOutputDevice,
  outputVolume,
  onOutputVolumeChange,
  notificationsEnabled,
  onNotificationsChange,
}) {
  return (
    <div className="audio-settings-menu audio-settings-menu--headphone">
      <h4 className="audio-settings-menu__title">Çıkış Ayarları</h4>

      <label className="audio-settings-menu__label" htmlFor="user-bar-output-device">
        Çıkış Aygıtı
      </label>
      <select
        id="user-bar-output-device"
        className="audio-settings-menu__select"
        value={selectedOutputDevice}
        onChange={(e) => onSelectOutputDevice(e.target.value)}
      >
        <option value="">Varsayılan</option>
        {outputDevices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Hoparlör ${d.deviceId.slice(0, 5)}`}
          </option>
        ))}
      </select>

      <label className="audio-settings-menu__label">Çıkış Sesi — {outputVolume}%</label>
      <VolumeSlider value={outputVolume} onChange={onOutputVolumeChange} />

      <label className="audio-settings-menu__checkbox">
        <input
          type="checkbox"
          checked={notificationsEnabled}
          onChange={(e) => onNotificationsChange(e.target.checked)}
        />
        Mesaj bildirimleri
      </label>
    </div>
  );
});

const UserMenu = memo(function UserMenu({ onOpenAccountSettings, onLogout }) {
  return (
    <div className="channel-sidebar__user-dropdown">
      <button
        type="button"
        className="channel-sidebar__user-dropdown-item channel-sidebar__user-dropdown-item--neutral"
        onClick={onOpenAccountSettings}
      >
        <span className="material-symbols-outlined">person</span>
        Profil ve Ayarlar
      </button>
      <button type="button" className="channel-sidebar__user-dropdown-item" onClick={onLogout}>
        <span className="material-symbols-outlined">logout</span>
        Çıkış Yap
      </button>
    </div>
  );
});

function UserBar({
  user,
  onLogout,
  onOpenAccountSettings,
  inputVolume,
  setInputVolume,
  outputVolume,
  setOutputVolume,
  selectedInputDevice,
  setSelectedInputDevice,
  selectedOutputDevice,
  setSelectedOutputDevice,
  isMicMuted,
  onToggleMic,
  isDeafened,
  onToggleDeafen,
  noiseSuppressionEnabled,
  setNoiseSuppressionEnabled,
}) {
  // Aynı anda en fazla bir menü açık: 'mic' | 'output' | 'user' | null
  const [openMenu, setOpenMenu] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => !getMessageNotificationsMuted()
  );
  const { inputDevices, outputDevices, requestPermission } = useAudioDevices();
  const rootRef = useRef(null);

  // Dinleyiciyi sadece bir menü açıkken bağla — kapalıyken her mousedown'da
  // çalışan global handler'a gerek yok.
  useEffect(() => {
    if (!openMenu) return undefined;
    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenu]);

  const toggleMenu = useCallback((menu) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  }, []);

  const handleOpenMicSettings = useCallback(async () => {
    const willOpen = openMenu !== 'mic';
    toggleMenu('mic');
    // Etiketler ancak izin verildikten sonra dolar; menüyü açarken bir kez iste.
    if (willOpen && !inputDevices.some((d) => d.label)) {
      await requestPermission();
    }
  }, [openMenu, toggleMenu, inputDevices, requestPermission]);

  const handleNotificationsChange = useCallback(async (enabled) => {
    setMessageNotificationsMuted(!enabled);
    setNotificationsEnabled(enabled);
    if (enabled) {
      const permission = await requestDesktopNotificationPermission();
      if (permission !== 'granted') {
        setMessageNotificationsMuted(true);
        setNotificationsEnabled(false);
      }
    }
  }, []);

  const handleOpenAccountSettings = useCallback(() => {
    setOpenMenu(null);
    onOpenAccountSettings?.();
  }, [onOpenAccountSettings]);

  const handleLogout = useCallback(() => {
    setOpenMenu(null);
    onLogout?.();
  }, [onLogout]);

  if (!user) return null;

  return (
    <div className="user-bar" ref={rootRef}>
      <div className="user-bar__inner">
        <div className="user-bar__identity-container">
          <button
            type="button"
            className="channel-sidebar__user-info user-bar__identity"
            onClick={() => toggleMenu('user')}
            aria-haspopup="menu"
            aria-expanded={openMenu === 'user'}
          >
            <div className="channel-sidebar__user-avatar-wrapper">
              <div className="channel-sidebar__user-avatar">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="channel-sidebar__user-avatar-img"
                  />
                ) : (
                  <span>{user.userName?.charAt(0)?.toUpperCase() || '?'}</span>
                )}
              </div>
              <div className="channel-sidebar__user-status-dot" />
            </div>
            <div className="user-bar__identity-text">
              <p className="channel-sidebar__user-name">{user.userName || 'User'}</p>
              <p className="channel-sidebar__user-status">Çevrimiçi</p>
            </div>
          </button>

          {openMenu === 'user' && (
            <UserMenu
              onOpenAccountSettings={handleOpenAccountSettings}
              onLogout={handleLogout}
            />
          )}
        </div>

        <div className="channel-sidebar__user-actions">
          {/* Mikrofon */}
          <div className="channel-sidebar__audio-control">
            <button
              type="button"
              className={`channel-sidebar__user-action-btn ${isMicMuted ? 'channel-sidebar__user-action-btn--muted' : ''}`}
              title={isMicMuted ? 'Mikrofonu Aç' : 'Sustur'}
              onClick={onToggleMic}
            >
              <span className="material-symbols-outlined">
                {isMicMuted ? 'mic_off' : 'mic'}
              </span>
            </button>
            <button
              type="button"
              className="channel-sidebar__audio-settings-btn"
              title="Mikrofon Ayarları"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'mic'}
              onClick={handleOpenMicSettings}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                expand_less
              </span>
            </button>
            {openMenu === 'mic' && (
              <MicSettingsMenu
                inputDevices={inputDevices}
                selectedInputDevice={selectedInputDevice}
                onSelectInputDevice={setSelectedInputDevice}
                inputVolume={inputVolume}
                onInputVolumeChange={setInputVolume}
                noiseSuppressionEnabled={noiseSuppressionEnabled}
                onNoiseSuppressionChange={setNoiseSuppressionEnabled}
              />
            )}
          </div>

          {/* Kulaklık */}
          <div className="channel-sidebar__audio-control">
            <button
              type="button"
              className={`channel-sidebar__user-action-btn ${isDeafened ? 'channel-sidebar__user-action-btn--muted' : ''}`}
              title={isDeafened ? 'Sesi Aç' : 'Sesi Kapat'}
              onClick={onToggleDeafen}
            >
              <span className="material-symbols-outlined">
                {isDeafened ? 'headset_off' : 'headphones'}
              </span>
            </button>
            <button
              type="button"
              className="channel-sidebar__audio-settings-btn"
              title="Ses Çıkış Ayarları"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'output'}
              onClick={() => toggleMenu('output')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                expand_less
              </span>
            </button>
            {openMenu === 'output' && (
              <OutputSettingsMenu
                outputDevices={outputDevices}
                selectedOutputDevice={selectedOutputDevice}
                onSelectOutputDevice={setSelectedOutputDevice}
                outputVolume={outputVolume}
                onOutputVolumeChange={setOutputVolume}
                notificationsEnabled={notificationsEnabled}
                onNotificationsChange={handleNotificationsChange}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(UserBar);
