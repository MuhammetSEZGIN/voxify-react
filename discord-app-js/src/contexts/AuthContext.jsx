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

/**
 * .NET JWT claim adlarını kullanıcı dostu alan adlarına eşle.
 */
function mapClaimsToUser(decoded) {
  if (!decoded) return null;

  const claimMap = {
    // userName
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'userName',
    'unique_name': 'userName',
    'name': 'userName',
    'preferred_username': 'userName',
    // id
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': 'id',
    'nameid': 'id',
    'sub': 'id',
    // email
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'email',
    'email': 'email',
    // role
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'role',
    'role': 'role',
  };

  const user = {};
  for (const [key, value] of Object.entries(decoded)) {
    const mapped = claimMap[key];
    if (mapped) {
      user[mapped] = value;
    } else {
      // Bilinmeyen claim'leri de koru
      user[key] = value;
    }
  }

  // Fallback: userName yoksa email veya id kullan
  if (!user.userName) {
    user.userName = user.email || user.id || 'User';
  }

  return user;
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  // Uygulama başlangıcında token geçerliliğini kontrol et ve gerekirse refresh dene
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("token");
      const storedRefreshToken = localStorage.getItem("refreshToken");
      const storedUser = localStorage.getItem("user");

      if (!storedToken) {
        setLoading(false);
        return;
      }

      // Token'ı decode et ve expire kontrolü yap
      const decoded = decodeJwt(storedToken);
      const now = Math.floor(Date.now() / 1000);
      const isExpired = decoded?.exp && decoded.exp < now;

      if (isExpired && storedRefreshToken) {
        // Token expired — refresh dene
        try {
          const parsedUser = storedUser ? JSON.parse(storedUser) : null;
          const userId = parsedUser?.id || decoded?.sub || decoded?.nameid || '';
          const data = await AuthService.refreshToken(userId, storedRefreshToken);
          const newToken = data.accessToken || data.token;
          const newRefreshToken = data.refreshToken;

          localStorage.setItem("token", newToken);
          if (newRefreshToken) localStorage.setItem("refreshToken", newRefreshToken);

          setToken(newToken);

          // Yeni token'dan user bilgisini güncelle
          const newDecoded = decodeJwt(newToken);
          const refreshedUser = mapClaimsToUser(newDecoded);
          if (parsedUser?.id) refreshedUser.id = parsedUser.id;
          if (parsedUser?.sessionId) refreshedUser.sessionId = parsedUser.sessionId;
          setUser(refreshedUser);
          localStorage.setItem("user", JSON.stringify(refreshedUser));

          console.info("[Auth] Token refreshed successfully");
        } catch (error) {
          console.error("[Auth] Token refresh failed, logging out:", error);
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
          setToken(null);
          setUser(null);
        }
      } else if (isExpired) {
        // Token expired ve refresh token yok — logout
        console.warn("[Auth] Token expired, no refresh token available");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        setToken(null);
        setUser(null);
      } else {
        // Token hala geçerli — user bilgisini güncelle
        if (!user) {
          const derivedUser = decoded?.user
            ? mapClaimsToUser(decoded.user)
            : mapClaimsToUser(decoded);
          if (derivedUser) {
            setUser(derivedUser);
            localStorage.setItem("user", JSON.stringify(derivedUser));
          }
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []); // Sadece mount'ta çalışır

  const login = useCallback(async (userName, password) => {
    try {
      const userData = { userName, password, deviceInfo: navigator.userAgent };
      const data = await AuthService.login(userData);
      const tkn = data.accessToken || data.token;
      const rtkn = data.refreshToken;

      setToken(tkn);
      localStorage.setItem("token", tkn);
      if (rtkn) localStorage.setItem("refreshToken", rtkn);

      const decoded = decodeJwt(tkn);
      const nextUser = data.user
        ? mapClaimsToUser(data.user)
        : mapClaimsToUser(decoded);
      if (nextUser && data.userID) nextUser.id = data.userID;
      if (nextUser && data.sessionId) nextUser.sessionId = data.sessionId;
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
      const rtkn = data.refreshToken;

      setToken(tkn);
      localStorage.setItem("token", tkn);
      if (rtkn) localStorage.setItem("refreshToken", rtkn);

      const rawUser = data.user ?? decodeJwt(data.token)?.user ?? decodeJwt(data.token);
      const nextUser = mapClaimsToUser(rawUser);
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
    // Her durumda temizle
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
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


