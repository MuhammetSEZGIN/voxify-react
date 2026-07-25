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
    const plugin = await getNotificationPlugin();
    if (plugin) {
      if (await plugin.isPermissionGranted()) return 'granted';
      return plugin.requestPermission();
    }

    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    if (Notification.permission !== 'default') return Notification.permission;
    return Notification.requestPermission();
  } catch (error) {
    console.warn('[Notifications] permission request failed:', error);
    return 'denied';
  }
}

export async function sendDesktopNotification({ title, body, tag }) {
  const permission = await requestDesktopNotificationPermission();
  if (permission !== 'granted') return null;

  const plugin = await getNotificationPlugin();
  if (plugin) {
    plugin.sendNotification({ title, body });
    return null;
  }

  return new Notification(title, { body, tag });
}

export { isTauriRuntime };
