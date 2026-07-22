import React, { useState, useEffect, useCallback } from 'react';
import FriendService from '../../services/FriendService';
import UserService from '../../services/UserService';

function FriendsPanel({ user, onlineUserIds, onOpenDm }) {
  const [activeTab, setActiveTab] = useState('friends'); // friends | requests | add
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addFeedback, setAddFeedback] = useState(null);

  const currentUserId = user?.id || user?.sub || '';

  const loadFriends = useCallback(async () => {
    try {
      const data = await FriendService.getFriends();
      setFriends(data || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const data = await FriendService.getRequests();
      setRequests({ incoming: data?.incoming || [], outgoing: data?.outgoing || [] });
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadFriends(), loadRequests()]).finally(() => setLoading(false));
  }, [loadFriends, loadRequests]);

  // Arama debounce (ChatArea.jsx'teki GIF arama pattern'i ile aynı: 400ms)
  useEffect(() => {
    if (activeTab !== 'add' || !searchQuery.trim()) {
      setSearchResults([]);
      return;
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
  }, [searchQuery, activeTab, currentUserId]);

  const handleSendRequest = async (addresseeId) => {
    setAddFeedback(null);
    try {
      await FriendService.sendRequest(addresseeId);
      setAddFeedback('İstek gönderildi');
      loadRequests();
    } catch (err) {
      setAddFeedback(err.message);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await FriendService.acceptRequest(requestId);
      await Promise.all([loadFriends(), loadRequests()]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReject = async (requestId) => {
    try {
      await FriendService.rejectRequest(requestId);
      loadRequests();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemove = async (friendUserId) => {
    try {
      await FriendService.removeFriend(friendUserId);
      loadFriends();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="friends-panel">
      <div className="friends-panel__header">
        <nav className="friends-panel__tabs">
          <button
            className={`friends-panel__tab ${activeTab === 'friends' ? 'friends-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            Arkadaşlar
          </button>
          <button
            className={`friends-panel__tab ${activeTab === 'requests' ? 'friends-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            İstekler
            {requests.incoming.length > 0 && (
              <span className="friends-panel__badge">{requests.incoming.length}</span>
            )}
          </button>
          <button
            className={`friends-panel__tab ${activeTab === 'add' ? 'friends-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            Arkadaş Ekle
          </button>
        </nav>
      </div>

      {error && <p className="account-settings__error friends-panel__error">{error}</p>}

      {loading ? (
        <p className="friends-panel__empty">Yükleniyor...</p>
      ) : (
        <>
          {activeTab === 'friends' && (
            <div className="friends-panel__list">
              {friends.length === 0 ? (
                <p className="friends-panel__empty">Henüz arkadaşın yok. "Arkadaş Ekle" sekmesinden birini bul.</p>
              ) : (
                friends.map((friend) => (
                  <div key={friend.id} className="friends-panel__item">
                    <div className="friends-panel__item-info">
                      <div className="friends-panel__avatar-wrapper">
                        <div className="friends-panel__avatar">
                          {friend.avatarUrl ? (
                            <img src={friend.avatarUrl} alt="" />
                          ) : (
                            <span>{friend.userName?.charAt(0)?.toUpperCase() || '?'}</span>
                          )}
                        </div>
                        {onlineUserIds?.has(friend.id) && <div className="friends-panel__status-dot" />}
                      </div>
                      <div>
                        <p className="friends-panel__name">{friend.userName}</p>
                        <p className="friends-panel__status-text">
                          {onlineUserIds?.has(friend.id) ? 'Çevrimiçi' : 'Çevrimdışı'}
                        </p>
                      </div>
                    </div>
                    <div className="friends-panel__item-actions">
                      <button
                        className="friends-panel__action-btn"
                        title="Mesaj Gönder"
                        onClick={() => onOpenDm?.(friend)}
                      >
                        <span className="material-symbols-outlined">chat</span>
                      </button>
                      <button
                        className="friends-panel__action-btn friends-panel__action-btn--danger"
                        title="Arkadaşlıktan Çıkar"
                        onClick={() => handleRemove(friend.id)}
                      >
                        <span className="material-symbols-outlined">person_remove</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="friends-panel__list">
              {requests.incoming.length === 0 && requests.outgoing.length === 0 ? (
                <p className="friends-panel__empty">Bekleyen istek yok.</p>
              ) : (
                <>
                  {requests.incoming.map((req) => (
                    <div key={req.id} className="friends-panel__item">
                      <div className="friends-panel__item-info">
                        <div className="friends-panel__avatar">
                          {req.requesterAvatarUrl ? (
                            <img src={req.requesterAvatarUrl} alt="" />
                          ) : (
                            <span>{req.requesterUserName?.charAt(0)?.toUpperCase() || '?'}</span>
                          )}
                        </div>
                        <p className="friends-panel__name">{req.requesterUserName}</p>
                      </div>
                      <div className="friends-panel__item-actions">
                        <button className="friends-panel__action-btn" title="Kabul Et" onClick={() => handleAccept(req.id)}>
                          <span className="material-symbols-outlined">check</span>
                        </button>
                        <button className="friends-panel__action-btn friends-panel__action-btn--danger" title="Reddet" onClick={() => handleReject(req.id)}>
                          <span className="material-symbols-outlined">close</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  {requests.outgoing.map((req) => (
                    <div key={req.id} className="friends-panel__item">
                      <div className="friends-panel__item-info">
                        <div className="friends-panel__avatar">
                          {req.addresseeAvatarUrl ? (
                            <img src={req.addresseeAvatarUrl} alt="" />
                          ) : (
                            <span>{req.addresseeUserName?.charAt(0)?.toUpperCase() || '?'}</span>
                          )}
                        </div>
                        <p className="friends-panel__name">{req.addresseeUserName}</p>
                        <p className="friends-panel__status-text">Bekliyor...</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {activeTab === 'add' && (
            <div className="friends-panel__add">
              <input
                className="clan-settings__input"
                placeholder="Kullanıcı adı ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {addFeedback && <p className="account-settings__success friends-panel__error">{addFeedback}</p>}
              <div className="friends-panel__list">
                {searching && <p className="friends-panel__empty">Aranıyor...</p>}
                {!searching && searchQuery.trim() && searchResults.length === 0 && (
                  <p className="friends-panel__empty">Kullanıcı bulunamadı.</p>
                )}
                {searchResults.map((result) => (
                  <div key={result.id} className="friends-panel__item">
                    <div className="friends-panel__item-info">
                      <div className="friends-panel__avatar">
                        {result.avatarUrl ? (
                          <img src={result.avatarUrl} alt="" />
                        ) : (
                          <span>{result.userName?.charAt(0)?.toUpperCase() || '?'}</span>
                        )}
                      </div>
                      <p className="friends-panel__name">{result.userName}</p>
                    </div>
                    <button
                      className="friends-panel__action-btn"
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
        </>
      )}
    </div>
  );
}

export default FriendsPanel;
