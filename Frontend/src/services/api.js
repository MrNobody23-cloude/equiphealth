// Frontend/src/services/api.js

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Write token to cookie as a fallback (readable by SPA)
function setTokenCookie(token, maxAgeDays = 7) {
  try {
    const maxAge = maxAgeDays * 24 * 60 * 60;
    // Secure cookie requires HTTPS (Render/Prod). SameSite=None for cross-site redirects.
    document.cookie = `token=${encodeURIComponent(token || '')}; Path=/; Max-Age=${maxAge}; Secure; SameSite=None`;
  } catch {}
}

function eraseTokenCookie() {
  try {
    document.cookie = 'token=; Path=/; Max-Age=0; Secure; SameSite=None';
  } catch {}
}

// Capture token from URL (query or hash) and store it
export function captureTokenFromUrl(cleanUrl = true) {
  try {
    const url = new URL(window.location.href);
    let token = null;

    // 1) Query: ?token=...
    if (url.searchParams.has('token')) {
      token = url.searchParams.get('token');
      if (cleanUrl) {
        url.searchParams.delete('token');
        const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '');
        window.history.replaceState(null, '', clean);
      }
    }

    // 2) Hash: #token=...
    if (!token && url.hash && url.hash.startsWith('#')) {
      const hp = new URLSearchParams(url.hash.substring(1));
      token = hp.get('token');
      if (cleanUrl) {
        window.history.replaceState(null, '', url.pathname + url.search);
      }
    }

    if (token) {
      localStorage.setItem('token', token);
      setTokenCookie(token);
    }

    return token;
  } catch {
    return null;
  }
}

// Ensure we capture token ASAP when the module loads
if (typeof window !== 'undefined') {
  captureTokenFromUrl(true);
}

// Helpers to manage token centrally
export function setAuthToken(token) {
  if (!token) {
    localStorage.removeItem('token');
    eraseTokenCookie();
    return;
  }
  localStorage.setItem('token', token);
  setTokenCookie(token);
}
export function getAuthToken() {
  return localStorage.getItem('token');
}
export function clearAuthToken() {
  localStorage.removeItem('token');
  eraseTokenCookie();
}

// Safe JSON parse (handles empty body)
async function safeJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    let url = `${this.baseURL}${endpoint}`;

    // Handle query params
    if (options.params) {
      const queryString = new URLSearchParams(options.params).toString();
      if (queryString) url += `?${queryString}`;
      delete options.params;
    }

    const token = getAuthToken();

    // Build headers
    const baseHeaders = {
      Accept: 'application/json',
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const config = {
      method: options.method || 'GET',
      credentials: 'include', // keep cookies (if backend uses them)
      headers: baseHeaders,
      body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body || undefined,
      signal: options.signal
    };

    try {
      const response = await fetch(url, config);
      const data = await safeJson(response);

      if (!response.ok) {
        // If unauthorized, clear token (so guards reroute cleanly)
        if (response.status === 401 || response.status === 403) {
          clearAuthToken();
        }
        const errMsg = data?.error || data?.message || `HTTP ${response.status}`;
        const error = new Error(errMsg);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return { data };
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  get(endpoint, params = null) {
    const options = { method: 'GET' };
    if (params) options.params = params;
    return this.request(endpoint, options);
  }

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  }

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

const api = new ApiService();
export default api;