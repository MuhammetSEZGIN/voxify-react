import { memo, useCallback, useMemo, useState } from 'react';
import VoiceSessionPanel from '../voicechannel/VoiceSessionPanel';
import AvatarContent from '../common/AvatarContent';

const CONVERSATION_NOTIFICATION_TYPES = new Set([
  'DirectMessageReceived',
  'MissedCall',
]);

const TYPE_ICONS = {
  DirectMessageReceived: 'chat',
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

function FriendsNotificationSidebar({
  notifications,
  activeConversationId,
  onOpenNotification,
  headerAccessory,
  activeVoiceChannel,
  voiceState,
  onDisconnectVoice,
  onWatchScreenShare,
  callPanel,
  friends = [],
}) {
  const [actionError, setActionError] = useState(null);
  const {
    items,
    loading,
    error,
    markRead,
  } = notifications;

  const conversationNotifications = useMemo(
    () => items.filter(
      (notification) =>
        CONVERSATION_NOTIFICATION_TYPES.has(notification.type) && notification.targetId
    ),
    [items]
  );
  const friendsById = useMemo(
    () => new Map(friends.map((friend) => [friend.id, friend])),
    [friends]
  );

  const handleOpen = useCallback(async (notification) => {
    setActionError(null);
    onOpenNotification?.(notification);
    try {
      await markRead(notification.id);
    } catch (err) {
      setActionError(err.message);
    }
  }, [markRead, onOpenNotification]);

  return (
    <aside className="channel-sidebar friends-notification-sidebar">
      <header className="channel-sidebar__header">
        <h1 className="channel-sidebar__title">Arkadaşlar</h1>
        <div className="channel-sidebar__header-actions">{headerAccessory}</div>
      </header>

      <div className="friends-notification-sidebar__content">
        <div className="friends-notification-sidebar__heading">
          <span>Bildirimler</span>
          {conversationNotifications.some((notification) => !notification.isRead) && (
            <span className="friends-notification-sidebar__heading-dot" aria-label="Okunmamış bildirim var" />
          )}
        </div>

        {(error || actionError) && (
          <p className="friends-notification-sidebar__error" role="alert">
            {actionError || error}
          </p>
        )}

        {loading ? (
          <div className="friends-notification-sidebar__state">
            <span className="material-symbols-outlined friends-notification-sidebar__state-icon">hourglass_top</span>
            <p>Bildirimler yükleniyor...</p>
          </div>
        ) : conversationNotifications.length === 0 ? (
          <div className="friends-notification-sidebar__state">
            <span className="material-symbols-outlined friends-notification-sidebar__state-icon">mark_chat_read</span>
            <p>Henüz sohbet bildirimin yok.</p>
          </div>
        ) : (
          <div className="friends-notification-sidebar__list">
            {conversationNotifications.map((notification) => {
              const actor = friendsById.get(notification.actorUserId);
              const actorName = notification.actorUserName
                || actor?.userName
                || notification.title
                || 'Kullanıcı';
              const actorAvatarUrl = notification.actorAvatarUrl || actor?.avatarUrl || null;

              return (
                <button
                  key={notification.id}
                  type="button"
                  className={`friends-notification-sidebar__item ${
                    notification.isRead ? '' : 'friends-notification-sidebar__item--unread'
                  } ${
                    activeConversationId === notification.targetId
                      ? 'friends-notification-sidebar__item--active'
                      : ''
                  }`}
                  onClick={() => handleOpen(notification)}
                >
                  <span className="friends-notification-sidebar__item-avatar">
                    <AvatarContent src={actorAvatarUrl} name={actorName} />
                    <span className="friends-notification-sidebar__item-type material-symbols-outlined">
                      {TYPE_ICONS[notification.type] || 'notifications'}
                    </span>
                  </span>
                  <span className="friends-notification-sidebar__item-content">
                    <span className="friends-notification-sidebar__item-title">
                      {notification.title || actorName || 'Doğrudan Mesaj'}
                    </span>
                    <span className="friends-notification-sidebar__item-body">{notification.body}</span>
                  </span>
                  <time className="friends-notification-sidebar__item-time">
                    {formatRelativeTime(notification.createdAt)}
                  </time>
                  {!notification.isRead && (
                    <span className="friends-notification-sidebar__unread-dot" aria-label="Okunmamış" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <VoiceSessionPanel
        activeVoiceChannel={activeVoiceChannel}
        voiceState={voiceState}
        onDisconnectVoice={onDisconnectVoice}
        onWatchScreenShare={onWatchScreenShare}
      />
      {callPanel}
    </aside>
  );
}

export default memo(FriendsNotificationSidebar);
