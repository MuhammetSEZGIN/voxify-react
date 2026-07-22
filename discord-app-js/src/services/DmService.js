import api from "./api";

/**
 * 1:1 DM konuşma yönetimi. Backend MessageService `DmController`
 * (`guncelleme-plani-backend.md` madde 3) ile Ocelot `/message/*` prefix'i
 * üzerinden konuşur. Gerçek mesajlaşma (gönderme/alma) mevcut
 * `MessageService.js` + `LiveMessageService.js` (MessageHub) altyapısını
 * `channelId` olarak dönen `conversationId` ile aynen kullanır — DM'ler için
 * ayrı bir mesaj gönderme/alma API'si yoktur.
 */

/**
 * İki kullanıcı arasındaki DM konuşmasını getirir, yoksa oluşturur (idempotent).
 * POST /message/dm/conversations { otherUserId }
 * @param {string} otherUserId
 * @returns {Promise<{conversationId: string, otherUserId: string}>}
 */
async function getOrCreateConversation(otherUserId) {
  try {
    const response = await api.post("/message/dm/conversations", { otherUserId });
    return response.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "DM konuşması başlatılırken bir hata oluştu";
    throw new Error(msg);
  }
}

/**
 * Oturum açık kullanıcının tüm DM konuşmalarını (son mesaj önizlemesiyle) getirir.
 * GET /message/dm/conversations
 * @returns {Promise<Array<{conversationId, otherUserId, otherUserName, otherAvatarUrl, lastMessage, lastMessageAt}>>}
 */
async function getConversations() {
  try {
    const response = await api.get("/message/dm/conversations");
    return response.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "DM konuşmaları alınırken bir hata oluştu";
    throw new Error(msg);
  }
}

const DmService = {
  getOrCreateConversation,
  getConversations,
};

export default DmService;
export { getOrCreateConversation, getConversations };
