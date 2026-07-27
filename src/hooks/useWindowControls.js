import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const isTauriRuntime = () =>
  typeof window !== 'undefined' &&
  Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

/**
 * Tauri pencere API'sini görsel title bar'dan ayırır. Tarayıcıda uygulama
 * aynı layout ile render edilir; pencere komutları ise pasif kalır.
 */
export default function useWindowControls() {
  const windowRef = useRef(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) return undefined;

    let disposed = false;
    let resizeTimer = null;
    let unlistenResize = null;

    const syncMaximized = async (appWindow) => {
      try {
        const maximized = await appWindow.isMaximized();
        if (!disposed) setIsMaximized(maximized);
      } catch (error) {
        if (!disposed) console.error('[WindowControls] Pencere durumu okunamadı:', error);
      }
    };

    const setup = async () => {
      try {
        const appWindow = getCurrentWindow();
        if (disposed) return;

        windowRef.current = appWindow;
        setIsAvailable(true);
        await syncMaximized(appWindow);

        unlistenResize = await appWindow.onResized(() => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => syncMaximized(appWindow), 80);
        });

        if (disposed) unlistenResize?.();
      } catch (error) {
        if (!disposed) console.error('[WindowControls] Tauri pencere API’si başlatılamadı:', error);
      }
    };

    setup();

    return () => {
      disposed = true;
      clearTimeout(resizeTimer);
      unlistenResize?.();
      windowRef.current = null;
    };
  }, []);

  const minimize = useCallback(async () => {
    try {
      await windowRef.current?.minimize();
    } catch (error) {
      console.error('[WindowControls] Küçültme başarısız:', error);
    }
  }, []);

  const toggleMaximize = useCallback(async () => {
    const appWindow = windowRef.current;
    if (!appWindow) return;
    try {
      const maximized = await appWindow.isMaximized();
      if (maximized) await appWindow.unmaximize();
      else await appWindow.maximize();
      setIsMaximized(!maximized);
    } catch (error) {
      console.error('[WindowControls] Büyütme işlemi başarısız:', error);
    }
  }, []);

  const close = useCallback(async () => {
    try {
      await windowRef.current?.close();
    } catch (error) {
      console.error('[WindowControls] Kapatma başarısız:', error);
    }
  }, []);

  return { isAvailable, isMaximized, minimize, toggleMaximize, close };
}
