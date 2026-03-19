import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import VoiceService from '../../services/VoiceService';
import { useScreenShare } from '../../hooks/useScreenShare';

/**
 * ── MİKROFON, KONTROL VE EKRAN PAYLAŞIMI KÖPRÜSÜ ──
 */
function VoiceRoomBridge({ onVoiceStateChange, outputDevice, inputVolume }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const room = useRoomContext();

  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);

  // Ekran paylaşımı hook'u
  const { isScreenSharing, remoteScreenShares, startScreenShare, stopScreenShare } = useScreenShare();

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
      isMuted: !isMicrophoneEnabled,
      participants: participantInfo,
      toggleMute,
      disconnect,
      // Ekran paylaşımı durumu
      isScreenSharing,
      startScreenShare,
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
    startScreenShare,
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
  inputDevice, outputDevice, inputVolume, outputVolume
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
      audio={{
        deviceId: inputDevice || undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      }}
      token={token}
      serverUrl={serverUrl}
      connect={true}
      onDisconnected={handleDisconnect}
      options={{
        audioCaptureDefaults: {
          deviceId: inputDevice || undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
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
      {/* Çıkış Ses Seviyesi (Hoparlör) Kontrolü */}
      <RoomAudioRenderer volume={typeof outputVolume === 'number' ? outputVolume / 100 : 1} />

      {/* Köprüye tüm ayarları gönderiyoruz */}
      <VoiceRoomBridge
        onVoiceStateChange={onVoiceStateChange}
        outputDevice={outputDevice}
        inputVolume={inputVolume}
      />
    </LiveKitRoom>
  );
};

export default VoiceChannel;