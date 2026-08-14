import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { CLAN_ROLE_COLORS, CLAN_ROLE_LABELS, normalizeClanRole } from '../../utils/constants';
import UserService from '../../services/UserService';
import {
  getMemberAvatarUrl,
  getMemberBio,
  getMemberId,
  getMemberName,
  getMemberProfileBackgroundUrl,
} from '../../utils/member';
import AvatarContent from '../common/AvatarContent';

/**
 * UserProfilePopup
 * Bir üyenin adına/avatarına tıklandığında, tıklanan elemanın hemen üstünde
 * beliren küçük profil kartı (tam ekran modal değil).
 *
 * Props:
 *  - visible     : boolean
 *  - anchorRect  : DOMRect — tıklanan elemanın konumu (üstünde konumlanmak için)
 *  - member      : { userName, avatarUrl, bio, profileBackgroundUrl, role }
 *  - onClose     : () => void
 */
function UserProfilePopup({
  visible,
  anchorRect,
  member,
  currentUserId = '',
  isOnline = false,
  onClose,
}) {
  const popupRef = useRef(null);
  const [style, setStyle] = useState({ left: 0, top: 0 });
  const [remoteProfileState, setRemoteProfileState] = useState({ memberId: '', profile: null });
  const [failedBackgroundUrl, setFailedBackgroundUrl] = useState(null);

  const memberId = getMemberId(member);
  const remoteProfile = remoteProfileState.memberId === memberId
    ? remoteProfileState.profile
    : null;

  useEffect(() => {
    if (!visible || !memberId || memberId === currentUserId) {
      return undefined;
    }

    const controller = new AbortController();
    UserService.getPublicProfile(memberId, controller.signal)
      .then((profile) => {
        if (!controller.signal.aborted && profile) {
          setRemoteProfileState({ memberId, profile });
        }
      })
      .catch((error) => {
        if (error.name !== 'CanceledError' && error.code !== 'ERR_CANCELED') {
          // Public profil endpoint'i gelene kadar kart mevcut üyelik/arkadaşlık
          // alanlarıyla çalışmaya devam eder; kullanıcıya hata yansıtılmaz.
          console.debug('[Profile] Herkese açık profil bilgisi kullanılamıyor:', error.message);
        }
      });

    return () => controller.abort();
  }, [currentUserId, memberId, visible]);

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
  }, [visible, anchorRect, remoteProfile]);

  if (!visible || !member) return null;

  const profile = remoteProfile ? { ...member, ...remoteProfile } : member;
  const name = getMemberName(profile);
  const avatarUrl = getMemberAvatarUrl(profile);
  const bio = getMemberBio(profile).trim();
  const profileBackgroundUrl = getMemberProfileBackgroundUrl(profile);
  const backgroundFailed = failedBackgroundUrl === profileBackgroundUrl;
  const role = normalizeClanRole(profile.role);
  const roleLabel = CLAN_ROLE_LABELS[role] || role;
  const roleColor = CLAN_ROLE_COLORS[role];

  return (
    <div
      ref={popupRef}
      className="user-profile-popup"
      style={style}
    >
      <div className="user-profile-popup__banner">
        {profileBackgroundUrl && !backgroundFailed && (
          <img
            src={profileBackgroundUrl}
            alt=""
            className="user-profile-popup__banner-image"
            onError={() => setFailedBackgroundUrl(profileBackgroundUrl)}
          />
        )}
      </div>
      <div className="user-profile-popup__avatar">
        <AvatarContent src={avatarUrl} name={name} />
        <span
          className={`user-profile-popup__status-dot ${isOnline ? 'user-profile-popup__status-dot--online' : ''}`}
          aria-label={isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
        />
      </div>
      <div className="user-profile-popup__body">
        <p className="user-profile-popup__name">{name}</p>
        <p className="user-profile-popup__handle">@{name}</p>
        <section className="user-profile-popup__about" aria-label="Biyografi">
          <p className="user-profile-popup__about-label">Hakkında</p>
          <p className={`user-profile-popup__bio ${bio ? '' : 'user-profile-popup__bio--empty'}`}>
            {bio || 'Henüz biyografi eklenmemiş.'}
          </p>
        </section>
        <div className="user-profile-popup__meta">
          <span className={`user-profile-popup__presence ${isOnline ? 'user-profile-popup__presence--online' : ''}`}>
            {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
          </span>
          {profile.role && (
            <span
              className="user-profile-popup__role"
              style={roleColor ? { color: roleColor, borderColor: roleColor } : undefined}
            >
              {roleLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserProfilePopup;
