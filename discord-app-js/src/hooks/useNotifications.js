import { useCallback, useEffect, useRef, useState } from 'react';
import NotificationService from '../services/NotificationService';
import NotificationHubService from '../services/NotificationHubService';
import { playMessageNotificationSound } from '../utils/messageNotifications';

const PAGE_SIZE = 20;
const NOTIFICATION_TYPES = [
  'FriendRequestReceived',
  'FriendRequestAccepted',
  'DirectMessageReceived',
  'ClanInvite',
  'MissedCall',
];

function normalizeNotification(notification) {
  if (!notification) return notification;

  const numericType = typeof notification.type === 'number'
    ? notification.type
    : Number.isInteger(Number(notification.type)) ? Number(notification.type) : null;

  return {
    ...notification,
    type: numericType === null
      ? notification.type
      : (NOTIFICATION_TYPES[numericType] || notification.type),
  };
}

function mergeNotification(items, incoming) {
  const normalized = normalizeNotification(incoming);
  if (!normalized?.id) return items;
  const withoutDuplicate = items.filter((item) => item.id !== normalized.id);
  return [normalized, ...withoutDuplicate];
}

export default function useNotifications(token, onReceive, notificationVolume = 100) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const receiveRef = useRef(onReceive);
  const notificationVolumeRef = useRef(notificationVolume);

  useEffect(() => {
    receiveRef.current = onReceive;
  }, [onReceive]);

  useEffect(() => {
    notificationVolumeRef.current = notificationVolume;
  }, [notificationVolume]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [list, count] = await Promise.all([
        NotificationService.getNotifications({ page: 1, limit: PAGE_SIZE }),
        NotificationService.getUnreadCount(),
      ]);
      setItems(list.items.map(normalizeNotification));
      setTotal(list.total);
      setPage(1);
      setUnreadCount(count);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;

    const handleNotification = (notification) => {
      if (!active) return;
      const normalized = normalizeNotification(notification);
      setItems((current) => mergeNotification(current, normalized));
      setTotal((current) => current + 1);
      playMessageNotificationSound({
        senderId: normalized?.actorUserId,
        volume: (notificationVolumeRef.current / 100) * 0.5,
      });
      receiveRef.current?.(normalized);
    };
    const handleCount = (count) => {
      if (active) setUnreadCount(Math.max(0, Number(count) || 0));
    };
    const handleCleared = () => {
      if (!active) return;
      setItems([]);
      setTotal(0);
      setPage(1);
      setUnreadCount(0);
    };

    NotificationHubService.on('ReceiveNotification', handleNotification);
    NotificationHubService.on('UnreadCountChanged', handleCount);
    NotificationHubService.on('NotificationsCleared', handleCleared);
    refresh();
    NotificationHubService.startConnection(token).catch((err) => {
      if (active) setError(err.message || 'Bildirim bağlantısı kurulamadı');
    });

    return () => {
      active = false;
      NotificationHubService.off('ReceiveNotification', handleNotification);
      NotificationHubService.off('UnreadCountChanged', handleCount);
      NotificationHubService.off('NotificationsCleared', handleCleared);
      NotificationHubService.stopConnection();
    };
  }, [token, refresh]);

  const loadMore = useCallback(async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const result = await NotificationService.getNotifications({
        page: nextPage,
        limit: PAGE_SIZE,
      });
      const normalizedItems = result.items.map(normalizeNotification);
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...normalizedItems.filter((item) => !known.has(item.id))];
      });
      setTotal(result.total);
      setPage(nextPage);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [items.length, loadingMore, page, total]);

  const markRead = useCallback(async (id) => {
    const target = items.find((item) => item.id === id);
    if (!target || target.isRead) return;
    await NotificationService.markAsRead(id);
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item
      )
    );
    setUnreadCount((current) => Math.max(0, current - 1));
  }, [items]);

  const markAllRead = useCallback(async () => {
    await NotificationService.markAllAsRead();
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, isRead: true, readAt })));
    setUnreadCount(0);
  }, []);

  const remove = useCallback(async (id) => {
    const target = items.find((item) => item.id === id);
    await NotificationService.deleteNotification(id);
    setItems((current) => current.filter((item) => item.id !== id));
    setTotal((current) => Math.max(0, current - 1));
    if (target && !target.isRead) setUnreadCount((current) => Math.max(0, current - 1));
  }, [items]);

  const clearAll = useCallback(async () => {
    await NotificationService.clearNotifications();
    setItems([]);
    setTotal(0);
    setPage(1);
    setUnreadCount(0);
  }, []);

  return {
    items,
    unreadCount,
    loading,
    loadingMore,
    error,
    hasMore: items.length < total,
    refresh,
    loadMore,
    markRead,
    markAllRead,
    remove,
    clearAll,
  };
}
