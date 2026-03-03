import api from "./api-temp.js";

/**
 * Get messages for a channel
 * GET /api/Message/channel/{channelId}
 * @param {string} channelId
 */
const getMessagesByChannelId = async (channelId) => {
  try {
    const response = await api.get(`/Message`, { params: { channelId } });
    return response.data;
  } catch (error) {
    console.error("Error fetching messages", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Send a message to a channel
 * POST /api/Message
 * @param {Object} data - { content: string, channelId: string }
 */
const sendMessage = async (data) => {
  try {
    const response = await api.post("/Message", data);
    return response.data;
  } catch (error) {
    console.error("Error sending message", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Delete a message
 * DELETE /api/Message/{messageId}
 */
const deleteMessage = async (messageId) => {
  try {
    const response = await api.delete(`/Message/${messageId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting message", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Edit a message
 * PUT /api/Message
 * @param {Object} data - { messageId: string, content: string }
 */
const editMessage = async (data) => {
  try {
    const response = await api.put("/Message", data);
    return response.data;
  } catch (error) {
    console.error("Error editing message", error.response?.data || error.message);
    throw error;
  }
};

const MessageService = {
  getMessagesByChannelId,
  sendMessage,
  deleteMessage,
  editMessage,
};

export default MessageService;