import React, { useEffect, useRef } from 'react';

/**
 * MemberContextMenu
 * Bir klan üyesine sağ tıklandığında açılan bağlam menüsü.
 * `UserVolumeContextMenu` ile aynı konumlandırma/dışarı-tıklama pattern'ini kullanır.
 *
 * Props:
 *  - visible        : boolean
 *  - x, y           : number — viewport-relative pozisyon
 *  - member         : { userId, userName, avatarUrl }
 *  - isSelf         : boolean — kendi üzerine sağ tıklandıysa aksiyonları gizle
 *  - onAddFriend    : (member) => void
 *  - onSendMessage  : (member) => void
 *  - onClose        : () => void
 */
function MemberContextMenu({ visible, x, y, member, isSelf, onAddFriend, onSendMessage, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const el = menuRef.current;
    if (rect.right > window.innerWidth) {
      el.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${y - rect.height}px`;
    }
  }, [visible, x, y]);

  if (!visible || !member) return null;

  const name = member.userName || member.username || 'Unknown';

  return (
    <div
      ref={menuRef}
      className="member-ctx"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="member-ctx__header">
        <div className="member-ctx__avatar">
          {member.avatarUrl ? (
            <img src={member.avatarUrl} alt="" />
          ) : (
            <span>{name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <span className="member-ctx__name">{name}</span>
      </div>

      {!isSelf && (
        <>
          <div className="member-ctx__divider" />
          <button
            className="member-ctx__action"
            onClick={() => { onSendMessage?.(member); onClose?.(); }}
          >
            <span className="material-symbols-outlined">chat</span>
            Mesaj Gönder
          </button>
          <button
            className="member-ctx__action"
            onClick={() => { onAddFriend?.(member); onClose?.(); }}
          >
            <span className="material-symbols-outlined">person_add</span>
            Arkadaş Ekle
          </button>
        </>
      )}
    </div>
  );
}

export default MemberContextMenu;
