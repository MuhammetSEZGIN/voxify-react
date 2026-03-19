import { useState, useEffect, useCallback } from 'react';
import { useLocalParticipant, useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';

/**
 * useScreenShare
 * LiveKit room içinde ekran paylaşımı yönetimi.
 * Bu hook yalnızca LiveKitRoom bağlamı içinde kullanılabilir.
 */
export function useScreenShare() {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteScreenShares, setRemoteScreenShares] = useState([]);

  // Yerel ekran paylaşımı durumunu izle
  useEffect(() => {
    if (!localParticipant) return;

    const update = () => {
      const pub = localParticipant.getTrackPublication(Track.Source.ScreenShare);
      setIsScreenSharing(!!(pub?.track && pub.isSubscribed !== false && pub.track.mediaStreamTrack));
    };

    update();
    localParticipant.on('trackPublished', update);
    localParticipant.on('trackUnpublished', update);
    localParticipant.on('localTrackPublished', update);
    localParticipant.on('localTrackUnpublished', update);

    return () => {
      localParticipant.off('trackPublished', update);
      localParticipant.off('trackUnpublished', update);
      localParticipant.off('localTrackPublished', update);
      localParticipant.off('localTrackUnpublished', update);
    };
  }, [localParticipant]);

  // Uzak katılımcıların ekran paylaşımlarını izle
  useEffect(() => {
    const shares = [];
    for (const participant of participants) {
      if (participant === localParticipant) continue;
      const videoPub = participant.getTrackPublication(Track.Source.ScreenShare);
      const audioPub = participant.getTrackPublication(Track.Source.ScreenShareAudio);
      if (videoPub && videoPub.track) {
        shares.push({
          participantIdentity: participant.identity,
          name: participant.name || participant.identity,
          track: videoPub.track,
          audioTrack: audioPub?.track || null,
          publication: videoPub,
        });
      }
    }
    setRemoteScreenShares(shares);
  }, [participants, localParticipant]);

  const startScreenShare = useCallback(async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setScreenShareEnabled(true, {
        audio: true,
        selfBrowserSurface: 'include',
      });
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error('[ScreenShare] Ekran paylaşımı başlatılamadı:', err);
      }
    }
  }, [localParticipant]);

  const stopScreenShare = useCallback(async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setScreenShareEnabled(false);
    } catch (err) {
      console.error('[ScreenShare] Ekran paylaşımı durdurulamadı:', err);
    }
  }, [localParticipant]);

  return {
    isScreenSharing,
    remoteScreenShares,
    startScreenShare,
    stopScreenShare,
  };
}
