import api from "./api.js";

/**
 * Get messages for a channel
 * GET /message?channelId={channelId}
 * @param {string} channelId
 */
const getMessagesByChannelId = async (channelId) => {
  try {
    const response = await api.get(`/message`, { params: { channelId } });
    return response.data;
  } catch (error) {
    console.error("Error fetching messages", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Send a message to a channel
 * POST /message
 */
const sendMessage = async (data) => {
  try {
    const response = await api.post("/message", data);
    return response.data;
  } catch (error) {
    console.error("Error sending message", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Delete a message
 * DELETE /message/{messageId}
 */
const deleteMessage = async (messageId) => {
  try {
    const response = await api.delete(`/message/${messageId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting message", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Edit a message
 * PUT /message
 */
const editMessage = async (data) => {
  try {
    const response = await api.put("/message", data);
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