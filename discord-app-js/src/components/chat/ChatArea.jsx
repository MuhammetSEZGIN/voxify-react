import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import MessageService from '../../services/MessageService';
import MemberList from '../clan/MemberList';
import ClanService from '../../services/ClanService';
import { canDeleteMessage, canEditMessage } from '../../utils/permissions';

function ChatArea({ clan, channel }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Kanal değiştiğinde mesajları yükle
  useEffect(() => {
    if (!channel) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const data = await MessageService.getMessagesByChannelId(channel.channelId);
        setMessages(Array.isArray(data) ? data : data?.items || []);
      } catch (error) {
        console.error('Failed to fetch messages', error);
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [channel?.channelId]);

  // Klan değiştiğinde üyeleri yükle
  useEffect(() => {
    if (!clan) {
      setMembers([]);
      return;
    }

    const fetchMembers = async () => {
      try {
        const data = await ClanService.getClanMembers(clan.clanId);
        setMembers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch members', error);
        setMembers([]);
      }
    };

    fetchMembers();
  }, [clan?.clanId]);

  // Yeni mesaj geldiğinde en alta scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Mesaj gönder
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !channel || sending) return;

    setSending(true);
    try {
      const sent = await MessageService.sendMessage({
        content: newMessage.trim(),
        channelId: channel.channelId,
      });
      setMessages((prev) => [...prev, sent]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message', error);
    } finally {
      setSending(false);
    }
  };

  // Mesaj sil
  const handleDeleteMessage = async (messageId) => {
    try {
      await MessageService.deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
    } catch (error) {
      console.error('Failed to delete message', error);
    }
  };

  // Mesaj düzenlemeye başla
  const handleStartEdit = (message) => {
    setEditingMessageId(message.messageId);
    setEditContent(message.content);
  };

  // Mesaj düzenlemeyi kaydet
  const handleSaveEdit = async (messageId) => {
    if (!editContent.trim()) return;
    try {
      const updated = await MessageService.editMessage({
        messageId,
        content: editContent.trim(),
      });
      setMessages((prev) =>
        prev.map((m) => (m.messageId === messageId ? { ...m, ...updated } : m))
      );
      setEditingMessageId(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to edit message', error);
    }
  };

  // Düzenlemeyi iptal et
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  // Enter ile gönder, Shift+Enter ile yeni satır
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Düzenleme inputunda Enter = kaydet, Escape = iptal
  const handleEditKeyDown = (e, messageId) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit(messageId);
    }
    if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Clan seçilmemiş
  if (!clan) {
    return (
      <div className="chat-area">
        <div className="dashboard-welcome">
          <div className="dashboard-welcome__icon">🎧</div>
          <h2>SesVer&apos;e Hoş Geldiniz!</h2>
          <p>Sol panelden bir sunucu seçin, ardından bir metin kanalına tıklayarak sohbete başlayın.</p>
        </div>
      </div>
    );
  }

  // Kanal seçilmemiş
  if (!channel) {
    return (
      <div className="chat-area-wrapper">
        <div className="chat-area">
          <div className="dashboard-welcome">
            <div className="dashboard-welcome__icon">💬</div>
            <h2>{clan.name}</h2>
            <p>Bir metin kanalı seçerek sohbete başlayın.</p>
          </div>
        </div>
        <MemberList members={members} clanId={clan.clanId} />
      </div>
    );
  }

  return (
    <div className="chat-area-wrapper">
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
        <div className="chat-area__messages" ref={messagesContainerRef}>
          <div className="chat-area__welcome">
            <div className="chat-area__welcome-icon">#</div>
            <h2>#{channel.name} kanalına hoş geldiniz!</h2>
            <p>Bu, #{channel.name} kanalının başlangıcıdır.</p>
          </div>

          {loading && (
            <div className="chat-area__loading">Mesajlar yükleniyor...</div>
          )}

          {!loading && messages.length === 0 && (
            <div className="chat-area__no-messages">
              Henüz mesaj yok. İlk mesajı siz gönderin! 🎉
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble
              key={message.messageId}
              message={message}
              currentUser={user}
              clanId={clan.clanId}
              isEditing={editingMessageId === message.messageId}
              editContent={editContent}
              onEditContentChange={setEditContent}
              onStartEdit={handleStartEdit}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onDelete={handleDeleteMessage}
              onEditKeyDown={handleEditKeyDown}
            />
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form className="chat-input" onSubmit={handleSendMessage}>
          <div className="chat-input__wrapper">
            <button type="button" className="chat-input__attach-btn" title="Dosya ekle">
              +
            </button>
            <textarea
              className="chat-input__textarea"
              placeholder={`#${channel.name} kanalına mesaj gönder`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={sending}
            />
            <button
              type="submit"
              className="chat-input__send-btn"
              disabled={!newMessage.trim() || sending}
              title="Gönder"
            >
              ➤
            </button>
          </div>
        </form>
      </div>

      {/* Sağ taraf: Üye listesi */}
      <MemberList members={members} clanId={clan.clanId} />
    </div>
  );
}

function MessageBubble({
  message,
  currentUser,
  clanId,
  isEditing,
  editContent,
  onEditContentChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditKeyDown,
}) {
  const authorId = message.userId || message.user?.id;
  const authorName = message.user?.username || message.username || 'Bilinmeyen';
  const timestamp = message.createdAt
    ? new Date(message.createdAt).toLocaleString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

  const showDelete = canDeleteMessage(currentUser, clanId, authorId);
  const showEdit = canEditMessage(currentUser, authorId);

  return (
    <div className="message">
      <div className="message__avatar">
        {authorName.charAt(0).toUpperCase()}
      </div>
      <div className="message__body">
        <div className="message__header">
          <span className="message__author">{authorName}</span>
          <span className="message__timestamp">{timestamp}</span>
        </div>

        {isEditing ? (
          <div className="message__edit">
            <textarea
              className="message__edit-input"
              value={editContent}
              onChange={(e) => onEditContentChange(e.target.value)}
              onKeyDown={(e) => onEditKeyDown(e, message.messageId)}
              rows={1}
              autoFocus
            />
            <div className="message__edit-actions">
              <span className="message__edit-hint">
                escape ile <button type="button" onClick={onCancelEdit}>iptal</button> · enter ile{' '}
                <button type="button" onClick={() => onSaveEdit(message.messageId)}>kaydet</button>
              </span>
            </div>
          </div>
        ) : (
          <div className="message__content">
            {message.content}
            {message.isEdited && <span className="message__edited">(düzenlendi)</span>}
          </div>
        )}
      </div>

      {/* Aksiyon butonları - hover'da görünecek */}
      {!isEditing && (
        <div className="message__actions">
          {showEdit && (
            <button
              className="message__action-btn"
              onClick={() => onStartEdit(message)}
              title="Düzenle"
            >
              ✏️
            </button>
          )}
          {showDelete && (
            <button
              className="message__action-btn message__action-btn--danger"
              onClick={() => onDelete(message.messageId)}
              title="Sil"
            >
              🗑️
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ChatArea;