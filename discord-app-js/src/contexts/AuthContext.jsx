import React, { createContext, useMemo, useState, useEffect, useCallback } from "react";
import AuthService from "../services/AuthService";

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
  const [user, setUser] = useState(localStorage.getItem("user") 
  ? JSON.parse(localStorage.getItem("user")) : null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      const decoded = decodeJwt(token);
      const derivedUser = decoded?.user || decoded || null;

      if (!user && derivedUser) {
        setUser(derivedUser);
        localStorage.setItem("user", JSON.stringify(derivedUser));
      }
    }
    setLoading(false);
  }, [token, user]);

  const login = useCallback(async (userName, password) => {
    try {
      const userData = { userName, password, deviceInfo: navigator.userAgent };
      const data = await AuthService.login(userData);
      const tkn = data.accessToken || data.token;
      setToken(tkn);
      localStorage.setItem("token", tkn);
      const decoded = decodeJwt(tkn);
      const nextUser = data.user ?? decoded ?? null;
      if (nextUser && data.userID) nextUser.id = data.userID;
      setUser(nextUser);
      if (nextUser) {
        localStorage.setItem("user", JSON.stringify(nextUser));
      }

    } catch (error) {
      console.error("Login error", error);
      throw error;
    }
  }, []);

  const register = useCallback(async (userData) => {
    try {
      const data = await AuthService.register(userData);
      const tkn = data.accessToken || data.token;
      setToken(tkn);
      localStorage.setItem("token", tkn);
      const nextUser = data.user ?? (decodeJwt(data.token)?.user || null);
      setUser(nextUser);
      if (nextUser) {
        localStorage.setItem("user", JSON.stringify(nextUser));
      }
    } catch (error) {
      console.error("Registration error", error);
      throw error;
    }
  }, []);
  const logout = useCallback(async () => {
    try {
      if (user?.sessionId) {
        await AuthService.logoutSession(user.sessionId);
      }
    } catch (error) {
      console.error("Logout session error", error);
    }
    finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setToken(null);
    }
  }, [user?.sessionId]);

  // Global olarak erişilecek değerler
  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!token,
      loading,
      login,
      register,
      logout,
    }),
    [user, token, loading, login, register, logout]
  );
  // uygulamanın yüklenmesi tamamlanmadan çocuk bileşenleri render etme
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export { AuthProvider, AuthContext };


