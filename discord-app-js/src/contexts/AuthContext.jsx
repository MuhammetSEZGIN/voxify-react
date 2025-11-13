import React, { createContext, useState, useEffect } from "react";
import AuthService from "../services/AuthService";
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLoginStatus = async () => {
      if (token) {
        setToken(token);
        try {
            // TODO: Kullanıcı bilgilerini alabiliriz
            // Bunu direkt olarak api çağrısı ile yapabiliriz
            // Veya token decode edip içinden user bilgilerini çekebiliriz.


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
