import api from "./api";

/**
 * Get all clans for the current user
 * GET /api/Clan
 */
const getMyClans = async () => {
  try {
    const response = await api.get("/Clan");
    return response.data;
  } catch (error) {
    console.error("Error fetching clans", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get clans by user ID
 * GET /api/Clan/user/{userId}
 */
const getClansByUserId = async (userId) => {
  try {
    const response = await api.get(`/Clan/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching clans by user", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get a specific clan by ID
 * GET /api/Clan/{clanId}
 */
const getClanById = async (clanId) => {
  try {
    const response = await api.get(`/Clan/${clanId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching clan", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Create a new clan
 * POST /api/Clan
 * @param {Object} data - { name: string, userId: string, imagePath?: string, description?: string }
 */
const createClan = async (data) => {
  try {
    const response = await api.post("/Clan", data);
    return response.data;
  } catch (error) {
    console.error("Error creating clan", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Update a clan
 * PUT /api/Clan
 * @param {Object} data - { clanId: string, name: string, imagePath?: string }
 */
const updateClan = async (data) => {
  try {
    const response = await api.put("/Clan", data);
    return response.data;
  } catch (error) {
    console.error("Error updating clan", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Delete a clan
 * DELETE /api/Clan/{clanId}
 */
const deleteClan = async (clanId) => {
  try {
    const response = await api.delete(`/Clan/${clanId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting clan", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Create invitation for a clan
 * POST /api/ClanMembership/{clanId}/invitations
 */
const createInvitation = async (clanId) => {
  try {
    const response = await api.post(`/ClanMembership/${clanId}/invitations`);
    return response.data;
  } catch (error) {
    console.error("Error creating invitation", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Join a clan with invite code
 * POST /api/ClanMembership/join
 * @param {Object} data - { inviteCode: string, userId: string }
 */
const joinClan = async (data) => {
  try {
    const response = await api.post("/ClanMembership/join", data);
    return response.data;
  } catch (error) {
    console.error("Error joining clan", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get members of a clan
 * GET /api/ClanMembership/clan/{clanId}
 */
const getClanMembers = async (clanId) => {
  try {
    const response = await api.get(`/ClanMembership/clan/${clanId}`);
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