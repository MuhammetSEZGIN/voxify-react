import React from 'react';

function ServerList({ clans, selectedClanId, onSelectClan, onCreateClan }) {
  return (
    <nav className="server-list">
      {/* Home / DM button */}
      <div className="server-list__home-wrapper">
        <div
          className={`server-list__indicator ${!selectedClanId ? 'server-list__indicator--active' : ''}`}
        />
        <button
          className={`server-list__item ${!selectedClanId ? 'server-list__item--active' : 'server-list__item--default'}`}
          onClick={() => onSelectClan(null)}
          title="Home"
        >
          <span className="material-symbols-outlined server-list__icon">shield</span>
        </button>
      </div>

      <div className="server-list__separator" />

      {/* Clan list */}
      {clans.map((clan) => {
        const isSelected = selectedClanId === clan.clanId;
        return (
          <button
            key={clan.clanId}
            className="server-list__clan-btn group"
            onClick={() => onSelectClan(clan)}
            title={clan.name}
          >
            <div
              className={`server-list__indicator ${isSelected ? 'server-list__indicator--active' : 'server-list__indicator--hover'}`}
            />
            {clan.avatarUrl ? (
              <div
                className={`server-list__clan-avatar ${isSelected ? 'server-list__clan-avatar--selected' : ''}`}
                style={{ backgroundImage: `url("${clan.avatarUrl}")` }}
              />
            ) : (
              <div
                className={`server-list__clan-initials ${isSelected ? 'server-list__clan-initials--selected' : ''}`}
              >
                {clan.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </button>
        );
      })}

      {/* Add clan button */}
      <button
        className="server-list__add-btn group"
        onClick={onCreateClan}
        title="Create a Clan"
      >
        <div className="server-list__indicator server-list__indicator--hover" />
        <span className="material-symbols-outlined server-list__add-icon">add</span>
      </button>
    </nav>
  );
}

export default ServerList;