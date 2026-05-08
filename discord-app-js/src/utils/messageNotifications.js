export const MESSAGE_NOTIFICATIONS_MUTED_KEY = 'voxify.messageNotificationsMuted';

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
