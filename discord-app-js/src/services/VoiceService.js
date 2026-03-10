import api from './api';

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
      // Using the central api instance if baseUrl is configured to the same host,
      // but since it explicitly targets http://localhost:4000/api/voice we will use a direct fetch
      // or api instance if it matches. Let's use direct fetch given the requirement to hit localhost:4000.
      // However, we should check what api.js baseUrl is. If it's the same, we can use api.get().
      // To be safe as per the user's initial code, let's use fetch but through the service.
      
      const baseUrl = import.meta.env.VITE_VOICE_SERVER_URL;
      
      console.log(`[VoiceService] Joining room with URL: ${baseUrl}/voice/join-room/${roomId}?${params.toString()}`);
      const response = await fetch(
        `${baseUrl}/voice/join-room/${roomId}?${params.toString()}`,
        { 
            method: 'GET',
            signal: signal,
            headers: {
                'Content-Type': 'application/json'
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
