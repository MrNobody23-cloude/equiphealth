import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children }) {
  const { token, initialized, setToken } = useAuth();

  // Safety net: if context doesn't have token but localStorage does, hydrate it
  useEffect(() => {
    if (initialized && !token) {
      const stored = localStorage.getItem('token');
      if (stored) {
        setToken(stored);
      }
    }
  }, [initialized, token, setToken]);

  if (!initialized) return null; // or a loader
  if (!token) return <Navigate to="/login" replace />;

  return children;
}