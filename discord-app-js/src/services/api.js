import axios from "axios";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5074/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.error("Unauthorized! Redirecting to login...");
      localStorage.removeItem("token");

      // TODO: Refresh token mekanizması ile yeniden deneme yapılmalı
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
