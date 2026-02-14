import React from 'react';

function ChannelSidebar({ clan, channels, voiceChannels, selectedChannelId, onSelectChannel, user, onLogout }) {
  if (!clan) {
    return (
      <div className="channel-sidebar">
        <div className="channel-sidebar__header">SesVer</div>
        <div className="channel-sidebar__content">
          <div className="no-clan-message">
            <div className="no-clan-message__icon">👈</div>
            <p>Sol panelden bir sunucu seçin</p>
          </div>
        </div>
        <UserPanel user={user} onLogout={onLogout} />
      </div>
    );
  }

  return (
    <div className="channel-sidebar">
      <div className="channel-sidebar__header">
        {clan.name}
      </div>

      <div className="channel-sidebar__content">
        {/* Text Channels */}
        {channels.length > 0 && (
          <>
            <div className="channel-sidebar__category">
              <span className="channel-sidebar__category-icon">▾</span>
              <span className="channel-sidebar__category-text">Metin Kanalları</span>
            </div>
            {channels.map((channel) => (
              <div
                key={channel.channelId}
                className={`channel-item ${selectedChannelId === channel.channelId ? 'channel-item--active' : ''}`}
                onClick={() => onSelectChannel(channel)}
              >
                <span className="channel-item__icon">#</span>
                <span className="channel-item__name">{channel.name}</span>
              </div>
            ))}
          </>
        )}

        {/* Voice Channels */}
        {voiceChannels.length > 0 && (
          <>
            <div className="channel-sidebar__category">
              <span className="channel-sidebar__category-icon">▾</span>
              <span className="channel-sidebar__category-text">Sesli Kanallar</span>
            </div>
            {voiceChannels.map((vc) => (
              <div key={vc.voiceChannelId} className="channel-item">
                <span className="channel-item__icon">🔊</span>
                <span className="channel-item__name">{vc.name}</span>
                <span className={`voice-channel__status ${vc.isActive ? 'voice-channel__status--active' : ''}`}>
                  {vc.isActive ? `${vc.maxParticipants} kişi` : 'Pasif'}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      <UserPanel user={user} onLogout={onLogout} />
    </div>
  );
}

function UserPanel({ user, onLogout }) {
  return (
    <div className="user-panel">
      <div className="user-panel__avatar">
        {user?.username?.charAt(0)?.toUpperCase() || '?'}
      </div>
      <div className="user-panel__info">
        <div className="user-panel__username">{user?.username || 'Kullanıcı'}</div>
        <div className="user-panel__status">Çevrimiçi</div>
      </div>
      <div className="user-panel__actions">
        <button className="user-panel__btn user-panel__btn--logout" onClick={onLogout} title="Çıkış Yap">
          ⏻
        </button>
      </div>
    </div>
  );
}

export default ChannelSidebar;