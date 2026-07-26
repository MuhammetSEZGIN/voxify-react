import React, { memo } from 'react';
import ScreenShareStatusBar from './ScreenShareStatusBar';

function VoiceSessionPanel({
  activeVoiceChannel,
  voiceState,
  onDisconnectVoice,
  onWatchScreenShare,
}) {
  // DM görüşmesinin kimlik, çağrı durumu, ekran paylaşımı ve kapatma
  // kontrolleri DmCallOverlay içinde birlikte gösterilir.
  if (!activeVoiceChannel || !voiceState || activeVoiceChannel.isDirect) return null;

  return (
    <>
      <ScreenShareStatusBar
        activeVoiceChannel={activeVoiceChannel}
        voiceState={voiceState}
        onWatchScreenShare={onWatchScreenShare}
      />
      <div className="voice-status-panel">
        <div className="voice-status-panel__info">
          <div className="voice-status-panel__signal">
            <span className="material-symbols-outlined voice-status-panel__signal-icon">cell_tower</span>
            <span className="voice-status-panel__label">
              Ses Bağlantısı
            </span>
          </div>
          <p className="voice-status-panel__channel-name">{activeVoiceChannel.name}</p>
        </div>
        <div className="voice-status-panel__actions">
          <button
            type="button"
            className="voice-status-panel__btn"
            onClick={() => onDisconnectVoice?.()}
            title="Bağlantıyı Kes"
          >
            <span className="material-symbols-outlined voice-status-panel__disconnect-icon">call_end</span>
          </button>
        </div>
      </div>
    </>
  );
}

export default memo(VoiceSessionPanel);
