import { memo, useCallback, useEffect, useRef, useState } from 'react';
import useNotifications from '../../hooks/useNotifications';

const TYPE_ICONS = {
  FriendRequestReceived: 'person_add',
  FriendRequestAccepted: 'group',
  DirectMessageReceived: 'chat',
  ClanInvite: 'mail',
  MissedCall: 'phone_missed',
};

function formatRelativeTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Şimdi';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dk`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} sa`;
  return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function NotificationCenter({ token, onReceive, onOpen }) {
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState(null);
  const containerRef = useRef(null);
  const {
    items,
    unreadCount,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    markRead,
    markAllRead,
    remove,
  } = useNotifications(token, onReceive);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const runAction = useCallback(async (action) => {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err.message);
    }
  }, []);

  const handleOpen = useCallback((notification) => {
    runAction(async () => {
      await markRead(notification.id);
      onOpen?.(notification);
      setOpen(false);
    });
  }, [markRead, onOpen, runAction]);

  return (
    <div className="notification-center" ref={containerRef}>
      <button
        type="button"
        className={`notification-center__trigger ${open ? 'notification-center__trigger--active' : ''}`}
        aria-label={`Bildirimler${unreadCount ? `, ${unreadCount} okunmamış` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className="notification-center__badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section className="notification-center__panel" aria-label="Bildirim merkezi">
          <header className="notification-center__header">
            <div>
              <h2>Bildirimler</h2>
              <p>{unreadCount ? `${unreadCount} okunmamış` : 'Tümü okundu'}</p>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={() => runAction(markAllRead)}>
                Tümünü oku
              </button>
            )}
          </header>

          {(error || actionError) && (
            <p className="notification-center__error" role="alert">{actionError || error}</p>
          )}

          <div className="notification-center__list">
            {loading ? (
              <div className="notification-center__state">Bildirimler yükleniyor...</div>
            ) : items.length === 0 ? (
              <div className="notification-center__state">
                <span className="material-symbols-outlined">notifications_off</span>
                <p>Henüz bildirimin yok.</p>
              </div>
            ) : (
              items.map((notification) => (
                <article
                  key={notification.id}
                  className={`notification-center__item ${notification.isRead ? '' : 'notification-center__item--unread'}`}
                >
                  <button
                    type="button"
                    className="notification-center__item-main"
                    onClick={() => handleOpen(notification)}
                  >
                    <span className="material-symbols-outlined notification-center__item-icon">
                      {TYPE_ICONS[notification.type] || 'notifications'}
                    </span>
                    <span className="notification-center__item-content">
                      <strong>{notification.title}</strong>
                      <span>{notification.body}</span>
                      <time>{formatRelativeTime(notification.createdAt)}</time>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="notification-center__delete"
                    aria-label="Bildirimi sil"
                    onClick={() => runAction(() => remove(notification.id))}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </article>
              ))
            )}
          </div>

          {hasMore && (
            <button
              type="button"
              className="notification-center__more"
              disabled={loadingMore}
              onClick={() => runAction(loadMore)}
            >
              {loadingMore ? 'Yükleniyor...' : 'Daha fazlasını göster'}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

export default memo(NotificationCenter);
