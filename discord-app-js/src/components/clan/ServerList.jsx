import React, { useRef, useState } from 'react';

function ServerList({ clans, selectedClanId, onSelectClan, onCreateClan, onReorder, isFriendsActive, onSelectFriends }) {
  const draggedIdRef = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);

  const handleDragStart = (e, clanId) => {
    draggedIdRef.current = clanId;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, clanId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (clanId !== draggedIdRef.current) setDragOverId(clanId);
  };

  const handleDragLeave = () => setDragOverId(null);

  const handleDrop = (e, targetClanId) => {
    e.preventDefault();
    setDragOverId(null);
    const draggedId = draggedIdRef.current;
    draggedIdRef.current = null;
    if (!draggedId || draggedId === targetClanId) return;

    const next = [...clans];
    const fromIdx = next.findIndex((c) => c.clanId === draggedId);
    const toIdx = next.findIndex((c) => c.clanId === targetClanId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onReorder?.(next);
  };

  const handleDragEnd = () => {
    draggedIdRef.current = null;
    setDragOverId(null);
  };

  return (
    <nav className="server-list">
      {/* Home button */}
      <div className="server-list__home-wrapper">
        <div
          className={`server-list__indicator ${!selectedClanId && !isFriendsActive ? 'server-list__indicator--active' : ''}`}
        />
        <button
          className={`server-list__item ${!selectedClanId && !isFriendsActive ? 'server-list__item--active' : 'server-list__item--default'}`}
          onClick={() => onSelectClan(null)}
          title="Home"
        >
          <span className="material-symbols-outlined server-list__icon">shield</span>
        </button>
      </div>

      {/* Friends / DM button */}
      <div className="server-list__home-wrapper">
        <div
          className={`server-list__indicator ${isFriendsActive ? 'server-list__indicator--active' : ''}`}
        />
        <button
          className={`server-list__item ${isFriendsActive ? 'server-list__item--active' : 'server-list__item--default'}`}
          onClick={onSelectFriends}
          title="Arkadaşlar"
        >
          <span className="material-symbols-outlined server-list__icon">group</span>
        </button>
      </div>

      <div className="server-list__separator" />

      {/* Clan list */}
      {clans.map((clan) => {
        const isSelected = selectedClanId === clan.clanId;
        const isDragOver = dragOverId === clan.clanId;
        return (
          <div
            key={clan.clanId}
            className="server-list__clan-item"
            draggable
            onDragStart={(e) => handleDragStart(e, clan.clanId)}
            onDragOver={(e) => handleDragOver(e, clan.clanId)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, clan.clanId)}
            onDragEnd={handleDragEnd}
            style={{
              opacity: draggedIdRef.current === clan.clanId ? 0.4 : 1,
              outline: isDragOver ? '2px solid var(--accent, #5865f2)' : 'none',
              borderRadius: isDragOver ? '50%' : undefined,
              transition: 'outline 0.1s',
            }}
          >
            <button
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
          </div>
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
