import axios from 'axios';

// A second axios instance for the member portal. It is deliberately separate
// from the partner `api` client: it carries the member token (a different
// localStorage key) and bounces 401s to the member login, so the two sessions
// never interfere.
export const MEMBER_TOKEN_KEY = 'mobicova_member_token';

const memberApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

memberApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(MEMBER_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

memberApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(MEMBER_TOKEN_KEY);
      // Only redirect if we're inside the member area, so a partner-side 401
      // (handled by the other client) never yanks us here.
      if (window.location.pathname.startsWith('/member')) {
        window.location.href = '/member/login';
      }
    }
    return Promise.reject(error);
  }
);

export default memberApi;
