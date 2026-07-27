export const MESSAGE_NOTIFICATIONS_MUTED_KEY = 'voxify.messageNotificationsMuted';
export const MUTED_CLAN_IDS_KEY = 'voxify.mutedClanIds';
export const MUTED_USER_IDS_KEY = 'voxify.mutedUserIds';

function readIdList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter(Boolean).map(String))] : [];
  } catch {
    return [];
  }
}

function writeIdList(key, ids) {
  const normalized = [...new Set((ids || []).filter(Boolean).map(String))];
  try {
    localStorage.setItem(key, JSON.stringify(normalized));
  } catch {
    // Ignore storage failures
  }
  return normalized;
}

export function getMessageNotificationsMuted() {
  try {
    return localStorage.getItem(MESSAGE_NOTIFICATIONS_MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setMessageNotificationsMuted(muted) {
  try {
    localStorage.setItem(MESSAGE_NOTIFICATIONS_MUTED_KEY, String(Boolean(muted)));
  } catch {
    // Ignore storage failures
  }
}

export const getMutedClanIds = () => readIdList(MUTED_CLAN_IDS_KEY);
export const getMutedUserIds = () => readIdList(MUTED_USER_IDS_KEY);

export function isClanMuted(clanId) {
  return Boolean(clanId) && getMutedClanIds().includes(String(clanId));
}

export function isUserMuted(userId) {
  return Boolean(userId) && getMutedUserIds().includes(String(userId));
}

export function setClanMuted(clanId, muted) {
  if (!clanId) return getMutedClanIds();
  const current = new Set(getMutedClanIds());
  if (muted) current.add(String(clanId));
  else current.delete(String(clanId));
  return writeIdList(MUTED_CLAN_IDS_KEY, [...current]);
}

export function setUserMuted(userId, muted) {
  if (!userId) return getMutedUserIds();
  const current = new Set(getMutedUserIds());
  if (muted) current.add(String(userId));
  else current.delete(String(userId));
  return writeIdList(MUTED_USER_IDS_KEY, [...current]);
}

export function areMessageNotificationsMuted({ clanId, senderId } = {}) {
  return (
    getMessageNotificationsMuted() ||
    isClanMuted(clanId) ||
    isUserMuted(senderId)
  );
}

/** Sessize alma ayarlarına uyarak normal mesaj bildirim sesini çalar. */
export function playMessageNotificationSound({
  clanId,
  senderId,
  volume = 0.5,
} = {}) {
  if (areMessageNotificationsMuted({ clanId, senderId })) return;

  const safeVolume = Math.max(0, Math.min(Number(volume) || 0, 1));
  try {
    const audio = new Audio('/mixkit-select-click-1109.wav');
    audio.volume = safeVolume;
    audio.play().catch(() => {});
  } catch {
    // WebView ses oynatmayı reddederse bildirimin geri kalanı çalışmaya devam eder.
  }
}
