import api from './api';

const VoiceService = {
  /**
   * Joins a voice room and retrieves the token.
   * @param {string} roomId
   * @param {string|null} clanId Klan odasında zorunlu, DM odasında null
   * @param {AbortSignal} signal
   * @returns {Promise<{token: string}>}
   */
  joinRoom: async (roomId, clanId, signal) => {
    try {

      const rawBaseUrl = import.meta.env.VITE_VOICE_SERVER_URL || import.meta.env.VITE_BASE_URL;
      const normalizedBaseUrl = (rawBaseUrl || '').replace(/\/+$/, '');
      const roomPath = `/voice/join-room/${encodeURIComponent(roomId)}`;
      const requestUrl = clanId
        ? `${normalizedBaseUrl}${roomPath}/clanId/${encodeURIComponent(clanId)}`
        : `${normalizedBaseUrl}${roomPath}`;

      console.log(`[VoiceService] Joining room with URL: ${requestUrl}`);
      const token = localStorage.getItem("token");

      const response = await fetch(
        requestUrl,
        {
          method: 'GET',
          signal: signal,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Ses kanalına bağlanılamadı (${response.status}). Lütfen tekrar deneyin.`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[VoiceService] joinRoom hatası:', error);

      if (error instanceof TypeError) {
        // "Failed to fetch" gibi ham network hataları burada yakalanır
        throw new Error('Ses sunucusuna ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.');
      }

      if (error.name === 'AbortError') {
        throw error;
      }

      if (error.message?.startsWith('Ses kanalına bağlanılamadı')) {
        throw error;
      }

      throw new Error('Ses kanalına bağlanırken beklenmeyen bir hata oluştu.');
    }
  },

  /**
   * Removes a participant from a clan voice room.
   * Backend allows only clan owners and admins.
   * @param {string} roomId
   * @param {string} clanId
   * @param {string} userId
   * @returns {Promise<{message: string}>}
   */
  kickParticipant: async (roomId, clanId, userId) => {
    if (!roomId || !clanId || !userId) {
      throw new Error('Ses kanalından çıkarma için oda, klan ve kullanıcı bilgisi gerekli.');
    }

    const rawBaseUrl = import.meta.env.VITE_VOICE_SERVER_URL || import.meta.env.VITE_BASE_URL;
    const normalizedBaseUrl = (rawBaseUrl || '').replace(/\/+$/, '');
    const requestUrl = `${normalizedBaseUrl}/voice/rooms/${encodeURIComponent(roomId)}`
      + `/participants/${encodeURIComponent(userId)}/clanId/${encodeURIComponent(clanId)}`;
    try {
      const response = await api.delete(requestUrl);

      if (response.status === 204) {
        return { message: 'Kullanıcı ses kanalından çıkarıldı.' };
      }
      return response.data || { message: 'Kullanıcı ses kanalından çıkarıldı.' };
    } catch (error) {
      const status = error.response?.status;
      const body = error.response?.data;
      console.error('[VoiceService] kickParticipant hatası:', {
        status,
        roomId,
        clanId,
        userId,
        message: error.message,
      });

      if (status === 403) {
        throw new Error('Bu işlem için klan sahibi veya admin yetkisi gerekli.');
      }
      if (!error.response || error.code === 'ERR_NETWORK') {
        throw new Error('Ses sunucusuna ulaşılamadı. Lütfen tekrar deneyin.');
      }
      throw new Error(
        body?.message
        || body?.detail
        || body?.error
        || `Kullanıcı ses kanalından çıkarılamadı (${status || 'bilinmeyen hata'}).`
      );
    }
  }
};

export default VoiceService;
