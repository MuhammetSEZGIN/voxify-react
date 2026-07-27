import React from 'react';
import '../../styles/update-notification.css';

function UpdateNotification({ updateInfo, status, progress, errorMsg, onInstall, onDismiss }) {
  if (!updateInfo) return null;

  const isDownloading = status === 'downloading';
  const isError = status === 'error';

  return (
    <div className="update-notification">
      <div className="update-notification__icon">
        <span className="material-symbols-outlined">system_update</span>
      </div>
      <div className="update-notification__content">
        <div className="update-notification__title">
          Voxify {updateInfo.version} mevcut
        </div>
        {updateInfo.body && (
          <div className="update-notification__notes">{updateInfo.body}</div>
        )}
        {isDownloading && (
          <div className="update-notification__progress-bar">
            <div
              className="update-notification__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {isError && errorMsg && (
          <div className="update-notification__error">{errorMsg}</div>
        )}
      </div>
      <div className="update-notification__actions">
        {!isDownloading && (
          <>
            <button
              className="update-notification__btn update-notification__btn--primary"
              onClick={onInstall}
            >
              {isError ? 'Tekrar Dene' : 'Güncelle'}
            </button>
            <button
              className="update-notification__btn update-notification__btn--ghost"
              onClick={onDismiss}
            >
              Daha sonra
            </button>
          </>
        )}
        {isDownloading && (
          <span className="update-notification__downloading">
            İndiriliyor… {progress > 0 ? `${progress}%` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export default UpdateNotification;
