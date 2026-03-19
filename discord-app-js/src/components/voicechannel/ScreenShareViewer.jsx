import React, { useEffect, useRef, useState } from 'react';

/**
 * ScreenShareViewer
 * Seçilen katılımcının ekran yayınını tam ekran modal olarak gösterir.
 * LiveKit track'ını doğrudan video elementine bağlar.
 */
function ScreenShareViewer({ share, onClose, outputVolume, setOutputVolume }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [localVolume, setLocalVolume] = useState(
    typeof outputVolume === 'number' ? outputVolume : 100
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);

  // Track'ı video elementine bağla
  useEffect(() => {
    if (!share?.track || !videoRef.current) return;

    const track = share.track;
    const el = videoRef.current;

    try {
      // LiveKit track'ı attach et
      if (track.attach) {
        track.attach(el);
      } else if (track.mediaStreamTrack) {
        el.srcObject = new MediaStream([track.mediaStreamTrack]);
      }
    } catch (err) {
      console.error('[ScreenShareViewer] Track bağlanamadı:', err);
    }

    return () => {
      try {
        if (track.detach) {
          track.detach(el);
        } else {
          el.srcObject = null;
        }
      } catch { /* ignore */ }
    };
  }, [share?.track]);

  // Video elementinin ses seviyesini güncelle
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = localVolume / 100;
    }
  }, [localVolume]);

  // Esc tuşu ve Fullscreen/PiP dinleyicileri
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose?.();
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleEnterPiP = () => setIsPiP(true);
    const handleLeavePiP = () => setIsPiP(false);

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.addEventListener('enterpictureinpicture', handleEnterPiP);
      videoEl.addEventListener('leavepictureinpicture', handleLeavePiP);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (videoEl) {
        videoEl.removeEventListener('enterpictureinpicture', handleEnterPiP);
        videoEl.removeEventListener('leavepictureinpicture', handleLeavePiP);
      }
    };
  }, [onClose]);

  if (!share) return null;

  const handleVolumeChange = (val) => {
    setLocalVolume(val);
    if (setOutputVolume) setOutputVolume(val);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Fullscreen hatası: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error(`PiP hatası: ${err.message}`);
    }
  };

  return (
    <div className="screenshare-viewer" role="dialog" aria-modal="true">
      {/* Arkaplan tıklamasını engelle — yanlışlıkla kapanmasın */}
      <div className="screenshare-viewer__backdrop" onClick={onClose} />

      <div
        ref={containerRef}
        className={`screenshare-viewer__window ${isFullscreen ? 'screenshare-viewer__window--fullscreen' : ''}`}
      >
        {/* Üst Bar */}
        <div className="screenshare-viewer__topbar">
          <div className="screenshare-viewer__topbar-info">
            <span className="material-symbols-outlined screenshare-viewer__topbar-icon">
              present_to_all
            </span>
            <span className="screenshare-viewer__topbar-title">
              {share.name}'in Ekran Paylaşımı
            </span>
          </div>

          <div className="screenshare-viewer__topbar-actions">
            {/* PiP Butonu */}
            <button
              className={`screenshare-viewer__action-btn ${isPiP ? 'screenshare-viewer__action-btn--active' : ''}`}
              onClick={togglePiP}
              title={isPiP ? "Pencere Modundan Çık" : "Ayrı Pencere (PiP)"}
            >
              <span className="material-symbols-outlined">
                {isPiP ? 'picture_in_picture_alt' : 'picture_in_picture_alt'}
              </span>
            </button>

            {/* Fullscreen Butonu */}
            <button
              className="screenshare-viewer__action-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Tam Ekrandan Çık" : "Tam Ekran"}
            >
              <span className="material-symbols-outlined">
                {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
            </button>

            {/* Kapat Butonu */}
            <button
              className="screenshare-viewer__close-btn"
              onClick={onClose}
              title="Kapat (Esc)"
              aria-label="Kapat"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Video */}
        <div className="screenshare-viewer__video-wrap">
          <video
            ref={videoRef}
            className="screenshare-viewer__video"
            autoPlay
            playsInline
            muted={localVolume === 0}
          />
        </div>

        {/* Alt Kontrol Barı */}
        <div className="screenshare-viewer__controls">
          {/* Ses Kontrolü */}
          <div className="screenshare-viewer__volume-group">
            <span className="material-symbols-outlined screenshare-viewer__volume-icon">
              {localVolume === 0 ? 'volume_off' : localVolume < 50 ? 'volume_down' : 'volume_up'}
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={localVolume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="screenshare-viewer__volume-slider"
              title={`Ses: ${localVolume}%`}
            />
            <span className="screenshare-viewer__volume-label">{localVolume}%</span>
          </div>

          {/* Bağlantıyı Kes */}
          <button
            className="screenshare-viewer__disconnect-btn"
            onClick={onClose}
            title="Yayından Çık"
          >
            <span className="material-symbols-outlined">cancel_presentation</span>
            <span>Yayından Çık</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScreenShareViewer;

