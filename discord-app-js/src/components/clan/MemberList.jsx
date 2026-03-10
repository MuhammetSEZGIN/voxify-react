import React, { useState } from 'react';
import ClanMembershipService from '../../services/ClanMembershipService';

function MemberList({ members, clanId }) {
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!clanId || !members) return null;

  // Kullanıcı adını normalize et (userName veya username)
  const getName = (m) => m.userName || m.username || m.UserName || 'Unknown';

  // Arama filtresi
  const filtered = members.filter((m) =>
    getName(m).toLowerCase().includes(search.toLowerCase())
  );

  // Group by status
  const onlineMembers = filtered.filter((m) => m.status === 'online' || m.isOnline);
  const offlineMembers = filtered.filter((m) => m.status !== 'online' && !m.isOnline);

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

  if (!visible) {
    return (
      <aside className="member-list member-list--collapsed">
        <button
          className="member-list__header-icon"
          onClick={() => setVisible(true)}
          title="Show Members"
        >
          <span className="material-symbols-outlined">group</span>
        </button>
      </aside>
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

      {/* Members */}
      <div className="member-list__body">
        {/* Online */}
        {onlineMembers.length > 0 && (
          <div className="member-list__section">
            <p className="member-list__section-title">
              Online — {onlineMembers.length}
            </p>
            <ul className="member-list__list">
              {onlineMembers.map((member) => (
                <li key={member.userId || member.id} className="member-list__item">
                  <div className="member-list__avatar-wrapper">
                    <div className="member-list__avatar">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt="" className="member-list__avatar-img" />
                      ) : (
                        <span>{getName(member).charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="member-list__status-dot member-list__status-dot--online" />
                  </div>
                  <span className="member-list__name">{getName(member)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Offline */}
        {offlineMembers.length > 0 && (
          <div className="member-list__section">
            <p className="member-list__section-title">
              Offline — {offlineMembers.length}
            </p>
            <ul className="member-list__list">
              {offlineMembers.map((member) => (
                <li key={member.userId || member.id} className="member-list__item member-list__item--offline">
                  <div className="member-list__avatar-wrapper">
                    <div className="member-list__avatar member-list__avatar--offline">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt="" className="member-list__avatar-img member-list__avatar-img--offline" />
                      ) : (
                        <span>{getName(member).charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="member-list__status-dot member-list__status-dot--offline" />
                  </div>
                  <span className="member-list__name">{getName(member)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fallback when no members */}
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
          </div>
        )}
      </div>
    </aside>
  );
}

export default MemberList;