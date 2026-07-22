import React, { createContext, useMemo, useState, useEffect, useCallback } from "react";
import { LazyStore } from "@tauri-apps/plugin-store";
import AuthService from "../services/AuthService";

const AuthContext = createContext(null);

// AppData/Roaming/com.voxify.desktop/auth.json — installer tarafından silinmez
const authStore = new LazyStore("auth.json", { autoSave: true });

// Hem store hem localStorage'a yaz (servisler localStorage'dan okur)
async function persistSet(key, value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  localStorage.setItem(key, serialized);
  try {
    await authStore.set(key, value);
  } catch (error) {
    // localStorage yazımı başarılı oldu ama Tauri store diskte diverge etti —
    // bir sonraki restart'ta persistGet localStorage'a düşer, ama en azından loglanmalı.
    console.error(`[Auth] authStore.set("${key}") başarısız, localStorage ile senkron değil:`, error);
  }
}

async function persistRemove(key) {
  localStorage.removeItem(key);
  try {
    await authStore.delete(key);
  } catch (error) {
    console.error(`[Auth] authStore.delete("${key}") başarısız, localStorage ile senkron değil:`, error);
  }
}

// Store'dan oku; boşsa localStorage'a bak (update sonrası kurtarma)
async function persistGet(key) {
  try {
    const storeVal = await authStore.get(key);
    if (storeVal !== null && storeVal !== undefined) return storeVal;
  } catch { /* ignore */ }
  // Store boş — localStorage'dan oku (ilk migration veya kurtarma)
  const lsVal = localStorage.getItem(key);
  return lsVal ?? null;
}

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

function mapClaimsToUser(decoded) {
  if (!decoded) return null;

  const claimMap = {
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'userName',
    'unique_name': 'userName',
    'name': 'userName',
    'preferred_username': 'userName',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': 'id',
    'nameid': 'id',
    'sub': 'id',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'email',
    'email': 'email',
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'role',
    'role': 'role',
  };

  const user = {};
  for (const [key, value] of Object.entries(decoded)) {
    const mapped = claimMap[key];
    if (mapped) user[mapped] = value;
    else user[key] = value;
  }

  if (!user.userName) user.userName = user.email || user.id || 'User';
  return user;
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = await persistGet("token");
      const storedRefreshToken = await persistGet("refreshToken");
      const rawUser = await persistGet("user");
      const storedUser = typeof rawUser === "string"
        ? (() => { try { return JSON.parse(rawUser); } catch { return null; } })()
        : rawUser;

      if (!storedToken) {
        setLoading(false);
        return;
      }

      // Store'da varsa localStorage'ı da güncelle (update sonrası kurtarma)
      if (!localStorage.getItem("token")) {
        localStorage.setItem("token", storedToken);
        if (storedRefreshToken) localStorage.setItem("refreshToken", storedRefreshToken);
        if (storedUser) localStorage.setItem("user", JSON.stringify(storedUser));
        console.info("[Auth] Restored auth data from store to localStorage");
      }

      const decoded = decodeJwt(storedToken);
      const now = Math.floor(Date.now() / 1000);
      const isExpired = decoded?.exp && decoded.exp < now;

      if (isExpired && storedRefreshToken) {
        try {
          const userId = storedUser?.id || decoded?.sub || decoded?.nameid || '';
          const data = await AuthService.refreshToken(userId, storedRefreshToken);
          const newToken = data.accessToken || data.token;
          const newRefreshToken = data.refreshToken;

          await persistSet("token", newToken);
          if (newRefreshToken) await persistSet("refreshToken", newRefreshToken);
          setToken(newToken);

          const newDecoded = decodeJwt(newToken);
          const refreshedUser = mapClaimsToUser(newDecoded);
          if (storedUser?.id) refreshedUser.id = storedUser.id;
          if (storedUser?.sessionId) refreshedUser.sessionId = storedUser.sessionId;
          setUser(refreshedUser);
          await persistSet("user", refreshedUser);
          console.info("[Auth] Token refreshed successfully");
        } catch (error) {
          console.error("[Auth] Token refresh failed, logging out:", error);
          await persistRemove("token");
          await persistRemove("refreshToken");
          await persistRemove("user");
          setToken(null);
          setUser(null);
        }
      } else if (isExpired) {
        console.warn("[Auth] Token expired, no refresh token available");
        await persistRemove("token");
        await persistRemove("refreshToken");
        await persistRemove("user");
        setToken(null);
        setUser(null);
      } else {
        setToken(storedToken);
        const resolvedUser = storedUser
          ?? mapClaimsToUser(decoded?.user ? decoded.user : decoded);
        setUser(resolvedUser);
        if (resolvedUser && !storedUser) await persistSet("user", resolvedUser);
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (userName, password) => {
    try {
      const userData = { userName, password, deviceInfo: navigator.userAgent };
      const data = await AuthService.login(userData);
      const tkn = data.accessToken || data.token;
      const rtkn = data.refreshToken;

      setToken(tkn);
      await persistSet("token", tkn);
      if (rtkn) await persistSet("refreshToken", rtkn);

      const decoded = decodeJwt(tkn);
      const nextUser = data.user ? mapClaimsToUser(data.user) : mapClaimsToUser(decoded);
      if (nextUser && data.userID) nextUser.id = data.userID;
      if (nextUser && data.sessionId) nextUser.sessionId = data.sessionId;
      setUser(nextUser);
      if (nextUser) await persistSet("user", nextUser);
    } catch (error) {
      console.error("Login error", error);
      throw error;
    }
  }, []);

  const register = useCallback(async (userData) => {
    try {
      const data = await AuthService.register(userData);
      const tkn = data.accessToken || data.token;
      const rtkn = data.refreshToken;

      setToken(tkn);
      await persistSet("token", tkn);
      if (rtkn) await persistSet("refreshToken", rtkn);

      const rawUser = data.user ?? decodeJwt(data.token)?.user ?? decodeJwt(data.token);
      const nextUser = mapClaimsToUser(rawUser);
      setUser(nextUser);
      if (nextUser) await persistSet("user", nextUser);
    } catch (error) {
      console.error("Registration error", error);
      throw error;
    }
  }, []);

  // Profil güncellemesi gibi backend'den dönen kısmi verilerle in-memory user'ı yeniler.
  const updateUser = useCallback(async (updates) => {
    setUser((prev) => {
      const next = { ...prev, ...updates };
      persistSet("user", next);
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      if (user?.sessionId) await AuthService.logoutSession(user.sessionId);
    } catch (error) {
      console.error("Logout session error", error);
    }
    await persistRemove("token");
    await persistRemove("refreshToken");
    await persistRemove("user");
    setUser(null);
    setToken(null);
  }, [user?.sessionId]);

  const value = useMemo(
    () => ({ user, token, isAuthenticated: !!token, loading, login, register, logout, updateUser }),
    [user, token, loading, login, register, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export { AuthProvider, AuthContext };
