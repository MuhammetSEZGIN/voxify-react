import { memo } from 'react';
import useWindowControls, { isTauriRuntime } from '../../hooks/useWindowControls';
import '../../styles/titlebar.css';

function TitleBar() {
  const {
    isAvailable,
    isMaximized,
    minimize,
    toggleMaximize,
    close,
  } = useWindowControls();

  // Web sürümü tarayıcının kendi pencere kontrollerini kullanır.
  if (!isTauriRuntime()) return null;

  return (
    <header className="titlebar">
      <div
        className="titlebar__drag-region"
        data-tauri-drag-region
        onDoubleClick={toggleMaximize}
      >
        <div className="titlebar__brand" aria-label="Voxify">
          <img src="/logo.png" alt="" className="titlebar__logo" draggable="false" />
          <span className="titlebar__title">Voxify</span>
        </div>
      </div>

      <div className="titlebar__controls" aria-label="Pencere kontrolleri">
        <button
          type="button"
          className="titlebar__button"
          onClick={minimize}
          title="Küçült"
          aria-label="Pencereyi küçült"
          disabled={!isAvailable}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M1 6.5h10" />
          </svg>
        </button>

        <button
          type="button"
          className="titlebar__button"
          onClick={toggleMaximize}
          title={isMaximized ? 'Eski boyuta getir' : 'Ekranı kapla'}
          aria-label={isMaximized ? 'Pencereyi eski boyutuna getir' : 'Pencereyi büyüt'}
          disabled={!isAvailable}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            {isMaximized ? (
              <path d="M3.5 3.5v-2h7v7h-2m-7-5h7v7h-7z" />
            ) : (
              <rect x="1.5" y="1.5" width="9" height="9" />
            )}
          </svg>
        </button>

        <button
          type="button"
          className="titlebar__button titlebar__button--close"
          onClick={close}
          title="Kapat"
          aria-label="Pencereyi kapat"
          disabled={!isAvailable}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="m1.5 1.5 9 9m0-9-9 9" />
          </svg>
        </button>
      </div>
    </header>
  );
}

export default memo(TitleBar);
