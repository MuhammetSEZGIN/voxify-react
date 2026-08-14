import React, { useEffect, useState } from 'react';
import UserService from '../../services/UserService';
import ImgBBService from '../../services/ImgBBService';

function AccountSettings({ user, onClose, onProfileUpdated, initialTab = 'profile' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Profil sekmesi
  const [userName, setUserName] = useState(user?.userName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [profileBackgroundUrl, setProfileBackgroundUrl] = useState(
    user?.profileBackgroundUrl || ''
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(null);

  // Şifre sekmesi
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);

  // E-posta doğrulama sekmesi
  const [email, setEmail] = useState(user?.email || '');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [emailSent, setEmailSent] = useState(false);

  // JWT yalnızca temel claim'leri taşır; profil modalı açıldığında biyografi,
  // avatar ve e-posta gibi alanları gerçek `/me` kaynağından eşitle.
  useEffect(() => {
    let cancelled = false;
    UserService.getMe()
      .then((profile) => {
        if (cancelled || !profile) return;
        setUserName(profile.userName || '');
        setBio(profile.bio || '');
        setAvatarUrl(profile.avatarUrl || '');
        if (Object.prototype.hasOwnProperty.call(profile, 'profileBackgroundUrl')) {
          setProfileBackgroundUrl(profile.profileBackgroundUrl || '');
        }
        setEmail(profile.email || '');
        onProfileUpdated?.(profile);
      })
      .catch((err) => {
        if (!cancelled) setProfileError(err.message);
      });
    return () => { cancelled = true; };
  }, [onProfileUpdated]);

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

  const handleBackgroundChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileError('Arka plan için bir görsel veya GIF seçmelisin.');
      e.target.value = '';
      return;
    }

    setBackgroundUploading(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const url = await ImgBBService.uploadImage(file);
      setProfileBackgroundUrl(url);
    } catch (err) {
      setProfileError(err.message || 'Arka plan görseli yüklenemedi');
    } finally {
      setBackgroundUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveProfile = async () => {
    if (!userName.trim()) return;
    const normalizedAvatarUrl = avatarUrl.trim();
    const normalizedBackgroundUrl = profileBackgroundUrl.trim();
    if (normalizedAvatarUrl && !/^https:\/\//i.test(normalizedAvatarUrl)) {
      setProfileError('Profil fotoğrafı URL’si https:// ile başlamalıdır.');
      return;
    }
    if (normalizedBackgroundUrl && !/^https:\/\//i.test(normalizedBackgroundUrl)) {
      setProfileError('Profil arka planı URL’si https:// ile başlamalıdır.');
      return;
    }
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const updated = await UserService.updateProfile({
        userName: userName.trim(),
        bio: bio.trim(),
        avatarUrl: normalizedAvatarUrl || null,
        profileBackgroundUrl: normalizedBackgroundUrl || null,
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
    if (!/[a-z]/.test(newPassword)) {
      setPasswordError('Yeni şifre en az bir küçük harf içermelidir');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setPasswordError('Yeni şifre en az bir büyük harf içermelidir');
      return;
    }
    if (!/\d/.test(newPassword)) {
      setPasswordError('Yeni şifre en az bir rakam içermelidir');
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

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setEmailError('E-posta adresi gereklidir.');
      return;
    }

    setEmailSending(true);
    setEmailError(null);
    setEmailSent(false);
    try {
      await UserService.updateEmail(normalizedEmail);
      onProfileUpdated?.({ email: normalizedEmail, emailConfirmed: false });
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
                <label className="clan-settings__label" htmlFor="account-avatar-url">
                  Profil Fotoğrafı URL'si
                </label>
                <input
                  id="account-avatar-url"
                  className="clan-settings__input"
                  type="url"
                  inputMode="url"
                  placeholder="https://ornek.com/profil.png"
                  value={avatarUrl}
                  onChange={(e) => {
                    setAvatarUrl(e.target.value);
                    setProfileError(null);
                    setProfileSuccess(null);
                  }}
                />
                <p className="account-settings__field-hint">
                  Bir dosya yükleyebilir veya dışarıda barındırılan görselin HTTPS adresini kullanabilirsin.
                </p>
              </div>

              <div className="clan-settings__field account-settings__background-field">
                <label className="clan-settings__label" htmlFor="account-background-url">
                  Profil Arka Planı
                </label>
                <div className="account-settings__background-preview">
                  {profileBackgroundUrl ? (
                    <img src={profileBackgroundUrl} alt="Profil arka planı önizlemesi" />
                  ) : (
                    <div className="account-settings__background-placeholder">
                      <span className="material-symbols-outlined">panorama</span>
                      <span>Profil kartında görünecek arka plan</span>
                    </div>
                  )}
                  <div className="account-settings__background-preview-avatar">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" />
                    ) : (
                      <span>{userName?.charAt(0)?.toUpperCase() || '?'}</span>
                    )}
                  </div>
                </div>
                <div className="account-settings__background-actions">
                  <label className="clan-settings__save-btn account-settings__avatar-upload-btn">
                    {backgroundUploading ? 'Yükleniyor...' : 'Görsel veya GIF Yükle'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleBackgroundChange}
                      disabled={backgroundUploading}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {profileBackgroundUrl && (
                    <button
                      type="button"
                      className="account-settings__background-remove"
                      onClick={() => {
                        setProfileBackgroundUrl('');
                        setProfileError(null);
                        setProfileSuccess(null);
                      }}
                    >
                      Kaldır
                    </button>
                  )}
                </div>
                <input
                  id="account-background-url"
                  className="clan-settings__input"
                  type="url"
                  inputMode="url"
                  placeholder="https://ornek.com/arka-plan.gif"
                  value={profileBackgroundUrl}
                  onChange={(e) => {
                    setProfileBackgroundUrl(e.target.value);
                    setProfileError(null);
                    setProfileSuccess(null);
                  }}
                />
                <p className="account-settings__field-hint">
                  PNG, JPG, WebP ve hareketli GIF kullanabilirsin. Görsel profil kartında kırpılarak gösterilir.
                </p>
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
                disabled={profileSaving || avatarUploading || backgroundUploading || !userName.trim()}
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
                    type={showPasswords ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="clan-settings__field">
                  <label className="clan-settings__label">Yeni Şifre</label>
                  <input
                    className="clan-settings__input"
                    type={showPasswords ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                  <p className="account-settings__field-hint">
                    En az 6 karakter; bir küçük harf, bir büyük harf ve bir rakam kullanın.
                  </p>
                </div>
                <div className="clan-settings__field">
                  <label className="clan-settings__label">Yeni Şifre (Tekrar)</label>
                  <input
                    className="clan-settings__input"
                    type={showPasswords ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>

                <label className="account-settings__inline-check">
                  <input
                    type="checkbox"
                    checked={showPasswords}
                    onChange={(e) => setShowPasswords(e.target.checked)}
                  />
                  Şifreleri göster
                </label>

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
              <form onSubmit={handleUpdateEmail}>
                <div className="clan-settings__field">
                  <label className="clan-settings__label" htmlFor="account-email">
                    E-posta Adresi
                  </label>
                  <input
                    id="account-email"
                    className="clan-settings__input"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError(null);
                      setEmailSent(false);
                    }}
                    required
                  />
                </div>

                <p className={user?.emailConfirmed ? 'account-settings__success' : 'clan-settings__danger-description'}>
                  {user?.emailConfirmed
                    ? 'Mevcut adresiniz doğrulanmış. Adresi değiştirirseniz yeni adresi doğrulamanız gerekir.'
                    : 'Bu adres henüz doğrulanmadı. Aynı adresle devam ederseniz doğrulama e-postası yeniden gönderilir.'}
                </p>

                {emailError && <p className="account-settings__error">{emailError}</p>}
                {emailSent && (
                  <p className="account-settings__success">
                    Doğrulama e-postası {email.trim()} adresine gönderildi.
                  </p>
                )}

                <button
                  className="clan-settings__save-btn"
                  type="submit"
                  disabled={emailSending || !email.trim() || (user?.emailConfirmed && email.trim() === user?.email)}
                >
                  {emailSending
                    ? 'Gönderiliyor...'
                    : email.trim() !== user?.email
                      ? 'E-postayı Değiştir ve Doğrula'
                      : 'Doğrulama E-postasını Yeniden Gönder'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountSettings;
