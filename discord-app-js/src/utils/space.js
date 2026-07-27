/**
 * Space — klan ve DM'in ortak soyutlaması.
 *
 * Mimari karar (2026-07-25): DM'ler klan tablosuna YAZILMAZ. Bunun yerine ikisi
 * de "Space" kavramının birer türü olarak modellenir:
 *
 *   Space
 *   ├── ClanSpace   → roller, davet, üye yönetimi, sol listede görünür
 *   └── DirectSpace → iki sabit üye, rol YOK, davet YOK, sağ listede
 *
 * Amaç: `ChatArea`, `VoiceChannel`, presence gibi bileşenlerin ortak kodu
 * paylaşması, ama rol/davet/üye-atma mantığının DM'e HİÇ ulaşmaması.
 *
 * "DM'i gizli bir klan yap" yaklaşımı kasıtlı olarak reddedildi: o yaklaşımda
 * "karşı taraf beni DM'imden atabilir mi?", "davet kodu üretip üçüncü kişiyi
 * sokabilir mi?" gibi sorular her yere `if (isDm)` istisnası ekleyerek
 * çözülmek zorunda kalırdı. Burada o kod yolları DirectSpace için hiç var olmaz.
 */

export const SPACE_TYPE = {
  CLAN: 'clan',
  DIRECT: 'direct',
};

/** Klan kaydından bir ClanSpace üretir. */
export function clanSpace(clan) {
  if (!clan) return null;
  return {
    type: SPACE_TYPE.CLAN,
    id: clan.clanId,
    name: clan.name,
    // Mesaj/REST çağrılarında path'e gömülen clanId. DirectSpace'te null.
    clanId: clan.clanId,
    raw: clan,
  };
}

/** DM konuşmasından bir DirectSpace üretir. */
export function directSpace(conversation) {
  if (!conversation?.conversationId) return null;
  return {
    type: SPACE_TYPE.DIRECT,
    id: conversation.conversationId,
    name: conversation.otherUserName || 'DM',
    // DM'lerde clanId yok — REST katmanı bunu görünce clanId'siz route'a düşer.
    clanId: null,
    otherUserId: conversation.otherUserId,
    raw: conversation,
  };
}

export const isClanSpace = (space) => space?.type === SPACE_TYPE.CLAN;
export const isDirectSpace = (space) => space?.type === SPACE_TYPE.DIRECT;

/**
 * Bir Space'in ses odası kimliği.
 *
 * Klan: ses kanalının kendi `voiceChannelId`'si (kanal başına bir oda).
 * DM:   konuşma başına TEK kalıcı oda — `dm-{conversationId}`.
 *
 * BACKEND-DOĞRULA (madde 3.1): VoiceService'in `dm-` önekli roomId'yi kabul
 * edip yetkiyi DM katılımcılığından doğrulaması gerekiyor.
 */
export function directVoiceRoomId(conversationId) {
  return conversationId ? `dm-${conversationId}` : null;
}

/**
 * Space'in yetki yetenekleri. Rol/davet mantığının DirectSpace'e sızmadığı
 * tek nokta burası — bileşenler `can(space, 'invite')` diye sorar, kendileri
 * `if (isDm)` kontrolü yapmaz.
 */
export function spaceCapabilities(space, { userRole } = {}) {
  if (isDirectSpace(space)) {
    // DM'de yönetim kavramı yoktur: kimse kimseyi atamaz, davet edemez,
    // rol veremez, konuşmayı "silemez".
    return {
      canManageChannels: false,
      canInvite: false,
      canManageMembers: false,
      canEditSpace: false,
      canLeave: false,
      hasRoles: false,
      hasVoice: true,
    };
  }

  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'admin';
  return {
    canManageChannels: isOwner || isAdmin,
    canInvite: true,
    canManageMembers: isOwner || isAdmin,
    canEditSpace: isOwner || isAdmin,
    canLeave: true,
    hasRoles: true,
    hasVoice: true,
  };
}
