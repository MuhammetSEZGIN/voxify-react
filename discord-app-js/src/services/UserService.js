import api from "./api";

/**
 * Şifre değiştirme, e-posta doğrulama, profil ve kullanıcı arama işlemleri.
 * Backend IdentityService'e Ocelot gateway üzerinden `/identity/*` prefix'i ile konuşur.
 * Route'lar guncelleme-plani-backend.md'deki gerçek IdentityService kontratına göre.
 */

// AuthService.js'deki login/register/refresh-token ile aynı response zarfı: { isSuccessfull, message, data }
function unwrap(result, fallbackMessage) {
  if (result?.isSuccessfull === false) {
    throw new Error(result.message || fallbackMessage);
  }
  return result?.data ?? result;
}

/**
 * Oturum açık kullanıcının şifresini değiştirir.
 * POST /identity/user/change-password — userId JWT'den okunur.
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<Object>}
 */
async function changePassword(currentPassword, newPassword) {
  try {
    const response = await api.post("/identity/user/change-password", {
      currentPassword,
      newPassword,
    });
    return unwrap(response.data, "Şifre değiştirilemedi");
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "Şifre değiştirilirken bir hata oluştu";
    throw new Error(msg);
  }
}

/**
 * Kayıtlı e-postaya yeni bir doğrulama bağlantısı gönderilmesini ister.
 * POST /identity/auth/resend-confirmation-email — henüz login olmamış kullanıcılar
 * da çağırabildiği için userId body'de gönderilir, JWT şart değil.
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function resendConfirmationEmail(userId) {
  try {
    const response = await api.post("/identity/auth/resend-confirmation-email", { userId });
    return unwrap(response.data, "Doğrulama e-postası gönderilemedi");
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "Doğrulama e-postası gönderilirken bir hata oluştu";
    throw new Error(msg);
  }
}

/**
 * E-posta doğrulama bağlantısındaki token'ı backend'e onaylatır.
 * GET /identity/auth/confirm-email?userId=...&token=... (e-postadaki linkin hedefi).
 * @param {string} userId
 * @param {string} token
 * @returns {Promise<Object>}
 */
async function confirmEmail(userId, token) {
  try {
    const response = await api.get("/identity/auth/confirm-email", {
      params: { userId, token },
    });
    return unwrap(response.data, "E-posta doğrulanamadı");
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "E-posta doğrulanırken bir hata oluştu";
    throw new Error(msg);
  }
}

/**
 * Oturum açık kullanıcının profil bilgilerini getirir.
 * GET /identity/user/me
 * @returns {Promise<{userName, email, bio, avatarUrl, emailConfirmed}>}
 */
async function getMe() {
  try {
    const response = await api.get("/identity/user/me");
    return unwrap(response.data, "Profil bilgileri alınamadı");
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "Profil bilgileri alınırken bir hata oluştu";
    throw new Error(msg);
  }
}

/**
 * Profil bilgilerini günceller (görünen ad, biyografi, avatar URL'si vb).
 * PUT /identity/user — userId JWT'den okunur.
 * @param {{userName?: string, bio?: string, avatarUrl?: string}} updates
 * @returns {Promise<Object>}
 */
async function updateProfile(updates) {
  try {
    const response = await api.put("/identity/user", updates);
    return unwrap(response.data, "Profil güncellenemedi");
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "Profil güncellenirken bir hata oluştu";
    throw new Error(msg);
  }
}

/**
 * Kullanıcı adına göre kullanıcı arar (arkadaş ekleme akışı için de kullanılır).
 * GET /identity/user/search?q=...&page=...&limit=...
 * @param {string} query
 * @param {number} page
 * @param {number} limit
 * @returns {Promise<Array<{id, userName, avatarUrl}>>}
 */
async function searchUsers(query, page = 1, limit = 20) {
  try {
    const response = await api.get("/identity/user/search", {
      params: { q: query, page, limit },
    });
    return unwrap(response.data, "Kullanıcı arama başarısız");
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "Kullanıcı aranırken bir hata oluştu";
    throw new Error(msg);
  }
}

const UserService = {
  changePassword,
  resendConfirmationEmail,
  confirmEmail,
  getMe,
  updateProfile,
  searchUsers,
};

export default UserService;
export { changePassword, resendConfirmationEmail, confirmEmail, getMe, updateProfile, searchUsers };
