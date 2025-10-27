// Frontend/src/services/api.js

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

function setTokenCookie(token, maxAgeDays = 7) {
  try {
    const maxAge = maxAgeDays * 24 * 60 * 60;
    document.cookie = `token=${encodeURIComponent(token || '')}; Path=/; Max-Age=${maxAge}; Secure; SameSite=None`;
  } catch {}
}
function eraseTokenCookie() {
  try {
    document.cookie = 'token=; Path=/; Max-Age=0; Secure; SameSite=None';
  } catch {}
}

// Capture token from URL (query or hash) on module load and store it
export function captureTokenFromUrl(cleanUrl = true) {
  try {
    const url = new URL(window.location.href);
    let token = null;

    // Query: ?token=...
    if (url.searchParams.has('token')) {
      token = url.searchParams.get('token');
      if (cleanUrl) {
        url.searchParams.delete('token');
        const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '');
        window.history.replaceState(null, '', clean);
      }
    }

    // Hash: #token=...
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

// Ensure token capture happens ASAP
if (typeof window !== 'undefined') {
  captureTokenFromUrl(true);
}

export function getAuthToken() {
  return localStorage.getItem('token');
}
export function clearAuthToken() {
  localStorage.removeItem('token');
  eraseTokenCookie();
}

async function safeJson(res) {
  const text = await res.text();
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

    // Query params
    if (options.params) {
      const qs = new URLSearchParams(options.params).toString();
      if (qs) url += `?${qs}`;
      delete options.params;
    }

    const token = getAuthToken();

    // Build headers
    const headers = {
      Accept: 'application/json',
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const config = {
      method: options.method || 'GET',
      credentials: 'include', // keep cookies if any
      headers,
      body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body || undefined,
      signal: options.signal
    };

    const res = await fetch(url, config);
    const data = await safeJson(res);

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) clearAuthToken();
      const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return { data };
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