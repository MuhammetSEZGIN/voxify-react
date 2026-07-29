import React, { useState } from 'react';
import VoiceSessionPanel from '../voicechannel/VoiceSessionPanel';

/**
 * NOT: Kullanıcı çubuğu (avatar + mikrofon/kulaklık/ses ayarları) artık burada
 * değil — `layout/UserBar.jsx` olarak ayrıldı ve MainLayout'ta floating olarak
 * tek bir kez render ediliyor. Sidebar'ın altındaki boşluk `.channel-sidebar`
 * padding'i ile ayrılır (bkz. discord.css `--user-bar-height`).
 */
function ChannelSidebar({
  clan,
  channels,
  voiceChannels,
  selectedChannelId,
  activeVoiceChannelId,
  onSelectChannel,
  onSelectVoiceChannel,
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
  currentUserId,
  userRole,
  onLeaveClan,
  onOpenClanSettings,
  headerAccessory,
  onWatchScreenShare,
  onParticipantContextMenu,
  isClanMuted = false,
  onToggleClanMute,
  callPanel,
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

  if (!clan) {
    return (
      <aside className="channel-sidebar">
        <header className="channel-sidebar__header">
          <h1 className="channel-sidebar__title">Voxify</h1>
          <div className="channel-sidebar__header-actions">
            {headerAccessory}
          </div>
        </header>
        <div className="channel-sidebar__empty">
          <p className="channel-sidebar__empty-text">Select a clan to see channels</p>
        </div>
        {/* DM görüşmesi klan seçili değilken de sürebilir — bağlantıyı kesme
            yolu her zaman görünür olmalı. */}
        <VoiceSessionPanel
          activeVoiceChannel={activeVoiceChannel}
          voiceState={voiceState}
          onDisconnectVoice={onDisconnectVoice}
          onWatchScreenShare={onWatchScreenShare}
        />
        {callPanel}
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

  return (
    <aside className="channel-sidebar">
      {/* Clan Header */}
      <header className="channel-sidebar__header">
        <h1 className="channel-sidebar__title">{clan.name}</h1>
        <div className="channel-sidebar__header-actions">
          {headerAccessory}
          <div className="channel-sidebar__header-menu-wrapper">
            <button className="channel-sidebar__header-btn" onClick={() => setShowClanMenu(!showClanMenu)}>
              <span className="material-symbols-outlined">{showClanMenu ? 'close' : 'expand_more'}</span>
            </button>
            {showClanMenu && (
              <div className="clan-dropdown-menu">
                <button
                  className="clan-dropdown-menu__item"
                  onClick={() => { setShowClanMenu(false); onToggleClanMute?.(); }}
                >
                  <span className="material-symbols-outlined">
                    {isClanMuted ? 'notifications_active' : 'notifications_off'}
                  </span>
                  <span>{isClanMuted ? 'Klan Bildirimlerini Aç' : 'Klanı Sessize Al'}</span>
                </button>
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
                                    onParticipantContextMenu?.(e, {
                                      ...p,
                                      voiceChannelId: vc.voiceChannelId,
                                      clanId: vc.clanId || clan?.clanId,
                                    });
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
                                {!p.isLocal && (
                                  <button
                                    type="button"
                                    className="voice-participants__mobile-actions-btn"
                                    aria-label={`${p.name} için ses ayarlarını aç`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onParticipantContextMenu?.(event, {
                                        ...p,
                                        voiceChannelId: vc.voiceChannelId,
                                        clanId: vc.clanId || clan?.clanId,
                                      });
                                    }}
                                  >
                                    <span className="material-symbols-outlined">more_vert</span>
                                  </button>
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
                              <div
                                key={p.userId}
                                className="voice-participants__item"
                                onContextMenu={(event) => {
                                  const isCurrentUser = String(p.userId || '').toLowerCase()
                                    === String(currentUserId || '').toLowerCase();
                                  if (!canManage || isCurrentUser) return;
                                  onParticipantContextMenu?.(event, {
                                    identity: p.userId,
                                    name: p.userName,
                                    isLocal: false,
                                    presenceOnly: true,
                                    voiceChannelId: vc.voiceChannelId,
                                    clanId: vc.clanId || clan?.clanId,
                                  });
                                }}
                                style={{
                                  cursor: canManage && String(p.userId || '').toLowerCase()
                                    !== String(currentUserId || '').toLowerCase()
                                    ? 'context-menu'
                                    : 'default',
                                }}
                              >
                                <div className="voice-participants__avatar">
                                  <span>{(p.userName || '?').charAt(0).toUpperCase()}</span>
                                </div>
                                <span className="voice-participants__name">{p.userName}</span>
                                {canManage && String(p.userId || '').toLowerCase()
                                  !== String(currentUserId || '').toLowerCase() && (
                                  <button
                                    type="button"
                                    className="voice-participants__mobile-actions-btn"
                                    aria-label={`${p.userName} için işlemleri aç`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onParticipantContextMenu?.(event, {
                                        identity: p.userId,
                                        name: p.userName,
                                        isLocal: false,
                                        presenceOnly: true,
                                        voiceChannelId: vc.voiceChannelId,
                                        clanId: vc.clanId || clan?.clanId,
                                      });
                                    }}
                                  >
                                    <span className="material-symbols-outlined">more_vert</span>
                                  </button>
                                )}
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

      <VoiceSessionPanel
        activeVoiceChannel={activeVoiceChannel}
        voiceState={voiceState}
        onDisconnectVoice={onDisconnectVoice}
        onWatchScreenShare={onWatchScreenShare}
      />
      {callPanel}

    </aside>
  );
}

export default ChannelSidebar;
