import { useCallback, useEffect, useRef, useState } from 'react';
import NotificationService from '../services/NotificationService';
import NotificationHubService from '../services/NotificationHubService';

const PAGE_SIZE = 20;

function mergeNotification(items, incoming) {
  if (!incoming?.id) return items;
  const withoutDuplicate = items.filter((item) => item.id !== incoming.id);
  return [incoming, ...withoutDuplicate];
}

export default function useNotifications(token, onReceive) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const receiveRef = useRef(onReceive);

  useEffect(() => {
    receiveRef.current = onReceive;
  }, [onReceive]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [list, count] = await Promise.all([
        NotificationService.getNotifications({ page: 1, limit: PAGE_SIZE }),
        NotificationService.getUnreadCount(),
      ]);
      setItems(list.items);
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
      setItems((current) => mergeNotification(current, notification));
      setTotal((current) => current + 1);
      receiveRef.current?.(notification);
    };
    const handleCount = (count) => {
      if (active) setUnreadCount(Math.max(0, Number(count) || 0));
    };

    NotificationHubService.on('ReceiveNotification', handleNotification);
    NotificationHubService.on('UnreadCountChanged', handleCount);
    refresh();
    NotificationHubService.startConnection(token).catch((err) => {
      if (active) setError(err.message || 'Bildirim bağlantısı kurulamadı');
    });

    return () => {
      active = false;
      NotificationHubService.off('ReceiveNotification', handleNotification);
      NotificationHubService.off('UnreadCountChanged', handleCount);
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
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...result.items.filter((item) => !known.has(item.id))];
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
  };
}
