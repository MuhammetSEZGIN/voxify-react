import { useCallback, useEffect, useRef } from 'react';
import { areMessageNotificationsMuted } from '../utils/messageNotifications';
import {
  sendDesktopNotification,
} from '../utils/desktopNotifications';

function useDesktopMessageNotifications(channelName) {
  const isWindowFocusedRef = useRef(typeof document !== 'undefined' ? document.hasFocus() : true);
  const isWindowVisibleRef = useRef(typeof document !== 'undefined' ? !document.hidden : true);
  const isAppInBackground = useCallback(() => (
    document.hidden
    || !document.hasFocus()
    || !isWindowFocusedRef.current
    || !isWindowVisibleRef.current
  ), []);

  const showDesktopNotification = useCallback(async (message, options = {}) => {
    const { clanId } = options;
    if (areMessageNotificationsMuted({ clanId, senderId: message.senderId })) return;
    if (!isAppInBackground()) return;

    const notification = await sendDesktopNotification({
      title: `${message.userName || 'Bir kullanıcı'} • #${channelName || 'kanal'}`,
      body: String(message.content || '').trim() || 'Yeni bir mesaj var.',
      tag: `channel-${message.channelId || 'unknown'}`,
    });

    if (notification) notification.onclick = () => {
      notification.close();
      window.focus();
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

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return {
    showDesktopNotification,
  };
}

export default useDesktopMessageNotifications;
