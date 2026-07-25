import api from "./api";

/**
 * 1:1 DM konuşma yönetimi. Backend MessageService `DmController` ile Ocelot
 * `/message/*` prefix'i üzerinden konuşur.
 *
 * Route'lar MessageService swagger'ından (`:5107/swagger/v1/swagger.json`)
 * doğrulandı — önceki `/message/dm/conversations` tahminleri yanlıştı, gerçek
 * yol `/message/api/Dm/conversations`.
 *
 * Gerçek mesajlaşma (gönderme/alma) mevcut `MessageService.js` +
 * `LiveMessageService.js` (MessageHub) altyapısını `channelId` olarak dönen
 * `conversationId` ile aynen kullanır — DM'ler için ayrı bir mesaj API'si yok.
 */

/**
 * Ocelot'un `/message/*` downstream şablonu kesin tespit edilemedi (bkz.
 * MessageService.js'deki aynı not ve backend-gereksinimleri-dm.md madde 0).
 * Bu yüzden `/message/api/Dm/...` ve `/message/dm/...` biçimlerinin ikisi de
 * deneniyor; tutan biçim hatırlanıyor.
 */
let resolvedDmStyle = null;

const dmCandidates = (suffix) => {
  const prefixed = { style: 'prefixed', url: `/message/api/Dm${suffix}` };
  const rewritten = { style: 'rewritten', url: `/message/dm${suffix}` };
  if (resolvedDmStyle === 'prefixed') return [prefixed];
  if (resolvedDmStyle === 'rewritten') return [rewritten];
  return [prefixed, rewritten];
};

async function dmRequest(suffix, send) {
  let lastError;
  const candidates = dmCandidates(suffix);
  console.debug('[DmService] denenecek adaylar:', candidates.map((c) => c.url));
  for (const candidate of candidates) {
    try {
      const response = await send(candidate.url);
      resolvedDmStyle = candidate.style;
      console.debug('[DmService] başarılı:', candidate.url, '→', response.status);
      return response;
    } catch (error) {
      lastError = error;
      console.debug(
        '[DmService] deneme başarısız:',
        candidate.url,
        '→ status:', error.response?.status,
        'axios code:', error.code,
        'message:', error.message
      );
      if (error.response?.status !== 404) throw error;
    }
  }
  throw lastError;
}

/** Konuşma nesnesindeki id alanını normalize et — backend adlandırması netleşmedi. */
function normalizeConversation(raw, fallbackOtherUserId) {
  if (!raw) return null;
  // BACKEND-DOĞRULA (madde 1.2): POST /api/Dm/conversations'ın response şeması
  // swagger'da belgelenmemiş. conversationId / id / channelId biçimlerinin
  // hepsini kabul ediyoruz ki backend hangisini dönerse dönsün çalışsın.
  const conversationId =
    raw.conversationId || raw.ConversationId ||
    raw.channelId || raw.ChannelId ||
    (typeof raw.id === 'object' && raw.id !== null ? raw.id.$oid : raw.id) ||
    raw.Id || null;

  return {
    conversationId,
    otherUserId: raw.otherUserId || raw.OtherUserId || fallbackOtherUserId || '',
    otherUserName: raw.otherUserName || raw.OtherUserName || '',
    otherAvatarUrl: raw.otherAvatarUrl || raw.OtherAvatarUrl || null,
    lastMessage: raw.lastMessage || raw.LastMessage || '',
    lastMessageAt: raw.lastMessageAt || raw.LastMessageAt || null,
  };
}

/**
 * İki kullanıcı arasındaki DM konuşmasını getirir, yoksa oluşturur (idempotent).
 * POST /message/api/Dm/conversations { otherUserId }
 * @param {string} otherUserId
 * @returns {Promise<{conversationId: string, otherUserId: string}>}
 */
async function getOrCreateConversation(otherUserId) {
  try {
    const response = await dmRequest("/conversations", (url) =>
      api.post(url, { otherUserId })
    );
    const conversation = normalizeConversation(response.data, otherUserId);

    if (!conversation?.conversationId) {
      throw new Error(
        "Sunucu konuşma kimliği döndürmedi. (Backend: POST /api/Dm/conversations yanıtında conversationId bekleniyor.)"
      );
    }
    return conversation;
  } catch (error) {
    throw new Error(describeDmError(error, "DM konuşması başlatılamadı"));
  }
}

/**
 * Oturum açık kullanıcının tüm DM konuşmalarını (son mesaj önizlemesiyle) getirir.
 * GET /message/api/Dm/conversations
 * @returns {Promise<Array<{conversationId, otherUserId, otherUserName, otherAvatarUrl, lastMessage, lastMessageAt}>>}
 */
async function getConversations() {
  try {
    const response = await dmRequest("/conversations", (url) => api.get(url));
    const list = Array.isArray(response.data)
      ? response.data
      : response.data?.$values || response.data?.items || [];
    return list.map((c) => normalizeConversation(c)).filter((c) => c?.conversationId);
  } catch (error) {
    throw new Error(describeDmError(error, "DM konuşmaları alınamadı"));
  }
}

/**
 * DM hatalarını kullanıcıya anlamlı biçimde çevirir.
 *
 * Gateway (Ocelot) route eşleştirmeden ÖNCE authentication çalıştırdığı için
 * var olmayan bir route da 401 döndürüyor (bkz. backend-gereksinimleri-dm.md
 * madde 0). Bu yüzden 401'i körü körüne "oturum düştü" diye yorumlamıyoruz.
 */
function describeDmError(error, fallback) {
  if (error?.message && !error.response) return error.message;

  const status = error.response?.status;
  const serverMsg = error.response?.data?.message || error.response?.data?.title;

  if (status === 401 || status === 403) {
    return serverMsg
      || `${fallback}: yetki reddedildi. (Oturum geçerliyse backend route'u eksik olabilir — gateway eşleşmeyen route'lar için de 401 dönüyor.)`;
  }
  if (status === 404) return `${fallback}: sunucuda böyle bir uç nokta yok (404).`;
  return serverMsg || error.message || fallback;
}

const DmService = {
  getOrCreateConversation,
  getConversations,
};

export default DmService;
export { getOrCreateConversation, getConversations };
