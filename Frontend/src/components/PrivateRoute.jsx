import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[2]) : null;
}

export default function PrivateRoute({ children }) {
  const { token, initialized, setToken } = useAuth();

  // Safety net: if token missing, try to hydrate from localStorage or cookie
  useEffect(() => {
    if (!initialized) return;
    if (!token) {
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
    }
  }, [initialized, token, setToken]);

  if (!initialized) return null;
  if (!token) return <Navigate to="/login" replace />;

  return children;
}