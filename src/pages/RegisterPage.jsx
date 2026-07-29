import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import AuthService from '../services/AuthService';
import { useAuth } from '../hooks/useAuth';
import '../styles/auth.css';

function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [avatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Parolalar eşleşmiyor.");
      return;
    }

    setLoading(true);
    try {
      const userDataRegister = {
        email,
        password,
        passwordConfirmation: confirmPassword,
        userName: username,
        avatarUrl: avatarUrl || undefined,
        deviceInfo: navigator.userAgent,
      };
      await AuthService.register(userDataRegister);
      await login(username, password);
      navigate("/app");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-container">
      <div className="auth-card">
        <Link className="auth-logo" to="/" aria-label="Voxify ana sayfa">
          <img src="/logo.png" alt="" className="auth-logo__image" />
        </Link>

        <div className="auth-header">
          <h1 id="register-title" className="auth-header__title">Voxify’a katıl</h1>
          <p className="auth-header__subtitle">Topluluğunu kurmak için ücretsiz hesabını oluştur.</p>
        </div>

        <form className="auth-form auth-form--register" onSubmit={handleSubmit} aria-labelledby="register-title">
          <label className="auth-field">
            <p className="auth-field__label">Kullanıcı adı</p>
            <input
              className="auth-field__input auth-field__input--register"
              type="text"
              name="username"
              autoComplete="username"
              placeholder="Kullanıcı adını seç"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>

          <label className="auth-field">
            <p className="auth-field__label">E-posta</p>
            <input
              className="auth-field__input auth-field__input--register"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="ornek@eposta.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="auth-field">
            <p className="auth-field__label">Parola</p>
            <div className="auth-field__input-wrapper">
              <input
                className="auth-field__input auth-field__input--register"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                placeholder="En az 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                className="auth-field__toggle-password"
                aria-label={showPassword ? "Parolayı gizle" : "Parolayı göster"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }} aria-hidden="true">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </label>

          <label className="auth-field">
            <p className="auth-field__label">Parola tekrarı</p>
            <div className="auth-field__input-wrapper">
              <input
                className={`auth-field__input auth-field__input--register ${passwordMismatch ? 'auth-field__input--error' : ''}`}
                type={showConfirmPassword ? "text" : "password"}
                name="passwordConfirmation"
                autoComplete="new-password"
                placeholder="Parolanı tekrar gir"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                aria-invalid={passwordMismatch}
                aria-describedby={passwordMismatch ? 'password-mismatch' : undefined}
                required
              />
              <button
                type="button"
                className="auth-field__toggle-password"
                aria-label={showConfirmPassword ? "Parola tekrarını gizle" : "Parola tekrarını göster"}
                aria-pressed={showConfirmPassword}
                onClick={() => setShowConfirmPassword((visible) => !visible)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }} aria-hidden="true">
                  {showConfirmPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
            {passwordMismatch && (
              <p id="password-mismatch" className="auth-field__error">Parolalar eşleşmiyor.</p>
            )}
          </label>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <div>
            <button type="submit" className="auth-submit auth-submit--register" disabled={loading || passwordMismatch}>
              {loading ? "Hesap oluşturuluyor..." : "Hesap oluştur"}
            </button>
          </div>
        </form>
        <div className="auth-footer">
          <p className="auth-footer__text">
            Zaten hesabın var mı?{" "}
            <Link to="/login" className="auth-footer__link">Giriş yap</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default RegisterPage;
