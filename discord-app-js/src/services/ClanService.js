import api from "./api";

/**
 * Get all clans for the current user
 * GET /clan
 */
const getMyClans = async () => {
  try {
    const response = await api.get("/clan");
    return response.data;
  } catch (error) {
    console.error("Error fetching clans", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get clans by user ID
 * GET /clan/user/{userId}
 */
const getClansByUserId = async (userId) => {
  try {
    const response = await api.get(`/clan/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching clans by user", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get a specific clan by ID
 * GET /clan/{clanId}
 */
const getClanById = async (clanId) => {
  try {
    const response = await api.get(`/clan/${clanId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching clan", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Create a new clan
 * POST /clan
 */
const createClan = async (data) => {
  try {
    const response = await api.post("/clan", data);
    return response.data;
  } catch (error) {
    console.error("Error creating clan", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Update a clan
 * PUT /clan
 */
const updateClan = async (data) => {
  try {
    const response = await api.put("/clan", data);
    return response.data;
  } catch (error) {
    console.error("Error updating clan", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Delete a clan
 * DELETE /clan/{clanId}
 */
const deleteClan = async (clanId) => {
  try {
    const response = await api.delete(`/clan/${clanId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting clan", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Create invitation for a clan
 * POST /clanMembership/{clanId}/invitations
 */
const createInvitation = async (clanId) => {
  try {
    const response = await api.post(`/clanMembership/${clanId}/invitations`);
    return response.data;
  } catch (error) {
    console.error("Error creating invitation", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Join a clan with invite code
 * POST /clanMembership/join
 */
const joinClan = async (data) => {
  try {
    const response = await api.post("/clanMembership/join", data);
    return response.data;
  } catch (error) {
    console.error("Error joining clan", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get members of a clan
 * GET /clanMembership/clan/{clanId}
 */
const getClanMembers = async (clanId) => {
  try {
    const response = await api.get(`/clanMembership/clan/${clanId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching clan members", error.response?.data || error.message);
    throw error;
  }
};

const ClanService = {
  getMyClans,
  getClansByUserId,
  getClanById,
  createClan,
  updateClan,
  deleteClan,
  createInvitation,
  joinClan,
  getClanMembers,
};

export default ClanService;