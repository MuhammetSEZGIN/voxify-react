export const TENOR_API_KEY = import.meta.env.VITE_TENOR_API_KEY;
export const TENOR_CLIENT_KEY = import.meta.env.VITE_TENOR_CLIENT_KEY;

export const CLAN_ROLES = Object.freeze({
    OWNER: 'OWNER',
    ADMIN: 'ADMIN',
    MEMBER: 'MEMBER',
});

export const CLAN_ROLE_LABELS = Object.freeze({
    [CLAN_ROLES.OWNER]: 'Owner',
    [CLAN_ROLES.ADMIN]: 'Admin',
    [CLAN_ROLES.MEMBER]: 'Member',
});

export const CLAN_ROLE_ORDER = Object.freeze({
    [CLAN_ROLES.OWNER]: 0,
    [CLAN_ROLES.ADMIN]: 1,
    [CLAN_ROLES.MEMBER]: 2,
});

export const CLAN_ROLE_COLORS = Object.freeze({
    [CLAN_ROLES.OWNER]: '#e2b714',
    [CLAN_ROLES.ADMIN]: '#e74c3c',
    [CLAN_ROLES.MEMBER]: '',
});

export const CLAN_ASSIGNABLE_ROLES = Object.freeze([
    CLAN_ROLES.MEMBER,
    CLAN_ROLES.ADMIN,
]);

export const normalizeClanRole = (role) => {
    const normalized = String(role || '').trim().toUpperCase();
    return Object.values(CLAN_ROLES).includes(normalized) ? normalized : CLAN_ROLES.MEMBER;
};

export const COMMON_EMOJIS = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
    '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁', '👅', '👄', '💋', '🩸',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'
];
