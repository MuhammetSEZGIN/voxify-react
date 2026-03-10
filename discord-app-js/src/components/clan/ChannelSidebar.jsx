import React, { useState } from 'react';

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
  voiceState,
  activeVoiceChannel,
  onDisconnectVoice,
  canManage,
  userRole,
  onLeaveClan,
  onOpenClanSettings,
}) {
  const [textOpen, setTextOpen] = useState(true);
  const [voiceOpen, setVoiceOpen] = useState(true);
  const [showChannelInput, setShowChannelInput] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [showVoiceChannelInput, setShowVoiceChannelInput] = useState(false);
  const [newVoiceChannelName, setNewVoiceChannelName] = useState('');
  const [editingChannel, setEditingChannel] = useState(null);
  const [editName, setEditName] = useState('');
  const [showClanMenu, setShowClanMenu] = useState(false);

  if (!clan) {
    return (
      <aside className="channel-sidebar">
        <header className="channel-sidebar__header">
          <h1 className="channel-sidebar__title">SesVer</h1>
        </header>
        <div className="channel-sidebar__empty">
          <p className="channel-sidebar__empty-text">Select a clan to see channels</p>
        </div>
        {user && (
          <div className="channel-sidebar__user-bar">
            <div className="channel-sidebar__user-info">
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
            </div>
            <div className="channel-sidebar__user-actions">
              <button className="channel-sidebar__user-action-btn" title="Microphone">
                <span className="material-symbols-outlined">mic</span>
              </button>
              <button className="channel-sidebar__user-action-btn" title="Headphones">
                <span className="material-symbols-outlined">headphones</span>
              </button>
              <button className="channel-sidebar__user-action-btn" onClick={onLogout} title="Logout" style={{ color: '#ed4245' }}>
                <span className="material-symbols-outlined">logout</span>
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
      onUpdateChannel(channel.channelId, editName.trim());
    }
    setEditingChannel(null);
  };

  const handleDeleteChannel = (channelId, e) => {
    e.stopPropagation();
    onDeleteChannel(channelId);
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
                      <button onClick={(e) => handleDeleteChannel(ch.channelId, e)} title="Delete">
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
                      <p className={`channel-sidebar__channel-name ${activeVoiceChannelId === vc.voiceChannelId ? 'channel-sidebar__channel-name--active' : ''}`}>{vc.name}</p>
                    </div>
                    {/* Ses kanalına bağlı kullanıcıları göster */}
                    {activeVoiceChannelId === vc.voiceChannelId && voiceState?.participants && (
                      <div className="voice-participants">
                        {voiceState.participants.map((p) => (
                          <div key={p.identity} className={`voice-participants__item ${p.isSpeaking ? 'voice-participants__item--speaking' : ''}`}>
                            <div className="voice-participants__avatar">
                              <span>{(p.name || '?').charAt(0).toUpperCase()}</span>
                              {p.isSpeaking && <div className="voice-participants__speaking-ring" />}
                            </div>
                            <span className="voice-participants__name">{p.name}</span>
                            {p.isMuted && (
                              <span className="material-symbols-outlined voice-participants__muted-icon">mic_off</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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
          <div className="channel-sidebar__user-info">
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
          </div>
          <div className="channel-sidebar__user-actions">
            <button
              className={`channel-sidebar__user-action-btn ${voiceState?.isMuted ? 'channel-sidebar__user-action-btn--muted' : ''}`}
              title={voiceState ? (voiceState.isMuted ? 'Mikrofonu Aç' : 'Sustur') : 'Mikrofon'}
              onClick={() => voiceState?.toggleMute?.()}
              disabled={!voiceState}
            >
              <span className="material-symbols-outlined">
                {voiceState?.isMuted ? 'mic_off' : 'mic'}
              </span>
            </button>
            <button className="channel-sidebar__user-action-btn" title="Headphones">
              <span className="material-symbols-outlined">headphones</span>
            </button>
            <button className="channel-sidebar__user-action-btn" onClick={onLogout} title="Logout" style={{ color: '#ed4245' }}>
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

export default ChannelSidebar;