import { useState, useEffect, useCallback, useRef } from 'react';

let checkedOnce = false;

export function useUpdater() {
  const [updateInfo, setUpdateInfo] = useState(null); // { version, body, update }
  const [status, setStatus] = useState('idle'); // idle | checking | downloading | error
  const [progress, setProgress] = useState(0); // 0-100
  const [errorMsg, setErrorMsg] = useState('');
  const downloadedRef = useRef(0);
  const totalRef = useRef(0);

  const checkForUpdate = useCallback(async () => {
    if (status === 'checking' || status === 'downloading') return;
    try {
      setStatus('checking');
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      console.log('[Updater] check result:', update);
      if (update?.available) {
        setUpdateInfo({ version: update.version, body: update.body, update });
      }
      setStatus('idle');
    } catch (err) {
      console.error('[Updater] check failed:', err);
      setStatus('idle');
    }
  }, [status]);

  const installUpdate = useCallback(async () => {
    if (!updateInfo?.update) return;
    try {
      setStatus('downloading');
      setProgress(0);
      setErrorMsg('');
      downloadedRef.current = 0;
      totalRef.current = 0;

      await updateInfo.update.downloadAndInstall((event) => {
        console.log('[Updater] download event:', event);
        if (event.event === 'Started') {
          totalRef.current = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloadedRef.current += event.data.chunkLength;
          if (totalRef.current > 0) {
            setProgress(Math.round((downloadedRef.current / totalRef.current) * 100));
          }
        } else if (event.event === 'Finished') {
          setProgress(100);
          console.log('[Updater] download finished, installer running...');
        }
      });

      // NSIS installer takes over after this — no manual restart needed
    } catch (err) {
      console.error('[Updater] install failed:', err);
      setErrorMsg(String(err?.message ?? err));
      setStatus('error');
    }
  }, [updateInfo]);

  const dismiss = useCallback(() => {
    setUpdateInfo(null);
    setStatus('idle');
    setErrorMsg('');
  }, []);

  useEffect(() => {
    if (checkedOnce) return;
    checkedOnce = true;
    const t = setTimeout(() => checkForUpdate(), 3000);
    return () => clearTimeout(t);
  }, []);

  return { updateInfo, status, progress, errorMsg, checkForUpdate, installUpdate, dismiss };
}
