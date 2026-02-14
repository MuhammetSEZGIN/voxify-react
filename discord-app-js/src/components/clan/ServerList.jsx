import React from 'react';

function ServerList({ clans, selectedClanId, onSelectClan, onCreateClan }) {
  return (
    <nav className="server-list">
      {/* Home button */}
      <div
        className={`server-list__item ${!selectedClanId ? 'server-list__item--active' : ''}`}
        onClick={() => onSelectClan(null)}
        title="Ana Sayfa"
        style={{ background: !selectedClanId ? '#5865f2' : '#313338' }}
      >
        🏠
      </div>

      <div className="server-list__separator" />

      {clans.map((clan) => (
        <div
          key={clan.clanId}
          className={`server-list__item ${selectedClanId === clan.clanId ? 'server-list__item--active' : ''}`}
          onClick={() => onSelectClan(clan)}
          title={clan.name}
        >
          {clan.imagePath ? (
            <img src={clan.imagePath} alt={clan.name} />
          ) : (
            clan.name.charAt(0).toUpperCase()
          )}
        </div>
      ))}

      <div className="server-list__separator" />

      <div
        className="server-list__item server-list__item--add"
        onClick={onCreateClan}
        title="Sunucu Ekle"
      >
        +
      </div>
    </nav>
  );
}

export default ServerList;