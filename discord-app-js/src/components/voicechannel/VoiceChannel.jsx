import React, { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
} from '@livekit/components-react';
import '@livekit/components-styles';
import VoiceService from '../../services/VoiceService';

const VoiceChannel = ({ roomId, userId, userName, onLeaveRoom }) => {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Vite projeleri için ortam değişkenleri import.meta.env üzerinden okunur.
  // Not: Eğer Create React App kullanıyorsan process.env.REACT_APP_LIVEKIT_URL olarak değiştirebilirsin.
  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://192.168.5.122:7880';

  useEffect(() => {
    // İstek atılırken bileşen unmount olursa hatayı önlemek için AbortController
    const abortController = new AbortController();

    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);

        // Token'ı VoiceService üzerinden alıyoruz
        const data = await VoiceService.joinRoom(roomId, userId, userName, abortController.signal);
        
        // Backend'in { "token": "..." } şeklinde döndüğünü varsayıyoruz
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
      abortController.abort(); // Cleanup fonksiyonu
    };
  }, [roomId, userId, userName]);

  // Kullanıcı odadan çıktığında (Disconnect butonuna bastığında veya bağlantı koptuğunda)
  const handleDisconnect = () => {
    setToken(null);
    
    // Üst bileşenden (örneğin Router'dan) gelen yönlendirme fonksiyonu çağrılır
    // Kullanıcıyı arayüze/odalara geri döndürüp temizliyoruz.
    if (onLeaveRoom) {
      onLeaveRoom();
    }
  };

  // 2. Adım: Yükleniyor durumu UI bildirimi
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8 h-full">
        <p className="text-gray-400 font-semibold animate-pulse">Bağlanıyor...</p>
      </div>
    );
  }

  // Hata durumu UI bildirimi
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

  // 3. Adım ve 4. Adım: LiveKitRoom ve İçerikleri
  return (
    <LiveKitRoom
      video={false}     // Görüntü kapalı
      audio={true}      // Ses otomatik olarak açılacak
      token={token}     // Fetch edilen token
      serverUrl={serverUrl} 
      connect={true}    // Otomatik bağlanma
      onDisconnected={handleDisconnect} // Odadan çıkıldığında tetiklenen eventi dinliyoruz
      data-lk-theme="default" // LiveKit'in hazır default temasını etkinleştiriyoruz
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Odadaki diğer kullanıcıların seslerini duymak için arka planda çalışır */}
      <RoomAudioRenderer />

      {/* Alt kısımdaki hazır kontroller. 
          Sadece mikrofon ve çıkış (disconnect) aktif. */}
      {/* İsimlendirilen props'lara göre diğer butonlar gizlenir. */}
      <ControlBar 
        controls={{ 
          microphone: true, 
          camera: false, 
          screenShare: false, 
          chat: false, 
          leave: true 
        }} 
      />
    </LiveKitRoom>
  );
};

export default VoiceChannel;
