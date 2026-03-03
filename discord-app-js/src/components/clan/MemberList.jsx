import React from 'react';

function MemberList({ members, clanId }) {
  if (!clanId || !members) return null;

  // Group by status
  const onlineMembers = members.filter((m) => m.status === 'online' || m.isOnline);
  const offlineMembers = members.filter((m) => m.status !== 'online' && !m.isOnline);

  return (
    <aside className="member-list">
      {/* Header */}
      <div className="member-list__header">
        <h2 className="member-list__title">Clan Members</h2>
        <span className="material-symbols-outlined member-list__header-icon">group</span>
      </div>

      {/* Search */}
      <div className="member-list__search-wrapper">
        <div className="member-list__search">
          <input
            className="member-list__search-input"
            placeholder="Search members..."
            type="text"
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
                        <span>{member.userName?.charAt(0)?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                    <div className="member-list__status-dot member-list__status-dot--online" />
                  </div>
                  <span className="member-list__name">{member.userName || 'Unknown'}</span>
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
                        <span>{member.userName?.charAt(0)?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                    <div className="member-list__status-dot member-list__status-dot--offline" />
                  </div>
                  <span className="member-list__name">{member.userName || 'Unknown'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fallback when no members */}
        {members.length === 0 && (
          <div className="member-list__empty">
            <p>No members found</p>
          </div>
        )}
      </div>
    </aside>
  );
}

export default MemberList;