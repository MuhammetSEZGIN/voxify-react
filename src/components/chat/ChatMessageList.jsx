import { memo } from 'react';
import MessageContent from './MessageContent';
import AvatarContent from '../common/AvatarContent';
import { getMemberAvatarUrl, getMemberId, getMemberName } from '../../utils/member';

function MessageAvatar({ member, onClick }) {
  const name = getMemberName(member);
  return (
    <button
      type="button"
      className="chat-area__message-avatar"
      aria-label={`${name} profilini aç`}
      title={`${name} profilini görüntüle`}
      onClick={onClick}
    >
      <AvatarContent
        src={getMemberAvatarUrl(member)}
        name={name}
        imgClassName="chat-area__message-avatar-img"
      />
    </button>
  );
}

function ChatMessageList({
  messages,
  groupedMessages,
  user,
  isDm,
  targetName,
  loading,
  loadingMore,
  hasMore,
  chatContainerRef,
  observerTargetRef,
  messagesEndRef,
  editingMessageId,
  editingContent,
  editInputRef,
  onEditingContentChange,
  onCancelEdit,
  onSubmitEdit,
  onContextMenu,
  participantProfiles = [],
  onUserClick,
}) {
  const currentUserId = user?.id || user?.sub || '';
  const currentUserName = user?.userName || user?.name;

  return (
    <div className="chat-area__messages" ref={chatContainerRef}>
      {hasMore && !loading && messages.length > 0 && (
        <div ref={observerTargetRef} className="chat-area__load-more-trigger">
          {loadingMore && (
            <div className="chat-area__loading-spinner chat-area__loading-spinner--small" />
          )}
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
        groupedMessages.map((group, groupIndex) => {
          const isOwn = group.senderId === currentUserId || group.userName === currentUserName;
          const knownProfile = participantProfiles.find((profile) => (
            (group.senderId && getMemberId(profile) === group.senderId)
            || (!group.senderId && getMemberName(profile) === group.userName)
          ));
          const messageMember = {
            ...(knownProfile || {}),
            userId: group.senderId || getMemberId(knownProfile),
            userName: group.userName || getMemberName(knownProfile),
            avatarUrl: group.avatarUrl
              || getMemberAvatarUrl(knownProfile)
              || (isOwn ? user?.avatarUrl : null),
          };
          const handleOpenProfile = (event) => {
            onUserClick?.(messageMember, event.currentTarget.getBoundingClientRect());
          };

          return (
            <div
              key={`${groupIndex}-${group.messages[0].messageId}`}
              className={`chat-area__message-group ${isOwn ? 'chat-area__message-group--own' : ''}`}
            >
              {!isOwn && <MessageAvatar member={messageMember} onClick={handleOpenProfile} />}
              <div className="chat-area__message-content">
                <div className="chat-area__message-header">
                  <button
                    type="button"
                    className="chat-area__message-author"
                    onClick={handleOpenProfile}
                  >
                    {group.userName || 'Unknown'}
                  </button>
                  <p className="chat-area__message-time">
                    {group.createdAt
                      ? new Date(group.createdAt).toLocaleTimeString([], {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                      : ''}
                  </p>
                </div>
                {group.messages.map((message) => (
                  <div
                    key={message.messageId}
                    className="chat-area__message-item"
                    onContextMenu={(event) => onContextMenu(event, message, isOwn)}
                  >
                    {editingMessageId === message.messageId ? (
                      <form className="chat-area__edit-form" onSubmit={onSubmitEdit}>
                        <input
                          ref={editInputRef}
                          className="chat-area__edit-input"
                          value={editingContent}
                          onChange={(event) => onEditingContentChange(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') onCancelEdit();
                          }}
                        />
                        <div className="chat-area__edit-actions">
                          <span className="chat-area__edit-hint">Enter kaydet • Esc iptal</span>
                          <button
                            type="button"
                            className="chat-area__edit-cancel-btn"
                            onClick={onCancelEdit}
                          >
                            <span className="material-symbols-outlined">close</span>
                          </button>
                          <button
                            type="submit"
                            className="chat-area__edit-save-btn"
                            disabled={!editingContent.trim()}
                          >
                            <span className="material-symbols-outlined">check</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="chat-area__message-text">
                        <MessageContent content={message.content} />
                        {message._edited && (
                          <span className="chat-area__edited-tag">(düzenlendi)</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {isOwn && <MessageAvatar member={messageMember} onClick={handleOpenProfile} />}
            </div>
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default memo(ChatMessageList);
