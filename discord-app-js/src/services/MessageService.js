import api from "./api.js";

/**
 * Get messages for a channel
 * GET /message?channelId={channelId}&page={page}&limit={limit}
 * @param {string} channelId
 * @param {number} page
 * @param {number} limit
 */
const getMessagesByChannelId = async (channelId, clanId, page = 1, limit = 50) => {
  try {
    const response = await api.get(`/message/channelId/${channelId}/clanId/${clanId}`, { params: { page, limit } });
    return response.data;
  } catch (error) {
    console.error("Error fetching messages", error.response?.data || error.message);
    throw error;
  }
};


/**
 * Delete a message
 * DELETE /message/{messageId}
 */
const deleteMessage = async (messageId, clanId) => {
  try {
    const response = await api.delete(`/message/${messageId}/clanId/${clanId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting message", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Edit a message
 * PUT /message/{messageId}/clanId/{clanId}
 * Body: { content: string }
 */
const editMessage = async (data) => {
  try {
    const response = await api.put(`/message/${data.messageId}/clanId/${data.clanId}`,   data.content);
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