import React, { createContext, useMemo, useState, useEffect, useCallback } from "react";
import AuthService from "../services/AuthService";
import UserService from "../services/UserService";
import {
  getAuthItem,
  migrateLegacyAuthStorage,
  removeAuthItem,
  setAuthItem,
} from "../utils/authStorage";

const AuthContext = createContext(null);

async function persistSet(key, value) {
  setAuthItem(key, value);
}

async function persistRemove(key) {
  removeAuthItem(key);
}

async function persistGet(key) {
  return getAuthItem(key);
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
    'picture': 'avatarUrl',
    'IsEmailConfirmed': 'emailConfirmed',
  };

  const user = {};
  for (const [key, value] of Object.entries(decoded)) {
    const mapped = claimMap[key];
    if (mapped) user[mapped] = value;
    else user[key] = value;
  }

  if (!user.userName) user.userName = user.email || user.id || 'User';
  if (typeof user.emailConfirmed === 'string') {
    user.emailConfirmed = user.emailConfirmed.toLowerCase() === 'true';
  }
  return user;
}

// JWT yalnızca oturum kimliği için yeterlidir; avatar, biyografi ve değişmiş
// e-posta gibi güncel profil alanlarının tek kaynağı `/identity/user/me`'dir.
// İstek geçici olarak başarısız olursa oturum açmayı engellemeden claim verisine
// geri düşeriz.
async function hydrateUserProfile(baseUser) {
  try {
    const profile = await UserService.getMe();
    return { ...baseUser, ...profile };
  } catch (error) {
    console.warn('[Auth] Profil başlangıçta eşitlenemedi:', error.message);
    return baseUser;
  }
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      migrateLegacyAuthStorage();
      const storedToken = await persistGet("token");
      const storedRefreshToken = await persistGet("refreshToken");
      const rawUser = await persistGet("user");
      const storedUser = typeof rawUser === "string"
        ? (() => { try { return JSON.parse(rawUser); } catch { return null; } })()
        : rawUser;

      if (!storedToken) {
        return;
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
          let refreshedUser = mapClaimsToUser(newDecoded);
          if (storedUser?.id) refreshedUser.id = storedUser.id;
          if (storedUser?.sessionId) refreshedUser.sessionId = storedUser.sessionId;
          refreshedUser = await hydrateUserProfile(refreshedUser);
          setUser(refreshedUser);
          await persistSet("user", refreshedUser);
        } catch {
          console.warn("[Auth] Token yenilenemedi; oturum kapatılıyor.");
          await persistRemove("token");
          await persistRemove("refreshToken");
          await persistRemove("user");
          setToken(null);
          setUser(null);
        }
      } else if (isExpired) {
        console.warn("[Auth] Token süresi dolmuş; refresh token bulunamadı.");
        await persistRemove("token");
        await persistRemove("refreshToken");
        await persistRemove("user");
        setToken(null);
        setUser(null);
      } else {
        setToken(storedToken);
        const resolvedUser = storedUser
          ?? mapClaimsToUser(decoded?.user ? decoded.user : decoded);
        const hydratedUser = await hydrateUserProfile(resolvedUser);
        setUser(hydratedUser);
        if (hydratedUser) await persistSet("user", hydratedUser);
      }

    };

    initAuth()
      .catch((error) => {
        console.warn('[Auth] Oturum başlangıç durumu yüklenemedi:', error.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (userName, password) => {
    const userData = { userName, password, deviceInfo: navigator.userAgent };
    const data = await AuthService.login(userData);
    const tkn = data.accessToken || data.token;
    const rtkn = data.refreshToken;

    if (!tkn || !decodeJwt(tkn)) {
      throw new Error('Giriş yanıtında geçerli bir erişim tokenı bulunamadı.');
    }

    setToken(tkn);
    await persistSet("token", tkn);
    if (rtkn) await persistSet("refreshToken", rtkn);

    const decoded = decodeJwt(tkn);
    let nextUser = data.user ? mapClaimsToUser(data.user) : mapClaimsToUser(decoded);
    if (nextUser && data.userID) nextUser.id = data.userID;
    if (nextUser && data.sessionId) nextUser.sessionId = data.sessionId;
    nextUser = await hydrateUserProfile(nextUser);
    setUser(nextUser);
    if (nextUser) await persistSet("user", nextUser);
  }, []);

  const register = useCallback(async (userData) => {
    const data = await AuthService.register(userData);
    const tkn = data.accessToken || data.token;
    const rtkn = data.refreshToken;

    if (!tkn || !decodeJwt(tkn)) {
      throw new Error('Kayıt yanıtında geçerli bir erişim tokenı bulunamadı.');
    }

    setToken(tkn);
    await persistSet("token", tkn);
    if (rtkn) await persistSet("refreshToken", rtkn);

    const decoded = decodeJwt(tkn);
    const rawUser = data.user ?? decoded?.user ?? decoded;
    const nextUser = await hydrateUserProfile(mapClaimsToUser(rawUser));
    setUser(nextUser);
    if (nextUser) await persistSet("user", nextUser);
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
    } catch {
      console.warn("[Auth] Sunucu oturumu kapatılamadı; yerel oturum temizleniyor.");
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthProvider, AuthContext };
