import React, { memo, useState } from 'react';
import { SCREEN_SHARE_QUALITIES } from '../../hooks/useScreenShare';

function ScreenShareControls({ voiceState, onWatchScreenShare, compact = false }) {
  const [quality, setQuality] = useState('medium');

  if (!voiceState) return null;

  const {
    isScreenSharing,
    isStartingScreenShare,
    remoteScreenShares = [],
    screenShareError,
    startScreenShare,
    stopScreenShare,
  } = voiceState;
  const remoteShare = remoteScreenShares[0];

  return (
    <div className={`screenshare-controls ${compact ? 'screenshare-controls--compact' : ''}`}>
      {remoteShare && (
        <button
          type="button"
          className="screenshare-controls__btn screenshare-controls__btn--watch"
          onClick={() => onWatchScreenShare?.(remoteShare.participantIdentity)}
          title={`${remoteShare.name} kullanıcısının ekranını izle`}
        >
          <span className="material-symbols-outlined">visibility</span>
          {!compact && <span>Yayını İzle</span>}
        </button>
      )}

      {!isScreenSharing && (
        <select
          className="screenshare-controls__quality"
          value={quality}
          onChange={(event) => setQuality(event.target.value)}
          title="Ekran paylaşımı kalitesi"
          aria-label="Ekran paylaşımı kalitesi"
          disabled={isStartingScreenShare}
        >
          {SCREEN_SHARE_QUALITIES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      )}

      {isScreenSharing ? (
        <button
          type="button"
          className="screenshare-controls__btn screenshare-controls__btn--stop"
          onClick={stopScreenShare}
          title="Ekran paylaşımını durdur"
        >
          <span className="material-symbols-outlined">stop_screen_share</span>
          {!compact && <span>Paylaşımı Durdur</span>}
        </button>
      ) : (
        <button
          type="button"
          className="screenshare-controls__btn screenshare-controls__btn--start"
          onClick={() => startScreenShare?.(quality)}
          disabled={isStartingScreenShare}
          title="Ekranını paylaş"
        >
          <span className="material-symbols-outlined">present_to_all</span>
          {!compact && <span>{isStartingScreenShare ? 'Başlatılıyor...' : 'Ekranı Paylaş'}</span>}
        </button>
      )}

      {screenShareError && (
        <span className="screenshare-controls__error material-symbols-outlined" title={screenShareError}>
          error
        </span>
      )}
    </div>
  );
}

export default memo(ScreenShareControls);

