import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LiveKitRoom,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import VoiceService from '../../services/VoiceService';
import { useScreenShare } from '../../hooks/useScreenShare';
import VoiceAudioRenderer from './VoiceAudioRenderer';

/**
 * ── MİKROFON, KONTROL VE EKRAN PAYLAŞIMI KÖPRÜSÜ ──
 */
function VoiceRoomBridge({ onVoiceStateChange, outputDevice, inputVolume, screenShareQuality, isMicMuted }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const room = useRoomContext();

  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);

  // Ekran paylaşımı hook'u
  const { isScreenSharing, remoteScreenShares, startScreenShare, stopScreenShare } = useScreenShare();

  // Kalite bazlı ekran paylaşımı başlat
  const startScreenShareWithQuality = useCallback(async (quality = 'medium') => {
    if (!localParticipant) return;
    const presets = {
      low: { maxBitrate: 500_000, maxFramerate: 30, width: 1280, height: 720 },
      medium: { maxBitrate: 1_500_000, maxFramerate: 60, width: 1920, height: 1080 },
      high: { maxBitrate: 3_000_000, maxFramerate: 60, width: 2560, height: 1440 },
    };
    const enc = presets[quality] || presets.medium;
    try {
      await localParticipant.setScreenShareEnabled(true, {
        audio: true,
        selfBrowserSurface: 'include',
        contentHint: quality === 'high' ? 'detail' : 'motion',
        resolution: { width: enc.width, height: enc.height, frameRate: enc.maxFramerate },
      });
      // Yayın başladıktan sonra encoding parametrelerini güncelle
      const pub = localParticipant.getTrackPublication(Track.Source.ScreenShare);
      if (pub?.videoTrack) {
        pub.videoTrack.sender?.setParameters({
          encodings: [{ maxBitrate: enc.maxBitrate, maxFramerate: enc.maxFramerate }],
        }).catch(() => { });
      }
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error('[ScreenShare] Ekran paylaşımı başlatılamadı:', err);
      }
    }
  }, [localParticipant]);

  // Global Mute durumunu LiveKit'e senkronize et
  useEffect(() => {
    if (localParticipant) {
      if (isMicrophoneEnabled === isMicMuted) {
        localParticipant.setMicrophoneEnabled(!isMicMuted);
      }
    }
  }, [localParticipant, isMicMuted, isMicrophoneEnabled]);

  // 1. ÇIKIŞ CİHAZI (HOPARLÖR) DEĞİŞİMİ
  useEffect(() => {
    if (outputDevice && room.state === 'connected') {
      room.switchActiveDevice('audiooutput', outputDevice).catch(err => {
        console.warn("Çıkış cihazı değiştirilemedi:", err);
      });
    }
  }, [outputDevice, room]);

  // 2. GİRİŞ SESİ (INPUT VOLUME) KONTROLÜ - WEB AUDIO API (GAIN NODE)
  useEffect(() => {
    if (!localParticipant) return;

    // Aktif mikrofon yayınını bul
    const trackPub = localParticipant.getTrackPublication(Track.Source.Microphone);
    const audioTrack = trackPub?.track;

    if (audioTrack && audioTrack.sender && audioTrack.mediaStreamTrack) {
      // Eğer filtre (GainNode) henüz kurulmadıysa kur
      if (!gainNodeRef.current) {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          const ctx = new AudioContext();
          audioContextRef.current = ctx;

          // Mikrofonun ham sesini al
          const source = ctx.createMediaStreamSource(new MediaStream([audioTrack.mediaStreamTrack]));

          // Ses filtresini (GainNode) oluştur
          const gainNode = ctx.createGain();
          gainNodeRef.current = gainNode;

          // Çıkış noktası oluştur
          const destination = ctx.createMediaStreamDestination();

          // Birleştir: Ham Ses -> Filtre -> Çıkış
          source.connect(gainNode);
          gainNode.connect(destination);

          // LiveKit'in sunucuya yolladığı ham sesi, bizim filtrelenmiş sesimizle değiştir!
          const processedTrack = destination.stream.getAudioTracks()[0];
          audioTrack.sender.replaceTrack(processedTrack);

        } catch (error) {
          console.error("Giriş sesi filtresi oluşturulamadı:", error);
        }
      }

      // Sürgüden gelen 0-100 değerini sese dönüştür
      // 50 = Normal Ses (1x), 100 = İki Katı Ses (2x), 0 = Sessiz (0x)
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = inputVolume / 50;
      }
    }
  }, [localParticipant, inputVolume, isMicrophoneEnabled]);

  const toggleMute = useCallback(() => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [localParticipant, isMicrophoneEnabled]);

  const disconnect = useCallback(() => {
    room.disconnect();
  }, [room]);

  useEffect(() => {
    if (!onVoiceStateChange) return;

    const participantInfo = participants.map((p) => ({
      identity: p.identity,
      name: p.name || p.identity,
      isMuted: !p.isMicrophoneEnabled,
      isSpeaking: p.isSpeaking,
      isLocal: p === localParticipant,
      // Ekran paylaşımı yapıyor mu?
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
      // Ekran paylaşımı durumu
      isScreenSharing,
      startScreenShare: startScreenShareWithQuality,
      stopScreenShare,
      remoteScreenShares,
    });
  }, [
    isMicrophoneEnabled,
    participants,
    toggleMute,
    disconnect,
    onVoiceStateChange,
    localParticipant,
    isScreenSharing,
    startScreenShareWithQuality,
    stopScreenShare,
    remoteScreenShares,
  ]);

  return null;
}

/**
 * ── ANA VOICE CHANNEL BİLEŞENİ ──
 */
const VoiceChannel = ({
  roomId, userId, userName, onLeaveRoom, onVoiceStateChange,
  inputDevice, outputDevice, inputVolume, outputVolume, isMicMuted,
  userVolumes,
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
        const data = await VoiceService.joinRoom(roomId, userId, userName, abortController.signal);
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
  }, [roomId, userId, userName]);

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
      audio={!isMicMuted ? {
        deviceId: inputDevice || undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
        suppressLocalAudioPlayback: true,
      } : false}
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
        // Ekran paylaşımı için video codec desteği
        publishDefaults: {
          screenShareEncoding: {
            maxBitrate: 3_000_000,
            maxFramerate: 15,
          },
        },
      }}
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      {/* Sadece Mikrofon seslerini çalıyor; ekran paylaşımı sesi hariç */}
      <VoiceAudioRenderer
        volume={typeof outputVolume === 'number' ? outputVolume / 100 : 1}
        userVolumes={userVolumes || {}}
      />

      {/* Köprüye tüm ayarları gönderiyoruz */}
      <VoiceRoomBridge
        onVoiceStateChange={onVoiceStateChange}
        outputDevice={outputDevice}
        inputVolume={inputVolume}
        isMicMuted={isMicMuted}
      />
    </LiveKitRoom>
  );
};

export default VoiceChannel;