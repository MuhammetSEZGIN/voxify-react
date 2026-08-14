import api from "./api";
import {
  getMemberAvatarUrl,
  getMemberBio,
  getMemberId,
  getMemberName,
  getMemberProfileBackgroundUrl,
} from '../utils/member';

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

function describeError(error, fallbackMessage) {
  const data = error.response?.data;

  if (Array.isArray(data)) {
    const descriptions = data
      .map((item) => item?.description || item?.message || String(item || ''))
      .filter(Boolean);
    if (descriptions.length) return descriptions.join(' ');
  }

  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.join(' ');
  }

  if (data?.errorsByField && typeof data.errorsByField === 'object') {
    const fieldErrors = Object.values(data.errorsByField).flat().filter(Boolean);
    if (fieldErrors.length) return fieldErrors.join(' ');
  }

  return data?.message || data?.detail || data?.title || error.message || fallbackMessage;
}

function isUnsupportedProfileBackgroundField(error) {
  if (![400, 422].includes(error.response?.status)) return false;
  const details = `${error.message || ''} ${JSON.stringify(error.response?.data || {})}`.toLowerCase();
  return details.includes('profilebackgroundurl')
    && ['unknown', 'unmapped', 'not recognized', 'not supported', 'could not be mapped']
      .some((phrase) => details.includes(phrase));
}

function normalizeProfile(profile) {
  if (!profile) return profile;

  const normalized = {
    ...profile,
    id: getMemberId(profile),
    userName: getMemberName(profile),
    avatarUrl: getMemberAvatarUrl(profile),
    bio: getMemberBio(profile),
  };

  const hasProfileBackground = [
    'profileBackgroundUrl',
    'ProfileBackgroundUrl',
    'backgroundUrl',
    'BackgroundUrl',
    'bannerUrl',
    'BannerUrl',
  ].some((key) => Object.prototype.hasOwnProperty.call(profile, key))
    || ['profileBackgroundUrl', 'backgroundUrl', 'bannerUrl'].some(
      (key) => Object.prototype.hasOwnProperty.call(profile.user || {}, key)
    );

  if (hasProfileBackground) {
    normalized.profileBackgroundUrl = getMemberProfileBackgroundUrl(profile);
  }

  return normalized;
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
    throw new Error(describeError(error, 'Şifre değiştirilirken bir hata oluştu'));
  }
}

/**
 * Kayıtlı e-postaya yeni bir doğrulama bağlantısı gönderilmesini ister.
 * POST /identity/resend-confirmation-email
 * @param {string} email
 * @returns {Promise<Object>}
 */
async function resendConfirmationEmail(email) {
  try {
    const response = await api.post("/identity/resend-confirmation-email", { email });
    return unwrap(response.data, "Doğrulama e-postası gönderilemedi");
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "Doğrulama e-postası gönderilirken bir hata oluştu";
    throw new Error(msg);
  }
}

/**
 * E-posta doğrulama bağlantısındaki token'ı backend'e onaylatır.
 * GET /identity/confirm-email?userId=...&token=... (e-postadaki linkin hedefi).
 * @param {string} userId
 * @param {string} token
 * @returns {Promise<Object>}
 */
async function confirmEmail(userId, token) {
  try {
    const response = await api.get("/identity/confirm-email", {
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
 * @returns {Promise<{userName, email, bio, avatarUrl, profileBackgroundUrl, emailConfirmed}>}
 */
async function getMe() {
  try {
    const response = await api.get("/identity/user/me");
    return normalizeProfile(unwrap(response.data, "Profil bilgileri alınamadı"));
  } catch (error) {
    throw new Error(describeError(error, 'Profil bilgileri alınırken bir hata oluştu'));
  }
}

/**
 * Profil bilgilerini günceller (görünen ad, biyografi, avatar URL'si vb).
 * PUT /identity/user/update — userId JWT'den okunur.
 * @param {{userName?: string, bio?: string, avatarUrl?: string, profileBackgroundUrl?: string}} updates
 * @returns {Promise<Object>}
 */
async function updateProfile(updates) {
  try {
    const response = await api.put("/identity/user/update", updates);
    unwrap(response.data, "Profil güncellenemedi");
    // Endpoint yalnızca başarı mesajı döndürüyor. AuthContext'e gönderilecek
    // güncel profil alanları isteğin kendisidir.
    return updates;
  } catch (error) {
    // Yeni profil arka planı alanı henüz canlı backend DTO'suna eklenmediyse,
    // kullanıcı adı/biyografi/avatar kaydını bozmamak için eski kontratla bir
    // kez daha dene. Arka plan bu sırada AuthContext'te yerel olarak korunur.
    if (
      Object.prototype.hasOwnProperty.call(updates, 'profileBackgroundUrl')
      && isUnsupportedProfileBackgroundField(error)
    ) {
      const { profileBackgroundUrl: _unsupportedProfileBackgroundUrl, ...legacyUpdates } = updates;
      try {
        const legacyResponse = await api.put('/identity/user/update', legacyUpdates);
        unwrap(legacyResponse.data, 'Profil güncellenemedi');
        return updates;
      } catch (legacyError) {
        throw new Error(describeError(legacyError, 'Profil güncellenirken bir hata oluştu'));
      }
    }
    throw new Error(describeError(error, 'Profil güncellenirken bir hata oluştu'));
  }
}

/**
 * Başka bir kullanıcının profil kartında gösterilebilen herkese açık alanlarını
 * getirir. Endpoint henüz backend'de yoksa çağıran bileşen üyelik/arkadaşlık
 * verisine sessizce geri düşer. `skipAuthRefresh`, gateway'in olmayan route'u
 * 401 olarak raporladığı kurulumlarda oturumun yanlışlıkla kapanmasını önler.
 *
 * GET /identity/user/{userId}/profile
 * @param {string} userId
 * @param {AbortSignal} signal
 */
async function getPublicProfile(userId, signal) {
  if (!userId) return null;

  try {
    const response = await api.get(`/identity/user/${encodeURIComponent(userId)}/profile`, {
      signal,
      skipAuthRefresh: true,
    });
    return normalizeProfile(unwrap(response.data, 'Kullanıcı profili alınamadı'));
  } catch (error) {
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') throw error;
    throw new Error(describeError(error, 'Kullanıcı profili alınamadı'));
  }
}

/**
 * Oturumdaki kullanıcının e-posta adresini değiştirir ve yeni adrese doğrulama
 * bağlantısı gönderir. Aynı doğrulanmamış adres gönderildiğinde maili yeniler.
 * PUT /identity/user/email — userId JWT'den okunur.
 * @param {string} email
 * @returns {Promise<Object>}
 */
async function updateEmail(email) {
  try {
    const response = await api.put('/identity/user/email', { email });
    return unwrap(response.data, 'E-posta adresi güncellenemedi');
  } catch (error) {
    throw new Error(describeError(error, 'E-posta adresi güncellenirken bir hata oluştu'));
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
async function searchUsers(query, page = 1, limit = 20, signal) {
  try {
    const response = await api.get("/identity/user/search", {
      params: { q: query, page, limit },
      signal,
    });
    const result = unwrap(response.data, "Kullanıcı arama başarısız");
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.items)) return result.items;
    if (Array.isArray(result?.$values)) return result.$values;
    return [];
  } catch (error) {
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') throw error;
    console.error('[UserService] Kullanıcı arama isteği başarısız:', {
      status: error.response?.status,
      response: error.response?.data,
      message: error.message,
    });
    const msg = error.response?.data?.message || error.message || "Kullanıcı aranırken bir hata oluştu";
    throw new Error(msg);
  }
}

const UserService = {
  changePassword,
  resendConfirmationEmail,
  confirmEmail,
  getMe,
  getPublicProfile,
  updateProfile,
  updateEmail,
  searchUsers,
};

export default UserService;
export {
  changePassword,
  resendConfirmationEmail,
  confirmEmail,
  getMe,
  getPublicProfile,
  updateProfile,
  updateEmail,
  searchUsers,
};
