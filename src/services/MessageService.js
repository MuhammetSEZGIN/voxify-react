import api from "./api.js";

/**
 * Mesaj REST API'si — klan kanalları ve DM'ler için ortak.
 *
 * Route'lar MessageService swagger'ından (`:5107/swagger/v1/swagger.json`)
 * doğrulandı. Gerçekte var olan uç noktalar:
 *   GET    /api/Message?channelId=&page=&limit=          → DM (clanId'siz)
 *   GET    /api/Message/channelId/{channelId}/clanId/{clanId} → klan kanalı
 *   PUT    /api/Message/{messageId}/clanId/{clanId}
 *   DELETE /api/Message/{messageId}/clanId/{clanId}
 *
 * Ocelot prefix'i `/message` olduğu için hepsinin başına o geliyor.
 *
 * ÖNEMLİ: Önceki sürüm DM'ler için `/message/dm/channelId/{id}` çağırıyordu —
 * bu route backend'de HİÇ YOK (doğrudan servise sorulduğunda 404 dönüyor).
 * DM mesajlarının yüklenmemesinin sebebi buydu.
 */

/**
 * Bir kanalın/DM konuşmasının mesajlarını getirir.
 * @param {string} channelId - klan kanalı ID'si veya DM conversationId
 * @param {string|null} clanId - null ise DM olarak clanId'siz route kullanılır
 * @param {number} page
 * @param {number} limit
 */
const getMessagesByChannelId = async (channelId, clanId, page = 1, limit = 50) => {
  try {
    if (clanId) {
      // Klan kanalı: clanId path'e gömülü
      const response = await api.get(
        `/message/channelId/${channelId}/clanId/${clanId}`,
        { params: { page, limit } }
      );
      return response.data;
    }

    // DM: clanId yok → query-string tabanlı genel route
    const response = await api.get('/message', {
      params: { channelId, page, limit },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching messages", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Mesaj siler.
 * @param {string} messageId
 * @param {string|null} clanId - DM'lerde null; aşağıdaki nota bakınız
 */
const deleteMessage = async (messageId, clanId) => {
  // BACKEND-DOĞRULA (madde 1.1): DM mesajları için silme route'u backend'de yok.
  // Sadece `/api/Message/{id}/clanId/{clanId}` mevcut. Bu yüzden DM'lerde
  // silme UI'da zaten kapalı (ChatArea `isDm` kontrolü); buraya düşerse
  // sessizce yanlış istek atmak yerine açık hata veriyoruz.
  if (!clanId) {
    throw new Error("DM mesajları şu an silinemiyor — backend'de karşılığı olan bir uç nokta yok.");
  }

  try {
    const response = await api.delete(`/message/${messageId}/clanId/${clanId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting message", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Mesaj düzenler.
 * @param {{messageId: string, clanId: string|null, content: string}} data
 */
const editMessage = async (data) => {
  // BACKEND-DOĞRULA (madde 1.1): deleteMessage ile aynı durum — DM karşılığı yok.
  if (!data.clanId) {
    throw new Error("DM mesajları şu an düzenlenemiyor — backend'de karşılığı olan bir uç nokta yok.");
  }

  try {
    const response = await api.put(
      `/message/${data.messageId}/clanId/${data.clanId}`,
      data.content
    );
    return response.data;
  } catch (error) {
    console.error("Error editing message", error.response?.data || error.message);
    throw error;
  }
};

const MessageService = {
  getMessagesByChannelId,
  deleteMessage,
  editMessage,
};

export default MessageService;
