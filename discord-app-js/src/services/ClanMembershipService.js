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
  const response = await api.get(`/clanMembership/clanId/${clanId}`);
  return response.data;
};

const getUserMemberships = async (userId) => {
  const response = await api.get(`/clanMembership/user/${userId}`);
  return response.data;
};

const removeUserFromClan = async (clanId, userId) => {
  const response = await api.delete(`/clanMembership/member/${userId}/clanId/${clanId}`);
  return response.data;
};
const leaveClan = async (clanId) => {
  const response = await api.delete(`/clanMembership/user/clanId/${clanId}`);
  return response.data;
};

const createInvitation = async (clanId) => {
  const response = await api.post(`/clanMembership/invitations/clanId/${clanId}`);
  return response.data;
};

const joinClan = async ({ inviteCode, userId }) => {
  const response = await api.post("/clanMembership/join", { inviteCode, userId });
  return response.data;
};

const updateMemberRole = async (membershipId, roleName, clanId) => {
  const response = await api.put(`/role/clanId/${clanId}`, { membershipId, roleName });
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
  updateMemberRole,
};

export default ClanMembershipService;
