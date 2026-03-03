import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthService from '../services/AuthService';
import { useAuth } from '../hooks/useAuth';
import '../styles/auth.css';

function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
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
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const userDataRegister = {
        email,
        password,
        userName: username,
        avatarUrl: avatarUrl || undefined,
      };
      await AuthService.register(userDataRegister);
      await login(email, password);
      navigate("/app");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div style={{ display: 'flex', width: '100%', maxWidth: '28rem', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* Logo */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h2 className="auth-logo__text" style={{ fontSize: '1.875rem' }}>SesVer</h2>
        </div>

        {/* Form Container */}
        <div className="auth-form-container">
          <div className="auth-form-container__header">
            <h1 className="auth-form-container__title">Create Your Account</h1>
            <p className="auth-form-container__subtitle">Join SesVer today to start communicating.</p>
          </div>

          <form className="auth-form auth-form--register" onSubmit={handleSubmit} style={{ marginTop: '2rem' }}>
            {/* Username */}
            <label className="auth-field">
              <p className="auth-field__label">Username</p>
              <input
                className="auth-field__input auth-field__input--register"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>

            {/* Email */}
            <label className="auth-field">
              <p className="auth-field__label">Email Address</p>
              <input
                className="auth-field__input auth-field__input--register"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            {/* Password */}
            <label className="auth-field">
              <p className="auth-field__label">Password</p>
              <div className="auth-field__input-wrapper">
                <input
                  className="auth-field__input auth-field__input--register"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-field__toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </label>

            {/* Confirm Password */}
            <label className="auth-field">
              <p className="auth-field__label">Confirm Password</p>
              <div className="auth-field__input-wrapper">
                <input
                  className={`auth-field__input auth-field__input--register ${passwordMismatch ? 'auth-field__input--error' : ''}`}
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-field__toggle-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {showConfirmPassword ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
              {passwordMismatch && (
                <p className="auth-field__error">Passwords do not match</p>
              )}
            </label>

            {/* Error */}
            {error && <div className="auth-error">{error}</div>}

            {/* Submit */}
            <div>
              <button type="submit" className="auth-submit auth-submit--register" disabled={loading}>
                {loading ? "Registering..." : "Register"}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
          <p className="auth-footer__text">
            Already have an account?{" "}
            <Link to="/login" className="auth-footer__link">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;