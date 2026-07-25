import React, { memo, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import MessageService from '../../services/MessageService';
import SignalRService from '../../services/LiveMessageService';
import { useAuth } from '../../hooks/useAuth';
import useDesktopMessageNotifications from '../../hooks/useDesktopMessageNotifications';
import { TENOR_API_KEY, TENOR_CLIENT_KEY, COMMON_EMOJIS } from '../../utils/constants';
import ImgBBService from '../../services/ImgBBService';
import WelcomePage from '../../pages/WelcomePage';
import { playMessageNotificationSound } from '../../utils/messageNotifications';

function groupMessagesBySender(messages) {
  const groups = [];
  for (const message of messages) {
    const lastGroup = groups[groups.length - 1];
    const lastMessage = lastGroup?.messages[lastGroup.messages.length - 1];
    if (
      lastGroup &&
      lastGroup.userName === message.userName &&
      lastGroup.senderId === message.senderId &&
      Math.abs(new Date(message.createdAt) - new Date(lastMessage.createdAt)) < 60000
    ) {
      lastGroup.messages.push(message);
    } else {
      groups.push({
        userName: message.userName,
        senderId: message.senderId,
        avatarUrl: message.avatarUrl,
        createdAt: message.createdAt,
        messages: [message],
      });
    }
  }
  return groups;
}


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
  const prevChannelIdRef = useRef(null);
  const { showDesktopNotification } = useDesktopMessageNotifications(targetName);
  

  // SignalR bağlantısını başlat (singleton — cleanup'ta kapatma)
  useEffect(() => {
    // DM modunda `clan` yok; bağlantı yine de gerekli.
    if (!token || (!clan && !isDm)) return;

    SignalRService.startConnection(token).catch((err) => {
      console.error('SignalR connection failed:', err);
    });
    // Bağlantıyı burada kapatmıyoruz: modül seviyesinde singleton,
    // Strict Mode cleanup'ı negotiation'ı yarıda kesiyor.
  }, [token, clan, isDm]);

  // Hedef (kanal ya da DM) değiştiğinde: eskisinden ayrıl, yenisine katıl, yükle
  useEffect(() => {
    const prevId = prevChannelIdRef.current;
    const newId = targetId;

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
    // Mesaj yükleme bu effect'in içinde hedef değişiminde çalışmalı; render-başına
    // yeniden oluşan yardımcı fonksiyon dependency olursa gereksiz REST döngüsü oluşur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

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
        await SignalRService.deleteMessage(messageId, targetId);
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
        await SignalRService.updateMessage(messageId, trimmed);
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
      {/* Header — kanalda #kanal-adı, DM'de @kullanıcı */}
      <header className="chat-area__header">
        <div className="chat-area__header-info">
          {isDm && onBack && (
            <button
              type="button"
              className="chat-area__header-back-btn"
              onClick={onBack}
              title="Geri"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          <span className="chat-area__header-hash">{isDm ? '@' : '#'}</span>
          <h2 className="chat-area__header-name">{targetName}</h2>
          {!isDm && (
            <>
              <div className="chat-area__header-divider" />
              <p className="chat-area__header-topic">{channel.description || `Welcome to #${channel.name}`}</p>
            </>
          )}
        </div>

        {/* DM sesli arama — backend zil/kabul durum makinesini yönetir. */}
        {isDm && onToggleVoiceCall && (
          <div className="chat-area__header-actions">
            <button
              type="button"
              className={`chat-area__call-btn ${isVoiceCallActive ? 'chat-area__call-btn--active' : ''}`}
              onClick={() => onToggleVoiceCall(conversation)}
              title={isVoiceCallActive ? 'Görüşmeyi bitir' : 'Sesli arama başlat'}
            >
              <span className="material-symbols-outlined">
                {isVoiceCallActive ? 'call_end' : 'call'}
              </span>
              <span className="chat-area__call-btn-label">
                {isVoiceCallActive
                  ? 'Bitir'
                  : ['starting', 'ringing'].includes(voiceCallPhase)
                    ? 'Aranıyor...'
                    : 'Sesli Ara'}
              </span>
            </button>
          </div>
        )}
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
              <h3 className="chat-area__empty-title">
                {isDm ? targetName : `Welcome to #${targetName}`}
              </h3>
              <p className="chat-area__empty-subtitle">
                {isDm
                  ? 'Bu sohbetin başlangıcı. İlk mesajı gönder!'
                  : 'This is the start of the channel. Send a message to begin!'}
              </p>
            </div>
          ) : (
            groupedMessages.map((group, gi) => {
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
              multiple
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

            <textarea
              ref={composerRef}
              className="chat-area__input"
              placeholder={isDm ? `@${targetName} kullanıcısına mesaj gönder` : `Message #${targetName}`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={1}
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

export default memo(ChatArea);
