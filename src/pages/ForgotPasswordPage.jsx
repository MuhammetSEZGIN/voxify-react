import React, { useState } from 'react';
import { Link } from 'react-router';
import AuthService from '../services/AuthService';
import '../styles/auth.css';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await AuthService.forgotPassword(email.trim());
      setSent(true);
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

        {sent ? (
          <div className="auth-form auth-status-panel">
            <span className="material-symbols-outlined auth-status-panel__icon">mark_email_read</span>
            <h1 className="auth-status-panel__title">E-postanı kontrol et</h1>
            <p className="auth-status-panel__text">
              Adres bir hesaba bağlıysa parola sıfırlama bağlantısı gönderildi.
              Bağlantı 6 saat geçerli ve yalnızca bir kez kullanılabilir.
            </p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-status-panel auth-status-panel--compact">
              <h1 className="auth-status-panel__title">Parolanı sıfırla</h1>
              <p className="auth-status-panel__text">
                Hesabına bağlı e-posta adresini gir; sana güvenli bir bağlantı gönderelim.
              </p>
            </div>
            <label className="auth-field">
              <p className="auth-field__label">E-posta</p>
              <input
                className="auth-field__input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-submit" disabled={loading || !email.trim()}>
              {loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
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

export default ForgotPasswordPage;
