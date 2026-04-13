import React, { useState, useEffect, useRef } from 'react';
import ScreenShareStatusBar from '../voicechannel/ScreenShareStatusBar';
import { getMessageNotificationsMuted, setMessageNotificationsMuted } from '../../utils/messageNotifications';

function ChannelSidebar({
  clan,
  channels,
  voiceChannels,
  selectedChannelId,
  activeVoiceChannelId,
  onSelectChannel,
  onSelectVoiceChannel,
  user,
  onLogout,
  onCreateChannel,
  onCreateVoiceChannel,
  onUpdateChannel,
  onDeleteChannel,
  onUpdateVoiceChannel,
  onDeleteVoiceChannel,
  voiceState,
  activeVoiceChannel,
  onDisconnectVoice,
  voicePresence,
  canManage,
  userRole,
  onLeaveClan,
  onOpenClanSettings,
  inputVolume,
  setInputVolume,
  outputVolume,
  setOutputVolume,
  selectedInputDevice,
  setSelectedInputDevice,
  selectedOutputDevice,
  setSelectedOutputDevice,
  onWatchScreenShare,
  isMicMuted,
  onToggleMic,
  onParticipantContextMenu,
}) {
  const [textOpen, setTextOpen] = useState(true);
  const [voiceOpen, setVoiceOpen] = useState(true);
  const [showChannelInput, setShowChannelInput] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [showVoiceChannelInput, setShowVoiceChannelInput] = useState(false);
  const [newVoiceChannelName, setNewVoiceChannelName] = useState('');
  const [editingChannel, setEditingChannel] = useState(null);
  const [editingVoiceChannel, setEditingVoiceChannel] = useState(null);
  const [editName, setEditName] = useState('');
  const [showClanMenu, setShowClanMenu] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [showMicSettings, setShowMicSettings] = useState(false);
  const [showHeadphoneSettings, setShowHeadphoneSettings] = useState(false);
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [messageNotificationsMuted, setMessageNotificationsMutedState] = useState(getMessageNotificationsMuted);
  const micSettingsRef = useRef(null);
  const headphoneSettingsRef = useRef(null);
  const userMenuRef = useRef(null);

  // Load audio devices — no getUserMedia on mount; enumerate with whatever labels are already available.
  // Labels are populated if the user has previously granted permission or once they open mic settings.
  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputDevices(devices.filter(d => d.kind === 'audioinput'));
      setAudioOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
    } catch {
      // Device enumeration not supported
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    setMessageNotificationsMutedState(getMessageNotificationsMuted());
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (micSettingsRef.current && !micSettingsRef.current.contains(e.target)) {
        setShowMicSettings(false);
      }
      if (headphoneSettingsRef.current && !headphoneSettingsRef.current.contains(e.target)) {
        setShowHeadphoneSettings(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!clan) {
    return (
      <aside className="channel-sidebar">
        <header className="channel-sidebar__header">
          <h1 className="channel-sidebar__title">Voxify</h1>
        </header>
        <div className="channel-sidebar__empty">
          <p className="channel-sidebar__empty-text">Select a clan to see channels</p>
        </div>
        {user && (
          <div className="channel-sidebar__user-bar">
            <div
              className="channel-sidebar__user-info"
              onClick={() => setShowUserMenu(!showUserMenu)}
              ref={userMenuRef}
              style={{ cursor: 'pointer', position: 'relative' }}
            >
              <div className="channel-sidebar__user-avatar-wrapper">
                <div className="channel-sidebar__user-avatar">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="avatar" className="channel-sidebar__user-avatar-img" />
                  ) : (
                    <span>{user.userName?.charAt(0)?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <div className="channel-sidebar__user-status-dot" />
              </div>
              <div>
                <p className="channel-sidebar__user-name">{user.userName || 'User'}</p>
                <p className="channel-sidebar__user-status">Online</p>
              </div>

              {showUserMenu && (
                <div className="channel-sidebar__user-dropdown">
                  <button className="channel-sidebar__user-dropdown-item" onClick={onLogout}>
                    <span className="material-symbols-outlined">logout</span>
                    Çıkış Yap
                  </button>
                </div>
              )}
            </div>
            <div className="channel-sidebar__user-actions">
              <button className="channel-sidebar__user-action-btn" title="Microphone">
                <span className="material-symbols-outlined">mic</span>
              </button>
              <button className="channel-sidebar__user-action-btn" title="Headphones">
                <span className="material-symbols-outlined">headphones</span>
              </button>
            </div>
          </div>
        )}
      </aside>
    );
  }

  const handleCreateChannel = () => {
    if (newChannelName.trim()) {
      onCreateChannel(newChannelName.trim());
      setNewChannelName('');
      setShowChannelInput(false);
    }
  };

  const handleCreateVoiceChannel = () => {
    if (newVoiceChannelName.trim()) {
      onCreateVoiceChannel(newVoiceChannelName.trim());
      setNewVoiceChannelName('');
      setShowVoiceChannelInput(false);
    }
  };

  const handleStartEdit = (channel, e) => {
    e.stopPropagation();
    setEditingChannel(channel.channelId);
    setEditName(channel.name);
  };

  const handleSaveEdit = (channel) => {
    if (editName.trim() && editName !== channel.name) {
      onUpdateChannel({
        channelId: channel.channelId,
        clanId: channel.clanId || clan?.clanId,
        name: editName.trim(),
      });
    }
    setEditingChannel(null);
  };

  const handleDeleteChannel = (channelId, clanId, e) => {
    e.stopPropagation();
    onDeleteChannel(channelId, clanId);
  };

  const handleStartEditVoice = (vc, e) => {
    e.stopPropagation();
    setEditingVoiceChannel(vc.voiceChannelId);
    setEditName(vc.name);
  };

  const handleSaveEditVoice = (vc) => {
    if (editName.trim() && editName !== vc.name) {
      onUpdateVoiceChannel({
        voiceChannelId: vc.voiceChannelId,
        clanId: vc.clanId || clan?.clanId,
        name: editName.trim(),
      });
    }
    setEditingVoiceChannel(null);
  };

  const handleDeleteVoiceChannel = (voiceChannelId, clanId, e) => {
    e.stopPropagation();
    onDeleteVoiceChannel(voiceChannelId, clanId || clan?.clanId);
  };

  const handleToggleDeafen = () => {
    setIsDeafened((prev) => {
      const newDeafened = !prev;
      // Mute/unmute all audio elements on the page
      document.querySelectorAll('audio, video').forEach((el) => {
        el.muted = newDeafened;
      });
      return newDeafened;
    });
  };

  return (
    <aside className="channel-sidebar">
      {/* Clan Header */}
      <header className="channel-sidebar__header">
        <h1 className="channel-sidebar__title">{clan.name}</h1>
        <div className="channel-sidebar__header-menu-wrapper">
          <button className="channel-sidebar__header-btn" onClick={() => setShowClanMenu(!showClanMenu)}>
            <span className="material-symbols-outlined">{showClanMenu ? 'close' : 'expand_more'}</span>
          </button>
          {showClanMenu && (
            <div className="clan-dropdown-menu">
              {(userRole === 'owner' || userRole === 'admin') && (
                <button className="clan-dropdown-menu__item" onClick={() => { setShowClanMenu(false); onOpenClanSettings?.(); }}>
                  <span className="material-symbols-outlined">settings</span>
                  <span>Klan Ayarları</span>
                </button>
              )}
              <button className="clan-dropdown-menu__item clan-dropdown-menu__item--danger" onClick={() => { setShowClanMenu(false); onLeaveClan?.(); }}>
                <span className="material-symbols-outlined">logout</span>
                <span>Klandan Ayrıl</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Channel List */}
      <div className="channel-sidebar__channels">
        {/* Text Channels */}
        <details className="channel-sidebar__group" open={textOpen}>
          <summary
            className="channel-sidebar__group-summary"
            onClick={(e) => { e.preventDefault(); setTextOpen(!textOpen); }}
          >
            <span className="channel-sidebar__group-label">Text Channels</span>
            <span className={`material-symbols-outlined channel-sidebar__group-chevron ${textOpen ? 'channel-sidebar__group-chevron--open' : ''}`}>
              expand_more
            </span>
          </summary>
          {textOpen && (
            <div className="channel-sidebar__group-items">
              {channels.map((ch) => (
                <div
                  key={ch.channelId}
                  className={`channel-sidebar__channel ${selectedChannelId === ch.channelId ? 'channel-sidebar__channel--active' : ''}`}
                  onClick={() => onSelectChannel(ch)}
                >
                  <span className="material-symbols-outlined channel-sidebar__channel-icon">tag</span>
                  {editingChannel === ch.channelId ? (
                    <input
                      className="channel-sidebar__channel-edit-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleSaveEdit(ch)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(ch)}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <p className={`channel-sidebar__channel-name ${selectedChannelId === ch.channelId ? 'channel-sidebar__channel-name--active' : ''}`}>
                      {ch.name}
                    </p>
                  )}
                  {canManage && selectedChannelId === ch.channelId && editingChannel !== ch.channelId && (
                    <div className="channel-sidebar__channel-actions">
                      <button onClick={(e) => handleStartEdit(ch, e)} title="Edit">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                      </button>
                      <button onClick={(e) => handleDeleteChannel(ch.channelId, ch.clanId, e)} title="Delete">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {canManage && (showChannelInput ? (
                <div className="channel-sidebar__new-channel">
                  <input
                    className="channel-sidebar__new-channel-input"
                    placeholder="channel-name"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
                    autoFocus
                  />
                  <button onClick={handleCreateChannel} className="channel-sidebar__new-channel-confirm">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>
                  </button>
                  <button onClick={() => { setShowChannelInput(false); setNewChannelName(''); }} className="channel-sidebar__new-channel-cancel">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                  </button>
                </div>
              ) : (
                <button
                  className="channel-sidebar__add-channel-btn"
                  onClick={() => setShowChannelInput(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                  <span>Add Channel</span>
                </button>
              ))}
            </div>
          )}
        </details>

        {/* Voice Channels */}
        <details className="channel-sidebar__group" open={voiceOpen}>
          <summary
            className="channel-sidebar__group-summary"
            onClick={(e) => { e.preventDefault(); setVoiceOpen(!voiceOpen); }}
          >
            <span className="channel-sidebar__group-label">Voice Channels</span>
            <span className={`material-symbols-outlined channel-sidebar__group-chevron ${voiceOpen ? 'channel-sidebar__group-chevron--open' : ''}`}>
              expand_more
            </span>
          </summary>
          {voiceOpen && (
            <div className="channel-sidebar__group-items">
              {voiceChannels && voiceChannels.length > 0 && (
                voiceChannels.map((vc) => (
                  <div key={vc.voiceChannelId || vc.name}>
                    <div
                      className={`channel-sidebar__channel ${activeVoiceChannelId === vc.voiceChannelId ? 'channel-sidebar__channel--active' : ''}`}
                      onClick={() => onSelectVoiceChannel && onSelectVoiceChannel(vc)}
                    >
                      <span className="material-symbols-outlined channel-sidebar__channel-icon" style={{ color: activeVoiceChannelId === vc.voiceChannelId ? '#23a559' : undefined }}>volume_up</span>
                      {editingVoiceChannel === vc.voiceChannelId ? (
                        <input
                          className="channel-sidebar__channel-edit-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={() => handleSaveEditVoice(vc)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEditVoice(vc)}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p className={`channel-sidebar__channel-name ${activeVoiceChannelId === vc.voiceChannelId ? 'channel-sidebar__channel-name--active' : ''}`}>{vc.name}</p>
                      )}
                      {canManage && editingVoiceChannel !== vc.voiceChannelId && (
                        <div className="channel-sidebar__channel-actions">
                          <button onClick={(e) => handleStartEditVoice(vc, e)} title="Edit">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                          </button>
                          <button onClick={(e) => handleDeleteVoiceChannel(vc.voiceChannelId, vc.clanId, e)} title="Delete">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Ses kanalına bağlı kullanıcıları göster */}
                    {(() => {
                      const isActiveAndConnected =
                        activeVoiceChannelId === vc.voiceChannelId && voiceState?.participants;
                      const participants = isActiveAndConnected
                        ? voiceState.participants
                        : (voicePresence?.[vc.voiceChannelId] || []);

                      if (!participants.length) return null;

                      return (
                        <div className="voice-participants">
                          {isActiveAndConnected
                            ? participants.map((p) => (
                              <div
                                key={p.identity}
                                className={`voice-participants__item ${p.isSpeaking ? 'voice-participants__item--speaking' : ''}`}
                                onContextMenu={(e) => {
                                  if (!p.isLocal) {
                                    onParticipantContextMenu?.(e, p);
                                  }
                                }}
                                style={{ cursor: p.isLocal ? 'default' : 'context-menu' }}
                              >
                                <div className="voice-participants__avatar">
                                  <span>{(p.name || '?').charAt(0).toUpperCase()}</span>
                                  {p.isSpeaking && <div className="voice-participants__speaking-ring" />}
                                </div>
                                <span className="voice-participants__name">{p.name}</span>
                                {p.isMuted && (
                                  <span className="material-symbols-outlined voice-participants__muted-icon">mic_off</span>
                                )}
                                {p.isScreenSharing && !p.isLocal && (
                                  <button
                                    className="voice-participants__share-btn"
                                    title={`${p.name}'in ekranını izle`}
                                    onClick={(e) => { e.stopPropagation(); onWatchScreenShare?.(p.identity); }}
                                  >
                                    <span className="material-symbols-outlined">present_to_all</span>
                                  </button>
                                )}
                                {p.isScreenSharing && p.isLocal && (
                                  <span className="material-symbols-outlined voice-participants__share-active-icon" title="Ekranını paylaşıyor">
                                    present_to_all
                                  </span>
                                )}
                              </div>
                            ))
                            : participants.map((p) => (
                              <div key={p.userId} className="voice-participants__item">
                                <div className="voice-participants__avatar">
                                  <span>{(p.userName || '?').charAt(0).toUpperCase()}</span>
                                </div>
                                <span className="voice-participants__name">{p.userName}</span>
                              </div>
                            ))
                          }
                        </div>
                      );
                    })()}
                  </div>
                ))
              )}
              {canManage && (showVoiceChannelInput ? (
                <div className="channel-sidebar__new-channel">
                  <input
                    className="channel-sidebar__new-channel-input"
                    placeholder="voice-channel-name"
                    value={newVoiceChannelName}
                    onChange={(e) => setNewVoiceChannelName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateVoiceChannel()}
                    autoFocus
                  />
                  <button onClick={handleCreateVoiceChannel} className="channel-sidebar__new-channel-confirm">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>
                  </button>
                  <button onClick={() => { setShowVoiceChannelInput(false); setNewVoiceChannelName(''); }} className="channel-sidebar__new-channel-cancel">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                  </button>
                </div>
              ) : (
                <button
                  className="channel-sidebar__add-channel-btn"
                  onClick={() => setShowVoiceChannelInput(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                  <span>Add Channel</span>
                </button>
              ))}
            </div>
          )}
        </details>
      </div>

      {/* Screen Share Status Bar - voice status panelinin ÜSTÜNDE */}
      <ScreenShareStatusBar
        activeVoiceChannel={activeVoiceChannel}
        voiceState={voiceState}
      />

      {/* Voice Connection Panel - Discord tarzı bağlantı durumu */}
      {activeVoiceChannel && voiceState && (
        <div className="voice-status-panel">
          <div className="voice-status-panel__info">
            <div className="voice-status-panel__signal">
              <span className="material-symbols-outlined voice-status-panel__signal-icon">cell_tower</span>
              <span className="voice-status-panel__label">Ses Bağlantısı</span>
            </div>
            <p className="voice-status-panel__channel-name">{activeVoiceChannel.name}</p>
          </div>
          <div className="voice-status-panel__actions">
            <button
              className="voice-status-panel__btn"
              onClick={() => onDisconnectVoice?.()}
              title="Bağlantıyı Kes"
            >
              <span className="material-symbols-outlined" style={{ color: '#ed4245' }}>call_end</span>
            </button>
          </div>
        </div>
      )}

      {/* User Control Bar */}
      {user && (
        <div className="channel-sidebar__user-bar">
          <div
            className="channel-sidebar__user-info"
            onClick={() => setShowUserMenu(!showUserMenu)}
            ref={userMenuRef}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            <div className="channel-sidebar__user-avatar-wrapper">
              <div className="channel-sidebar__user-avatar">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="avatar" className="channel-sidebar__user-avatar-img" />
                ) : (
                  <span>{user.userName?.charAt(0)?.toUpperCase() || '?'}</span>
                )}
              </div>
              <div className="channel-sidebar__user-status-dot" />
            </div>
            <div>
              <p className="channel-sidebar__user-name">{user.userName || 'User'}</p>
              <p className="channel-sidebar__user-status">Online</p>
            </div>

            {showUserMenu && (
              <div className="channel-sidebar__user-dropdown">
                <button className="channel-sidebar__user-dropdown-item" onClick={onLogout}>
                  <span className="material-symbols-outlined">logout</span>
                  Çıkış Yap
                </button>
              </div>
            )}
          </div>
          <div className="channel-sidebar__user-actions">
            {/* Microphone button + settings */}
            <div className="channel-sidebar__audio-control" ref={micSettingsRef}>
              <button
                className={`channel-sidebar__user-action-btn ${isMicMuted ? 'channel-sidebar__user-action-btn--muted' : ''}`}
                title={isMicMuted ? 'Mikrofonu Aç' : 'Sustur'}
                onClick={onToggleMic}
              >
                <span className="material-symbols-outlined">
                  {isMicMuted ? 'mic_off' : 'mic'}
                </span>
              </button>
              <button
                className="channel-sidebar__audio-settings-btn"
                title="Mikrofon Ayarları"
                onClick={async () => {
                  if (!showMicSettings) {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                      stream.getTracks().forEach(t => t.stop());
                      await loadDevices();
                    } catch { /* izin reddedildi */ }
                  }
                  setShowMicSettings(!showMicSettings);
                  setShowHeadphoneSettings(false);
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>expand_less</span>
              </button>
              {showMicSettings && (
                <div className="audio-settings-menu audio-settings-menu--mic">
                  <h4 className="audio-settings-menu__title">Giriş Ayarları</h4>
                  <label className="audio-settings-menu__label">Giriş Aygıtı</label>
                  <select
                    className="audio-settings-menu__select"
                    value={selectedInputDevice}
                    onChange={(e) => setSelectedInputDevice(e.target.value)}
                  >
                    <option value="">Varsayılan</option>
                    {audioInputDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Mikrofon ${d.deviceId.slice(0, 5)}`}</option>
                    ))}
                  </select>
                  <label className="audio-settings-menu__label">Giriş Sesi — {inputVolume}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={inputVolume}
                    onChange={(e) => setInputVolume(Number(e.target.value))}
                    className="audio-settings-menu__slider"
                  />
                </div>
              )}
            </div>

            {/* Headphone button + settings */}
            <div className="channel-sidebar__audio-control" ref={headphoneSettingsRef}>
              <button
                className={`channel-sidebar__user-action-btn ${isDeafened ? 'channel-sidebar__user-action-btn--muted' : ''}`}
                title={isDeafened ? 'Sesi Aç' : 'Sesi Kapat'}
                onClick={handleToggleDeafen}
              >
                <span className="material-symbols-outlined">
                  {isDeafened ? 'headset_off' : 'headphones'}
                </span>
              </button>
              <button
                className="channel-sidebar__audio-settings-btn"
                title="Ses Çıkış Ayarları"
                onClick={() => { setShowHeadphoneSettings(!showHeadphoneSettings); setShowMicSettings(false); }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>expand_less</span>
              </button>
              {showHeadphoneSettings && (
                <div className="audio-settings-menu audio-settings-menu--headphone">
                  <h4 className="audio-settings-menu__title">Çıkış Ayarları</h4>
                  <label className="audio-settings-menu__label">Çıkış Aygıtı</label>
                  <select
                    className="audio-settings-menu__select"
                    value={selectedOutputDevice}
                    onChange={(e) => setSelectedOutputDevice(e.target.value)}
                  >
                    <option value="">Varsayılan</option>
                    {audioOutputDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Hoparlör ${d.deviceId.slice(0, 5)}`}</option>
                    ))}
                  </select>
                  <label className="audio-settings-menu__label">Çıkış Sesi — {outputVolume}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={outputVolume}
                    onChange={(e) => setOutputVolume(Number(e.target.value))}
                    className="audio-settings-menu__slider"
                  />
                  <label className="audio-settings-menu__label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                    <input
                      type="checkbox"
                      checked={!messageNotificationsMuted}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setMessageNotificationsMuted(!enabled);
                        setMessageNotificationsMutedState(!enabled);
                      }}
                    />
                    Mesaj bildirimleri
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default ChannelSidebar;
