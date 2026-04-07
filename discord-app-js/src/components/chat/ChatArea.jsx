import React, { useState, useEffect, useRef, useCallback } from 'react';
import MessageService from '../../services/MessageService';
import SignalRService from '../../services/LiveMessageService';
import { useAuth } from '../../hooks/useAuth';
import { TENOR_API_KEY, TENOR_CLIENT_KEY, COMMON_EMOJIS } from '../../utils/constants';
import ImgBBService from '../../services/ImgBBService';
import WelcomePage from '../../pages/WelcomePage';


function ChatArea({ clan, channel }) {

  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [sendError, setSendError] = useState(null);
  // Context menu state: { x, y, messageId }
  const [contextMenu, setContextMenu] = useState(null);
  // Inline editing state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const editInputRef = useRef(null);
  // GIF Picker
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);

  // Emoji Picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // File Upload
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const gifSearchTimerRef = useRef(null);

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

            // Bildirim sesi çal (Eğer mesaj bizden değilse)
            const currentId = user?.id || user?.sub || '';
            if (normalized.senderId !== currentId) {
                try {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                    audio.volume = 0.5;
                    audio.play().catch(() => {
                        // Tarayıcı kısıtlaması nedeniyle çalmayabilir, sessizce geç
                    });
                } catch (err) {
                    console.warn('Bildirim sesi çalınamadı:', err);
                }
            }

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

    const handleDeleted = (...args) => {
      console.log('[SignalR] MessageDeleted raw args:', args);
      const deletedId = typeof args[0] === 'object' && args[0] !== null
        ? args[0].messageId || args[0].id || args[0].$oid
        : args[0];

      if (deletedId) {
        setMessages((prev) => prev.filter((m) => m.messageId !== deletedId));
      }
    };

    SignalRService.on('ReceiveMessage', handleReceive);
    SignalRService.on('MessageUpdated', handleUpdated);
    SignalRService.on('MessageDeleted', handleDeleted);

    return () => {
      SignalRService.off('ReceiveMessage', handleReceive);
      SignalRService.off('MessageUpdated', handleUpdated);
      SignalRService.off('MessageDeleted', handleDeleted);
    };
  }, []);

  // Intersection Observer for pagination
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && channel?.channelId) {
          console.log('[ChatArea] Load more triggered by observer');
          loadMoreMessages();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (observerTargetRef.current) {
      observer.observe(observerTargetRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, channel?.channelId, page]);

  useEffect(() => {
    if (page === 1 && messages.length > 0) {
      // Use behavior: 'auto' for initial load to avoid visible jumping/scrolling
      scrollToBottom('auto');
    }
  }, [messages, page]);

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
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
      const data = await MessageService.getMessagesByChannelId(channelId, clan?.clanId, pageNum, 50);
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
        // Instant scroll on first page
        setTimeout(() => scrollToBottom('auto'), 50);
      } else {
        // Prepend older messages and maintain scroll position
        const container = chatContainerRef.current;
        const prevScrollHeight = container?.scrollHeight || 0;

        setMessages((prev) => {
          const newIds = new Set(normalized.map(m => m.messageId));
          const filteredPrev = prev.filter(m => !newIds.has(m.messageId));
          const combined = [...normalized, ...filteredPrev].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          return combined;
        });

        // Restore scroll position after React updates the DOM
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - prevScrollHeight;
          }
        });
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

  const handleDeleteMessage = async (messageId) => {
    setContextMenu(null);
    if (!channel?.channelId || !clan?.clanId) return;

    if (!window.confirm('Bu mesajı silmek istediğinize emin misiniz?')) return;

    try {
      await MessageService.deleteMessage(messageId, clan.clanId);
      setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
    } catch (err) {
      console.error('Failed to delete message via MessageService:', err);
      setSendError('Mesaj silinemedi.');
      clearTimeout(sendErrorTimerRef.current);
      sendErrorTimerRef.current = setTimeout(() => setSendError(null), 5000);
    }
  };

  const handleEditMessage = (messageId) => {
    setContextMenu(null);
    const msg = messages.find((m) => m.messageId === messageId);
    if (!msg) return;
    setEditingMessageId(messageId);
    setEditingContent(msg.content);
    // input'a odaklan
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    const trimmed = editingContent.trim();
    if (!trimmed || !editingMessageId || !clan?.clanId) return;

    const messageId = editingMessageId;
    const oldContent = messages.find((m) => m.messageId === messageId)?.content;

    // Optimistik güncelleme
    setMessages((prev) =>
      prev.map((m) => m.messageId === messageId ? { ...m, content: trimmed } : m)
    );
    handleCancelEdit();

    try {
      await MessageService.editMessage({
        messageId,
        clanId: clan.clanId,
        content: trimmed,
      });
    } catch (err) {
      console.error('Failed to update message via MessageService:', err);
      // Geri al
      setMessages((prev) =>
        prev.map((m) => m.messageId === messageId ? { ...m, content: oldContent } : m)
      );
      setSendError('Mesaj düzenlenemedi.');
      clearTimeout(sendErrorTimerRef.current);
      sendErrorTimerRef.current = setTimeout(() => setSendError(null), 5000);
    }
  };

  const handleContextMenu = (e, msg, isOwn) => {
    if (!isOwn) return; // Sadece kendi mesajlarında context menu
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, messageId: msg.messageId });
  };

  // Context menu kapanması için global listener
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e) => { if (e.key === 'Escape') setContextMenu(null); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  // ── GIF Picker (Tenor — no API key sign-up required) ──────────────────
  const fetchGifs = useCallback(async (query) => {
    setGifLoading(true);
    try {
      const base = query
        ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&limit=24`
        : `https://tenor.googleapis.com/v2/featured?limit=24`;
      const url = `${base}&key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&media_filter=gif`;
      const res = await fetch(url);
      const json = await res.json();
      setGifs(json.results || []);
    } catch (err) {
      console.error('[GIF] Tenor fetch failed:', err);
    } finally {
      setGifLoading(false);
    }
  }, []);

  const handleGifSearch = (e) => {
    const q = e.target.value;
    setGifSearch(q);
    clearTimeout(gifSearchTimerRef.current);
    gifSearchTimerRef.current = setTimeout(() => fetchGifs(q), 400);
  };

  const handleToggleGifPicker = () => {
    setShowGifPicker((prev) => {
      if (!prev) {
        fetchGifs('');
        if (showEmojiPicker) setShowEmojiPicker(false);
      }
      return !prev;
    });
  };


  const handleSelectGif = (gif) => {
    const url = gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url || '';
    if (!url) return;
    setNewMessage((prev) => (prev ? `${prev} ${url}` : url));
    setShowGifPicker(false);
    setGifSearch('');
    setGifs([]);
  };

  const handleToggleEmojiPicker = () => {
    setShowEmojiPicker((prev) => !prev);
    if (showGifPicker) setShowGifPicker(false);
  };

  const handleSelectEmoji = (emoji) => {
    setNewMessage((prev) => prev + emoji);
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Sadece görsellere izin ver
    if (!file.type.startsWith('image/')) {
        alert('Lütfen sadece resim dosyası seçin.');
        return;
    }

    setIsUploading(true);
    try {
        const publicUrl = await ImgBBService.uploadImage(file);
        
        // Yüklenen dosyanın URL'sini hemen sohbete gönder
        const senderId = user?.id || user?.sub || '';
        const userName = user?.userName || user?.username || user?.name || 'Unknown';
        
        await SignalRService.sendMessage(channel.channelId, clan?.clanId, senderId, userName, publicUrl);
        
        // Inputu temizle
        e.target.value = '';
    } catch (err) {
        console.error('Dosya yüklenemedi:', err);
        setSendError('Görsel yüklenirken bir hata oluştu: ' + err.message);
        clearTimeout(sendErrorTimerRef.current);
        sendErrorTimerRef.current = setTimeout(() => setSendError(null), 5000);
    } finally {
        setIsUploading(false);
    }
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
              <img src={url} alt="attachment" className="chat-area__preview-img" loading="lazy" />
            </div>
          );
        }

        // Video önizleme
        if (lowerUrl.match(/\.(mp4|webm|ogg)$/)) {
          return (
            <div key={i} className="chat-area__media-preview">
              <video src={url} controls className="chat-area__preview-video" preload="metadata" />
            </div>
          );
        }

        // YouTube önizleme
        const youtubeMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^& \n]+)/);
        if (youtubeMatch) {
          const videoId = youtubeMatch[1];
          return (
            <div key={i} className="chat-area__media-preview">
              <iframe
                className="chat-area__preview-youtube"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
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

  // No clan selected — show welcome/download page
  if (!clan) {
    return <WelcomePage />;
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
                          ? new Date(group.createdAt).toLocaleTimeString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </p>
                    </div>
                    {group.messages.map((msg) => (
                      <div
                        key={msg.messageId}
                        className="chat-area__message-item"
                        onContextMenu={(e) => handleContextMenu(e, msg, isOwn)}
                      >
                        {editingMessageId === msg.messageId ? (
                          <form
                            className="chat-area__edit-form"
                            onSubmit={handleSubmitEdit}
                          >
                            <input
                              ref={editInputRef}
                              className="chat-area__edit-input"
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); }}
                            />
                            <div className="chat-area__edit-actions">
                              <span className="chat-area__edit-hint">Enter kaydet • Esc iptal</span>
                              <button type="button" className="chat-area__edit-cancel-btn" onClick={handleCancelEdit}>
                                <span className="material-symbols-outlined">close</span>
                              </button>
                              <button type="submit" className="chat-area__edit-save-btn" disabled={!editingContent.trim()}>
                                <span className="material-symbols-outlined">check</span>
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="chat-area__message-text">
                            {renderMessageContent(msg.content)}
                            {msg._edited && <span className="chat-area__edited-tag">(düzenlendi)</span>}
                          </div>
                        )}
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

        {/* Sağ tık Context Menu */}
        {contextMenu && (
          <div
            className="chat-area__context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="chat-area__context-menu-item"
              onClick={() => handleEditMessage(contextMenu.messageId)}
            >
              <span className="material-symbols-outlined">edit</span>
              Düzenle
            </button>
            <div className="chat-area__context-menu-divider" />
            <button
              className="chat-area__context-menu-item chat-area__context-menu-item--danger"
              onClick={() => handleDeleteMessage(contextMenu.messageId)}
            >
              <span className="material-symbols-outlined">delete</span>
              Sil
            </button>
          </div>
        )}

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

        {/* Message Input Wrapper (relative for anchoring) */}
        <div className="chat-area__input-wrapper">
          {/* Emoji Picker "Kutucuk" */}
          {showEmojiPicker && (
            <div className="chat-area__emoji-picker">
              <div className="chat-area__emoji-picker-header">
                <span className="material-symbols-outlined chat-area__emoji-picker-icon">sentiment_satisfied</span>
                <span className="chat-area__emoji-picker-title">Emoji Seç</span>
                <button
                  type="button"
                  className="chat-area__emoji-picker-close"
                  onClick={() => setShowEmojiPicker(false)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="chat-area__emoji-picker-grid">
                {COMMON_EMOJIS.map((emoji, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="chat-area__emoji-item"
                    onClick={() => handleSelectEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* GIF Picker "Kutucuk" */}
          {showGifPicker && (
            <div className="chat-area__gif-picker">
              <div className="chat-area__gif-picker-header">
                <span className="material-symbols-outlined chat-area__gif-picker-icon">gif_box</span>
                <input
                  className="chat-area__gif-picker-search"
                  type="text"
                  placeholder="GIF ara..."
                  value={gifSearch}
                  onChange={handleGifSearch}
                  autoFocus
                />
                <button
                  type="button"
                  className="chat-area__gif-picker-close"
                  onClick={() => setShowGifPicker(false)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="chat-area__gif-picker-grid">
                {gifLoading ? (
                  <div className="chat-area__gif-picker-loading">
                    <div className="chat-area__loading-spinner chat-area__loading-spinner--small" />
                  </div>
                ) : gifs.length === 0 ? (
                  <p className="chat-area__gif-picker-empty">GIF bulunamadı.</p>
                ) : (
                  gifs.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      className="chat-area__gif-item"
                      onClick={() => handleSelectGif(gif)}
                      title={gif.title}
                    >
                      <img
                        src={gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url}
                        alt={gif.title}
                        loading="lazy"
                      />
                    </button>
                  ))
                )}
              </div>
              <div className="chat-area__gif-picker-footer">
                Powered by Tenor
              </div>
            </div>
          )}

          <form className="chat-area__input-bar" onSubmit={handleSendMessage}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handleFileChange}
            />
            <button
                type="button"
                className="chat-area__input-action-btn"
                title="Dosya Ekle"
                onClick={handleFileUploadClick}
                disabled={isUploading}
            >
                {isUploading ? (
                    <div className="chat-area__loading-spinner chat-area__loading-spinner--small" style={{ width: '20px', height: '20px' }} />
                ) : (
                    <span className="material-symbols-outlined">add_circle</span>
                )}
            </button>

            <input
              className="chat-area__input"
              type="text"
              placeholder={`Message #${channel.name}`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <div className="chat-area__input-actions">
              <button
                type="button"
                className={`chat-area__input-action-btn${showGifPicker ? ' chat-area__input-action-btn--active' : ''}`}
                title="GIF"
                onClick={handleToggleGifPicker}
              >
                <span className="material-symbols-outlined">gif_box</span>
              </button>
              <button
                type="button"
                className={`chat-area__input-action-btn${showEmojiPicker ? ' chat-area__input-action-btn--active' : ''}`}
                title="Emoji"
                onClick={handleToggleEmojiPicker}
              >
                <span className="material-symbols-outlined">sentiment_satisfied</span>
              </button>
              <button type="submit" className="chat-area__input-action-btn" title="Gönder">
                <span className="material-symbols-outlined">send</span>
              </button>
            </div>
          </form>
        </div>

      </div>
    </main>
  );
}

export default ChatArea;
