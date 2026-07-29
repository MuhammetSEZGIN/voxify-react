import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router";
import "../styles/auth.css";

function LoginPage() {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const auth = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await auth.login(userName, password);
      navigate("/app", { replace: true });
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
          <h1 id="login-title" className="auth-header__title">Tekrar hoş geldin</h1>
          <p className="auth-header__subtitle">Topluluğuna kaldığın yerden devam et.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} aria-labelledby="login-title">
          <label className="auth-field">
            <p className="auth-field__label">Kullanıcı adı</p>
            <input
              className="auth-field__input"
              type="text"
              name="username"
              autoComplete="username"
              placeholder="Kullanıcı adını gir"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
            />
          </label>

          {/* Password */}
          <div className="auth-field">
            <div className="auth-field__label-row">
              <p className="auth-field__label auth-field__label--inline">Parola</p>
            </div>
            <div className="auth-field__password-wrapper">
              <input
                className="auth-field__input"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder="Parolanı gir"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            <Link to="/forgot-password" className="auth-field__forgot">Parolanı mı unuttun?</Link>
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <div style={{ paddingTop: '0.5rem' }}>
            <button type="submit" className="auth-submit" disabled={loading}>
              <span>{loading ? "Giriş yapılıyor..." : "Giriş yap"}</span>
            </button>
          </div>
        </form>

        <div className="auth-footer">
          <p className="auth-footer__text">
            Hesabın yok mu?{" "}
            <Link to="/register" className="auth-footer__link">Ücretsiz kayıt ol</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default LoginPage;
