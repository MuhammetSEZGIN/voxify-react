export function getMemberId(member) {
  return member?.userId
    || member?.UserId
    || member?.user?.id
    || member?.user?.userId
    || member?.id
    || '';
}

export function getMemberName(member) {
  return member?.userName
    || member?.username
    || member?.UserName
    || member?.Username
    || member?.user?.userName
    || member?.user?.username
    || 'Unknown';
}

export function getMemberAvatarUrl(member) {
  return member?.avatarUrl
    || member?.AvatarUrl
    || member?.avatarURL
    || member?.picture
    || member?.user?.avatarUrl
    || member?.user?.AvatarUrl
    || member?.user?.picture
    || null;
}

export function getMemberBio(member) {
  return member?.bio
    || member?.Bio
    || member?.biography
    || member?.Biography
    || member?.about
    || member?.About
    || member?.user?.bio
    || member?.user?.Bio
    || member?.user?.biography
    || '';
}

/**
 * Profil kartının kapak/arka plan görseli. Yeni kontratın kanonik alanı
 * `profileBackgroundUrl`; eski veya farklı servis adları da geçiş boyunca
 * desteklenir.
 */
export function getMemberProfileBackgroundUrl(member) {
  return member?.profileBackgroundUrl
    || member?.ProfileBackgroundUrl
    || member?.backgroundUrl
    || member?.BackgroundUrl
    || member?.bannerUrl
    || member?.BannerUrl
    || member?.user?.profileBackgroundUrl
    || member?.user?.backgroundUrl
    || member?.user?.bannerUrl
    || null;
}
