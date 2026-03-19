import React from 'react';

/**
 * ScreenShareStatusBar
 * Ses kanalı bağlantısı aktifken voice-status-panel'in ÜSTÜNDE görünen
 * ince ekran paylaşımı kontrol çubuğu.
 */
function ScreenShareStatusBar({ activeVoiceChannel, voiceState, onWatchOwnShare }) {
  if (!activeVoiceChannel || !voiceState) return null;

  const { isScreenSharing, startScreenShare, stopScreenShare } = voiceState;

  return (
    <div className="screenshare-status-bar">
      <div className="screenshare-status-bar__info">
        <span className="material-symbols-outlined screenshare-status-bar__icon">
          {isScreenSharing ? 'present_to_all' : 'screen_share'}
        </span>
        <div className="screenshare-status-bar__text">
          <span className="screenshare-status-bar__label">
            {isScreenSharing ? 'Ekran Yayını Aktif' : 'Ekran Paylaşımı'}
          </span>
          <span className="screenshare-status-bar__channel">
            {activeVoiceChannel.name}
          </span>
        </div>
      </div>

      <div className="screenshare-status-bar__actions">
        {isScreenSharing ? (
          <button
            className="screenshare-status-bar__btn screenshare-status-bar__btn--stop"
            onClick={stopScreenShare}
            title="Yayını Durdur"
          >
            <span className="material-symbols-outlined">stop_screen_share</span>
          </button>
        ) : (
          <button
            className="screenshare-status-bar__btn screenshare-status-bar__btn--start"
            onClick={startScreenShare}
            title="Ekranı Paylaş"
          >
            <span className="material-symbols-outlined">present_to_all</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default ScreenShareStatusBar;
