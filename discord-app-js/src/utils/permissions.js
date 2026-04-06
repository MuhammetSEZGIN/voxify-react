/**
 * Klan içi hiyerarşi seviyeleri.
 * Backend token'a "clanRoles" claim'i olarak aşağıdaki yapıda koymalı:
 * {
 *   "clanRoles": {
 *     "<clanId>": "owner" | "admin" | "member"
 *   }
 * }
 */

const ROLE_HIERARCHY = {
  owner: 4,
  admin: 3,
  member: 1,
};

/**
 * Kullanıcının belirli bir klandaki rolünü döndürür.
 * @param {Object|null} user - decoded JWT user object
 * @param {string} clanId
 * @returns {string} role - "owner" | "admin" | "member" | "none"
 */
export function getClanRole(user, clanId) {
  if (!user || !clanId) return 'none';
  const clanRoles = user.clanRoles || user.ClanRoles || {};
  return clanRoles[clanId] || 'none';
}

/**
 * Kullanıcının belirli bir klanda en az verilen role sahip olup olmadığını kontrol eder.
 * @param {Object|null} user
 * @param {string} clanId
 * @param {string} requiredRole - "owner" | "admin" | "member"
 * @returns {boolean}
 */
export function hasMinRole(user, clanId, requiredRole) {
  const userRole = getClanRole(user, clanId);
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Kullanıcının bir mesajı silebilip silemeyeceğini kontrol eder.
 * Kendi mesajını herkes silebilir; başkasının mesajını admin+ silebilir.
 * @param {Object|null} user
 * @param {string} clanId
 * @param {string} messageAuthorId
 * @returns {boolean}
 */
export function canDeleteMessage(user, clanId, messageAuthorId) {
  if (!user) return false;
  const userId = user.id || user.sub || user.userId;
  if (userId === messageAuthorId) return true;
  return hasMinRole(user, clanId, 'admin');
}

/**
 * Kullanıcının bir mesajı düzenleyebilip düzenleyemeyeceğini kontrol eder.
 * Sadece kendi mesajını düzenleyebilir.
 */
export function canEditMessage(user, messageAuthorId) {
  if (!user) return false;
  const userId = user.id || user.sub || user.userId;
  return userId === messageAuthorId;
}

/**
 * Kanal oluşturma yetkisi - admin+
 */
export function canManageChannels(user, clanId) {
  return hasMinRole(user, clanId, 'admin');
}

/**
 * Klan ayarları yetkisi - owner
 */
export function canManageClan(user, clanId) {
  return hasMinRole(user, clanId, 'owner');
}
