import api from "./api.js";

/**
 * Get messages for a channel.
 * Clan kanalları için clanId zorunlu (`/message/channelId/{channelId}/clanId/{clanId}`).
 * DM konuşmaları için clanId yok, backend route'u henüz doğrulanmadı — bkz.
 * guncelleme-plani.md madde 3, "DM mesaj geçmişi route'u onaylanmadı" notu.
 * @param {string} channelId
 * @param {string|null} clanId - null ise DM olarak varsayılır
 * @param {number} page
 * @param {number} limit
 */
const getMessagesByChannelId = async (channelId, clanId, page = 1, limit = 50) => {
  try {
    const url = clanId
      ? `/message/channelId/${channelId}/clanId/${clanId}`
      : `/message/dm/channelId/${channelId}`;
    const response = await api.get(url, { params: { page, limit } });
    return response.data;
  } catch (error) {
    console.error("Error fetching messages", error.response?.data || error.message);
    throw error;
  }
};


/**
 * Delete a message.
 * @param {string} messageId
 * @param {string|null} clanId - null ise DM olarak varsayılır
 */
const deleteMessage = async (messageId, clanId) => {
  try {
    const url = clanId ? `/message/${messageId}/clanId/${clanId}` : `/message/dm/${messageId}`;
    const response = await api.delete(url);
    return response.data;
  } catch (error) {
    console.error("Error deleting message", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Edit a message.
 * Body: { content: string }
 * @param {{messageId: string, clanId: string|null, content: string}} data
 */
const editMessage = async (data) => {
  try {
    const url = data.clanId
      ? `/message/${data.messageId}/clanId/${data.clanId}`
      : `/message/dm/${data.messageId}`;
    const response = await api.put(url, data.content);
    return response.data;
  } catch (error) {
    console.error("Error editing message", error.response?.data || error.message);
    throw error;
  }
};

const MessageService = {
  getMessagesByChannelId,
  deleteMessage,
  editMessage,
};

export default MessageService;