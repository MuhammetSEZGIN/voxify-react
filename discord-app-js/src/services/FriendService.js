import api from "./api";

/**
 * Arkadaşlık işlemleri. Backend IdentityService `FriendshipController`
 * (`guncelleme-plani-backend.md` madde 3) ile Ocelot `/identity/*` prefix'i
 * üzerinden konuşur. userId her zaman JWT'den okunur, client'tan gönderilmez.
 */

function unwrap(result, fallbackMessage) {
  if (result?.isSuccessfull === false) {
    throw new Error(result.message || fallbackMessage);
  }
  return result?.data ?? result;
}

/**
 * Kabul edilmiş arkadaş listesini getirir.
 * GET /identity/friendship
 * @returns {Promise<Array<{id, userName, avatarUrl}>>}
 */
async function getFriends() {
  try {
    const response = await api.get("/identity/friendship");
    return unwrap(response.data, "Arkadaş listesi alınamadı");
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "Arkadaş listesi alınırken bir hata oluştu";
    throw new Error(msg);
  }
}

/**
 * Gelen/giden bekleyen arkadaşlık isteklerini getirir.
 * GET /identity/friendship/requests
 * @returns {Promise<{incoming: Array, outgoing: Array}>}
 */
async function getRequests() {
  try {
    const response = await api.get("/identity/friendship/requests");
    return unwrap(response.data, "İstekler alınamadı");
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "İstekler alınırken bir hata oluştu";
    throw new Error(msg);
  }
}

/**
 * Bir kullanıcıya arkadaşlık isteği gönderir.
 * POST /identity/friendship/requests { addresseeId }
 * @param {string} addresseeId
 */
async function sendRequest(addresseeId) {
  try {
    const response = await api.post("/identity/friendship/requests", { addresseeId });
    return unwrap(response.data, "İstek gönderilemedi");
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "İstek gönderilirken bir hata oluştu";
    throw new Error(msg);
  }
}

/**
 * Gelen bir arkadaşlık isteğini kabul eder.
 * POST /identity/friendship/requests/{id}/accept
 * @param {string} requestId
 */
async function acceptRequest(requestId) {
  try {
    const response = await api.post(`/identity/friendship/requests/${requestId}/accept`);
    return unwrap(response.data, "İstek kabul edilemedi");
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "İstek kabul edilirken bir hata oluştu";
    throw new Error(msg);
  }
}

/**
 * Gelen bir arkadaşlık isteğini reddeder.
 * POST /identity/friendship/requests/{id}/reject
 * @param {string} requestId
 */
async function rejectRequest(requestId) {
  try {
    const response = await api.post(`/identity/friendship/requests/${requestId}/reject`);
    return unwrap(response.data, "İstek reddedilemedi");
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "İstek reddedilirken bir hata oluştu";
    throw new Error(msg);
  }
}

/**
 * Bir arkadaşlığı sonlandırır.
 * DELETE /identity/friendship/{friendUserId}
 * @param {string} friendUserId
 */
async function removeFriend(friendUserId) {
  try {
    const response = await api.delete(`/identity/friendship/${friendUserId}`);
    return unwrap(response.data, "Arkadaşlıktan çıkarılamadı");
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "Arkadaşlıktan çıkarılırken bir hata oluştu";
    throw new Error(msg);
  }
}

const FriendService = {
  getFriends,
  getRequests,
  sendRequest,
  acceptRequest,
  rejectRequest,
  removeFriend,
};

export default FriendService;
export { getFriends, getRequests, sendRequest, acceptRequest, rejectRequest, removeFriend };
