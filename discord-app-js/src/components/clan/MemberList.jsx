import React from 'react';
import { getClanRole } from '../../utils/permissions';

const ROLE_LABELS = {
  owner: 'Sahip',
  admin: 'Yönetici',
  moderator: 'Moderatör',
  member: 'Üye',
};

const ROLE_COLORS = {
  owner: '#f0b132',
  admin: '#e74c3c',
  moderator: '#2ecc71',
  member: '#dbdee1',
};

function MemberList({ members, clanId }) {
  if (!members || members.length === 0) {
    return (
      <aside className="member-list">
        <div className="member-list__header">Üyeler</div>
        <div className="member-list__empty">Üye bulunamadı</div>
      </aside>
    );
  }

  // Üyeleri role göre grupla
  const grouped = {};
  for (const member of members) {
    const rawRole = member.role || getClanRole(member.user, clanId) || 'member';
    const role = rawRole.toLowerCase();
    if (!grouped[role]) grouped[role] = [];
    grouped[role].push(member);
  }

  // Rol sıralaması
  const roleOrder = ['owner', 'admin', 'moderator', 'member'];

  return (
    <aside className="member-list">
      <div className="member-list__header">Üyeler — {members.length}</div>
      <div className="member-list__content">
        {roleOrder.map((role) => {
          const group = grouped[role];
          if (!group || group.length === 0) return null;

          return (
            <div key={role} className="member-list__group">
              <div
                className="member-list__role-header"
                style={{ color: ROLE_COLORS[role] || '#949ba4' }}
              >
                {ROLE_LABELS[role] || role} — {group.length}
              </div>
              {group.map((member) => (
                <MemberItem
                  key={member.userId || member.user?.id}
                  member={member}
                  roleColor={ROLE_COLORS[role]}
                />
              ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function MemberItem({ member, roleColor }) {
  const username = member.user?.username || member.username || 'Bilinmeyen';
  const avatarUrl = member.user?.avatarUrl || member.avatarUrl;

  return (
    <div className="member-item">
      <div className="member-item__avatar">
        {avatarUrl ? (
          <img src={avatarUrl} alt={username} />
        ) : (
          username.charAt(0).toUpperCase()
        )}
      </div>
      <span className="member-item__name" style={{ color: roleColor }}>
        {username}
      </span>
    </div>
  );
}

export default MemberList;