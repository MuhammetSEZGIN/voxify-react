import React, { useState, useEffect, useRef } from 'react';
import MessageService from '../../services/MessageService';
import SignalRService from '../../services/LiveMessageService';
import { useAuth } from '../../hooks/useAuth';

/**
 * 1:1 DM sohbet paneli. `ChatArea.jsx`'in temel mesajlaşma akışını (yükle,
 * SignalR ile katıl/gönder/al) DM konuşmaları için tekrar kullanır, ama
 * clan-only özellikleri (GIF/dosya yükleme, düzenleme/silme, masaüstü bildirim)
 * içermez — bunlar backend DM route'u doğrulandıktan sonra eklenebilir.
 *
 * NOT: DM mesaj geçmişi/gönderme route'u backend'de henüz doğrulanmadı
 * (bkz. guncelleme-plani.md madde 3). `MessageService.getMessagesByChannelId`
 * ve `SignalRService.sendMessage` clanId=null ile çağrılıyor.
 */
function DmChatArea({ conversation, onBack }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [sendError, setSendError] = useState(null);
  const messagesEndRef = useRef(null);
  const prevConversationIdRef = useRef(null);

  const currentUserId = user?.id || user?.sub || '';
  const conversationId = conversation?.conversationId;

  useEffect(() => {
    if (!token) return;
    SignalRService.startConnection(token).catch((err) => {
      console.error('SignalR connection failed:', err);
    });
  }, [token]);

  useEffect(() => {
    const prevId = prevConversationIdRef.current;
    if (prevId && prevId !== conversationId) {
      SignalRService.leaveChannel(prevId);
    }
    prevConversationIdRef.current = conversationId;

    if (!conversationId) {
      setMessages([]);
      return;
    }

    SignalRService.joinChannel(conversationId).catch((err) => {
      console.error('Failed to join DM conversation:', err);
    });

    setLoading(true);
    setLoadError(null);
    MessageService.getMessagesByChannelId(conversationId, null, 1, 50)
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.$values || data?.messages || [];
        setMessages(list.map(normalizeMessage));
      })
      .catch((err) => {
        console.error('Failed to load DM messages:', err);
        setLoadError('Mesajlar yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, [conversationId]);

  useEffect(() => {
    const handleReceive = (...args) => {
      let normalized;
      if (args.length === 1 && typeof args[0] === 'object') {
        normalized = normalizeMessage(args[0]);
      } else if (args.length >= 3) {
        normalized = {
          messageId: crypto.randomUUID(),
          channelId: args[0],
          content: args[args.length - 1],
          senderId: '',
          userName: '',
          createdAt: new Date().toISOString(),
        };
      } else {
        return;
      }
      if (normalized.channelId && normalized.channelId !== conversationId) return;

      setMessages((prev) => {
        const optimisticIdx = prev.findIndex((m) => m._optimistic && m.content === normalized.content);
        if (optimisticIdx !== -1) {
          const updated = [...prev];
          updated[optimisticIdx] = normalized;
          return updated;
        }
        if (prev.some((m) => m.messageId === normalized.messageId)) return prev;
        return [...prev, normalized];
      });
    };

    SignalRService.on('ReceiveMessage', handleReceive);
    return () => SignalRService.off('ReceiveMessage', handleReceive);
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  function normalizeMessage(msg) {
    const messageId = msg.messageId
      || (typeof msg.id === 'object' && msg.id !== null ? msg.id.$oid : msg.id)
      || msg.Id
      || crypto.randomUUID();
    return {
      messageId,
      content: msg.content || msg.Content || msg.text || msg.Text || msg.message || msg.Message || '',
      userName: msg.userName || msg.UserName || msg.senderName || msg.SenderName || 'Unknown',
      senderId: msg.senderId || msg.SenderId || msg.userId || msg.UserId || '',
      avatarUrl: msg.avatarUrl || msg.AvatarUrl || null,
      createdAt: msg.createdAt || msg.CreatedAt || msg.sentAt || msg.SentAt || new Date().toISOString(),
      channelId: msg.channelId || msg.ChannelId || conversationId,
    };
  }

  const handleSend = async (e) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !conversationId) return;

    const optimisticMsg = {
      messageId: `temp-${Date.now()}`,
      content,
      userName: user?.userName || user?.username || user?.name || 'Sen',
      senderId: currentUserId,
      avatarUrl: user?.avatarUrl || null,
      createdAt: new Date().toISOString(),
      channelId: conversationId,
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setNewMessage('');

    try {
      await SignalRService.sendMessage(conversationId, null, content);
    } catch (err) {
      console.error('Failed to send DM:', err);
      setMessages((prev) => prev.filter((m) => m.messageId !== optimisticMsg.messageId));
      setSendError('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
      setTimeout(() => setSendError(null), 5000);
    }
  };

  if (!conversation) return null;

  return (
    <div className="chat-area">
      <header className="chat-area__header">
        <div className="chat-area__header-info">
          <button className="friends-panel__action-btn" onClick={onBack} title="Geri" style={{ marginRight: 8 }}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <span className="chat-area__header-hash">@</span>
          <h2 className="chat-area__header-name">{conversation.otherUserName || 'DM'}</h2>
        </div>
      </header>

      <div className="chat-area__messages">
        {loading && <p className="friends-panel__empty">Mesajlar yükleniyor...</p>}
        {loadError && <p className="account-settings__error">{loadError}</p>}
        {!loading && messages.length === 0 && (
          <p className="friends-panel__empty">Henüz mesaj yok. İlk mesajı gönder!</p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.senderId === currentUserId;
          return (
            <div key={msg.messageId} className={`chat-area__message-group ${isOwn ? 'chat-area__message-group--own' : ''}`}>
              <div className="chat-area__message-content">
                <div className="chat-area__message-header">
                  <p className="chat-area__message-author">{msg.userName}</p>
                  <p className="chat-area__message-time">
                    {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="chat-area__message-text">{msg.content}</div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {sendError && <p className="account-settings__error" style={{ padding: '0 16px' }}>{sendError}</p>}

      <form className="chat-area__input-bar" onSubmit={handleSend}>
        <input
          className="chat-area__input"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={`@${conversation.otherUserName || ''} kullanıcısına mesaj gönder`}
        />
        <button type="submit" className="chat-area__input-action-btn" title="Gönder" disabled={!newMessage.trim()}>
          <span className="material-symbols-outlined">send</span>
        </button>
      </form>
    </div>
  );
}

export default DmChatArea;
