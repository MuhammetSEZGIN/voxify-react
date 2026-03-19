import React, { useEffect, useRef, useState } from 'react';

/**
 * ScreenShareViewer
 * Seçilen katılımcının ekran yayınını tam ekran modal olarak gösterir.
 * Video ve ses track'ları AYRI elementlere bağlanır — ses seviyesi diğer
 * kullanıcıların sesini etkilemez.
 */
function ScreenShareViewer({ share, onClose }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const containerRef = useRef(null);
  // Yayın sesi bağımsız — başlangıç 80% 
  const [screenVolume, setScreenVolume] = useState(80);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);

  // Video track'ı video elementine bağla
  useEffect(() => {
    if (!share?.track || !videoRef.current) return;

    const track = share.track;
    const el = videoRef.current;

    try {
      if (track.attach) {
        track.attach(el);
      } else if (track.mediaStreamTrack) {
        el.srcObject = new MediaStream([track.mediaStreamTrack]);
      }
    } catch (err) {
      console.error('[ScreenShareViewer] Video track bağlanamadı:', err);
    }

    return () => {
      try {
        if (track.detach) track.detach(el);
        else el.srcObject = null;
      } catch { /* ignore */ }
    };
  }, [share?.track]);

  // Audio track'ı AYRI bir audio elementine bağla (mikrofon sesinden bağımsız)
  useEffect(() => {
    if (!audioRef.current) return;

    const audioTrack = share?.audioTrack;
    const el = audioRef.current;
    el.volume = screenVolume / 100;

    if (!audioTrack) {
      el.srcObject = null;
      return;
    }

    try {
      if (audioTrack.attach) {
        audioTrack.attach(el);
      } else if (audioTrack.mediaStreamTrack) {
        el.srcObject = new MediaStream([audioTrack.mediaStreamTrack]);
      }
    } catch (err) {
      console.error('[ScreenShareViewer] Audio track bağlanamadı:', err);
    }

    return () => {
      try {
        if (audioTrack.detach) audioTrack.detach(el);
        else el.srcObject = null;
      } catch { /* ignore */ }
    };
  }, [share?.audioTrack]);

  // Yayın ses seviyesini yalnızca audio elementine uygula
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, screenVolume / 100));
      audioRef.current.muted = screenVolume === 0;
    }
    // Video elementi her zaman mute — ses audio elementinden geliyor
    if (videoRef.current) {
      videoRef.current.muted = true;
    }
  }, [screenVolume]);

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
      {/* Arkaplan tıklaması kapatmasın */}
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
              title={isPiP ? 'Pencere Modundan Çık' : 'Ayrı Pencere (PiP)'}
            >
              <span className="material-symbols-outlined">picture_in_picture_alt</span>
            </button>

            {/* Fullscreen Butonu */}
            <button
              className="screenshare-viewer__action-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
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

        {/* Video — her zaman muted; ses audio ref'inden geliyor */}
        <div className="screenshare-viewer__video-wrap">
          <video
            ref={videoRef}
            className="screenshare-viewer__video"
            autoPlay
            playsInline
            muted
          />
          {/* Gizli audio elementi — yalnızca yayın sesini bağımsız çalar */}
          <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
        </div>

        {/* Alt Kontrol Barı */}
        <div className="screenshare-viewer__controls">
          {/* Yayın Ses Kontrolü (mikrofon sesinden bağımsız!) */}
          <div className="screenshare-viewer__volume-group">
            <button
              className="screenshare-viewer__volume-mute-btn"
              title={screenVolume === 0 ? 'Sesi Aç' : 'Sesi Kapat'}
              onClick={() => setScreenVolume((v) => (v === 0 ? 80 : 0))}
            >
              <span className="material-symbols-outlined screenshare-viewer__volume-icon">
                {screenVolume === 0 ? 'volume_off' : screenVolume < 50 ? 'volume_down' : 'volume_up'}
              </span>
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={screenVolume}
              onChange={(e) => setScreenVolume(Number(e.target.value))}
              className="screenshare-viewer__volume-slider"
              title={`Yayın Sesi: ${screenVolume}%`}
            />
            <span className="screenshare-viewer__volume-label">{screenVolume}%</span>
          </div>

          {/* Yayından Çık */}
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
