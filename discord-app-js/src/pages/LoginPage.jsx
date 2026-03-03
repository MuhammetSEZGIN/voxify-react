import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import "../styles/auth.css";

function LoginPage() {
  const [email, setEmail] = useState("");
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
      await auth.login(email, password);
      navigate("/app");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <svg
            className="auth-logo__icon"
            fill="none"
            height="32"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="32"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
            <path d="M8 12h8" />
            <path d="M12 8v8" />
          </svg>
          <h1 className="auth-logo__text">SesVer</h1>
        </div>

        {/* Header */}
        <div className="auth-header">
          <h1 className="auth-header__title">Log in to your account</h1>
          <p className="auth-header__subtitle">Welcome back! Please enter your details.</p>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Email */}
          <label className="auth-field">
            <p className="auth-field__label">Username or Email</p>
            <input
              className="auth-field__input"
              type="email"
              placeholder="Enter your username or email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          {/* Password */}
          <div className="auth-field">
            <div className="auth-field__label-row">
              <p className="auth-field__label auth-field__label--inline">Password</p>
              <button type="button" className="auth-field__forgot">Forgot Password?</button>
            </div>
            <div className="auth-field__password-wrapper">
              <input
                className="auth-field__input"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="auth-field__toggle-password--login"
                aria-label="Toggle password visibility"
                onClick={() => setShowPassword(!showPassword)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  {showPassword ? "visibility" : "visibility_off"}
                </span>
              </button>
            </div>
          </div>

          {/* Error */}
          {error && <div className="auth-error">{error}</div>}

          {/* Submit */}
          <div style={{ paddingTop: '0.5rem' }}>
            <button type="submit" className="auth-submit" disabled={loading}>
              <span>{loading ? "Logging in..." : "Log In"}</span>
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="auth-footer">
          <p className="auth-footer__text">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="auth-footer__link">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;