import React, { useState } from 'react';
import ClanMembershipService from '../../services/ClanMembershipService';

const ROLE_ORDER = { owner: 0, admin: 1, moderator: 2, member: 3 };
const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', moderator: 'Moderator', member: 'Member' };
const ROLE_COLORS = { owner: '#e2b714', admin: '#e74c3c', moderator: '#2ecc71', member: '' };

function MemberList({ members, clanId, onlineUserIds = new Set() }) {
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!clanId || !members) return null;

  const getName = (m) => m.userName || m.username || m.UserName || 'Unknown';
  const getUserId = (m) => m.userId || m.user?.id || m.id || '';
  const getRole = (m) => (m.role || 'member').toLowerCase();

  const filtered = members.filter((m) =>
    getName(m).toLowerCase().includes(search.toLowerCase())
  );

  // Group by role, then sort within each group by online status
  const grouped = {};
  for (const m of filtered) {
    const role = getRole(m);
    if (!grouped[role]) grouped[role] = [];
    grouped[role].push(m);
  }

  // Sort roles by hierarchy
  const sortedRoles = Object.keys(grouped).sort(
    (a, b) => (ROLE_ORDER[a] ?? 99) - (ROLE_ORDER[b] ?? 99)
  );

  // Within each role, online first
  for (const role of sortedRoles) {
    grouped[role].sort((a, b) => {
      const aOnline = onlineUserIds.has(getUserId(a)) ? 0 : 1;
      const bOnline = onlineUserIds.has(getUserId(b)) ? 0 : 1;
      return aOnline - bOnline;
    });
  }

  const handleCreateInvite = async () => {
    try {
      setInviteLoading(true);
      const data = await ClanMembershipService.createInvitation(clanId);
      setInviteCode(data.inviteCode || data);
      setCopied(false);
    } catch (error) {
      console.error('Failed to create invite', error);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseInvite = () => {
    setInviteCode('');
    setCopied(false);
  };

  if (!visible) {
    return (
      <button
        className="member-list__show-btn"
        onClick={() => setVisible(true)}
        title="Show Members"
      >
        <span className="material-symbols-outlined">group</span>
      </button>
    );
  }

  return (
    <aside className="member-list">
      {/* Header */}
      <div className="member-list__header">
        <h2 className="member-list__title">Clan Members</h2>
        <button
          className="member-list__header-icon"
          onClick={() => setVisible(false)}
          title="Hide Members"
        >
          <span className="material-symbols-outlined">group</span>
        </button>
      </div>

      {/* Search */}
      <div className="member-list__search-wrapper">
        <div className="member-list__search">
          <input
            className="member-list__search-input"
            placeholder="Search members..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="material-symbols-outlined member-list__search-icon">search</span>
        </div>
      </div>

      {/* Members grouped by role */}
      <div className="member-list__body">
        {sortedRoles.map((role) => (
          <div key={role} className="member-list__section">
            <p className="member-list__section-title" style={ROLE_COLORS[role] ? { color: ROLE_COLORS[role] } : undefined}>
              {ROLE_LABELS[role] || role} — {grouped[role].length}
            </p>
            <ul className="member-list__list">
              {grouped[role].map((member) => {
                const isOnline = onlineUserIds.has(getUserId(member));
                return (
                  <li key={member.userId || member.id} className={`member-list__item ${!isOnline ? 'member-list__item--offline' : ''}`}>
                    <div className="member-list__avatar-wrapper">
                      <div className={`member-list__avatar ${!isOnline ? 'member-list__avatar--offline' : ''}`}>
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt="" className={`member-list__avatar-img ${!isOnline ? 'member-list__avatar-img--offline' : ''}`} />
                        ) : (
                          <span>{getName(member).charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className={`member-list__status-dot ${isOnline ? 'member-list__status-dot--online' : 'member-list__status-dot--offline'}`} />
                    </div>
                    <span className="member-list__name">{getName(member)}</span>
                    {ROLE_COLORS[role] && (
                      <span className="member-list__role-badge" style={{ color: ROLE_COLORS[role], borderColor: ROLE_COLORS[role] }}>
                        {ROLE_LABELS[role]}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="member-list__empty">
            <p>{search ? 'No members match your search' : 'No members found'}</p>
          </div>
        )}
      </div>

      {/* Invite */}
      <div className="member-list__invite">
        <button
          className="member-list__invite-btn"
          onClick={handleCreateInvite}
          disabled={inviteLoading}
        >
          <span className="material-symbols-outlined">person_add</span>
          {inviteLoading ? 'Creating...' : 'Invite People'}
        </button>

        {inviteCode && (
          <div className="member-list__invite-link-box">
            <input
              className="member-list__invite-link-input"
              value={inviteCode}
              readOnly
            />
            <button
              className="member-list__invite-copy-btn"
              onClick={handleCopyCode}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              className="member-list__invite-close-btn"
              onClick={handleCloseInvite}
              title="Kapat"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export default MemberList;