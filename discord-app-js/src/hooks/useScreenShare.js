import { useState, useEffect, useCallback } from 'react';
import { useLocalParticipant, useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';

export const SCREEN_SHARE_QUALITIES = [
  { value: 'low', label: '720p', width: 1280, height: 720, maxFramerate: 30, maxBitrate: 500_000 },
  { value: 'medium', label: '1080p', width: 1920, height: 1080, maxFramerate: 60, maxBitrate: 1_500_000 },
  { value: 'high', label: '1440p', width: 2560, height: 1440, maxFramerate: 60, maxBitrate: 3_000_000 },
];

const QUALITY_BY_VALUE = Object.fromEntries(
  SCREEN_SHARE_QUALITIES.map((quality) => [quality.value, quality])
);

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
  const [isStartingScreenShare, setIsStartingScreenShare] = useState(false);
  const [screenShareError, setScreenShareError] = useState(null);

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

  const startScreenShare = useCallback(async (quality = 'medium') => {
    if (!localParticipant || isStartingScreenShare) return false;
    const preset = QUALITY_BY_VALUE[quality] || QUALITY_BY_VALUE.medium;
    setScreenShareError(null);
    setIsStartingScreenShare(true);
    try {
      await localParticipant.setScreenShareEnabled(true, {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
        selfBrowserSurface: 'include',
        contentHint: quality === 'high' ? 'detail' : 'motion',
        resolution: {
          width: preset.width,
          height: preset.height,
          frameRate: preset.maxFramerate,
        },
      });

      const publication = localParticipant.getTrackPublication(Track.Source.ScreenShare);
      if (publication?.videoTrack?.sender) {
        const sender = publication.videoTrack.sender;
        const parameters = sender.getParameters();
        parameters.encodings = parameters.encodings?.length
          ? parameters.encodings.map((encoding) => ({
              ...encoding,
              maxBitrate: preset.maxBitrate,
              maxFramerate: preset.maxFramerate,
            }))
          : [{ maxBitrate: preset.maxBitrate, maxFramerate: preset.maxFramerate }];
        await sender.setParameters(parameters).catch(() => {});
      }
      return true;
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error('[ScreenShare] Ekran paylaşımı başlatılamadı:', err);
        setScreenShareError(err.message || 'Ekran paylaşımı başlatılamadı.');
      }
      return false;
    } finally {
      setIsStartingScreenShare(false);
    }
  }, [isStartingScreenShare, localParticipant]);

  const stopScreenShare = useCallback(async () => {
    if (!localParticipant) return;
    setScreenShareError(null);
    try {
      await localParticipant.setScreenShareEnabled(false);
    } catch (err) {
      console.error('[ScreenShare] Ekran paylaşımı durdurulamadı:', err);
      setScreenShareError(err.message || 'Ekran paylaşımı durdurulamadı.');
    }
  }, [localParticipant]);

  return {
    isScreenSharing,
    remoteScreenShares,
    isStartingScreenShare,
    screenShareError,
    startScreenShare,
    stopScreenShare,
  };
}
