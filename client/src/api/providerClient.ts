import axios from 'axios';

// A third axios instance, for the provider portal. Its own token key so a
// signed-in clinician/pharmacist never collides with a staff or member session.
export const PROVIDER_TOKEN_KEY = 'mobicova_provider_token';
// The clinic/pharmacy the clinician is currently acting as (org switcher).
export const PROVIDER_ORG_KEY = 'mobicova_provider_active_org';

const providerApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

providerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(PROVIDER_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Scope every request to the org the clinician is acting as (multi-clinic switcher).
  const orgId = localStorage.getItem(PROVIDER_ORG_KEY);
  if (orgId) config.params = { ...(config.params || {}), orgId };
  return config;
});

providerApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(PROVIDER_TOKEN_KEY);
      if (window.location.pathname.startsWith('/provider')) {
        window.location.href = '/provider/login';
      }
    }
    return Promise.reject(error);
  }
);

export default providerApi;
