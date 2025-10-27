import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// Attach/remove token on axios
function setAxiosAuthHeader(token) {
  try {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  } catch {}
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Keep axios header in sync with token
  useEffect(() => {
    setAxiosAuthHeader(token);
  }, [token]);

  // Hydrate on first load
  useEffect(() => {
    const boot = async () => {
      const stored = localStorage.getItem('token');
      if (!stored) {
        setInitialized(true);
        return;
      }

      setToken(stored);
      try {
        const res = await api.get('/auth/me');
        if (res.data?.success) {
          setUser(res.data.user);
        } else {
          localStorage.removeItem('token');
          setToken(null);
        }
      } catch {
        localStorage.removeItem('token');
        setToken(null);
      } finally {
        setInitialized(true);
      }
    };
    boot();
  }, []);

  const checkAuth = async () => {
    const stored = localStorage.getItem('token');
    if (!stored) {
      setToken(null);
      setUser(null);
      return { authenticated: false };
    }
    try {
      setToken(stored);
      const res = await api.get('/auth/me');
      if (res.data?.success) {
        setUser(res.data.user);
        return { authenticated: true, user: res.data.user };
      }
    } catch {}
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    return { authenticated: false };
  };

  const register = async (name, email, password) => {
    try {
      const res = await api.post('/auth/register', { name, email, password });
      if (res.data.success) {
        return {
          success: true,
          message: res.data.message || 'Registration successful! Please check your email.',
        };
      }
      return { success: false, error: res.data.error || 'Registration failed' };
    } catch (error) {
      return { success: false, error: error?.response?.data?.error || error.message || 'Registration failed' };
    }
  };

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data?.success && res.data.token) {
        localStorage.setItem('token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user || null);
        return { success: true };
      }
      return {
        success: false,
        error: res.data?.error || 'Invalid credentials',
        emailNotVerified: res.data?.emailNotVerified || false,
      };
    } catch (error) {
      const msg = error?.response?.data?.error || error.message || 'Login failed. Please try again.';
      const isUnverified = msg.toLowerCase().includes('verify your email');
      return { success: false, error: msg, emailNotVerified: isUnverified };
    }
  };

  const logout = async () => {
    try {
      await api.post?.('/auth/logout').catch(() => {});
    } catch {}
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  // Let OAuth callback push a token into context
  const applyToken = async (newToken) => {
    if (!newToken) return;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success) setUser(res.data.user);
    } catch {}
  };

  const value = {
    token,
    user,
    setUser,
    initialized,
    register,
    login,
    logout,
    checkAuth,
    applyToken,
    setToken,
  };

  if (!initialized) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner-large"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};