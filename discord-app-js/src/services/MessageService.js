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
 * Ocelot'un `/message/*` için downstream şablonu bu makineden kesin olarak
 * tespit edilemedi (gateway route eşleşmesinden önce 401 döndüğü için ayırt
 * edilemiyor — bkz. backend-gereksinimleri-dm.md madde 0).
 *
 * İki olasılık var:
 *   (a) prefix soyuluyor:   /message/api/Message/... → /api/Message/...
 *   (b) prefix yeniden yazılıyor: /message/...       → /api/Message/...
 *
 * Klan mesajlaşması bugüne kadar (b) biçimindeki `/message/channelId/...` ile
 * çalıştığı için ikisini de deniyoruz: önce (a), 404 gelirse (b).
 * Hangisinin tuttuğu modül ömrü boyunca hatırlanır, böylece her istekte iki
 * çağrı yapılmaz.
 *
 * Backend madde 0'ı düzeltip route'lar netleştiğinde bu yardımcı kaldırılmalı.
 */
let resolvedStyle = null; // 'prefixed' → (a), 'rewritten' → (b)

const buildUrls = (prefixedPath, rewrittenPath) =>
  resolvedStyle === 'rewritten'
    ? [{ style: 'rewritten', url: rewrittenPath }]
    : resolvedStyle === 'prefixed'
      ? [{ style: 'prefixed', url: prefixedPath }]
      : [
          { style: 'prefixed', url: prefixedPath },
          { style: 'rewritten', url: rewrittenPath },
        ];

/** Adayları sırayla dener; 404 dışındaki hatalarda hemen durur. */
async function requestWithFallback(candidates, send) {
  let lastError;
  for (const candidate of candidates) {
    try {
      const response = await send(candidate.url);
      resolvedStyle = candidate.style;
      return response;
    } catch (error) {
      lastError = error;
      // Sadece "route yok" durumunda diğer biçimi dene; 401/403/429 gerçek
      // cevaplardır, tekrar denemek yanıltıcı olur.
      if (error.response?.status !== 404) throw error;
    }
  }
  throw lastError;
}

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
      const response = await requestWithFallback(
        buildUrls(
          `/message/api/Message/channelId/${channelId}/clanId/${clanId}`,
          `/message/channelId/${channelId}/clanId/${clanId}`
        ),
        (url) => api.get(url, { params: { page, limit } })
      );
      return response.data;
    }

    // DM: clanId yok → query-string tabanlı genel route
    const response = await requestWithFallback(
      buildUrls(`/message/api/Message`, `/message`),
      (url) => api.get(url, { params: { channelId, page, limit } })
    );
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
    const response = await requestWithFallback(
      buildUrls(
        `/message/api/Message/${messageId}/clanId/${clanId}`,
        `/message/${messageId}/clanId/${clanId}`
      ),
      (url) => api.delete(url)
    );
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
    const response = await requestWithFallback(
      buildUrls(
        `/message/api/Message/${data.messageId}/clanId/${data.clanId}`,
        `/message/${data.messageId}/clanId/${data.clanId}`
      ),
      (url) => api.put(url, data.content)
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
