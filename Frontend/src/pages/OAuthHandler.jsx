// Frontend/src/pages/OAuthHandler.jsx
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function OAuthHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    try {
      let token = null;

      // Prefer query ?token=...
      const params = new URLSearchParams(location.search);
      if (params.has('token')) {
        token = params.get('token');

        // Clean query from URL
        const clean = location.pathname;
        window.history.replaceState(null, '', clean);
      }

      // Also support hash #token=...
      if (!token && location.hash && location.hash.startsWith('#')) {
        const hp = new URLSearchParams(location.hash.substring(1));
        token = hp.get('token');

        // Clean hash
        window.history.replaceState(null, '', location.pathname + location.search);
      }

      if (token) {
        localStorage.setItem('token', token);
        // Optional: you can also set a reactive global state or trigger a /me fetch in your AuthContext
        navigate('/dashboard', { replace: true });
      } else {
        // No token found; go to login with error
        navigate('/login?error=oauth_failed', { replace: true });
      }
    } catch (e) {
      console.error('OAuth handler error:', e);
      navigate('/login?error=oauth_failed', { replace: true });
    }
  }, [location, navigate]);

  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <h3>Signing you in...</h3>
    </div>
  );
}

export default OAuthHandler;