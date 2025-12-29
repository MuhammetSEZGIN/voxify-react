import React, { createContext, useState, useEffect } from "react";
import AuthService from "../services/AuthService";
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLoginStatus = async () => {
      if (token) {
        setToken(token);
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
            const padded = base64.padEnd(
              base64.length + (4 - (base64.length % 4)) % 4,
              "="
            );
            const payload = JSON.parse(atob(padded));
            setUser(payload.user || payload);
          } else {
            setUser(null);
          }
        } catch (error) {
          console.error("Error setting auth header", error);
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkLoginStatus();
  }, [token]);

  const login = async (email, password) => {
    try {
      const data = await AuthService.login(email, password);
      setUser(data.user);
      setToken(data.token);
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
  const value = {
    user,
    token,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
  };
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export {AuthProvider, AuthContext};


