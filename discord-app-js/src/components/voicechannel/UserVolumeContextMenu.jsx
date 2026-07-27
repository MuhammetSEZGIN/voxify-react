import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * UserVolumeContextMenu
 * Ses kanalındaki bir kullanıcıya sağ tıklandığında açılan bağlam menüsü.
 * Kullanıcının ses düzeyini bağımsız olarak ayarlamayı sağlar.
 *
 * Props:
 *  - visible       : boolean — menü görünür mü
 *  - x, y          : number — menü pozisyonu (viewport-relative)
 *  - participant    : { identity, name } — hedef kullanıcı
 *  - currentVolume  : number (0-200) — mevcut ses seviyesi
 *  - canAdjustVolume: boolean — hedef aynı LiveKit odasındaysa ses ayarı gösterilir
 *  - canKick        : boolean — ses kanalından çıkarma yetkisi var mı
 *  - isKicking      : boolean — çıkarma isteği sürüyor mu
 *  - onKick         : (participant) => void
 *  - onVolumeChange : (identity, volume) => void
 *  - onClose        : () => void
 */
function UserVolumeContextMenu({
  visible,
  x,
  y,
  participant,
  currentVolume,
  canAdjustVolume = true,
  canKick,
  isKicking,
  onKick,
  onVolumeChange,
  onClose,
}) {
  const menuRef = useRef(null);
  const [localVolume, setLocalVolume] = useState(currentVolume ?? 100);

  // Menü açıldığında mevcut değeri senkronize et
  useEffect(() => {
    if (visible) {
      setLocalVolume(currentVolume ?? 100);
    }
  }, [visible, currentVolume]);

  // Dışarı tıklanınca kapat
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    // RAF ile event ekle; böylece context menu tıklamasının kendisi yakalanmaz
    requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [visible, onClose]);

  // Menü ekrandan taşmasın
  useEffect(() => {
    if (!visible || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const el = menuRef.current;
    if (rect.right > window.innerWidth) {
      el.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${y - rect.height}px`;
    }
  }, [visible, x, y]);

  const handleChange = useCallback((e) => {
    const val = Number(e.target.value);
    setLocalVolume(val);
    onVolumeChange?.(participant?.identity, val);
  }, [onVolumeChange, participant?.identity]);

  const handleReset = useCallback(() => {
    setLocalVolume(100);
    onVolumeChange?.(participant?.identity, 100);
  }, [onVolumeChange, participant?.identity]);

  if (!visible || !participant) return null;

  const volumeIcon = localVolume === 0
    ? 'volume_off'
    : localVolume < 50
      ? 'volume_down'
      : 'volume_up';

  return (
    <div
      ref={menuRef}
      className="user-volume-ctx"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Başlık */}
      <div className="user-volume-ctx__header">
        <div className="user-volume-ctx__avatar">
          <span>{(participant.name || '?').charAt(0).toUpperCase()}</span>
        </div>
        <span className="user-volume-ctx__name">{participant.name}</span>
      </div>

      {canAdjustVolume && (
        <>
          <div className="user-volume-ctx__divider" />

          {/* Ses Seviyesi Kontrolü */}
          <div className="user-volume-ctx__section">
            <div className="user-volume-ctx__section-title">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{volumeIcon}</span>
              <span>Kullanıcı Sesi</span>
            </div>

            <div className="user-volume-ctx__slider-row">
              <input
                type="range"
                min="0"
                max="100"
                value={localVolume}
                onChange={handleChange}
                className="user-volume-ctx__slider"
                title={`${localVolume}%`}
              />
              <span className="user-volume-ctx__value">{localVolume}%</span>
            </div>

            {localVolume !== 100 && (
              <button className="user-volume-ctx__reset-btn" onClick={handleReset}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>restart_alt</span>
                Sıfırla
              </button>
            )}
          </div>
        </>
      )}

      {canKick && (
        <>
          <div className="user-volume-ctx__divider" />
          <button
            type="button"
            className="user-volume-ctx__kick-btn"
            disabled={isKicking}
            onClick={() => onKick?.(participant)}
          >
            <span className="material-symbols-outlined">person_remove</span>
            {isKicking ? 'Çıkarılıyor...' : 'Ses kanalından çıkar'}
          </button>
        </>
      )}
    </div>
  );
}

export default UserVolumeContextMenu;
