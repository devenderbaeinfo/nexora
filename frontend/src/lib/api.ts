import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "https://localhost:5443/api",
});

// Token lives in memory only (a module-level variable), never in localStorage —
// an XSS payload that runs on this page can still read localStorage but has a much
// harder time reading a plain JS closure it doesn't know exists.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setAccessToken(null);
      window.dispatchEvent(new Event("erp:session-expired"));
    }
    return Promise.reject(error);
  }
);
