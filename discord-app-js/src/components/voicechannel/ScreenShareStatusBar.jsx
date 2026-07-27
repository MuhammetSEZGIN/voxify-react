import React from 'react';
import ScreenShareControls from './ScreenShareControls';

/**
 * ScreenShareStatusBar
 * Ses kanalı bağlantısı aktifken voice-status-panel'in ÜSTÜNDE görünen
 * ince ekran paylaşımı kontrol çubuğu.
 */
function ScreenShareStatusBar({ activeVoiceChannel, voiceState, onWatchScreenShare }) {
  if (!activeVoiceChannel || !voiceState) return null;

  const { isScreenSharing, remoteScreenShares = [] } = voiceState;
  const remoteShare = remoteScreenShares[0];

  return (
    <div className="screenshare-status-bar">
      <div className="screenshare-status-bar__info">
        <span className="material-symbols-outlined screenshare-status-bar__icon">
          {isScreenSharing ? 'present_to_all' : 'screen_share'}
        </span>
        <div className="screenshare-status-bar__text">
          <span className="screenshare-status-bar__label">
            {isScreenSharing
              ? 'Ekran Yayını Aktif'
              : remoteShare
                ? `${remoteShare.name} ekran paylaşıyor`
                : 'Ekran Paylaşımı'}
          </span>
          <span className="screenshare-status-bar__channel">
            {activeVoiceChannel.name}
          </span>
        </div>
      </div>

      <ScreenShareControls
        voiceState={voiceState}
        onWatchScreenShare={onWatchScreenShare}
        compact
      />
    </div>
  );
}

export default ScreenShareStatusBar;
