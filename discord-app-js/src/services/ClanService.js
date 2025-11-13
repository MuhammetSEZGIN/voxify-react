import api from "./api";

const getMyClans = async () => {
  try {
    const response = await api.get("/api/clans");
    return response.data;
  } catch (error) {
    console.error(
      "Error fetching clans",
      error.response?.data || error.message
    );
  }
};

const getChannelByClanId = async (clanId) => {
  try {
    const response = await api.get(`/api/clans/${clanId}/channels`);
    return response.data;
  } catch (error) {
    console.error(
      "Error fetching channels for clan",
      error.response?.data || error.message
    );
  }
};

const ClanService = {
  getMyClans,
  getChannelByClanId,
};
export default ClanService;
