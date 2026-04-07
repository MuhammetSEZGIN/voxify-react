const VoiceService = {
  /**
   * Joins a voice room and retrieves the token.
   * @param {string} roomId 
   * @param {string} userId 
   * @param {string} userName 
   * @param {AbortSignal} signal 
   * @returns {Promise<{token: string}>}
   */
  joinRoom: async (roomId, userId, userName, signal) => {
    // URLSearchParams for safe appending
    const params = new URLSearchParams({
      userId: userId,
      userName: userName
    });

    try {

      const rawBaseUrl = import.meta.env.VITE_VOICE_SERVER_URL || import.meta.env.VITE_BASE_URL;
      const normalizedBaseUrl = (rawBaseUrl || '').replace(/\/+$/, '');
      const requestUrl = `${normalizedBaseUrl}/voice/join-room/${roomId}?${params.toString()}`;

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
        throw new Error(`Bağlantı hatası: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }
};

export default VoiceService;
