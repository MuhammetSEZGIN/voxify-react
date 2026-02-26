import React, { useState } from 'react';

function ChannelSidebar({ clan, channels, voiceChannels, selectedChannelId, onSelectChannel, user, onLogout, onCreateChannel, onUpdateChannel, onDeleteChannel }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [hoveredChannelId, setHoveredChannelId] = useState(null);

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
        <>
          <div className="channel-sidebar__category">
            <span className="channel-sidebar__category-icon">▾</span>
            <span className="channel-sidebar__category-text">Metin Kanalları</span>
            <button
              className="channel-sidebar__add-btn"
              onClick={() => setShowCreateModal(true)}
              title="Kanal Ekle"
            >
              +
            </button>
          </div>
          {channels.map((channel) => (
            <div
              key={channel.channelId}
              className={`channel-item ${selectedChannelId === channel.channelId ? 'channel-item--active' : ''}`}
              onClick={() => onSelectChannel(channel)}
              onMouseEnter={() => setHoveredChannelId(channel.channelId)}
              onMouseLeave={() => setHoveredChannelId(null)}
            >
              <span className="channel-item__icon">#</span>
              <span className="channel-item__name">{channel.name}</span>
              {hoveredChannelId === channel.channelId && (
                <div className="channel-item__actions">
                  <button
                    className="channel-item__action-btn"
                    onClick={(e) => { e.stopPropagation(); setEditingChannel(channel); }}
                    title="Düzenle"
                  >
                    ✏️
                  </button>
                  <button
                    className="channel-item__action-btn channel-item__action-btn--delete"
                    onClick={(e) => { e.stopPropagation(); onDeleteChannel(channel.channelId); }}
                    title="Sil"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))}
        </>

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

      {/* Create Channel Modal */}
      {showCreateModal && (
        <ChannelModal
          title="Kanal Oluştur"
          onClose={() => setShowCreateModal(false)}
          onSubmit={(name) => {
            onCreateChannel(name);
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Edit Channel Modal */}
      {editingChannel && (
        <ChannelModal
          title="Kanalı Düzenle"
          defaultValue={editingChannel.name}
          onClose={() => setEditingChannel(null)}
          onSubmit={(name) => {
            onUpdateChannel({ channelId: editingChannel.channelId, name });
            setEditingChannel(null);
          }}
        />
      )}
    </div>
  );
}

function ChannelModal({ title, defaultValue = '', onClose, onSubmit }) {
  const [name, setName] = useState(defaultValue);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>{title}</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <label className="modal__label">Kanal Adı</label>
            <input
              className="modal__input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="kanal-adı"
              autoFocus
            />
          </div>
          <div className="modal__footer">
            <button type="button" className="modal__btn modal__btn--cancel" onClick={onClose}>İptal</button>
            <button type="submit" className="modal__btn modal__btn--submit">Kaydet</button>
          </div>
        </form>
      </div>
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