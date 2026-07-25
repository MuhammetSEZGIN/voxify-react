import React, { useState } from 'react';
import UserService from '../../services/UserService';
import ImgBBService from '../../services/ImgBBService';

function AccountSettings({ user, onClose, onProfileUpdated, initialTab = 'profile' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Profil sekmesi
  const [userName, setUserName] = useState(user?.userName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(null);

  // Şifre sekmesi
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);

  // E-posta doğrulama sekmesi
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setProfileError(null);
    try {
      const url = await ImgBBService.uploadImage(file);
      setAvatarUrl(url);
    } catch (err) {
      setProfileError(err.message || 'Görsel yüklenemedi');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveProfile = async () => {
    if (!userName.trim()) return;
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const updated = await UserService.updateProfile({
        userName: userName.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl || null,
      });
      setProfileSuccess('Profil güncellendi');
      onProfileUpdated?.(updated);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 6) {
      setPasswordError('Yeni şifre en az 6 karakter olmalıdır');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Yeni şifreler eşleşmiyor');
      return;
    }

    setPasswordSaving(true);
    try {
      await UserService.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Şifreniz başarıyla değiştirildi');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSendConfirmation = async () => {
    setEmailSending(true);
    setEmailError(null);
    try {
      await UserService.resendConfirmationEmail(user?.email || '');
      setEmailSent(true);
    } catch (err) {
      setEmailError(err.message);
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="clan-settings" onClick={(e) => e.stopPropagation()}>
        <div className="clan-settings__sidebar">
          <h3 className="clan-settings__sidebar-title">Hesabım</h3>
          <nav className="clan-settings__nav">
            <button
              className={`clan-settings__nav-item ${activeTab === 'profile' ? 'clan-settings__nav-item--active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <span className="material-symbols-outlined">person</span>
              Profil
            </button>
            <button
              className={`clan-settings__nav-item ${activeTab === 'password' ? 'clan-settings__nav-item--active' : ''}`}
              onClick={() => setActiveTab('password')}
            >
              <span className="material-symbols-outlined">lock</span>
              Şifre
            </button>
            <button
              className={`clan-settings__nav-item ${activeTab === 'email' ? 'clan-settings__nav-item--active' : ''}`}
              onClick={() => setActiveTab('email')}
            >
              <span className="material-symbols-outlined">mail</span>
              E-posta Doğrulama
            </button>
          </nav>
        </div>

        <div className="clan-settings__content">
          <div className="clan-settings__header">
            <h2 className="clan-settings__title">
              {activeTab === 'profile' && 'Profil'}
              {activeTab === 'password' && 'Şifre Değiştir'}
              {activeTab === 'email' && 'E-posta Doğrulama'}
            </h2>
            <button className="clan-settings__close-btn" onClick={onClose}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {activeTab === 'profile' && (
            <div className="clan-settings__section">
              <div className="account-settings__avatar-row">
                <div className="account-settings__avatar-preview">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" />
                  ) : (
                    <span>{userName?.charAt(0)?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <label className="clan-settings__save-btn account-settings__avatar-upload-btn">
                  {avatarUploading ? 'Yükleniyor...' : 'Fotoğraf Yükle'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    disabled={avatarUploading}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              <div className="clan-settings__field">
                <label className="clan-settings__label">Kullanıcı Adı</label>
                <input
                  className="clan-settings__input"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  maxLength={32}
                />
              </div>
              <div className="clan-settings__field">
                <label className="clan-settings__label">Biyografi</label>
                <textarea
                  className="clan-settings__textarea"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Kendinden bahset..."
                  rows={3}
                  maxLength={200}
                />
              </div>

              {profileError && <p className="account-settings__error">{profileError}</p>}
              {profileSuccess && <p className="account-settings__success">{profileSuccess}</p>}

              <button
                className="clan-settings__save-btn"
                onClick={handleSaveProfile}
                disabled={profileSaving || avatarUploading || !userName.trim()}
              >
                {profileSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
              </button>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="clan-settings__section">
              <form onSubmit={handleChangePassword}>
                <div className="clan-settings__field">
                  <label className="clan-settings__label">Mevcut Şifre</label>
                  <input
                    className="clan-settings__input"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="clan-settings__field">
                  <label className="clan-settings__label">Yeni Şifre</label>
                  <input
                    className="clan-settings__input"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <div className="clan-settings__field">
                  <label className="clan-settings__label">Yeni Şifre (Tekrar)</label>
                  <input
                    className="clan-settings__input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>

                {passwordError && <p className="account-settings__error">{passwordError}</p>}
                {passwordSuccess && <p className="account-settings__success">{passwordSuccess}</p>}

                <button className="clan-settings__save-btn" type="submit" disabled={passwordSaving}>
                  {passwordSaving ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="clan-settings__section">
              {user?.emailConfirmed ? (
                <p className="account-settings__success">
                  E-posta adresiniz ({user?.email}) doğrulanmış.
                </p>
              ) : (
                <>
                  <p className="clan-settings__danger-description">
                    E-posta adresiniz ({user?.email}) henüz doğrulanmadı. Doğrulama
                    bağlantısı içeren bir e-posta almak için aşağıdaki butona tıklayın.
                  </p>
                  {emailError && <p className="account-settings__error">{emailError}</p>}
                  {emailSent ? (
                    <p className="account-settings__success">
                      Doğrulama e-postası gönderildi. Gelen kutunuzu kontrol edin.
                    </p>
                  ) : (
                    <button
                      className="clan-settings__save-btn"
                      onClick={handleSendConfirmation}
                      disabled={emailSending}
                    >
                      {emailSending ? 'Gönderiliyor...' : 'Doğrulama E-postası Gönder'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountSettings;
