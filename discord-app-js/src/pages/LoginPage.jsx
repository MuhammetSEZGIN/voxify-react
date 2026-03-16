import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
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
          <img src="/logo.png" alt="Voxify Logo" className="auth-logo__image" />
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Username */}
          <label className="auth-field">
            <p className="auth-field__label">Username</p>
            <input
              className="auth-field__input"
              type="text"
              placeholder="Enter your username"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
            />
          </label>

          {/* Password */}
          <div className="auth-field">
            <div className="auth-field__label-row">
              <p className="auth-field__label auth-field__label--inline">Password</p>
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
                className="auth-field__toggle-password"
                aria-label="Toggle password visibility"
                onClick={() => setShowPassword(!showPassword)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  {showPassword ? "visibility" : "visibility_off"}
                </span>
              </button>

            </div>
            <button type="button" className="auth-field__forgot">Forgot Password?</button>
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