import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import '@livekit/components-styles';
import VoiceService from '../../services/VoiceService';

/**
 * LiveKitRoom içinde çalışarak ses durumunu üst bileşene aktaran köprü bileşen.
 * Mikrofon durumu, katılımcı listesi ve kontrol fonksiyonlarını raporlar.
 */
function VoiceRoomBridge({ onVoiceStateChange }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const room = useRoomContext();

  // Mikrofonu sadece oda bağlandıktan sonra aç — izin sadece burada istenir
  useEffect(() => {
    const enableMic = () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.error('[VoiceChannel] Mikrofon kullanılamıyor: Sayfa HTTPS üzerinden açılmalı.');
        return;
      }
      localParticipant.setMicrophoneEnabled(true).catch((err) => {
        console.warn('[VoiceChannel] Mikrofon açılamadı:', err);
      });
    };
    if (room.state === 'connected') {
      enableMic();
    } else {
      room.once(RoomEvent.Connected, enableMic);
    }
    return () => {
      room.off(RoomEvent.Connected, enableMic);
    };
  }, [room, localParticipant]);

  const toggleMute = useCallback(() => {
    localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
  }, [localParticipant]);

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
    }));

    onVoiceStateChange({
      isMuted: !isMicrophoneEnabled,
      participants: participantInfo,
      toggleMute,
      disconnect,
    });
  }, [isMicrophoneEnabled, participants, toggleMute, disconnect, onVoiceStateChange, localParticipant]);

  return null;
}

const VoiceChannel = ({ roomId, userId, userName, onLeaveRoom, onVoiceStateChange }) => {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Secure context check — getUserMedia requires HTTPS (or localhost)
  const isSecureContext = typeof window !== 'undefined' && window.isSecureContext;

  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://192.168.5.122:7880';

  useEffect(() => {
    const abortController = new AbortController();

    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await VoiceService.joinRoom(roomId, userId, userName, abortController.signal);

        if (data && data.token) {
          setToken(data.token);
        } else {
          throw new Error('Odadan geçerli bir token alınamadı.');
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    if (roomId && userId && userName) {
      fetchToken();
    } else {
      setLoading(false);
      setError('Bağlanmak için roomId, userId ve userName bilgileri gereklidir.');
    }

    return () => {
      abortController.abort();
    };
  }, [roomId, userId, userName]);

  const handleDisconnect = () => {
    setToken(null);
    if (onVoiceStateChange) {
      onVoiceStateChange(null);
    }
    if (onLeaveRoom) {
      onLeaveRoom();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8 h-full">
        <p className="text-gray-400 font-semibold animate-pulse">Bağlanıyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center p-8 h-full">
        <p className="text-red-500 font-semibold mb-4">Hata: {error}</p>
        <button
          onClick={() => onLeaveRoom?.()}
          className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
        >
          Odalar Listesine Dön
        </button>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  // VoiceChannel.jsx içindeki return kısmı

  return (
    <LiveKitRoom
      video={false}
      // audio={false} yerine nesne olarak geçiyoruz
      audio={{
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1, // Mono ses gürültü engelleme için daha iyidir
      }}
      token={token}
      serverUrl={serverUrl}
      connect={true}
      onDisconnected={handleDisconnect}
      options={{
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        // Bağlantı kalitesi için adaptive stream ayarı
        adaptiveStream: true,
      }}
      style={{ display: 'none' }}
    >
      <RoomAudioRenderer />
      <VoiceRoomBridge onVoiceStateChange={onVoiceStateChange} />
    </LiveKitRoom>
  );

  export default VoiceChannel;
