import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import UserService from '../../services/UserService';

/**
 * FriendsMemberList — Arkadaşlar sekmesinin sağ paneli.
 *
 * Klan içindeki `MemberList.jsx` ile aynı iskelet: 256px sağ `aside`, arama
 * kutusu, katlanabilir başlık, gruplu liste. Fark: rol gruplaması yerine
 * Bekleyen/Çevrimiçi/Çevrimdışı gruplaması ve satır içi aksiyonlar.
 *
 * Eskiden ortada duran `FriendsPanel` (arkadaş ekleme + bekleyen istekler) ve
 * soldaki `FriendsSidebar` (ikinci bir arkadaş listesi) kaldırıldı; ikisinin de
 * işlevi buraya taşındı, orta alan artık sohbete ayrıldı.
 */
function FriendsMemberList({
  friends = [],
  friendRequests = [],
  onlineUserIds = new Set(),
  activeConversationUserId,
  currentUserId,
  loading,
  error,
  onOpenDm,
  onRemoveFriend,
  onRefresh,
  onSendRequest,
  onAcceptRequest,
  onRejectRequest,
}) {
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Arkadaş ekleme paneli
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addFeedback, setAddFeedback] = useState(null);
  const addPanelRef = useRef(null);

  useEffect(() => {
    if (!showAddPanel) return undefined;
    const handleClickOutside = (e) => {
      if (addPanelRef.current && !addPanelRef.current.contains(e.target)) {
        setShowAddPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddPanel]);

  // Kullanıcı arama — 400ms debounce (ChatArea'daki GIF arama pattern'i)
  useEffect(() => {
    if (!showAddPanel || !searchQuery.trim()) {
      setSearchResults([]);
      return undefined;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await UserService.searchUsers(searchQuery.trim());
        setSearchResults((results || []).filter((u) => u.id !== currentUserId));
      } catch (err) {
        setAddFeedback(err.message);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, showAddPanel, currentUserId]);

  const { online, offline } = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = query
      ? friends.filter((f) => (f.userName || '').toLowerCase().includes(query))
      : friends;

    const on = [];
    const off = [];
    for (const friend of matched) {
      (onlineUserIds.has(friend.id) ? on : off).push(friend);
    }
    const byName = (a, b) => (a.userName || '').localeCompare(b.userName || '');
    return { online: on.sort(byName), offline: off.sort(byName) };
  }, [friends, onlineUserIds, search]);

  const totalMatched = online.length + offline.length;

  /** Yalnızca bu sütunu yeniler — arkadaş listesi + bekleyen istekler. */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setActionError(null);
    try {
      await onRefresh?.();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const runAction = useCallback(async (fn, arg) => {
    setActionError(null);
    try {
      await fn?.(arg);
    } catch (err) {
      setActionError(err.message);
    }
  }, []);

  const handleSendRequest = async (addresseeId) => {
    setAddFeedback(null);
    try {
      await onSendRequest?.(addresseeId);
      setAddFeedback('İstek gönderildi');
    } catch (err) {
      setAddFeedback(err.message);
    }
  };

  const renderToggleButton = () => (
    <button
      className={`member-list__toggle-btn ${visible ? 'member-list__toggle-btn--header' : 'member-list__toggle-btn--collapsed'}`}
      onClick={() => setVisible((prev) => !prev)}
      title={visible ? 'Arkadaşları Gizle' : 'Arkadaşları Göster'}
      type="button"
    >
      <span className="material-symbols-outlined">group</span>
    </button>
  );

  if (!visible) {
    return <div className="member-list--collapsed">{renderToggleButton()}</div>;
  }

  const renderFriendRow = (friend, isOnline) => (
    <li
      key={friend.id}
      className={`member-list__item ${!isOnline ? 'member-list__item--offline' : ''} ${activeConversationUserId === friend.id ? 'member-list__item--active' : ''}`}
      onClick={() => onOpenDm?.(friend)}
    >
      <div className="member-list__avatar-wrapper">
        <div className={`member-list__avatar ${!isOnline ? 'member-list__avatar--offline' : ''}`}>
          {friend.avatarUrl ? (
            <img
              src={friend.avatarUrl}
              alt=""
              className={`member-list__avatar-img ${!isOnline ? 'member-list__avatar-img--offline' : ''}`}
            />
          ) : (
            <span>{friend.userName?.charAt(0)?.toUpperCase() || '?'}</span>
          )}
        </div>
        <div
          className={`member-list__status-dot ${isOnline ? 'member-list__status-dot--online' : 'member-list__status-dot--offline'}`}
        />
      </div>
      <span className="member-list__name">{friend.userName}</span>
      <div className="member-list__item-actions">
        <button
          type="button"
          className="member-list__item-action-btn"
          title="Mesaj Gönder"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDm?.(friend);
          }}
        >
          <span className="material-symbols-outlined">chat</span>
        </button>
        <button
          type="button"
          className="member-list__item-action-btn member-list__item-action-btn--danger"
          title="Arkadaşlıktan Çıkar"
          onClick={(e) => {
            e.stopPropagation();
            runAction(onRemoveFriend, friend.id);
          }}
        >
          <span className="material-symbols-outlined">person_remove</span>
        </button>
      </div>
    </li>
  );

  return (
    <aside className="member-list">
      <div className="member-list__header">
        <h2 className="member-list__title">Arkadaşlar</h2>
        <div className="member-list__header-actions">
          <button
            type="button"
            className={`member-list__refresh-btn ${refreshing ? 'member-list__refresh-btn--spinning' : ''}`}
            title="Listeyi Yenile"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
          <div className="member-list__add-wrapper" ref={addPanelRef}>
            <button
              type="button"
              className="member-list__refresh-btn"
              title="Arkadaş Ekle"
              onClick={() => setShowAddPanel((prev) => !prev)}
            >
              <span className="material-symbols-outlined">person_add</span>
            </button>
            {showAddPanel && (
              <div className="member-list__add-panel">
                <div className="friends-panel__search-box">
                  <span className="material-symbols-outlined friends-panel__search-icon">search</span>
                  <input
                    className="friends-panel__search-input"
                    placeholder="Bir kullanıcı adı gir..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="friends-panel__search-clear"
                      title="Temizle"
                      onClick={() => setSearchQuery('')}
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  )}
                </div>
                {addFeedback && (
                  <p className="account-settings__success friends-panel__error">{addFeedback}</p>
                )}
                <div className="member-list__add-results">
                  {searching && <p className="member-list__add-state">Aranıyor...</p>}
                  {!searching && !searchQuery.trim() && (
                    <p className="member-list__add-state">Aramak için bir kullanıcı adı yaz.</p>
                  )}
                  {!searching && searchQuery.trim() && searchResults.length === 0 && (
                    <p className="member-list__add-state">Kullanıcı bulunamadı.</p>
                  )}
                  {searchResults.map((result) => (
                    <div key={result.id} className="member-list__add-row">
                      <div className="member-list__avatar member-list__avatar--sm">
                        {result.avatarUrl ? (
                          <img src={result.avatarUrl} alt="" className="member-list__avatar-img" />
                        ) : (
                          <span>{result.userName?.charAt(0)?.toUpperCase() || '?'}</span>
                        )}
                      </div>
                      <span className="member-list__name">{result.userName}</span>
                      <button
                        type="button"
                        className="member-list__item-action-btn"
                        title="Arkadaş Ekle"
                        onClick={() => handleSendRequest(result.id)}
                      >
                        <span className="material-symbols-outlined">person_add</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {renderToggleButton()}
        </div>
      </div>

      <div className="member-list__search-wrapper">
        <div className="member-list__search">
          <input
            className="member-list__search-input"
            placeholder="Arkadaş ara..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="material-symbols-outlined member-list__search-icon">search</span>
        </div>
      </div>

      <div className="member-list__body">
        {(error || actionError) && (
          <p className="account-settings__error friends-panel__error">{error || actionError}</p>
        )}

        {loading ? (
          <div className="member-list__empty"><p>Yükleniyor...</p></div>
        ) : (
          <>
            {friendRequests.length > 0 && (
              <div className="member-list__section">
                <p className="member-list__section-title">
                  Bekleyen — {friendRequests.length}
                </p>
                <ul className="member-list__list">
                  {friendRequests.map((req) => (
                    <li key={req.id} className="member-list__item">
                      <div className="member-list__avatar-wrapper">
                        <div className="member-list__avatar">
                          {req.avatarUrl ? (
                            <img src={req.avatarUrl} alt="" className="member-list__avatar-img" />
                          ) : (
                            <span>{req.userName?.charAt(0)?.toUpperCase() || '?'}</span>
                          )}
                        </div>
                      </div>
                      <span className="member-list__name">
                        {req.userName || 'Bilinmeyen kullanıcı'}
                      </span>
                      <div className="member-list__item-actions member-list__item-actions--always">
                        <button
                          type="button"
                          className="member-list__item-action-btn member-list__item-action-btn--accept"
                          title="Kabul Et"
                          onClick={() => runAction(onAcceptRequest, req.id)}
                        >
                          <span className="material-symbols-outlined">check</span>
                        </button>
                        <button
                          type="button"
                          className="member-list__item-action-btn member-list__item-action-btn--danger"
                          title="Reddet"
                          onClick={() => runAction(onRejectRequest, req.id)}
                        >
                          <span className="material-symbols-outlined">close</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {online.length > 0 && (
              <div className="member-list__section">
                <p className="member-list__section-title">Çevrimiçi — {online.length}</p>
                <ul className="member-list__list">
                  {online.map((f) => renderFriendRow(f, true))}
                </ul>
              </div>
            )}

            {offline.length > 0 && (
              <div className="member-list__section">
                <p className="member-list__section-title">Çevrimdışı — {offline.length}</p>
                <ul className="member-list__list">
                  {offline.map((f) => renderFriendRow(f, false))}
                </ul>
              </div>
            )}

            {totalMatched === 0 && friendRequests.length === 0 && (
              <div className="member-list__empty">
                <p>{search ? 'Aramanla eşleşen arkadaş yok' : 'Henüz arkadaşın yok'}</p>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

export default memo(FriendsMemberList);
