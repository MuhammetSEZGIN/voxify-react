const isTauriRuntime = () =>
  typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

let notificationPluginPromise = null;

async function getNotificationPlugin() {
  if (!isTauriRuntime()) return null;
  if (!notificationPluginPromise) {
    notificationPluginPromise = import('@tauri-apps/plugin-notification');
  }
  return notificationPluginPromise;
}

export async function requestDesktopNotificationPermission() {
  try {
    if (!isTauriRuntime()) {
      if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
      if (Notification.permission !== 'default') return Notification.permission;
      // Tarayıcı bu çağrıyı doğrudan kullanıcı click/change handler'ı içinde görmeli.
      return Notification.requestPermission();
    }

    const plugin = await getNotificationPlugin();
    if (plugin) {
      if (await plugin.isPermissionGranted()) return 'granted';
      return plugin.requestPermission();
    }
    return 'denied';
  } catch (error) {
    console.warn('[Notifications] permission request failed:', error);
    return 'denied';
  }
}

export async function sendDesktopNotification({ title, body, tag }) {
  const plugin = await getNotificationPlugin();
  if (plugin) {
    if (!(await plugin.isPermissionGranted())) return null;
    plugin.sendNotification({ title, body });
    return null;
  }

  if (
    typeof window === 'undefined'
    || !('Notification' in window)
    || Notification.permission !== 'granted'
  ) {
    return null;
  }
  return new Notification(title, { body, tag });
}

export { isTauriRuntime };
