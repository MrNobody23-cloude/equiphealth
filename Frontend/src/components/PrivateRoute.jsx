import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner-large"></div>
        <p>Verifying authentication...</p>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

export default PrivateRoute;