import api from "./api";

/**
 * Get channels by clan ID
 * GET /api/Channel/clan/{clanId}
 */
const getChannelsByClanId = async (clanId) => {
  try {
    const response = await api.get(`/Channel/clan/${clanId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching channels", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get a specific channel
 * GET /api/Channel/{channelId}
 */
const getChannelById = async (channelId) => {
  try {
    const response = await api.get(`/Channel/${channelId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching channel", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Create a new channel
 * POST /api/Channel
 * @param {Object} data - { name: string, clanId: string }
 */
const createChannel = async (data) => {
  try {
    const response = await api.post("/Channel", data);
    return response.data;
  } catch (error) {
    console.error("Error creating channel", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Update a channel
 * PUT /api/Channel
 * @param {Object} data - { channelId: string, name: string }
 */
const updateChannel = async (data) => {
  try {
    const response = await api.put("/Channel", data);
    return response.data;
  } catch (error) {
    console.error("Error updating channel", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Delete a channel
 * DELETE /api/Channel/{channelId}
 */
const deleteChannel = async (channelId) => {
  try {
    const response = await api.delete(`/Channel/${channelId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting channel", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get voice channels by clan ID
 * GET /api/VoiceChannel/clan/{clanId}
 */
const getVoiceChannelsByClanId = async (clanId) => {
  try {
    const response = await api.get(`/VoiceChannel/clan/${clanId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching voice channels", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Create a voice channel
 * POST /api/VoiceChannel
 * @param {Object} data - { name: string, clanId: string }
 */
const createVoiceChannel = async (data) => {
  try {
    const response = await api.post("/VoiceChannel", data);
    return response.data;
  } catch (error) {
    console.error("Error creating voice channel", error.response?.data || error.message);
    throw error;
  }
};

const ChannelService = {
  getChannelsByClanId,
  getChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
  getVoiceChannelsByClanId,
  createVoiceChannel,
};

export default ChannelService;