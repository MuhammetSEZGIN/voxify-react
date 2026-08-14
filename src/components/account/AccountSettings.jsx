import React, { useEffect, useState } from 'react';
import UserService from '../../services/UserService';
import ImgBBService from '../../services/ImgBBService';
import useAudioDevices from '../../hooks/useAudioDevices';
import VolumeSlider from '../layout/VolumeSlider';
import {
  getMessageNotificationsMuted,
  setMessageNotificationsMuted,
} from '../../utils/messageNotifications';
import {
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
} from '../../utils/desktopNotifications';

const TAB_DETAILS = {
  profile: {
    icon: 'person',
    label: 'Profil',
    title: 'Profil',
    description: 'Voxify’da diğer kullanıcıların seni nasıl gördüğünü düzenle.',
  },
  email: {
    icon: 'mail',
    label: 'E-posta',
    title: 'E-posta ve Doğrulama',
    description: 'Hesabının iletişim adresini ve doğrulama durumunu yönet.',
  },
  password: {
    icon: 'shield_lock',
    label: 'Güvenlik',
    title: 'Güvenlik',
    description: 'Hesabını korumak için güçlü ve benzersiz bir şifre kullan.',
  },
  audio: {
    icon: 'tune',
    label: 'Ses ve İzinler',
    title: 'Ses ve İzinler',
    description: 'Tarayıcı izinlerini, mikrofonu, hoparlörü ve ses tercihlerini yönet.',
  },
};

const PERMISSION_DETAILS = {
  granted: { label: 'İzin verildi', tone: 'granted' },
  denied: { label: 'İzin kapalı', tone: 'denied' },
  prompt: { label: 'İzin gerekli', tone: 'pending' },
  default: { label: 'İzin gerekli', tone: 'pending' },
  unknown: { label: 'Kontrol edilemedi', tone: 'unknown' },
  unsupported: { label: 'Desteklenmiyor', tone: 'unknown' },
};

function AccountSettings({
  user,
  onClose,
  onProfileUpdated,
  initialTab = 'profile',
  audioSettings = {},
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const {
    inputVolume = 100,
    setInputVolume = () => {},
    outputVolume = 100,
    setOutputVolume = () => {},
    selectedInputDevice = '',
    setSelectedInputDevice = () => {},
    selectedOutputDevice = '',
    setSelectedOutputDevice = () => {},
    noiseSuppressionEnabled = true,
    setNoiseSuppressionEnabled = () => {},
  } = audioSettings;
  const {
    inputDevices,
    outputDevices,
    microphonePermission,
    permissionError: microphonePermissionError,
    refreshPermission: refreshMicrophonePermission,
    requestPermission: requestMicrophonePermission,
  } = useAudioDevices();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => !getMessageNotificationsMuted()
  );
  const [notificationPermission, setNotificationPermission] = useState('unknown');
  const [permissionFeedback, setPermissionFeedback] = useState(null);

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

  useEffect(() => {
    let cancelled = false;
    const syncNotificationPermission = async () => {
      const permission = await getDesktopNotificationPermission();
      if (!cancelled) setNotificationPermission(permission);
    };
    syncNotificationPermission();
    window.addEventListener('focus', syncNotificationPermission);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', syncNotificationPermission);
    };
  }, []);

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

  const handleRequestMicrophone = async () => {
    setPermissionFeedback(null);
    await requestMicrophonePermission();
  };

  const handleRequestNotifications = async () => {
    setPermissionFeedback(null);
    const permission = await requestDesktopNotificationPermission();
    setNotificationPermission(permission);
    if (permission !== 'granted') {
      setPermissionFeedback(
        'Bildirim izni açılmadı. Adres çubuğundaki site ayarlarından Bildirimler iznini açabilirsin.'
      );
    }
  };

  const handleNotificationsChange = (enabled) => {
    setMessageNotificationsMuted(!enabled);
    setNotificationsEnabled(enabled);
  };

  const handleRefreshPermissions = async () => {
    setPermissionFeedback(null);
    await refreshMicrophonePermission();
    setNotificationPermission(await getDesktopNotificationPermission());
  };

  const activeTabDetails = TAB_DETAILS[activeTab] || TAB_DETAILS.profile;
  const microphoneStatus = PERMISSION_DETAILS[microphonePermission]
    || PERMISSION_DETAILS.unknown;
  const notificationStatus = PERMISSION_DETAILS[notificationPermission]
    || PERMISSION_DETAILS.unknown;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="clan-settings account-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="clan-settings__sidebar">
          <div className="account-settings__sidebar-profile">
            <div className="account-settings__sidebar-avatar">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" />
              ) : (
                user?.userName?.charAt(0)?.toUpperCase() || '?'
              )}
            </div>
            <div>
              <strong>{user?.userName || 'Voxify kullanıcısı'}</strong>
              <span>Hesap ayarları</span>
            </div>
          </div>
          <h3 className="clan-settings__sidebar-title">Hesap</h3>
          <nav className="clan-settings__nav">
            {['profile', 'email', 'password'].map((tabId) => (
              <button
                key={tabId}
                type="button"
                className={`clan-settings__nav-item ${activeTab === tabId ? 'clan-settings__nav-item--active' : ''}`}
                onClick={() => setActiveTab(tabId)}
              >
                <span className="material-symbols-outlined">{TAB_DETAILS[tabId].icon}</span>
                {TAB_DETAILS[tabId].label}
              </button>
            ))}
            <span className="account-settings__nav-divider" aria-hidden="true" />
            <span className="account-settings__nav-label">Uygulama</span>
            <button
              type="button"
              className={`clan-settings__nav-item ${activeTab === 'audio' ? 'clan-settings__nav-item--active' : ''}`}
              onClick={() => setActiveTab('audio')}
            >
              <span className="material-symbols-outlined">{TAB_DETAILS.audio.icon}</span>
              {TAB_DETAILS.audio.label}
            </button>
          </nav>
        </div>

        <div className="clan-settings__content">
          <div className="clan-settings__header">
            <div>
              <span className="account-settings__eyebrow">AYARLAR</span>
              <h2 id="account-settings-title" className="clan-settings__title">
                {activeTabDetails.title}
              </h2>
              <p className="account-settings__header-description">{activeTabDetails.description}</p>
            </div>
            <button
              type="button"
              className="clan-settings__close-btn"
              onClick={onClose}
              aria-label="Ayarları kapat"
            >
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

          {activeTab === 'audio' && (
            <div className="clan-settings__section account-settings__audio-section">
              <section className="account-settings__permission-section" aria-labelledby="browser-permissions-title">
                <div className="account-settings__section-heading">
                  <div>
                    <span className="material-symbols-outlined" aria-hidden="true">verified_user</span>
                    <div>
                      <h3 id="browser-permissions-title">Tarayıcı izinleri</h3>
                      <p>Voxify izinleri yalnızca ilgili düğmeye bastığında ister.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="account-settings__refresh-button"
                    onClick={handleRefreshPermissions}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
                    Yeniden denetle
                  </button>
                </div>

                <div className="account-settings__permission-grid">
                  <article className="account-settings__permission-card">
                    <div className="account-settings__permission-card-icon">
                      <span className="material-symbols-outlined" aria-hidden="true">mic</span>
                    </div>
                    <div className="account-settings__permission-card-copy">
                      <div>
                        <strong>Mikrofon</strong>
                        <span className={`account-settings__permission-status account-settings__permission-status--${microphoneStatus.tone}`}>
                          {microphoneStatus.label}
                        </span>
                      </div>
                      <p>Ses kanallarında konuşmak için kullanılır. Ses verisi tarayıcı izni olmadan alınamaz.</p>
                      {!['granted', 'unsupported'].includes(microphonePermission) && (
                        <button type="button" onClick={handleRequestMicrophone}>
                          {microphonePermission === 'denied' ? 'İzni yeniden dene' : 'Mikrofon izni iste'}
                        </button>
                      )}
                    </div>
                  </article>

                  <article className="account-settings__permission-card">
                    <div className="account-settings__permission-card-icon account-settings__permission-card-icon--notification">
                      <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
                    </div>
                    <div className="account-settings__permission-card-copy">
                      <div>
                        <strong>Masaüstü bildirimleri</strong>
                        <span className={`account-settings__permission-status account-settings__permission-status--${notificationStatus.tone}`}>
                          {notificationStatus.label}
                        </span>
                      </div>
                      <p>Sekme arka plandayken yeni mesajları işletim sistemi bildirimi olarak gösterir.</p>
                      {!['granted', 'unsupported'].includes(notificationPermission) && (
                        <button type="button" onClick={handleRequestNotifications}>
                          {notificationPermission === 'denied' ? 'İzni yeniden dene' : 'Bildirim izni iste'}
                        </button>
                      )}
                    </div>
                  </article>
                </div>

                {(microphonePermissionError || permissionFeedback) && (
                  <p className="account-settings__permission-feedback" role="status">
                    <span className="material-symbols-outlined" aria-hidden="true">info</span>
                    {microphonePermissionError || permissionFeedback}
                  </p>
                )}

                <div className="account-settings__browser-help">
                  <span className="material-symbols-outlined" aria-hidden="true">page_info</span>
                  <div>
                    <strong>İzin penceresi görünmüyorsa</strong>
                    <p>
                      Adres çubuğundaki site bilgileri veya kilit simgesini aç; Mikrofon ve
                      Bildirimler seçeneklerini “İzin ver” yap. Ardından bu sayfaya dönüp
                      “Yeniden denetle” düğmesine bas.
                    </p>
                  </div>
                </div>
              </section>

              <div className="account-settings__audio-grid">
                <section className="account-settings__audio-card" aria-labelledby="input-settings-title">
                  <div className="account-settings__section-heading">
                    <div>
                      <span className="material-symbols-outlined" aria-hidden="true">graphic_eq</span>
                      <div>
                        <h3 id="input-settings-title">Mikrofon</h3>
                        <p>Giriş aygıtı ve ses işleme</p>
                      </div>
                    </div>
                  </div>

                  <label className="clan-settings__field">
                    <span className="clan-settings__label">Giriş aygıtı</span>
                    <select
                      className="account-settings__select"
                      value={selectedInputDevice}
                      onChange={(event) => setSelectedInputDevice(event.target.value)}
                    >
                      <option value="">Sistem varsayılanı</option>
                      {inputDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Mikrofon ${device.deviceId.slice(0, 5)}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="account-settings__volume-field">
                    <div><span>Giriş sesi</span><strong>%{inputVolume}</strong></div>
                    <VolumeSlider value={inputVolume} onChange={setInputVolume} />
                  </div>

                  <label className="account-settings__setting-row">
                    <span>
                      <strong>AI gürültü izolasyonu</strong>
                      <small>Klavye, fan ve arka plan seslerini azaltır.</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={noiseSuppressionEnabled}
                      onChange={(event) => setNoiseSuppressionEnabled(event.target.checked)}
                    />
                  </label>
                </section>

                <section className="account-settings__audio-card" aria-labelledby="output-settings-title">
                  <div className="account-settings__section-heading">
                    <div>
                      <span className="material-symbols-outlined" aria-hidden="true">headphones</span>
                      <div>
                        <h3 id="output-settings-title">Hoparlör</h3>
                        <p>Çıkış aygıtı ve uygulama uyarıları</p>
                      </div>
                    </div>
                  </div>

                  <label className="clan-settings__field">
                    <span className="clan-settings__label">Çıkış aygıtı</span>
                    <select
                      className="account-settings__select"
                      value={selectedOutputDevice}
                      onChange={(event) => setSelectedOutputDevice(event.target.value)}
                    >
                      <option value="">Sistem varsayılanı</option>
                      {outputDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Hoparlör ${device.deviceId.slice(0, 5)}`}
                        </option>
                      ))}
                    </select>
                    <small className="account-settings__device-note">
                      Bazı tarayıcılar çıkış aygıtı seçimini desteklemez; bu durumda sistem varsayılanı kullanılır.
                    </small>
                  </label>

                  <div className="account-settings__volume-field">
                    <div><span>Çıkış sesi</span><strong>%{outputVolume}</strong></div>
                    <VolumeSlider value={outputVolume} onChange={setOutputVolume} />
                  </div>

                  <label className="account-settings__setting-row">
                    <span>
                      <strong>Mesaj uyarıları</strong>
                      <small>Uygulama içi sesi ve izin verildiyse masaüstü bildirimini açar.</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={(event) => handleNotificationsChange(event.target.checked)}
                    />
                  </label>
                </section>
              </div>

              <p className="account-settings__privacy-note">
                <span className="material-symbols-outlined" aria-hidden="true">lock</span>
                Voxify kamera, konum veya dosya izni istemez. Mikrofon yalnızca ses özelliğini kullandığında açılır.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountSettings;
