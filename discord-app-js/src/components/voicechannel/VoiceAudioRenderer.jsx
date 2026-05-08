import { useEffect, useRef } from 'react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';

/**
 * VoiceAudioRenderer
 * RoomAudioRenderer'ın yerine geçer — ekran paylaşımı (ScreenShare) audio track'larını
 * HARIÇ tutar. Bu sayede yayın sesi sadece ScreenShareViewer'da bağımsız olarak
 * kontrol edilebilir; genel outputVolume ayarı sadece mikrofonları etkiler.
 *
 * Kullanıcı bazlı ses seviyesi desteği: userVolumes: { [identity]: number (0-200) }
 * %100 üstü değerler Web Audio API GainNode ile gerçek amplifikasyon sağlar.
 */
function VoiceAudioRenderer({ volume = 1, userVolumes = {} }) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const audioElemsRef = useRef({});
  const audioCtxsRef = useRef({});
  const gainNodesRef = useRef({});
  const compressorsRef = useRef({});

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
        try {
          micTrack.attach(audioEl);
        } catch { /* zaten bağlı */ }
      } else {
        const stream = new MediaStream([micTrack.mediaStreamTrack]);
        if (audioEl.srcObject !== stream) {
          audioEl.srcObject = stream;
        }
      }

      // createMediaElementSource yalnızca bir kez çağrılabilir per-element; guard ile korunuyor
      if (!audioCtxsRef.current[key]) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const source = ctx.createMediaElementSource(audioEl);
        const gainNode = ctx.createGain();
        const compressor = ctx.createDynamicsCompressor();
        // Limiter preset — yüksek oran, düşük eşik: clipping olmadan amplifikasyon
        compressor.threshold.value = -3;
        compressor.knee.value = 3;
        compressor.ratio.value = 20;
        compressor.attack.value = 0.001;
        compressor.release.value = 0.1;

        source.connect(gainNode);
        gainNode.connect(compressor);
        compressor.connect(ctx.destination);

        audioCtxsRef.current[key] = ctx;
        gainNodesRef.current[key] = gainNode;
        compressorsRef.current[key] = compressor;
      }

      const userVol = typeof userVolumes[key] === 'number' ? userVolumes[key] / 100 : 1;
      gainNodesRef.current[key].gain.value = Math.max(0, volume * userVol);
    }

    // Artık odada olmayan katılımcıların elementlerini temizle
    for (const key of Object.keys(audioElemsRef.current)) {
      if (!activeKeys.has(key)) {
        // AudioContext önce kapatılmalı, sonra element kaldırılmalı
        if (audioCtxsRef.current[key]) {
          audioCtxsRef.current[key].close();
          delete audioCtxsRef.current[key];
        }
        delete gainNodesRef.current[key];
        delete compressorsRef.current[key];

        const el = audioElemsRef.current[key];
        try { el.srcObject = null; } catch { /* ignore */ }
        el.remove();
        delete audioElemsRef.current[key];
      }
    }
  }, [participants, localParticipant, volume, userVolumes]);

  // Ses seviyesi değişince mevcut gain node'ları güncelle
  useEffect(() => {
    for (const [key] of Object.entries(audioElemsRef.current)) {
      if (!gainNodesRef.current[key]) continue;
      const userVol = typeof userVolumes[key] === 'number' ? userVolumes[key] / 100 : 1;
      gainNodesRef.current[key].gain.value = Math.max(0, volume * userVol);
    }
  }, [volume, userVolumes]);

  // Unmount'ta temizle
  useEffect(() => {
    return () => {
      for (const ctx of Object.values(audioCtxsRef.current)) {
        ctx.close();
      }
      audioCtxsRef.current = {};
      gainNodesRef.current = {};
      compressorsRef.current = {};

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
