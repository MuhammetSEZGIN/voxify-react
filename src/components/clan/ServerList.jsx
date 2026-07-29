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
    <nav className="server-list" aria-label="Sunucular">
      <header className="server-list__mobile-header">
        <div>
          <span className="server-list__mobile-eyebrow">Voxify</span>
          <h1>Sunucularım</h1>
        </div>
        <span className="server-list__mobile-count">{clans.length}</span>
      </header>

      {/* Home button */}
      <div className="server-list__home-wrapper">
        <div
          className={`server-list__indicator ${!selectedClanId && !isFriendsActive ? 'server-list__indicator--active' : ''}`}
        />
        <button
          type="button"
          className={`server-list__item ${!selectedClanId && !isFriendsActive ? 'server-list__item--active' : 'server-list__item--default'}`}
          onClick={() => onSelectClan(null)}
          title="Home"
          aria-current={!selectedClanId && !isFriendsActive ? 'page' : undefined}
        >
          <span className="material-symbols-outlined server-list__icon">shield</span>
          <span className="server-list__mobile-label">Ana Sayfa</span>
        </button>
      </div>

      {/* Friends / DM button */}
      <div className="server-list__home-wrapper">
        <div
          className={`server-list__indicator ${isFriendsActive ? 'server-list__indicator--active' : ''}`}
        />
        <button
          type="button"
          className={`server-list__item ${isFriendsActive ? 'server-list__item--active' : 'server-list__item--default'}`}
          onClick={onSelectFriends}
          title="Arkadaşlar"
          aria-current={isFriendsActive ? 'page' : undefined}
        >
          <span className="material-symbols-outlined server-list__icon">group</span>
          <span className="server-list__mobile-label">Arkadaşlar ve Mesajlar</span>
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
              type="button"
              className="server-list__clan-btn group"
              onClick={() => onSelectClan(clan)}
              title={clan.name}
              aria-current={isSelected ? 'page' : undefined}
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
              <span className="server-list__mobile-label">{clan.name}</span>
              <span className="material-symbols-outlined server-list__mobile-chevron">
                chevron_right
              </span>
            </button>
          </div>
        );
      })}

      {clans.length === 0 && (
        <div className="server-list__mobile-empty">
          <span className="material-symbols-outlined">shield_with_heart</span>
          <strong>Henüz bir sunucun yok</strong>
          <p>Yeni bir sunucu oluşturabilir veya davet koduyla katılabilirsin.</p>
        </div>
      )}

      {/* Add clan button */}
      <button
        type="button"
        className="server-list__add-btn group"
        onClick={onCreateClan}
        title="Create a Clan"
      >
        <div className="server-list__indicator server-list__indicator--hover" />
        <span className="material-symbols-outlined server-list__add-icon">add</span>
        <span className="server-list__mobile-label">Sunucu Oluştur veya Katıl</span>
      </button>
    </nav>
  );
}

export default ServerList;
