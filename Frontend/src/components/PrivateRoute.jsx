import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children }) {
  const { token, initialized } = useAuth();
  if (!initialized) return null; // or a loader
  if (!token) return <Navigate to="/login" replace />;
  return children;
}