const VoiceService = {
  /**
   * Joins a voice room and retrieves the token.
   * @param {string} roomId 
   * @param {AbortSignal} signal 
   * @returns {Promise<{token: string}>}
   */
  joinRoom: async (roomId, signal) => {
    try {

      const rawBaseUrl = import.meta.env.VITE_VOICE_SERVER_URL || import.meta.env.VITE_BASE_URL;
      const normalizedBaseUrl = (rawBaseUrl || '').replace(/\/+$/, '');
      const requestUrl = `${normalizedBaseUrl}/voice/join-room/${encodeURIComponent(roomId)}`;

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
  }
};

export default VoiceService;
