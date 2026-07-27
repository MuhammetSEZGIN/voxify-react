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

