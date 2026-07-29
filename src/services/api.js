import axios from "axios";
import {
  clearAuthSession,
  getAuthItem,
  setAuthItem,
} from "../utils/authStorage";

const API_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";
const API_TIMEOUT_MS = 15000;

const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getAuthItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

function clearSessionAndRedirect() {
  clearAuthSession();
  window.location.replace("/login");
}

// Eşzamanlı 401'lerde tek bir refresh isteği paylaşılır.
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = getAuthItem("refreshToken");
  if (!refreshToken) {
    throw new Error("Refresh token yok");
  }

  const rawUser = getAuthItem("user");
  const userId = (() => {
    try {
      return rawUser ? JSON.parse(rawUser)?.id ?? "" : "";
    } catch {
      return "";
    }
  })();

  // Interceptor döngüsüne girmemek için ayrı, temiz bir axios örneği kullanılır.
  const response = await axios.post(`${API_URL}/identity/refresh-token`, {
    userId,
    refreshToken,
  }, {
    timeout: API_TIMEOUT_MS,
  });

  const result = response.data;
  if (!result?.isSuccessfull) {
    throw new Error(result?.message || "Token refresh failed");
  }

  const data = result.data ?? result;
  const newToken = data.accessToken || data.token;
  const newRefreshToken = data.refreshToken;
  if (!newToken) {
    throw new Error("Refresh yanıtında token yok");
  }

  setAuthItem("token", newToken);
  if (newRefreshToken) setAuthItem("refreshToken", newRefreshToken);

  return newToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (response?.status === 401 && config && !config._retry) {
      // Refresh isteğinin kendisi 401 döndüyse tekrar denemeye çalışma.
      if (config.url?.includes("/identity/refresh-token")) {
        console.warn("Refresh token geçersiz; oturum kapatılıyor.");
        clearSessionAndRedirect();
        return Promise.reject(error);
      }

      config._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;

        config.headers["Authorization"] = `Bearer ${newToken}`;
        return api(config);
      } catch {
        console.warn("Token yenileme başarısız; oturum kapatılıyor.");
        clearSessionAndRedirect();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
