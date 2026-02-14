import React from 'react';

function ChatArea({ clan, channel }) {
  if (!clan) {
    return (
      <div className="chat-area">
        <div className="dashboard-welcome">
          <div className="dashboard-welcome__icon">🎧</div>
          <h2>SesVer'e Hoş Geldiniz!</h2>
          <p>Sol panelden bir sunucu seçin, ardından bir metin kanalına tıklayarak sohbete başlayın.</p>
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="chat-area">
        <div className="dashboard-welcome">
          <div className="dashboard-welcome__icon">💬</div>
          <h2>{clan.name}</h2>
          <p>Bir metin kanalı seçerek sohbete başlayın.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-area">
      {/* Chat Header */}
      <div className="chat-area__header">
        <span className="chat-area__header-icon">#</span>
        <span className="chat-area__header-name">{channel.name}</span>
        <div className="chat-area__header-divider" />
        <span className="chat-area__header-topic">
          {clan.name} sunucusundaki #{channel.name} kanalına hoş geldiniz
        </span>
      </div>

      {/* Messages */}
      <div className="chat-area__messages">
        <div className="chat-area__welcome">
          <div className="chat-area__welcome-icon">#</div>
          <h2>#{channel.name} kanalına hoş geldiniz!</h2>
          <p>Bu, #{channel.name} kanalının başlangıcıdır.</p>
        </div>

        {/* TODO: Buraya mesajlar gelecek */}
      </div>
    </div>
  );
}

export default ChatArea;