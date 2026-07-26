import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { TENOR_API_KEY, TENOR_CLIENT_KEY } from '../../utils/constants';
import ImgBBService from '../../services/ImgBBService';
import WelcomePage from '../../pages/WelcomePage';
import ChatHeader from './ChatHeader';
import ChatMessageList from './ChatMessageList';
import ChatComposer from './ChatComposer';
import useChatMessages from './useChatMessages';


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
  const [newMessage, setNewMessage] = useState('');
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
  const composerRef = useRef(null);
  const {
    messages,
    groupedMessages,
    loading,
    loadingMore,
    hasMore,
    sendError,
    showSendError,
    dismissSendError,
    sendMessage,
    editMessage,
    deleteMessage,
    messagesEndRef,
    observerTargetRef,
    chatContainerRef,
  } = useChatMessages({
    token,
    user,
    isDm,
    targetId,
    targetClanId,
    targetName,
    notificationVolume,
  });

  const handleDeleteMessage = async (messageId) => {
    setContextMenu(null);
    if (!targetId) return;

    if (!window.confirm('Bu mesajı silmek istediğinize emin misiniz?')) return;
    await deleteMessage(messageId);
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
    handleCancelEdit();
    await editMessage(messageId, trimmed);
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

    await sendMessage(url, {
      optimisticIdPrefix: 'temp-gif',
      failureMessage: 'GIF gönderilemedi. Lütfen tekrar deneyin.',
    });
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
      showSendError('Yalnızca görsel dosyaları yüklenebilir.');
      return;
    }
    if (!targetId || isUploading) return;

    setIsUploading(true);
    try {
      for (const image of images) {
        const publicUrl = await ImgBBService.uploadImage(image);
        await sendMessage(publicUrl, { optimistic: false, handleError: false });
      }
    } catch (err) {
      console.error('Dosya yüklenemedi:', err);
      showSendError('Görsel yüklenirken bir hata oluştu: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  }, [isUploading, sendMessage, showSendError, targetId]);

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
    setNewMessage('');
    const sent = await sendMessage(content);
    if (!sent) setNewMessage(content);
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
              onClick={dismissSendError}
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
