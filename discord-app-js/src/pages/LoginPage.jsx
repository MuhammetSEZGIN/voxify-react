import React, { useState } from "react";
import AuthService from "../services/AuthService";
import { useAuth } from "../hooks/useAuth";

import { useNavigate } from "react-router-dom";
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setLoading(false);
    } finally {
      setLoading(false);
    }
    console.log("giriş yapılıyor...", { email, password });
  };
  
  return (
    <div className="auth-page">
      <h2>Giriş Sayfası</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {/* error true ise mesaj gösterir ama null ise göstermez */}
        {error && <div className="error-message">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>{" "}
      </form>
      {/* TODO: register sayfasına link eklenecek */}
    </div>
  );
}

export default LoginPage;
