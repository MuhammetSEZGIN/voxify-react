import axios from "axios";

const API_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);

    const token = localStorage.getItem("token");
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
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

// Eşzamanlı 401'lerde tek bir refresh isteği paylaşılır.
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) {
    throw new Error("Refresh token yok");
  }

  const rawUser = localStorage.getItem("user");
  let userId = "";
  try {
    userId = rawUser ? JSON.parse(rawUser)?.id ?? "" : "";
  } catch {
    userId = "";
  }

  // Interceptor döngüsüne girmemek için ayrı, temiz bir axios örneği kullanılır.
  const response = await axios.post(`${API_URL}/identity/refresh-token`, {
    userId,
    refreshToken,
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

  localStorage.setItem("token", newToken);
  if (newRefreshToken) localStorage.setItem("refreshToken", newRefreshToken);

  return newToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (response?.status === 401 && config && !config._retry && !config.skipAuthRefresh) {
      // Refresh isteğinin kendisi 401 döndüyse tekrar denemeye çalışma.
      if (config.url?.includes("/identity/refresh-token")) {
        console.error("Refresh token da geçersiz. Oturum kapatılıyor...");
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
      } catch (refreshError) {
        console.error("Token yenileme başarısız. Oturum kapatılıyor...", refreshError);
        clearSessionAndRedirect();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
