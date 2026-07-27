import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LiveKitRoom,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from '@livekit/components-react';
import { ConnectionState, Track } from 'livekit-client';
import '@livekit/components-styles';
import VoiceService from '../../services/VoiceService';
import { useScreenShare } from '../../hooks/useScreenShare';
import VoiceAudioRenderer from './VoiceAudioRenderer';

import rnnoiseWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseSimdWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';
import rnnoiseWorkletPath from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';

// WASM ikili önbelleği — processor yeniden başlatılırken tekrar indirilmez
let _cachedWasmBinary = null;
async function getRnnoiseWasm() {
  if (!_cachedWasmBinary) {
    const { loadRnnoise } = await import('@sapphi-red/web-noise-suppressor');
    _cachedWasmBinary = await loadRnnoise({ url: rnnoiseWasmPath, simdUrl: rnnoiseSimdWasmPath });
  }
  return _cachedWasmBinary;
}

class RnnoiseAudioProcessor {
  name = 'rnnoise';
  processedTrack = undefined;
  #gainNode = null;
  #gainValue;

  constructor(gainValue = 1) {
    this.#gainValue = gainValue;
  }

  async init({ track, audioContext }) {
    const wasmBinary = await getRnnoiseWasm();
    const { RnnoiseWorkletNode } = await import('@sapphi-red/web-noise-suppressor');
    await audioContext.audioWorklet.addModule(rnnoiseWorkletPath);

    const source = audioContext.createMediaStreamSource(new MediaStream([track]));
    const rnnoiseNode = new RnnoiseWorkletNode(audioContext, { wasmBinary, maxChannels: 1 });
    this.#gainNode = audioContext.createGain();
    this.#gainNode.gain.value = this.#gainValue;
    const destination = audioContext.createMediaStreamDestination();

    source.connect(rnnoiseNode);
    rnnoiseNode.connect(this.#gainNode);
    this.#gainNode.connect(destination);

    this.processedTrack = destination.stream.getAudioTracks()[0];
  }

  async restart(options) {
    this.#gainNode = null;
    await this.init(options);
  }

  async destroy() {
    this.#gainNode = null;
  }

  setGain(value) {
    this.#gainValue = value;
    if (this.#gainNode) this.#gainNode.gain.value = value;
  }
}

/**
 * ── MİKROFON, KONTROL VE EKRAN PAYLAŞIMI KÖPRÜSÜ ──
 */
function VoiceRoomBridge({
  onVoiceStateChange,
  onMicrophoneUnavailable,
  onScreenShareStarted,
  inputDevice,
  outputDevice,
  inputVolume,
  isMicMuted,
  noiseSuppressionEnabled,
}) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const room = useRoomContext();
  const connectionState = useConnectionState(room);

  const processorRef = useRef(null);
  const setupTokenRef = useRef(null);

  const {
    isScreenSharing,
    remoteScreenShares,
    isStartingScreenShare,
    screenShareError,
    startScreenShare,
    stopScreenShare,
  } = useScreenShare({ onStarted: onScreenShareStarted });

  // Odaya önce mikrofonsuz bağlanılır. ICE bağlantısı tamamlandıktan sonra
  // global mute durumu LiveKit'e uygulanır. Böylece tarayıcı mikrofon iznini
  // reddetse bile kullanıcı kanala dinleyici olarak katılabilir.
  useEffect(() => {
    if (!localParticipant || connectionState !== ConnectionState.Connected) return undefined;

    const shouldEnable = !isMicMuted;
    if (isMicrophoneEnabled === shouldEnable) return undefined;

    let cancelled = false;
    localParticipant.setMicrophoneEnabled(shouldEnable).catch((error) => {
      if (!cancelled && shouldEnable) onMicrophoneUnavailable?.(error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    connectionState,
    isMicMuted,
    isMicrophoneEnabled,
    localParticipant,
    onMicrophoneUnavailable,
  ]);

  // 1. GİRİŞ CİHAZI (MİKROFON) DEĞİŞİMİ
  useEffect(() => {
    if (!inputDevice || room.state !== 'connected') return;
    room.switchActiveDevice('audioinput', inputDevice).catch(err => {
      console.warn("Giriş cihazı değiştirilemedi:", err);
    });
  }, [inputDevice, room]);

  // 2. ÇIKIŞ CİHAZI (HOPARLÖR) DEĞİŞİMİ
  useEffect(() => {
    if (!outputDevice || room.state !== 'connected') return;
    room.switchActiveDevice('audiooutput', outputDevice).catch(err => {
      console.warn("Çıkış cihazı değiştirilemedi:", err);
    });
  }, [outputDevice, room]);

  // 3. GİRİŞ SESİ + RNNoise PROCESSOR KONTROLÜ
  useEffect(() => {
    if (!localParticipant) return;
    const trackPub = localParticipant.getTrackPublication(Track.Source.Microphone);
    const audioTrack = trackPub?.track;
    if (!audioTrack) return;

    const currentType = processorRef.current?.name ?? null;
    const desiredType = noiseSuppressionEnabled ? 'rnnoise' : null;

    if (currentType === desiredType) {
      // Processor tipi değişmedi, sadece gain güncelle
      processorRef.current?.setGain(inputVolume / 50);
      return;
    }

    // Processor tipi değişti: eski durdur, yeni kur
    const token = Symbol();
    setupTokenRef.current = token;

    const setup = async () => {
      try {
        if (processorRef.current) {
          await audioTrack.stopProcessor().catch(() => {});
          processorRef.current = null;
        }

        if (!noiseSuppressionEnabled) return; // processor yok, ham WebRTC track devrede

        const processor = new RnnoiseAudioProcessor(inputVolume / 50);
        await audioTrack.setProcessor(processor);

        // Race condition: setup sırasında toggle tekrar değiştiyse iptal et
        if (setupTokenRef.current !== token) {
          await audioTrack.stopProcessor().catch(() => {});
          return;
        }
        processorRef.current = processor;
      } catch (err) {
        console.error('RNNoise processor başlatılamadı:', err);
        processorRef.current = null;
      }
    };

    setup();
  }, [localParticipant, inputVolume, isMicrophoneEnabled, noiseSuppressionEnabled]);

  // Unmount'ta aktif processor'ı durdur
  useEffect(() => {
    return () => {
      const trackPub = localParticipant?.getTrackPublication(Track.Source.Microphone);
      trackPub?.track?.stopProcessor().catch(() => {});
      processorRef.current = null;
    };
  }, [localParticipant]);

  const toggleMute = useCallback(() => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [localParticipant, isMicrophoneEnabled]);

  const disconnect = useCallback(() => {
    room.disconnect();
  }, [room]);

  useEffect(() => {
    if (!onVoiceStateChange) return;

    // LocalParticipant nesnesi sinyalleşme sırasında da oluşur. Presence'a
    // katılımı ancak ICE/peer connection gerçekten kurulduktan sonra bildir;
    // aksi halde başarısız bir bağlantı kısa süreliğine "bağlandı" görünür.
    if (connectionState !== ConnectionState.Connected) {
      onVoiceStateChange(null);
      return;
    }

    const participantInfo = participants.map((p) => ({
      identity: p.identity,
      name: p.name || p.identity,
      isMuted: !p.isMicrophoneEnabled,
      isSpeaking: p.isSpeaking,
      isLocal: p === localParticipant,
      isScreenSharing: (() => {
        const pub = p.getTrackPublication(Track.Source.ScreenShare);
        return !!(pub && pub.track);
      })(),
    }));

    onVoiceStateChange({
      isMuted: isMicMuted,
      participants: participantInfo,
      toggleMute,
      disconnect,
      isScreenSharing,
      startScreenShare,
      stopScreenShare,
      remoteScreenShares,
      isStartingScreenShare,
      screenShareError,
    });
  }, [
    isMicrophoneEnabled,
    participants,
    toggleMute,
    disconnect,
    onVoiceStateChange,
    localParticipant,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    remoteScreenShares,
    isStartingScreenShare,
    screenShareError,
    isMicMuted,
    connectionState,
  ]);

  return null;
}

/**
 * ── ANA VOICE CHANNEL BİLEŞENİ ──
 */
const VoiceChannel = ({
  roomId, clanId, userId, userName, onLeaveRoom, onVoiceStateChange,
  onMicrophoneUnavailable,
  onScreenShareStarted,
  inputDevice, outputDevice, inputVolume, outputVolume, isMicMuted,
  userVolumes, noiseSuppressionEnabled,
}) => {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://192.168.5.122:7880';

  useEffect(() => {
    const abortController = new AbortController();

    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await VoiceService.joinRoom(roomId, clanId, abortController.signal);
        if (data && data.token) setToken(data.token);
        else throw new Error('Odadan geçerli bir token alınamadı.');
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (roomId && userId && userName) fetchToken();
    else {
      setLoading(false);
      setError('Bağlanmak için roomId, userId ve userName bilgileri gereklidir.');
    }

    return () => abortController.abort();
  }, [roomId, clanId, userId, userName]);

  const handleDisconnect = () => {
    setToken(null);
    if (onVoiceStateChange) onVoiceStateChange(null);
    if (onLeaveRoom) onLeaveRoom();
  };

  if (loading) return <div className="flex justify-center items-center p-8 h-full"><p className="text-gray-400">Bağlanıyor...</p></div>;
  if (error) return <div className="flex flex-col justify-center items-center p-8"><p className="text-red-500 mb-4">{error}</p></div>;
  if (!token) return null;

  return (
    <LiveKitRoom
      video={false}
      audio={false}
      token={token}
      serverUrl={serverUrl}
      connect={true}
      onDisconnected={handleDisconnect}
      options={{
        audioCaptureDefaults: {
          deviceId: inputDevice || undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          suppressLocalAudioPlayback: true
        },
        publishDefaults: {
          screenShareEncoding: {
            maxBitrate: 3_000_000,
            maxFramerate: 15,
          },
        },
      }}
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <VoiceAudioRenderer
        volume={typeof outputVolume === 'number' ? outputVolume / 100 : 1}
        userVolumes={userVolumes || {}}
      />

      <VoiceRoomBridge
        onVoiceStateChange={onVoiceStateChange}
        onMicrophoneUnavailable={onMicrophoneUnavailable}
        onScreenShareStarted={onScreenShareStarted}
        inputDevice={inputDevice}
        outputDevice={outputDevice}
        inputVolume={inputVolume}
        isMicMuted={isMicMuted}
        noiseSuppressionEnabled={noiseSuppressionEnabled}
      />
    </LiveKitRoom>
  );
};

export default VoiceChannel;
