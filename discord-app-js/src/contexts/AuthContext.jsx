import React, { createContext, useMemo, useState, useEffect } from "react";
import AuthService from "../services/AuthService";
import api from "../services/api";
const AuthContext = createContext(null);

function decodeJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    () => {
      if (token) {
        const decoded = decodeJwt(token);
        const derivedUser = decoded?.user || decoded || null;

        if (!user && derivedUser) {
          setUser(derivedUser);
          localStorage.setItem("user", JSON.stringify(derivedUser));
        }
      }
      setLoading(false);
    };

  }, [token, user]);

  const login = async (email, password) => {
    try {
      const data = await AuthService.login(email, password);
      setToken(data.token);
      localStorage.setItem("token", data.token);
      const nextUser = data.user ?? (decodeJwt(data.token)?.user || null);
      setUser(nextUser);
      if (nextUser) {
        localStorage.setItem("user", JSON.stringify(nextUser));
      }

    } catch (error) {
      console.error("Login error", error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);

    AuthService.logout();
  };

  // Global olarak erişilecek değerler
  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!token,
      loading,
      login,
      logout,
    }),
    [user, token, loading]
  );
  // uygulamanın yüklenmesi tamamlanmadan çocuk bileşenleri render etme
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export { AuthProvider, AuthContext };


