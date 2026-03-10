import React, { useState } from 'react';
import ClanMembershipService from '../../services/ClanMembershipService';
import { useAuth } from '../../hooks/useAuth';

function CreateClanModal({ onClose, onCreate, onJoin }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('create'); // 'create' | 'join'

  // Create state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Join state
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 3) return;

    setLoading(true);
    try {
      await onCreate({ name: name.trim(), description: description.trim() || null });
      onClose();
    } catch {
      // Error handled in parent
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setJoinLoading(true);
    setJoinError('');
    try {
      await ClanMembershipService.joinClan({
        inviteCode: inviteCode.trim(),
        userId: user?.id || user?.sub || '',
      });
      if (onJoin) onJoin();
      onClose();
    } catch (error) {
      setJoinError(error.response?.data?.message || 'Failed to join clan. Check the invite code.');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Tabs */}
        <div className="modal__tabs">
          <button
            className={`modal__tab ${tab === 'create' ? 'modal__tab--active' : ''}`}
            onClick={() => setTab('create')}
            type="button"
          >
            Create Clan
          </button>
          <button
            className={`modal__tab ${tab === 'join' ? 'modal__tab--active' : ''}`}
            onClick={() => setTab('join')}
            type="button"
          >
            Join Clan
          </button>
        </div>

        {tab === 'create' ? (
          <>
            <h2 className="modal__title">Sunucunu Oluştur</h2>
            <p className="modal__subtitle">
              Sunucun, senin ve arkadaşlarının takıldığı yer. Kendininkini oluştur ve konuşmaya başla.
            </p>

            <form onSubmit={handleCreate}>
              <label className="modal__label">Sunucu Adı</label>
              <input
                className="modal__input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sunucu adını girin"
                minLength={3}
                maxLength={50}
                autoFocus
              />

              <label className="modal__label">Açıklama (İsteğe bağlı)</label>
              <input
                className="modal__input"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sunucunuz hakkında kısa bir açıklama"
              />

              <div className="modal__actions">
                <button type="button" className="modal__btn modal__btn--cancel" onClick={onClose}>
                  Geri
                </button>
                <button
                  type="submit"
                  className="modal__btn modal__btn--primary"
                  disabled={loading || name.trim().length < 3}
                >
                  {loading ? 'Oluşturuluyor...' : 'Oluştur'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 className="modal__title">Join a Clan</h2>
            <p className="modal__subtitle">
              Enter an invite code to join an existing clan.
            </p>

            <form onSubmit={handleJoin}>
              <label className="modal__label">Invite Code</label>
              <input
                className="modal__input"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Paste invite code here"
                autoFocus
              />

              {joinError && <p className="modal__error">{joinError}</p>}

              <div className="modal__actions">
                <button type="button" className="modal__btn modal__btn--cancel" onClick={onClose}>
                  Geri
                </button>
                <button
                  type="submit"
                  className="modal__btn modal__btn--primary"
                  disabled={joinLoading || !inviteCode.trim()}
                >
                  {joinLoading ? 'Joining...' : 'Join'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default CreateClanModal;