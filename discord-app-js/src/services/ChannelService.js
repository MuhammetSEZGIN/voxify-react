import api from "./api";

/**
 * Get channels by clan ID
 * GET /channel/clan/{clanId}
 */



const getChannelsByClanId = async (clanId) => {
  try {
    const response = await api.get(`/channel/clan/${clanId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching channels", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get a specific channel
 * GET /channel/{channelId}
 */
const getChannelById = async (channelId) => {
  try {
    const response = await api.get(`/channel/${channelId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching channel", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Create a new channel
 * POST /channel
 */
const createChannel = async (data) => {
  try {
    const response = await api.post("/channel", data);
    return response.data;
  } catch (error) {
    console.error("Error creating channel", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Update a channel
 * PUT /channel
 */
const updateChannel = async (data) => {
  try {
    const response = await api.put("/channel", data);
    return response.data;
  } catch (error) {
    console.error("Error updating channel", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Delete a channel
 * DELETE /channel/{channelId}
 */
const deleteChannel = async (channelId) => {
  try {
    const response = await api.delete(`/channel/${channelId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting channel", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get voice channels by clan ID
 * GET /voiceChannel/clan/{clanId}
 */
const getVoiceChannelsByClanId = async (clanId) => {
  try {
    const response = await api.get(`/voiceChannel/clan/${clanId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching voice channels", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Create a voice channel
 * POST /voiceChannel
 */
const createVoiceChannel = async (data) => {
  try {
    const response = await api.post("/voiceChannel", data);
    return response.data;
  } catch (error) {
    console.error("Error creating voice channel", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Update a voice channel
 * PUT /voiceChannel
 */
const updateVoiceChannel = async (data) => {
  try {
    const response = await api.put("/voiceChannel", data);
    return response.data;
  } catch (error) {
    console.error("Error updating voice channel", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Delete a voice channel
 * DELETE /voiceChannel/{voiceChannelId}
 */
const deleteVoiceChannel = async (voiceChannelId) => {
  try {
    const response = await api.delete(`/voiceChannel/${voiceChannelId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting voice channel", error.response?.data || error.message);
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
  updateVoiceChannel,
  deleteVoiceChannel,
};

export default ChannelService;