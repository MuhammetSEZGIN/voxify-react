import React, { useLayoutEffect, useState } from 'react';
import { Link } from 'react-router';
import AuthService from '../services/AuthService';
import '../styles/auth.css';

function ResetPasswordPage() {
  const [{ email, token }] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      email: searchParams.get('email') || '',
      token: searchParams.get('token') || '',
    };
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const linkIsValid = Boolean(email && token);

  useLayoutEffect(() => {
    if (window.location.search || window.location.hash) {
      window.history.replaceState(window.history.state, '', '/reset-password');
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Yeni parola en az 6 karakter olmalıdır.');
      return;
    }
    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Yeni parola en az bir küçük harf, bir büyük harf ve bir rakam içermelidir.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('Parolalar eşleşmiyor.');
      return;
    }

    setLoading(true);
    try {
      await AuthService.resetPassword({
        email,
        token,
        newPassword,
        newPasswordConfirmation: confirmation,
      });
      setNewPassword('');
      setConfirmation('');
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.png" alt="Voxify Logo" className="auth-logo__image" />
        </div>

        {success ? (
          <div className="auth-form auth-status-panel">
            <span className="material-symbols-outlined auth-status-panel__icon">verified</span>
            <h1 className="auth-status-panel__title">Parolan değiştirildi</h1>
            <p className="auth-status-panel__text">
              Güvenlik için diğer oturumların kapatıldı. Yeni parolanla giriş yapabilirsin.
            </p>
          </div>
        ) : !linkIsValid ? (
          <div className="auth-form auth-status-panel">
            <span className="material-symbols-outlined auth-status-panel__icon auth-status-panel__icon--error">link_off</span>
            <h1 className="auth-status-panel__title">Bağlantı geçersiz</h1>
            <p className="auth-status-panel__text">
              Bağlantıda e-posta veya güvenlik kodu eksik. Yeni bir bağlantı istemelisin.
            </p>
            <Link to="/forgot-password" className="auth-submit auth-status-panel__link">
              Yeni Bağlantı İste
            </Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-status-panel auth-status-panel--compact">
              <h1 className="auth-status-panel__title">Yeni parola belirle</h1>
              <p className="auth-status-panel__text">
                Bu tek kullanımlık bağlantı gönderildikten sonra 6 saat geçerlidir.
              </p>
            </div>
            <label className="auth-field">
              <p className="auth-field__label">E-posta</p>
              <input className="auth-field__input" type="email" value={email} readOnly />
            </label>
            <label className="auth-field">
              <p className="auth-field__label">Yeni Parola</p>
              <input
                className="auth-field__input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={6}
                required
              />
            </label>
            <label className="auth-field">
              <p className="auth-field__label">Yeni Parola (Tekrar)</p>
              <input
                className="auth-field__input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                minLength={6}
                required
              />
            </label>
            <label className="auth-inline-check">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(event) => setShowPassword(event.target.checked)}
              />
              Parolayı göster
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Değiştiriliyor...' : 'Parolayı Değiştir'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p className="auth-footer__text">
            <Link to="/login" className="auth-footer__link">Giriş sayfasına dön</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
