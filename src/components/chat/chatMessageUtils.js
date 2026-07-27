export function groupMessagesBySender(messages) {
  const groups = [];

  for (const message of messages) {
    const lastGroup = groups[groups.length - 1];
    const lastMessage = lastGroup?.messages[lastGroup.messages.length - 1];

    if (
      lastGroup
      && lastGroup.userName === message.userName
      && lastGroup.senderId === message.senderId
      && Math.abs(new Date(message.createdAt) - new Date(lastMessage.createdAt)) < 60000
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
 * API ve SignalR tarafındaki farklı mesaj biçimlerini tek UI modeline çevirir.
 */
export function normalizeMessage(message) {
  const messageId = message.messageId
    || (typeof message.id === 'object' && message.id !== null
      ? (message.id.$oid
        || `${message.id.timestamp ?? ''}-${message.id.machine ?? ''}-${message.id.pid ?? ''}-${message.id.increment ?? ''}`)
      : message.id)
    || message.Id
    || crypto.randomUUID();

  return {
    messageId,
    content: message.text || message.Text || message.content || message.Content
      || message.message || message.Message || '',
    userName: message.userName || message.UserName
      || message.user?.userName || message.user?.username || message.user?.UserName
      || message.senderName || message.SenderName || 'Unknown',
    senderId: message.senderId || message.SenderId || message.userId || message.UserId
      || message.user?.id || '',
    avatarUrl: message.avatarUrl || message.AvatarUrl || message.user?.avatarUrl || null,
    createdAt: message.createdAt || message.CreatedAt || message.sentAt || message.SentAt
      || new Date().toISOString(),
    channelId: message.channelId || message.ChannelId || '',
  };
}

/**
 * .NET koleksiyon sarmaları dahil olmak üzere API yanıtından mesajları çıkarır.
 */
export function extractMessages(data) {
  if (!data) return [];
  if (data.$values && Array.isArray(data.$values)) return data.$values;
  if (Array.isArray(data)) return data;
  if (data.messages && Array.isArray(data.messages)) return data.messages;
  if (data.Messages && Array.isArray(data.Messages)) return data.Messages;
  if (data.items && Array.isArray(data.items)) return data.items;
  if (data.messageId || data.id || data.content) return [data];

  console.warn('[ChatArea] Beklenmeyen mesaj formatı:', data);
  return [];
}
