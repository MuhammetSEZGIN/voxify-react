import { useEffect, useRef } from 'react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';

/**
 * VoiceAudioRenderer
 * Ekran paylaşımı sesini hariç tutar; sadece mikrofon track'larını çalar.
 * userVolumes: { [identity]: number (0-100) }
 */
function VoiceAudioRenderer({ volume = 1, userVolumes = {} }) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const audioElemsRef = useRef({});

  useEffect(() => {
    const activeKeys = new Set();

    for (const participant of participants) {
      if (participant === localParticipant) continue;

      const micPub = participant.getTrackPublication(Track.Source.Microphone);
      const micTrack = micPub?.track;
      if (!micTrack || !micTrack.mediaStreamTrack) continue;

      const key = participant.identity;
      activeKeys.add(key);

      if (!audioElemsRef.current[key]) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.playsInline = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        audioElemsRef.current[key] = audio;
      }

      const audioEl = audioElemsRef.current[key];

      if (micTrack.attach) {
        try { micTrack.attach(audioEl); } catch { /* zaten bağlı */ }
      } else {
        const stream = new MediaStream([micTrack.mediaStreamTrack]);
        if (audioEl.srcObject !== stream) audioEl.srcObject = stream;
      }

      const userVol = typeof userVolumes[key] === 'number' ? userVolumes[key] / 100 : 1;
      audioEl.volume = Math.max(0, Math.min(1, volume * userVol));
    }

    for (const key of Object.keys(audioElemsRef.current)) {
      if (!activeKeys.has(key)) {
        const el = audioElemsRef.current[key];
        try { el.srcObject = null; } catch { /* ignore */ }
        el.remove();
        delete audioElemsRef.current[key];
      }
    }
  }, [participants, localParticipant, volume, userVolumes]);

  useEffect(() => {
    for (const [key, el] of Object.entries(audioElemsRef.current)) {
      const userVol = typeof userVolumes[key] === 'number' ? userVolumes[key] / 100 : 1;
      el.volume = Math.max(0, Math.min(1, volume * userVol));
    }
  }, [volume, userVolumes]);

  useEffect(() => {
    return () => {
      for (const el of Object.values(audioElemsRef.current)) {
        try { el.srcObject = null; } catch { /* ignore */ }
        el.remove();
      }
      audioElemsRef.current = {};
    };
  }, []);

  return null;
}

export default VoiceAudioRenderer;
