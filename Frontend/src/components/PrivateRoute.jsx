import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[2]) : null;
}

export default function PrivateRoute({ children }) {
  const { token, initialized, setToken } = useAuth();

  useEffect(() => {
    if (!initialized || token) return;

    const justLoggedOut = sessionStorage.getItem('justLoggedOut') === '1';
    if (justLoggedOut) {
      // Do not rehydrate from cookie right after logout
      return;
    }

    const stored = localStorage.getItem('token');
    if (stored) {
      setToken(stored);
      return;
    }

    const cookieToken = getCookie('token');
    if (cookieToken) {
      localStorage.setItem('token', cookieToken);
      setToken(cookieToken);
    }
  }, [initialized, token, setToken]);

  if (!initialized) return null;
  if (!token) return <Navigate to="/login" replace />;

  return children;
}