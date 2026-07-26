import React, { memo, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import MessageService from '../../services/MessageService';
import SignalRService from '../../services/LiveMessageService';
import { useAuth } from '../../hooks/useAuth';
import useDesktopMessageNotifications from '../../hooks/useDesktopMessageNotifications';
import { TENOR_API_KEY, TENOR_CLIENT_KEY } from '../../utils/constants';
import ImgBBService from '../../services/ImgBBService';
import WelcomePage from '../../pages/WelcomePage';
import { playMessageNotificationSound } from '../../utils/messageNotifications';
import ChatHeader from './ChatHeader';
import ChatMessageList from './ChatMessageList';
import ChatComposer from './ChatComposer';
import { extractMessages, groupMessagesBySender, normalizeMessage } from './chatMessageUtils';


/**
 * ChatArea — hem klan metin kanalları hem 1:1 DM'ler için tek sohbet bileşeni.
 *
 * `variant` ile iki mod arasında geçer:
 *  - 'channel' (varsayılan): klan kanalı. `clan` + `channel` props'ları gerekir.
 *    Başlıkta `#kanal-adı`, mesaj düzenleme/silme (clanId gerektirir) açık.
 *  - 'dm': doğrudan mesaj. `conversation` prop'u gerekir. Başlıkta `@kullanıcı`,
 *    geri butonu. Mesaj yükleme/gönderme aynı MessageService/SignalR akışını
 *    `clanId=null` ile kullanır (bkz. guncelleme-plani.md madde 3).
 *
 * Önceden DM'ler ayrı bir `DmChatArea.jsx` içinde ~200 satır kopya kodla
 * çalışıyordu (normalizeMessage, SignalR join/leave, optimistik gönderim...).
 * O dosya kaldırıldı; tek kaynak burası.
 */
function ChatArea({
  clan,
  channel,
  variant = 'channel',
  conversation,
  onBack,
  onToggleVoiceCall,
  isVoiceCallActive = false,
  voiceCallPhase = null,
  notificationVolume = 100,
}) {
  const isDm = variant === 'dm';

  // İki mod için ortak "hedef" — aşağıdaki tüm mantık bunları kullanır, böylece
  // kanal/DM ayrımı tek noktada kalır.
  const targetId = isDm ? conversation?.conversationId : channel?.channelId;
  const targetClanId = isDm ? null : clan?.clanId;
  const targetName = isDm ? (conversation?.otherUserName || 'DM') : channel?.name;

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
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const dragDepthRef = useRef(0);

  const gifSearchTimerRef = useRef(null);

  const sendErrorTimerRef = useRef(null);
  const composerRef = useRef(null);

  const messagesEndRef = useRef(null);
  const observerTargetRef = useRef(null);
  const chatContainerRef = useRef(null);
  const prevChannelRef = useRef({ channelId: null, clanId: null });
  const { showDesktopNotification } = useDesktopMessageNotifications(targetName);
  

  // SignalR bağlantısını başlat (singleton — cleanup'ta kapatma)
  useEffect(() => {
    // DM modunda `clan` yok; bağlantı yine de gerekli.
    if (!token || (!targetClanId && !isDm)) return;

    SignalRService.startConnection(token, targetClanId).catch((err) => {
      console.error('SignalR connection failed:', err);
    });
    // Bağlantıyı burada kapatmıyoruz: modül seviyesinde singleton,
    // Strict Mode cleanup'ı negotiation'ı yarıda kesiyor.
  }, [token, targetClanId, isDm]);

  // Hedef (kanal ya da DM) değiştiğinde: eskisinden ayrıl, yenisine katıl, yükle
  useEffect(() => {
    const previous = prevChannelRef.current;
    const newId = targetId;

    if (
      previous.channelId
      && (previous.channelId !== newId || previous.clanId !== targetClanId)
    ) {
      SignalRService.leaveChannel(previous.channelId);
    }

    prevChannelRef.current = { channelId: newId, clanId: targetClanId };

    if (!newId) {
      setMessages([]);
      setHasMore(false);
      setPage(1);
      return;
    }

    SignalRService.joinChannel(newId, targetClanId).catch((err) => {
      console.error('Failed to join channel:', err);
    });

    setPage(1);
    setHasMore(true);
    loadMessages(newId, 1, true);
    // Mesaj yükleme bu effect'in içinde hedef değişiminde çalışmalı; render-başına
    // yeniden oluşan yardımcı fonksiyon dependency olursa gereksiz REST döngüsü oluşur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDm, targetClanId, targetId]);

    // SignalR'dan gelen mesajları dinle
    useEffect(() => {
        const handleReceive = async (...args) => {
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

            // Başka bir kanala/DM'e ait mesajı bu görünüme ekleme. (Hub grupları
            // ayrı olsa da kanal geçişinde yarış durumunda karışabiliyor.)
            if (normalized.channelId && targetId && normalized.channelId !== targetId) return;

            // Bildirim sesi ve masaüstü bildirimi tek ayar/mute hattından geçer.
            const currentId = user?.id || user?.sub || '';
            if (normalized.senderId !== currentId) {
                playMessageNotificationSound({
                    clanId: targetClanId,
                    senderId: normalized.senderId,
                    volume: (notificationVolume / 100) * 0.5,
                });
                showDesktopNotification(normalized, {
                    clanId: targetClanId,
                }).catch((error) => {
                    console.warn('[ChatArea] Desktop notification failed:', error);
                });
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

    const showHubFailure = (message) => {
      setSendError(message);
      clearTimeout(sendErrorTimerRef.current);
      sendErrorTimerRef.current = setTimeout(() => setSendError(null), 5000);
    };
    const handleSendFailed = (reason) => showHubFailure(reason || 'Mesaj gönderilemedi.');
    const handleUpdateFailed = () => showHubFailure('Mesaj düzenlenemedi.');
    const handleDeleteFailed = () => showHubFailure('Mesaj silinemedi.');
    const handleJoinFailed = () => showHubFailure('Bu sohbete erişim iznin yok.');

    SignalRService.on('ReceiveMessage', handleReceive);
    SignalRService.on('MessageUpdated', handleUpdated);
    SignalRService.on('MessageDeleted', handleDeleted);
    SignalRService.on('MessageSendFailed', handleSendFailed);
    SignalRService.on('MessageUpdateFailed', handleUpdateFailed);
    SignalRService.on('MessageDeleteFailed', handleDeleteFailed);
    SignalRService.on('JoinChannelFailed', handleJoinFailed);

    return () => {
      SignalRService.off('ReceiveMessage', handleReceive);
      SignalRService.off('MessageUpdated', handleUpdated);
      SignalRService.off('MessageDeleted', handleDeleted);
      SignalRService.off('MessageSendFailed', handleSendFailed);
      SignalRService.off('MessageUpdateFailed', handleUpdateFailed);
      SignalRService.off('MessageDeleteFailed', handleDeleteFailed);
      SignalRService.off('JoinChannelFailed', handleJoinFailed);
    };
  }, [isDm, notificationVolume, showDesktopNotification, targetClanId, targetId, user]);


  // Intersection Observer for pagination
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && targetId) {
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
    // loadMoreMessages güncel state'i yukarıdaki dependency'lerden okur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, loadingMore, targetId, page]);

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

  // Composer'daki her tuş vuruşunda uzun mesaj geçmişini yeniden gruplama.
  const groupedMessages = useMemo(() => groupMessagesBySender(messages), [messages]);

  const loadMessages = async (channelId, pageNum = 1, isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      console.log(`Loading messages for channel: ${channelId}, page: ${pageNum}`);
      const data = await MessageService.getMessagesByChannelId(channelId, targetClanId, pageNum, 50);
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
    if (!targetId || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadMessages(targetId, nextPage, false);
  };

  const handleDeleteMessage = async (messageId) => {
    setContextMenu(null);
    if (!targetId) return;

    if (!window.confirm('Bu mesajı silmek istediğinize emin misiniz?')) return;

    try {
      if (isDm) {
        await SignalRService.deleteMessage(messageId, targetId, null);
      } else {
        await MessageService.deleteMessage(messageId, targetClanId);
        setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
      }
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
    if (!trimmed || !editingMessageId || !targetId) return;

    const messageId = editingMessageId;
    const oldContent = messages.find((m) => m.messageId === messageId)?.content;

    // Optimistik güncelleme
    setMessages((prev) =>
      prev.map((m) => m.messageId === messageId ? { ...m, content: trimmed } : m)
    );
    handleCancelEdit();

    try {
      if (isDm) {
        await SignalRService.updateMessage(messageId, null, trimmed);
      } else {
        await MessageService.editMessage({
          messageId,
          clanId: targetClanId,
          content: trimmed,
        });
      }
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


  const handleSelectGif = async (gif) => {
    const url = gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url || '';
    if (!url) return;

    setShowGifPicker(false);
    setGifSearch('');
    setGifs([]);

    if (!targetId) return;

    const senderId = user?.id || user?.sub || '';
    const userName = user?.userName || user?.username || user?.name || 'Unknown';

    const optimisticMsg = {
      messageId: `temp-gif-${Date.now()}`,
      content: url,
      userName,
      senderId,
      avatarUrl: user?.avatarUrl || null,
      createdAt: new Date().toISOString(),
      channelId: targetId,
      _optimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      await SignalRService.sendMessage(targetId, targetClanId, url);
    } catch (err) {
      console.error('Failed to send GIF via SignalR:', err);
      setMessages((prev) => prev.filter((m) => m.messageId !== optimisticMsg.messageId));
      const msg = err?.message?.includes('SignalR baÄŸlantÄ±sÄ± yok')
        ? 'Sunucuya baÄŸlanÄ±lamÄ±yor. LÃ¼tfen internet baÄŸlantÄ±nÄ±zÄ± kontrol edin.'
        : 'GIF gÃ¶nderilemedi. LÃ¼tfen tekrar deneyin.';
      setSendError(msg);
      clearTimeout(sendErrorTimerRef.current);
      sendErrorTimerRef.current = setTimeout(() => setSendError(null), 5000);
    }
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

  const uploadAndSendImages = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    const images = files.filter((file) => file?.type?.startsWith('image/'));

    if (images.length === 0) {
      setSendError('Yalnızca görsel dosyaları yüklenebilir.');
      clearTimeout(sendErrorTimerRef.current);
      sendErrorTimerRef.current = setTimeout(() => setSendError(null), 5000);
      return;
    }
    if (!targetId || isUploading) return;

    setIsUploading(true);
    try {
      for (const image of images) {
        const publicUrl = await ImgBBService.uploadImage(image);
        await SignalRService.sendMessage(targetId, targetClanId, publicUrl);
      }
    } catch (err) {
      console.error('Dosya yüklenemedi:', err);
      setSendError('Görsel yüklenirken bir hata oluştu: ' + err.message);
      clearTimeout(sendErrorTimerRef.current);
      sendErrorTimerRef.current = setTimeout(() => setSendError(null), 5000);
    } finally {
      setIsUploading(false);
    }
  }, [isUploading, targetClanId, targetId]);

  const handleFileChange = async (e) => {
    await uploadAndSendImages(e.target.files);
    e.target.value = '';
  };

  const handleComposerPaste = (e) => {
    const imageFiles = Array.from(e.clipboardData?.items || [])
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean);

    if (imageFiles.length === 0) return;
    e.preventDefault();
    uploadAndSendImages(imageFiles);
  };

  const dragContainsFiles = (dataTransfer) =>
    Array.from(dataTransfer?.types || []).includes('Files');

  const handleDragEnter = (e) => {
    if (!dragContainsFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingImage(true);
  };

  const handleDragOver = (e) => {
    if (!dragContainsFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e) => {
    if (!dragContainsFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingImage(false);
  };

  const handleDrop = (e) => {
    if (!dragContainsFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingImage(false);
    uploadAndSendImages(e.dataTransfer.files);
  };


  const handleSendMessage = async (e) => {

    e.preventDefault();
    if (!newMessage.trim() || !targetId) return;

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
      channelId: targetId,
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setNewMessage('');

    try {
      await SignalRService.sendMessage(targetId, targetClanId, content);
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

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;

    composer.style.height = '0px';
    composer.style.height = `${composer.scrollHeight}px`;
  }, [newMessage]);

  const handleComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Klan modu: klan seçili değilse karşılama sayfası
  if (!isDm && !clan) {
    return <WelcomePage />;
  }

  // Klan modu: kanal seçili değil
  if (!isDm && !channel) {
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

  // DM modu: henüz bir sohbet seçilmedi — sağdaki listeden birini seç
  if (isDm && !conversation) {
    return (
      <main className="chat-area">
        <div className="chat-area__welcome">
          <span className="material-symbols-outlined chat-area__welcome-icon">forum</span>
          <h2 className="chat-area__welcome-title">Mesajların</h2>
          <p className="chat-area__welcome-subtitle">
            Sohbete başlamak için sağdaki listeden bir arkadaşını seç.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`chat-area ${isDraggingImage ? 'chat-area--dragging' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handleComposerPaste}
    >
      {isDraggingImage && (
        <div className="chat-area__drop-overlay" aria-hidden="true">
          <span className="material-symbols-outlined">add_photo_alternate</span>
          <strong>Görseli buraya bırak</strong>
          <span>Sohbete yükleyip göndereceğiz</span>
        </div>
      )}
      <ChatHeader
        isDm={isDm}
        targetName={targetName}
        channel={channel}
        conversation={conversation}
        onBack={onBack}
        onToggleVoiceCall={onToggleVoiceCall}
        isVoiceCallActive={isVoiceCallActive}
        voiceCallPhase={voiceCallPhase}
      />

      <div className="chat-area__body">
        <ChatMessageList
          messages={messages}
          groupedMessages={groupedMessages}
          user={user}
          isDm={isDm}
          targetName={targetName}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          chatContainerRef={chatContainerRef}
          observerTargetRef={observerTargetRef}
          messagesEndRef={messagesEndRef}
          editingMessageId={editingMessageId}
          editingContent={editingContent}
          editInputRef={editInputRef}
          onEditingContentChange={setEditingContent}
          onCancelEdit={handleCancelEdit}
          onSubmitEdit={handleSubmitEdit}
          onContextMenu={handleContextMenu}
        />

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

        <ChatComposer
          showEmojiPicker={showEmojiPicker}
          onCloseEmojiPicker={() => setShowEmojiPicker(false)}
          onSelectEmoji={handleSelectEmoji}
          showGifPicker={showGifPicker}
          gifSearch={gifSearch}
          onGifSearch={handleGifSearch}
          onCloseGifPicker={() => setShowGifPicker(false)}
          gifLoading={gifLoading}
          gifs={gifs}
          onSelectGif={handleSelectGif}
          onSubmit={handleSendMessage}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          onFileUploadClick={handleFileUploadClick}
          isUploading={isUploading}
          composerRef={composerRef}
          placeholder={isDm
            ? `@${targetName} kullanıcısına mesaj gönder`
            : `Message #${targetName}`}
          value={newMessage}
          onChange={setNewMessage}
          onKeyDown={handleComposerKeyDown}
          onToggleGifPicker={handleToggleGifPicker}
          onToggleEmojiPicker={handleToggleEmojiPicker}
        />

      </div>
    </main>
  );
}

export default memo(ChatArea);
