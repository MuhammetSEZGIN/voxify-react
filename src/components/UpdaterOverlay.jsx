import { useState, useEffect } from 'react';

// Tauri modüllerini dinamik import ile yükle — tarayıcı ortamında hata vermez
async function loadUpdater() {
  if (!window.__TAURI__) return null;
  try {
    return await import(/* @vite-ignore */ '@tauri-apps/plugin-updater');
  } catch {
    return null;
  }
}

async function loadProcess() {
  if (!window.__TAURI__) return null;
  try {
    return await import(/* @vite-ignore */ '@tauri-apps/plugin-process');
  } catch {
    return null;
  }
}

function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// state: 'idle' | 'downloading' | 'installing' | 'done' | 'error'
function UpdaterOverlay() {
  const [state, setState] = useState('idle');
  const [updateInfo, setUpdateInfo] = useState(null); // { version, notes }
  const [progress, setProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!window.__TAURI__) return;

    let cancelled = false;

    const run = async () => {
      const updaterModule = await loadUpdater();
      if (!updaterModule || cancelled) return;

      let update;
      try {
        update = await updaterModule.check();
      } catch (err) {
        console.warn('[Updater] Güncelleme kontrolü başarısız:', err);
        return;
      }

      if (!update || cancelled) return;

      setUpdateInfo({ version: update.version, notes: update.body || '' });
      setState('downloading');

      let dlBytes = 0;
      let totalBytes = 0;

      try {
        await update.downloadAndInstall((event) => {
          if (cancelled) return;
          if (event.event === 'Started') {
            totalBytes = event.data.contentLength || 0;
            setTotal(totalBytes);
          } else if (event.event === 'Progress') {
            dlBytes += event.data.chunkLength;
            setDownloaded(dlBytes);
            if (totalBytes > 0) {
              setProgress(Math.min(100, Math.round((dlBytes / totalBytes) * 100)));
            }
          } else if (event.event === 'Finished') {
            setState('installing');
          }
        });
      } catch (err) {
        console.error('[Updater] İndirme/kurulum hatası:', err);
        // Bloke etme — kullanıcı uygulamayı kullanmaya devam edebilir
        setState('idle');
        return;
      }

      if (cancelled) return;
      setState('done');

      await new Promise((r) => setTimeout(r, 1500));
      if (cancelled) return;

      const processModule = await loadProcess();
      if (processModule) {
        await processModule.relaunch();
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  if (state === 'idle') return null;

  return (
    <div className="updater-overlay">
      <div className="updater-overlay__card">
        <div className="updater-overlay__icon-wrap">
          <span className="material-symbols-outlined updater-overlay__icon">
            system_update
          </span>
        </div>

        {state === 'downloading' && (
          <>
            <h2 className="updater-overlay__title">Güncelleme İndiriliyor</h2>
            {updateInfo?.version && (
              <p className="updater-overlay__version">Voxify {updateInfo.version}</p>
            )}
            {updateInfo?.notes && (
              <p className="updater-overlay__notes">{updateInfo.notes}</p>
            )}
            <div className="updater-overlay__bar-track">
              <div
                className="updater-overlay__bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="updater-overlay__stats">
              {total > 0
                ? `${formatBytes(downloaded)} / ${formatBytes(total)} — %${progress}`
                : 'İndiriliyor...'}
            </p>
          </>
        )}

        {state === 'installing' && (
          <>
            <h2 className="updater-overlay__title">Kuruluyor</h2>
            {updateInfo?.version && (
              <p className="updater-overlay__version">Voxify {updateInfo.version}</p>
            )}
            <div className="updater-overlay__bar-track">
              <div className="updater-overlay__bar-fill updater-overlay__bar-fill--pulse" />
            </div>
            <p className="updater-overlay__stats">Lütfen bekleyin...</p>
          </>
        )}

        {state === 'done' && (
          <>
            <h2 className="updater-overlay__title">Güncelleme Tamamlandı</h2>
            <p className="updater-overlay__stats">Voxify yeniden başlatılıyor...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default UpdaterOverlay;
