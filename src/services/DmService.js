import api from './api';

const CONVERSATIONS_PATH = '/message/dm/conversations';

function normalizeConversation(raw, fallbackOtherUserId = '') {
  if (!raw?.conversationId) return null;

  return {
    conversationId: raw.conversationId,
    otherUserId: raw.otherUserId || fallbackOtherUserId,
    otherUserName: raw.otherUserName || '',
    otherAvatarUrl: raw.otherAvatarUrl || raw.avatarUrl || null,
    otherBio: raw.otherBio || raw.bio || '',
    otherProfileBackgroundUrl: raw.otherProfileBackgroundUrl
      || raw.profileBackgroundUrl
      || raw.backgroundUrl
      || raw.bannerUrl
      || null,
    lastMessage: raw.lastMessage ?? null,
    lastMessageAt: raw.lastMessageAt ?? null,
    createdAt: raw.createdAt ?? null,
  };
}

function describeError(error, fallback) {
  return (
    error.response?.data?.message ||
    error.response?.data?.detail ||
    error.response?.data?.title ||
    error.message ||
    fallback
  );
}

/** Aynı kullanıcı için idempotent biçimde mevcut konuşmayı döndürür veya oluşturur. */
async function getOrCreateConversation(otherUserId) {
  try {
    const { data } = await api.post(CONVERSATIONS_PATH, { otherUserId });
    const conversation = normalizeConversation(data, otherUserId);
    if (!conversation) throw new Error('Sunucu geçerli bir konuşma kimliği döndürmedi.');
    return conversation;
  } catch (error) {
    throw new Error(describeError(error, 'DM konuşması başlatılamadı'));
  }
}

/** Oturumdaki kullanıcının DM konuşmalarını son mesaj bilgisiyle getirir. */
async function getConversations() {
  try {
    const { data } = await api.get(CONVERSATIONS_PATH);
    const list = Array.isArray(data) ? data : data?.items || [];
    return list.map((item) => normalizeConversation(item)).filter(Boolean);
  } catch (error) {
    throw new Error(describeError(error, 'DM konuşmaları alınamadı'));
  }
}

const DmService = { getOrCreateConversation, getConversations };

export default DmService;
export { getOrCreateConversation, getConversations };
