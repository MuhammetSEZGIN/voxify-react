export async function requestDesktopNotificationPermission() {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    if (Notification.permission !== 'default') return Notification.permission;
    // Tarayıcı bu çağrıyı doğrudan kullanıcı click/change handler'ı içinde görmeli.
    return Notification.requestPermission();
  } catch (error) {
    console.warn('[Notifications] permission request failed:', error);
    return 'denied';
  }
}

export async function sendDesktopNotification({ title, body, tag }) {
  if (
    typeof window === 'undefined'
    || !('Notification' in window)
    || Notification.permission !== 'granted'
  ) {
    return null;
  }
  return new Notification(title, { body, tag });
}
