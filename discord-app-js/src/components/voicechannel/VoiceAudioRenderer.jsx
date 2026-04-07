import { useEffect, useRef } from 'react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';

/**
 * VoiceAudioRenderer
 * RoomAudioRenderer'ın yerine geçer — ekran paylaşımı (ScreenShare) audio track'larını
 * HARIÇ tutar. Bu sayede yayın sesi sadece ScreenShareViewer'da bağımsız olarak
 * kontrol edilebilir; genel outputVolume ayarı sadece mikrofonları etkiler.
 *
 * Artık kullanıcı bazlı ses seviyesi desteği var:
 *   userVolumes: { [identity]: number (0-200) }
 */
function VoiceAudioRenderer({ volume = 1, userVolumes = {} }) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  // Her katılımcının mikrofon track'ı için audio elementi: identity -> HTMLAudioElement
  const audioElemsRef = useRef({});

  useEffect(() => {
    const activeKeys = new Set();

    for (const participant of participants) {
      // Yerel katılımcının kendi sesini çalma
      if (participant === localParticipant) continue;

      const micPub = participant.getTrackPublication(Track.Source.Microphone);
      const micTrack = micPub?.track;
      if (!micTrack || !micTrack.mediaStreamTrack) continue;

      const key = participant.identity;
      activeKeys.add(key);

      // Daha önce oluşturulmamışsa yeni audio elementi yarat
      if (!audioElemsRef.current[key]) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.playsInline = true;
        // DOM'a eklemeden de çalışır ama bazı tarayıcılar için ekliyoruz
        audio.style.display = 'none';
        document.body.appendChild(audio);
        audioElemsRef.current[key] = audio;
      }

      const audioEl = audioElemsRef.current[key];

      // Track'ı bağla (zaten bağlıysa atla)
      if (micTrack.attach) {
        try {
          micTrack.attach(audioEl);
        } catch { /* zaten bağlı */ }
      } else {
        const stream = new MediaStream([micTrack.mediaStreamTrack]);
        if (audioEl.srcObject !== stream) {
          audioEl.srcObject = stream;
        }
      }

      // Kullanıcı bazlı ses seviyesi: userVolumes[identity] / 100 ile genel volume çarpılır
      const userVol = typeof userVolumes[key] === 'number' ? userVolumes[key] / 100 : 1;
      audioEl.volume = Math.max(0, Math.min(1, volume * userVol));
    }

    // Artık odada olmayan katılımcıların elementlerini temizle
    for (const key of Object.keys(audioElemsRef.current)) {
      if (!activeKeys.has(key)) {
        const el = audioElemsRef.current[key];
        try { el.srcObject = null; } catch { /* ignore */ }
        el.remove();
        delete audioElemsRef.current[key];
      }
    }
  }, [participants, localParticipant, volume, userVolumes]);

  // Ses seviyesi değişince mevcut elementleri güncelle
  useEffect(() => {
    for (const [key, el] of Object.entries(audioElemsRef.current)) {
      const userVol = typeof userVolumes[key] === 'number' ? userVolumes[key] / 100 : 1;
      el.volume = Math.max(0, Math.min(1, volume * userVol));
    }
  }, [volume, userVolumes]);

  // Unmount'ta temizle
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
