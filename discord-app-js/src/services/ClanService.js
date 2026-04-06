import api from "./api";

/**
 * Get all clans for the current user
 * GET /clan
 */
const getMyClans = async () => {
  try {
    const response = await api.get("/clan/user");
    return response.data;
  } catch (error) {
    console.error("Error fetching clans", error.response?.data || error.message);
    throw error;
  }
};



/**
 * Get a specific clan by ID
 * GET /clan/{clanId}
 */
const getClanById = async (clanId) => {
  try {
    const response = await api.get(`/clan/clanId/${clanId}`);
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
    const response = await api.put(`/clan/clanId/${data.clanId}`, data);
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
    const response = await api.delete(`/clan/clanId/${clanId}`);
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
    const response = await api.post(`/clanMembership/invitations/clanId/${clanId}`);
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
    const response = await api.get(`/clanMembership/clanId/${clanId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching clan members", error.response?.data || error.message);
    throw error;
  }
};

const ClanService = {
  getMyClans,
  getClanById,
  createClan,
  updateClan,
  deleteClan,
  createInvitation,
  joinClan,
  getClanMembers,
};

export default ClanService;