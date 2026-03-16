import React, { useState, useEffect, useRef, useCallback } from 'react';
import MessageService from '../../services/MessageService';
import SignalRService from '../../services/LiveMessageService';
import { useAuth } from '../../hooks/useAuth';

function ChatArea({ clan, channel }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [sendError, setSendError] = useState(null);
  const sendErrorTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const observerTargetRef = useRef(null);
  const chatContainerRef = useRef(null);
  const prevChannelIdRef = useRef(null);

  // SignalR bağlantısını başlat (singleton — cleanup'ta kapatma)
  useEffect(() => {
    if (!token) return;

    SignalRService.startConnection(token).catch((err) => {
      console.error('SignalR connection failed:', err);
    });
    // Bağlantıyı burada kapatmıyoruz: modül seviyesinde singleton,
    // Strict Mode cleanup'ı negotiation'ı yarıda kesiyor.
  }, [token]);

  // Kanal değiştiğinde: eski kanaldan ayrıl, yeni kanala katıl, mesajları yükle
  useEffect(() => {
    const prevId = prevChannelIdRef.current;
    const newId = channel?.channelId;

    if (prevId && prevId !== newId) {
      SignalRService.leaveChannel(prevId);
    }

    prevChannelIdRef.current = newId;

    if (!newId) {
      setMessages([]);
      setHasMore(false);
      setPage(1);
      return;
    }

    SignalRService.joinChannel(newId).catch((err) => {
      console.error('Failed to join channel:', err);
    });

    setPage(1);
    setHasMore(true);
    loadMessages(newId, 1, true);
  }, [channel?.channelId]);

  // SignalR'dan gelen mesajları dinle
  useEffect(() => {
    const handleReceive = (...args) => {
      console.log('[SignalR] ReceiveMessage raw args:', args);
      let normalized;
      if (args.length === 1 && typeof args[0] === 'object') {
        // Tek parametre: MessageDto nesnesi
        normalized = normalizeMessage(args[0]);
      } else if (args.length >= 4) {
        // Çok parametreli: channelId, senderId, userName, message
        normalized = {
          messageId: crypto.randomUUID(),
          channelId: args[0],
          senderId: args[1],
          userName: args[2],
          content: args[3],
          createdAt: new Date().toISOString(),
          avatarUrl: null,
        };
      } else {
        console.warn('[SignalR] Beklenmeyen ReceiveMessage formatı:', args);
        return;
      }
      console.log('[SignalR] Normalized message:', normalized);

      setMessages((prev) => {
        // Optimistik mesajı bul ve gerçek mesajla değiştir
        const optimisticIdx = prev.findIndex(
          (m) => m._optimistic && m.content === normalized.content
        );
        if (optimisticIdx !== -1) {
          const updated = [...prev];
          updated[optimisticIdx] = normalized;
          return updated;
        }
        // Aynı messageId ile tekrar ekleme
        if (prev.some((m) => m.messageId === normalized.messageId)) {
          return prev;
        }
        return [...prev, normalized];
      });
    };

    const handleUpdated = (...args) => {
      console.log('[SignalR] MessageUpdated raw args:', args);
      const messageDto = args.length === 1 ? args[0] : args;
      const normalized = normalizeMessage(messageDto);
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === normalized.messageId ? normalized : m
        )
      );
    };

    SignalRService.on('ReceiveMessage', handleReceive);
    SignalRService.on('MessageUpdated', handleUpdated);

    return () => {
      SignalRService.off('ReceiveMessage', handleReceive);
      SignalRService.off('MessageUpdated', handleUpdated);
    };
  }, []);

  // Intersection Observer for pagination
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && channel?.channelId) {
          loadMoreMessages();
        }
      },
      { threshold: 1.0, rootMargin: '100px' }
    );

    if (observerTargetRef.current) {
      observer.observe(observerTargetRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, channel?.channelId, page]);

  useEffect(() => {
    if (page === 1) {
      scrollToBottom();
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * Mesaj nesnesini normalize et — farklı API/SignalR formatlarını
   * tek bir yapıya dönüştür.
   */
  const normalizeMessage = (msg) => {
    // id alanı nesne olabilir (MongoDB ObjectId: { timestamp, machine, pid, increment } veya { $oid })
    const messageId = msg.messageId
      || (typeof msg.id === 'object' && msg.id !== null
        ? (msg.id.$oid
            || `${msg.id.timestamp ?? ''}-${msg.id.machine ?? ''}-${msg.id.pid ?? ''}-${msg.id.increment ?? ''}`)
        : msg.id)
      || msg.Id
      || crypto.randomUUID();

    return {
      messageId,
      content: msg.text || msg.Text || msg.content || msg.Content || msg.message || msg.Message || '',
      userName: msg.userName || msg.UserName
        || msg.user?.userName || msg.user?.username || msg.user?.UserName
        || msg.senderName || msg.SenderName || 'Unknown',
      senderId: msg.senderId || msg.SenderId || msg.userId || msg.UserId || msg.user?.id || '',
      avatarUrl: msg.avatarUrl || msg.AvatarUrl || msg.user?.avatarUrl || null,
      createdAt: msg.createdAt || msg.CreatedAt || msg.sentAt || msg.SentAt || new Date().toISOString(),
      channelId: msg.channelId || msg.ChannelId || '',
    };
  };

  /**
   * Mesajları grupla: aynı kullanıcıdan 1 dakika içinde gelen mesajlar tek blok.
   */
  const groupMessages = (msgs) => {
    const groups = [];
    for (const msg of msgs) {
      const lastGroup = groups[groups.length - 1];
      if (
        lastGroup &&
        lastGroup.userName === msg.userName &&
        lastGroup.senderId === msg.senderId &&
        Math.abs(new Date(msg.createdAt) - new Date(lastGroup.messages[lastGroup.messages.length - 1].createdAt)) < 60000
      ) {
        lastGroup.messages.push(msg);
      } else {
        groups.push({
          userName: msg.userName,
          senderId: msg.senderId,
          avatarUrl: msg.avatarUrl,
          createdAt: msg.createdAt,
          messages: [msg],
        });
      }
    }
    return groups;
  };

  /**
   * API yanıtından mesaj listesini çıkar — .NET $values sarması dahil.
   */
  const extractMessages = (data) => {
    if (!data) return [];
    // $values sarması (System.Text.Json ReferenceHandler.Preserve)
    if (data.$values && Array.isArray(data.$values)) return data.$values;
    // Doğrudan dizi
    if (Array.isArray(data)) return data;
    // { messages: [...] } sarması
    if (data.messages && Array.isArray(data.messages)) return data.messages;
    if (data.Messages && Array.isArray(data.Messages)) return data.Messages;
    // { items: [...] } sarması
    if (data.items && Array.isArray(data.items)) return data.items;
    // Tek mesaj nesnesi
    if (data.messageId || data.id || data.content) return [data];
    console.warn('[ChatArea] Beklenmeyen mesaj formatı:', data);
    return [];
  };

  const loadMessages = async (channelId, pageNum = 1, isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      console.log(`Loading messages for channel: ${channelId}, page: ${pageNum}`);
      const data = await MessageService.getMessagesByChannelId(channelId, pageNum, 50);
      const rawMessages = extractMessages(data);
      
      // Assume no more messages if we get less than requested or 0
      if (rawMessages.length < 50) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      const normalized = rawMessages
        .map(normalizeMessage)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      if (isInitial) {
        setMessages(normalized);
      } else {
        // Prepend older messages and maintain scroll position
        const prevScrollHeight = chatContainerRef.current?.scrollHeight || 0;
        
        setMessages((prev) => {
          // Filter duplicates
          const newIds = new Set(normalized.map(m => m.messageId));
          const filteredPrev = prev.filter(m => !newIds.has(m.messageId));
          return [...normalized, ...filteredPrev].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });

        // Restore scroll position after React updates the DOM
        setTimeout(() => {
          if (chatContainerRef.current) {
            const newScrollHeight = chatContainerRef.current.scrollHeight;
            chatContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight;
          }
        }, 0);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      if (isInitial) setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreMessages = () => {
    if (!channel?.channelId || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadMessages(channel.channelId, nextPage, false);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !channel?.channelId) return;

    const content = newMessage.trim();
    const senderId = user?.id || user?.sub || '';
    // Backend userName alanında ne saklıyorsa onu gönder
    const userName = user?.userName || user?.username || user?.name || 'Unknown';
    console.log('[ChatArea] Sending message — user object:', user, '→ senderId:', senderId, '→ userName:', userName);

    // Optimistik olarak mesajı hemen UI'a ekle
    const optimisticMsg = {
      messageId: `temp-${Date.now()}`,
      content,
      userName,
      senderId,
      avatarUrl: user?.avatarUrl || null,
      createdAt: new Date().toISOString(),
      channelId: channel.channelId,
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setNewMessage('');

    try {
      await SignalRService.sendMessage(channel.channelId, clan?.clanId, senderId, userName, content);
    } catch (err) {
      console.error('Failed to send message via SignalR:', err);
      // Optimistik mesajı kaldır ve input'a geri koy
      setMessages((prev) => prev.filter((m) => m.messageId !== optimisticMsg.messageId));
      setNewMessage(content);
      // Kullanıcıya hata bildirimi göster
      const msg = err?.message?.includes('SignalR bağlantısı yok')
        ? 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.'
        : 'Mesaj gönderilemedi. Lütfen tekrar deneyin.';
      setSendError(msg);
      clearTimeout(sendErrorTimerRef.current);
      sendErrorTimerRef.current = setTimeout(() => setSendError(null), 5000);
    }
  };

  // Yardımcı fonksiyon: Mesaj içeriğindeki linkleri ve medyayı render et
  const renderMessageContent = (content) => {
    if (!content) return null;

    // Basit URL regex'i
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        const url = part;
        const lowerUrl = url.toLowerCase();
        
        // Görüntü önizleme
        if (lowerUrl.match(/\.(jpeg|jpg|gif|png|webp)$/) || lowerUrl.includes('imgur.com')) {
          return (
            <div key={i} className="chat-area__media-preview">
              <a href={url} target="_blank" rel="noopener noreferrer" className="chat-area__message-link">
                {url}
              </a>
              <img src={url} alt="attachment" className="chat-area__preview-img" loading="lazy" />
            </div>
          );
        }
        
        // Video önizleme
        if (lowerUrl.match(/\.(mp4|webm|ogg)$/)) {
          return (
            <div key={i} className="chat-area__media-preview">
              <a href={url} target="_blank" rel="noopener noreferrer" className="chat-area__message-link">
                {url}
              </a>
              <video src={url} controls className="chat-area__preview-video" preload="metadata" />
            </div>
          );
        }

        // Normal link
        return (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="chat-area__message-link">
            {url}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // No clan selected
  if (!clan) {
    return (
      <main className="chat-area">
        <div className="chat-area__welcome">
          <span className="material-symbols-outlined chat-area__welcome-icon">shield</span>
          <h2 className="chat-area__welcome-title">Welcome to Voxify</h2>
          <p className="chat-area__welcome-subtitle">Select a clan to get started</p>
        </div>
      </main>
    );
  }

  // No channel selected
  if (!channel) {
    return (
      <main className="chat-area">
        <div className="chat-area__welcome">
          <span className="material-symbols-outlined chat-area__welcome-icon">tag</span>
          <h2 className="chat-area__welcome-title">{clan.name}</h2>
          <p className="chat-area__welcome-subtitle">Select a channel to start chatting</p>
        </div>
      </main>
    );
  }

  return (
    <main className="chat-area">
      {/* Channel Header */}
      <header className="chat-area__header">
        <div className="chat-area__header-info">
          <span className="chat-area__header-hash">#</span>
          <h2 className="chat-area__header-name">{channel.name}</h2>
          <div className="chat-area__header-divider" />
          <p className="chat-area__header-topic">{channel.description || `Welcome to #${channel.name}`}</p>
        </div>
        <div className="chat-area__header-actions">
          <button className="chat-area__header-btn" title="Pinned Messages">
            <span className="material-symbols-outlined">push_pin</span>
          </button>
          <button className="chat-area__header-btn" title="Search">
            <span className="material-symbols-outlined">search</span>
          </button>
         
        </div>
      </header>

      {/* Messages */}
      <div className="chat-area__body">
        <div className="chat-area__messages" ref={chatContainerRef}>
          {hasMore && !loading && messages.length > 0 && (
            <div ref={observerTargetRef} className="chat-area__load-more-trigger">
              {loadingMore && <div className="chat-area__loading-spinner chat-area__loading-spinner--small" />}
            </div>
          )}
          
          {loading ? (
            <div className="chat-area__loading">
              <div className="chat-area__loading-spinner" />
              <span>Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-area__empty">
              <span className="material-symbols-outlined chat-area__empty-icon">chat_bubble</span>
              <h3 className="chat-area__empty-title">Welcome to #{channel.name}</h3>
              <p className="chat-area__empty-subtitle">This is the start of the channel. Send a message to begin!</p>
            </div>
          ) : (
            groupMessages(messages).map((group, gi) => {
              const currentUserId = user?.id || user?.sub || '';
              const isOwn = group.senderId === currentUserId || group.userName === (user?.userName || user?.name);
              return (
                <div key={`${gi}-${group.messages[0].messageId}`} className={`chat-area__message-group ${isOwn ? 'chat-area__message-group--own' : ''}`}>
                  {!isOwn && (
                    <div className="chat-area__message-avatar">
                      {group.avatarUrl ? (
                        <img src={group.avatarUrl} alt="" className="chat-area__message-avatar-img" />
                      ) : (
                        <span>{group.userName?.charAt(0)?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                  )}
                  <div className="chat-area__message-content">
                    <div className="chat-area__message-header">
                      <p className="chat-area__message-author">{group.userName || 'Unknown'}</p>
                      <p className="chat-area__message-time">
                        {group.createdAt
                          ? new Date(group.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </p>
                    </div>
                    {group.messages.map((msg) => (
                      <div key={msg.messageId} className="chat-area__message-text">
                        {renderMessageContent(msg.content)}
                      </div>
                    ))}
                  </div>
                  {isOwn && (
                    <div className="chat-area__message-avatar">
                      {group.avatarUrl ? (
                        <img src={group.avatarUrl} alt="" className="chat-area__message-avatar-img" />
                      ) : (
                        <span>{group.userName?.charAt(0)?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Hata bildirimi */}
        {sendError && (
          <div className="chat-area__send-error" role="alert">
            <span className="material-symbols-outlined">error</span>
            <span>{sendError}</span>
            <button
              type="button"
              className="chat-area__send-error-close"
              onClick={() => setSendError(null)}
              aria-label="Kapat"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}

        {/* Message Input */}
        <div className="chat-area__input-wrapper">
          <form className="chat-area__input-bar" onSubmit={handleSendMessage}>
            <button type="button" className="chat-area__input-action-btn">
              <span className="material-symbols-outlined">add_circle</span>
            </button>
            <input
              className="chat-area__input"
              type="text"
              placeholder={`Message #${channel.name}`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <div className="chat-area__input-actions">
              <button type="button" className="chat-area__input-action-btn">
                <span className="material-symbols-outlined">gif_box</span>
              </button>
              <button type="button" className="chat-area__input-action-btn">
                <span className="material-symbols-outlined">sentiment_satisfied</span>
              </button>
              <button type="button" className="chat-area__input-action-btn">
                <span className="material-symbols-outlined">alternate_email</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default ChatArea;