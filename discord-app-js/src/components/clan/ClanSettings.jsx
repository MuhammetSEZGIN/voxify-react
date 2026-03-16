import React, { useState } from 'react';

function ClanSettings({
  clan,
  members,
  userRole,
  user,
  onClose,
  onUpdateClan,
  onDeleteClan,
  onUpdateMemberRole,
  onKickMember,
}) {
  const [activeTab, setActiveTab] = useState('general');
  const [clanName, setClanName] = useState(clan?.name || '');
  const [clanDescription, setClanDescription] = useState(clan?.description || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const isOwner = userRole === 'owner';
  const currentUserId = user?.id || user?.sub || '';

  const handleSaveGeneral = async () => {
    if (!clanName.trim()) return;
    setSaving(true);
    try {
      await onUpdateClan({
        clanId: clan.clanId,
        name: clanName.trim(),
        imagePath: clan.imagePath || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClan = async () => {
    await onDeleteClan();
    onClose();
  };

  const handleRoleChange = async (membershipId, newRole) => {
    await onUpdateMemberRole(membershipId, newRole);
  };

  const handleKick = async (memberId) => {
    await onKickMember(clan.clanId, memberId);
  };

  const getMemberName = (m) =>
    m.user?.username || m.user?.userName || m.userName || m.username || 'Unknown';

  const getMemberId = (m) => m.userId || m.user?.id || '';

  const getMembershipId = (m) => m.id || m.membershipId || '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="clan-settings" onClick={(e) => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="clan-settings__sidebar">
          <h3 className="clan-settings__sidebar-title">{clan.name}</h3>
          <nav className="clan-settings__nav">
            <button
              className={`clan-settings__nav-item ${activeTab === 'general' ? 'clan-settings__nav-item--active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <span className="material-symbols-outlined">tune</span>
              Genel
            </button>
            <button
              className={`clan-settings__nav-item ${activeTab === 'members' ? 'clan-settings__nav-item--active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              <span className="material-symbols-outlined">group</span>
              Üyeler
            </button>
            {isOwner && (
              <button
                className="clan-settings__nav-item clan-settings__nav-item--danger"
                onClick={() => setActiveTab('danger')}
              >
                <span className="material-symbols-outlined">warning</span>
                Tehlikeli Alan
              </button>
            )}
          </nav>
        </div>

        {/* Content */}
        <div className="clan-settings__content">
          <div className="clan-settings__header">
            <h2 className="clan-settings__title">
              {activeTab === 'general' && 'Genel Ayarlar'}
              {activeTab === 'members' && 'Üye Yönetimi'}
              {activeTab === 'danger' && 'Tehlikeli Alan'}
            </h2>
            <button className="clan-settings__close-btn" onClick={onClose}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="clan-settings__section">
              <div className="clan-settings__field">
                <label className="clan-settings__label">Klan Adı</label>
                <input
                  className="clan-settings__input"
                  value={clanName}
                  onChange={(e) => setClanName(e.target.value)}
                  maxLength={50}
                />
              </div>
              <div className="clan-settings__field">
                <label className="clan-settings__label">Açıklama</label>
                <textarea
                  className="clan-settings__textarea"
                  value={clanDescription}
                  onChange={(e) => setClanDescription(e.target.value)}
                  placeholder="Klan hakkında kısa bir açıklama..."
                  rows={3}
                />
              </div>
              <button
                className="clan-settings__save-btn"
                onClick={handleSaveGeneral}
                disabled={saving || !clanName.trim()}
              >
                {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
              </button>
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="clan-settings__section">
              <div className="clan-settings__members-list">
                {members && members.length > 0 ? (
                  members.map((member) => {
                    const memberId = getMemberId(member);
                    const membershipId = getMembershipId(member);
                    const memberRole = (member.role || 'member').toLowerCase();
                    const isSelf = memberId === currentUserId;
                    const canEditRole = isOwner && !isSelf && memberRole !== 'owner';
                    const canKick = (isOwner || (userRole === 'admin' && memberRole === 'member')) && !isSelf && memberRole !== 'owner';

                    return (
                      <div key={memberId || membershipId} className="clan-settings__member-item">
                        <div className="clan-settings__member-info">
                          <div className="clan-settings__member-avatar">
                            <span>{getMemberName(member).charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="clan-settings__member-name">
                              {getMemberName(member)}
                              {isSelf && <span className="clan-settings__member-you"> (Sen)</span>}
                            </p>
                            <p className="clan-settings__member-role-label">{memberRole}</p>
                          </div>
                        </div>
                        <div className="clan-settings__member-actions">
                          {canEditRole && (
                            <select
                              className="clan-settings__role-select"
                              value={memberRole}
                              onChange={(e) => handleRoleChange(membershipId, e.target.value)}
                            >
                              <option value="member">Member</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}
                          {canKick && (
                            <button
                              className="clan-settings__kick-btn"
                              onClick={() => handleKick(memberId)}
                              title="Üyeyi At"
                            >
                              <span className="material-symbols-outlined">person_remove</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="clan-settings__empty">Üye bulunamadı</p>
                )}
              </div>
            </div>
          )}

          {/* Danger Zone Tab */}
          {activeTab === 'danger' && isOwner && (
            <div className="clan-settings__section">
              <div className="clan-settings__danger-zone">
                <h3 className="clan-settings__danger-title">Klanı Sil</h3>
                <p className="clan-settings__danger-description">
                  Bu işlem geri alınamaz. Klan ve tüm kanallar kalıcı olarak silinecektir.
                </p>
                {!showDeleteConfirm ? (
                  <button
                    className="clan-settings__delete-btn"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Klanı Sil
                  </button>
                ) : (
                  <div className="clan-settings__delete-confirm">
                    <p>Emin misiniz? Bu işlem geri alınamaz!</p>
                    <div className="clan-settings__delete-confirm-actions">
                      <button className="clan-settings__delete-btn" onClick={handleDeleteClan}>
                        Evet, Sil
                      </button>
                      <button
                        className="clan-settings__cancel-btn"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClanSettings;
