import { useCallback, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getMessageNotificationsMuted } from '../utils/messageNotifications';

function useDesktopMessageNotifications(channelName) {
  const appWindowRef = useRef(null);
  const isWindowFocusedRef = useRef(typeof document !== 'undefined' ? document.hasFocus() : true);
  const isWindowVisibleRef = useRef(typeof document !== 'undefined' ? !document.hidden : true);
  const notificationPermissionRequestedRef = useRef(false);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    if (Notification.permission !== 'default') return Notification.permission;
    if (notificationPermissionRequestedRef.current) return Notification.permission;

    notificationPermissionRequestedRef.current = true;
    try {
      return await Notification.requestPermission();
    } catch (error) {
      console.warn('[Notifications] permission request failed:', error);
      return 'denied';
    }
  }, []);

  const isAppInBackground = useCallback(async () => {
    const browserHidden = document.hidden || !document.hasFocus();

    try {
      const appWindow = appWindowRef.current;
      if (!appWindow) return browserHidden;

      const [isMinimized, isVisible] = await Promise.all([
        appWindow.isMinimized(),
        appWindow.isVisible(),
      ]);

      return browserHidden || isMinimized || !isVisible || !isWindowFocusedRef.current || !isWindowVisibleRef.current;
    } catch {
      return browserHidden || !isWindowFocusedRef.current || !isWindowVisibleRef.current;
    }
  }, []);

  const showDesktopNotification = useCallback(async (message) => {
    if (getMessageNotificationsMuted()) return;

    const permission = await requestNotificationPermission();
    if (permission !== 'granted') return;
    if (!(await isAppInBackground())) return;

    const notification = new Notification(
      `${message.userName || 'Bir kullanıcı'} • #${channelName || 'kanal'}`,
      {
        body: String(message.content || '').trim() || 'Yeni bir mesaj var.',
        tag: `channel-${message.channelId || 'unknown'}`,
      }
    );

    notification.onclick = async () => {
      notification.close();
      try {
        const appWindow = appWindowRef.current;
        await appWindow?.show();
        await appWindow?.unminimize();
        await appWindow?.setFocus();
      } catch (error) {
        console.warn('[Notifications] failed to focus app after click:', error);
      }
    };
  }, [channelName, isAppInBackground, requestNotificationPermission]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      isWindowVisibleRef.current = !document.hidden;
    };
    const handleFocus = () => {
      isWindowFocusedRef.current = true;
    };
    const handleBlur = () => {
      isWindowFocusedRef.current = false;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    let unlistenFocusChange = null;

    async function setupWindowTracking() {
      try {
        const appWindow = getCurrentWindow();
        appWindowRef.current = appWindow;
        isWindowVisibleRef.current = await appWindow.isVisible();
        isWindowFocusedRef.current = !(await appWindow.isMinimized()) && document.hasFocus();
        unlistenFocusChange = await appWindow.onFocusChanged(({ payload: focused }) => {
          isWindowFocusedRef.current = focused;
        });
      } catch {
        appWindowRef.current = null;
      }
    }

    setupWindowTracking();
    requestNotificationPermission().catch(() => {});

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      if (unlistenFocusChange) {
        unlistenFocusChange();
      }
    };
  }, [requestNotificationPermission]);

  return {
    showDesktopNotification,
  };
}

export default useDesktopMessageNotifications;
