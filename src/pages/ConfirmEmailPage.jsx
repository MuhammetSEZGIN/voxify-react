import React, { useEffect, useLayoutEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../hooks/useAuth";
import UserService from "../services/UserService";
import "../styles/auth.css";

function ConfirmEmailPage() {
  // Query değerlerini bir kez belleğe al. Ardından doğrulama token'ının adres
  // çubuğu, tarayıcı geçmişi ve kopyalanan URL içinde kalmasını engelle.
  const [{ token, userId }] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      token: searchParams.get("token"),
      userId: searchParams.get("userId"),
    };
  });
  const { isAuthenticated, updateUser } = useAuth();

  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useLayoutEffect(() => {
    if (window.location.search) {
      window.history.replaceState(window.history.state, "", "/confirm-email");
    }
  }, []);

  useEffect(() => {
    if (!token || !userId) {
      setStatus("error");
      setMessage("Doğrulama bağlantısı geçersiz: bağlantı eksik bilgi içeriyor.");
      return;
    }

    let cancelled = false;
    UserService.confirmEmail(userId, token)
      .then(() => {
        if (cancelled) return;
        setStatus("success");
        setMessage("E-posta adresiniz başarıyla doğrulandı.");
        if (isAuthenticated) updateUser({ emailConfirmed: true });
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(err.message || "E-posta doğrulanamadı.");
      });

    return () => { cancelled = true; };
  }, [token, userId, isAuthenticated, updateUser]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.png" alt="Voxify Logo" className="auth-logo__image" />
        </div>

        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          {status === "loading" && <p>E-posta doğrulanıyor...</p>}
          {status === "success" && (
            <>
              <p style={{ color: "#3ba55c", fontWeight: 600 }}>{message}</p>
            </>
          )}
          {status === "error" && <div className="auth-error">{message}</div>}
        </div>

        <div className="auth-footer">
          <p className="auth-footer__text">
            <Link to={isAuthenticated ? "/app" : "/login"} className="auth-footer__link">
              {isAuthenticated ? "Uygulamaya dön" : "Giriş sayfasına dön"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConfirmEmailPage;
