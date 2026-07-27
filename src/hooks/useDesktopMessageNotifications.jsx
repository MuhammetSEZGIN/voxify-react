import { useCallback, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { areMessageNotificationsMuted } from '../utils/messageNotifications';
import {
  sendDesktopNotification,
} from '../utils/desktopNotifications';

function useDesktopMessageNotifications(channelName) {
  const appWindowRef = useRef(null);
  const isWindowFocusedRef = useRef(typeof document !== 'undefined' ? document.hasFocus() : true);
  const isWindowVisibleRef = useRef(typeof document !== 'undefined' ? !document.hidden : true);
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

  const showDesktopNotification = useCallback(async (message, options = {}) => {
    const { clanId } = options;
    if (areMessageNotificationsMuted({ clanId, senderId: message.senderId })) return;
    if (!(await isAppInBackground())) return;

    const notification = await sendDesktopNotification({
      title: `${message.userName || 'Bir kullanıcı'} • #${channelName || 'kanal'}`,
      body: String(message.content || '').trim() || 'Yeni bir mesaj var.',
      tag: `channel-${message.channelId || 'unknown'}`,
    });

    if (notification) notification.onclick = async () => {
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
  }, [channelName, isAppInBackground]);

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
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      if (unlistenFocusChange) {
        unlistenFocusChange();
      }
    };
  }, []);

  return {
    showDesktopNotification,
  };
}

export default useDesktopMessageNotifications;
