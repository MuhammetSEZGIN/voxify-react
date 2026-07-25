import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';

/**
 * UserProfilePopup
 * Bir üyenin adına/avatarına tıklandığında, tıklanan elemanın hemen üstünde
 * beliren küçük profil kartı (tam ekran modal değil). Şimdilik yalnızca
 * avatar + isim gösterir; ileride rol, "hakkında" metni vb. eklenebilir.
 *
 * Props:
 *  - visible     : boolean
 *  - anchorRect  : DOMRect — tıklanan elemanın konumu (üstünde konumlanmak için)
 *  - member      : { userName, avatarUrl, role }
 *  - onClose     : () => void
 */
function UserProfilePopup({ visible, anchorRect, member, onClose }) {
  const popupRef = useRef(null);
  const [style, setStyle] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!visible) return;
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
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

  useLayoutEffect(() => {
    if (!visible || !anchorRect || !popupRef.current) return;
    const rect = popupRef.current.getBoundingClientRect();
    let left = anchorRect.left + anchorRect.width / 2 - rect.width / 2;
    let top = anchorRect.top - rect.height - 8;

    if (top < 8) top = anchorRect.bottom + 8;
    if (left < 8) left = 8;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;

    setStyle({ left, top });
  }, [visible, anchorRect]);

  if (!visible || !member) return null;

  const name = member.userName || member.username || 'Unknown';

  return (
    <div ref={popupRef} className="user-profile-popup" style={style}>
      <div className="user-profile-popup__banner" />
      <div className="user-profile-popup__avatar">
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt="" />
        ) : (
          <span>{name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="user-profile-popup__body">
        <p className="user-profile-popup__name">{name}</p>
        {member.role && <p className="user-profile-popup__role">{member.role}</p>}
      </div>
    </div>
  );
}

export default UserProfilePopup;
