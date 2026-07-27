import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MessageService from '../../services/MessageService';
import SignalRService from '../../services/LiveMessageService';
import useDesktopMessageNotifications from '../../hooks/useDesktopMessageNotifications';
import { playMessageNotificationSound } from '../../utils/messageNotifications';
import { extractMessages, groupMessagesBySender, normalizeMessage } from './chatMessageUtils';

const PAGE_SIZE = 50;
const ERROR_TIMEOUT_MS = 5000;

function connectionErrorMessage(error, fallback) {
  return error?.message?.includes('SignalR bağlantısı yok')
    ? 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.'
    : fallback;
}

/**
 * Bir sohbet hedefinin mesaj bağlantısını, geçmişini ve mutation işlemlerini yönetir.
 * Kanal ve DM ayrımı yalnızca targetClanId/isDm girdilerinde kalır.
 */
export default function useChatMessages({
  token,
  user,
  isDm,
  targetId,
  targetClanId,
  targetName,
  notificationVolume,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [sendError, setSendError] = useState(null);

  const sendErrorTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const observerTargetRef = useRef(null);
  const chatContainerRef = useRef(null);
  const previousTargetRef = useRef({ channelId: null, clanId: null });
  const { showDesktopNotification } = useDesktopMessageNotifications(targetName);

  const showSendError = useCallback((message) => {
    setSendError(message);
    clearTimeout(sendErrorTimerRef.current);
    sendErrorTimerRef.current = setTimeout(() => setSendError(null), ERROR_TIMEOUT_MS);
  }, []);

  const dismissSendError = useCallback(() => {
    clearTimeout(sendErrorTimerRef.current);
    setSendError(null);
  }, []);

  useEffect(() => () => clearTimeout(sendErrorTimerRef.current), []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const loadMessages = useCallback(async (channelId, pageNumber = 1, isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      console.log(`Loading messages for channel: ${channelId}, page: ${pageNumber}`);
      const data = await MessageService.getMessagesByChannelId(
        channelId,
        targetClanId,
        pageNumber,
        PAGE_SIZE
      );
      const rawMessages = extractMessages(data);
      setHasMore(rawMessages.length >= PAGE_SIZE);

      const normalizedMessages = rawMessages
        .map(normalizeMessage)
        .sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt));

      if (isInitial) {
        setMessages(normalizedMessages);
        setTimeout(() => scrollToBottom('auto'), 50);
        return;
      }

      const container = chatContainerRef.current;
      const previousScrollHeight = container?.scrollHeight || 0;

      setMessages((currentMessages) => {
        const newIds = new Set(normalizedMessages.map((message) => message.messageId));
        const uniqueCurrentMessages = currentMessages.filter(
          (message) => !newIds.has(message.messageId)
        );

        return [...normalizedMessages, ...uniqueCurrentMessages]
          .sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt));
      });

      requestAnimationFrame(() => {
        if (!container) return;
        container.scrollTop = container.scrollHeight - previousScrollHeight;
      });
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      if (isInitial) setLoading(false);
      setLoadingMore(false);
    }
  }, [scrollToBottom, targetClanId]);

  useEffect(() => {
    if (!token || (!targetClanId && !isDm)) return;

    SignalRService.startConnection(token, targetClanId).catch((error) => {
      console.error('SignalR connection failed:', error);
    });
    // Singleton bağlantı Strict Mode cleanup'ında kapatılmaz.
  }, [isDm, targetClanId, token]);

  useEffect(() => {
    const previousTarget = previousTargetRef.current;

    if (
      previousTarget.channelId
      && (previousTarget.channelId !== targetId || previousTarget.clanId !== targetClanId)
    ) {
      SignalRService.leaveChannel(previousTarget.channelId);
    }

    previousTargetRef.current = { channelId: targetId, clanId: targetClanId };

    if (!targetId) {
      setMessages([]);
      setHasMore(false);
      setPage(1);
      return;
    }

    SignalRService.joinChannel(targetId, targetClanId).catch((error) => {
      console.error('Failed to join channel:', error);
    });

    setPage(1);
    setHasMore(true);
    loadMessages(targetId, 1, true);
  }, [loadMessages, targetClanId, targetId]);

  useEffect(() => {
    const handleReceive = (...args) => {
      console.log('[SignalR] ReceiveMessage raw args:', args);
      let normalized;

      if (args.length === 1 && typeof args[0] === 'object') {
        normalized = normalizeMessage(args[0]);
      } else if (args.length >= 4) {
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
      if (normalized.channelId && targetId && normalized.channelId !== targetId) return;

      const currentUserId = user?.id || user?.sub || '';
      if (normalized.senderId !== currentUserId) {
        playMessageNotificationSound({
          clanId: targetClanId,
          senderId: normalized.senderId,
          volume: (notificationVolume / 100) * 0.5,
        });
        showDesktopNotification(normalized, { clanId: targetClanId }).catch((error) => {
          console.warn('[ChatArea] Desktop notification failed:', error);
        });
      }

      setMessages((currentMessages) => {
        const optimisticIndex = currentMessages.findIndex(
          (message) => message._optimistic && message.content === normalized.content
        );

        if (optimisticIndex !== -1) {
          const updatedMessages = [...currentMessages];
          updatedMessages[optimisticIndex] = normalized;
          return updatedMessages;
        }

        if (currentMessages.some((message) => message.messageId === normalized.messageId)) {
          return currentMessages;
        }

        return [...currentMessages, normalized];
      });
    };

    const handleUpdated = (...args) => {
      console.log('[SignalR] MessageUpdated raw args:', args);
      const messageDto = args.length === 1 ? args[0] : args;
      const normalized = normalizeMessage(messageDto);
      setMessages((currentMessages) => currentMessages.map((message) => (
        message.messageId === normalized.messageId ? normalized : message
      )));
    };

    const handleDeleted = (...args) => {
      console.log('[SignalR] MessageDeleted raw args:', args);
      const deletedId = typeof args[0] === 'object' && args[0] !== null
        ? args[0].messageId || args[0].id || args[0].$oid
        : args[0];

      if (deletedId) {
        setMessages((currentMessages) => currentMessages.filter(
          (message) => message.messageId !== deletedId
        ));
      }
    };

    const handleSendFailed = (reason) => showSendError(reason || 'Mesaj gönderilemedi.');
    const handleUpdateFailed = () => showSendError('Mesaj düzenlenemedi.');
    const handleDeleteFailed = () => showSendError('Mesaj silinemedi.');
    const handleJoinFailed = () => showSendError('Bu sohbete erişim iznin yok.');

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
  }, [
    notificationVolume,
    showDesktopNotification,
    showSendError,
    targetClanId,
    targetId,
    user,
  ]);

  const loadMoreMessages = useCallback(() => {
    if (!targetId || loadingMore || !hasMore) return;

    const nextPage = page + 1;
    setPage(nextPage);
    loadMessages(targetId, nextPage, false);
  }, [hasMore, loadMessages, loadingMore, page, targetId]);

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

    if (observerTargetRef.current) observer.observe(observerTargetRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMoreMessages, loading, loadingMore, targetId]);

  useEffect(() => {
    if (page === 1 && messages.length > 0) scrollToBottom('auto');
  }, [messages, page, scrollToBottom]);

  const sendMessage = useCallback(async (content, options = {}) => {
    if (!content || !targetId) return false;

    const {
      optimistic = true,
      optimisticIdPrefix = 'temp',
      handleError = true,
      failureMessage = 'Mesaj gönderilemedi. Lütfen tekrar deneyin.',
    } = options;
    const optimisticMessage = optimistic ? {
      messageId: `${optimisticIdPrefix}-${Date.now()}`,
      content,
      userName: user?.userName || user?.username || user?.name || 'Unknown',
      senderId: user?.id || user?.sub || '',
      avatarUrl: user?.avatarUrl || null,
      createdAt: new Date().toISOString(),
      channelId: targetId,
      _optimistic: true,
    } : null;

    if (optimisticMessage) {
      setMessages((currentMessages) => [...currentMessages, optimisticMessage]);
    }

    try {
      await SignalRService.sendMessage(targetId, targetClanId, content);
      return true;
    } catch (error) {
      if (optimisticMessage) {
        setMessages((currentMessages) => currentMessages.filter(
          (message) => message.messageId !== optimisticMessage.messageId
        ));
      }

      if (!handleError) throw error;
      console.error('Failed to send message via SignalR:', error);
      showSendError(connectionErrorMessage(error, failureMessage));
      return false;
    }
  }, [showSendError, targetClanId, targetId, user]);

  const editMessage = useCallback(async (messageId, content) => {
    const oldContent = messages.find((message) => message.messageId === messageId)?.content;
    setMessages((currentMessages) => currentMessages.map((message) => (
      message.messageId === messageId ? { ...message, content } : message
    )));

    try {
      if (isDm) {
        await SignalRService.updateMessage(messageId, null, content);
      } else {
        await MessageService.editMessage({ messageId, clanId: targetClanId, content });
      }
      return true;
    } catch (error) {
      console.error('Failed to update message:', error);
      setMessages((currentMessages) => currentMessages.map((message) => (
        message.messageId === messageId ? { ...message, content: oldContent } : message
      )));
      showSendError('Mesaj düzenlenemedi.');
      return false;
    }
  }, [isDm, messages, showSendError, targetClanId]);

  const deleteMessage = useCallback(async (messageId) => {
    try {
      if (isDm) {
        await SignalRService.deleteMessage(messageId, targetId, null);
      } else {
        await MessageService.deleteMessage(messageId, targetClanId);
        setMessages((currentMessages) => currentMessages.filter(
          (message) => message.messageId !== messageId
        ));
      }
      return true;
    } catch (error) {
      console.error('Failed to delete message:', error);
      showSendError('Mesaj silinemedi.');
      return false;
    }
  }, [isDm, showSendError, targetClanId, targetId]);

  const groupedMessages = useMemo(() => groupMessagesBySender(messages), [messages]);

  return {
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
  };
}
