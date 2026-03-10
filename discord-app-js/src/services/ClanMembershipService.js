import api from "./api";

const getMembershipById = async (id) => {
  const response = await api.get(`/clanMembership/${id}`);
  return response.data;
};

const deleteMembership = async (id) => {
  const response = await api.delete(`/clanMembership/${id}`);
  return response.data;
};

const getClanMembers = async (clanId) => {
  const response = await api.get(`/clanMembership/clan/${clanId}`);
  return response.data;
};

const getUserMemberships = async (userId) => {
  const response = await api.get(`/clanMembership/user/${userId}`);
  return response.data;
};

const removeUserFromClan = async (clanId, userId) => {
  const response = await api.delete(`/clanMembership/${clanId}/user/${userId}`);
  return response.data;
};

const createInvitation = async (clanId) => {
  const response = await api.post(`/clanMembership/${clanId}/invitations`);
  return response.data;
};

const joinClan = async ({ inviteCode, userId }) => {
  const response = await api.post("/clanMembership/join", { inviteCode, userId });
  return response.data;
};

const ClanMembershipService = {
  getMembershipById,
  deleteMembership,
  getClanMembers,
  getUserMemberships,
  removeUserFromClan,
  createInvitation,
  joinClan,
};

export default ClanMembershipService;
