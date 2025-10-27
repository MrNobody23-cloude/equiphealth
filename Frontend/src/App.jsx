import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './components/Dashboard';
import EquipmentMonitor from './components/EquipmentMonitor';
import ServiceLocator from './components/ServiceLocator';
import api from './services/api';
import './App.css';

// 1) TokenCapture: runs BEFORE routes render to ensure token exists for PrivateRoute
function TokenCapture({ onReady }) {
  const location = useLocation();

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      let token = null;

      // Prefer query (?token=...)
      const qp = url.searchParams;
      if (qp.has('token')) {
        token = qp.get('token');
        qp.delete('token');
        const clean = url.pathname + (qp.toString() ? `?${qp.toString()}` : '');
        window.history.replaceState(null, '', clean);
      }

      // Fallback: hash (#token=...)
      if (!token && url.hash && url.hash.startsWith('#')) {
        const hp = new URLSearchParams(url.hash.substring(1));
        token = hp.get('token');
        // Clean hash
        window.history.replaceState(null, '', url.pathname + url.search);
      }

      if (token) {
        localStorage.setItem('token', token);
      }
    } catch (e) {
      console.warn('TokenCapture failed:', e);
    } finally {
      // Signal that the token capture step is done (so routes can render)
      onReady(true);
    }
  }, [location, onReady]);

  return null;
}

// 2) OAuth Callback Handler (public route)
function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuth();
  const [status, setStatus] = useState('processing');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Check both query and hash
      let token = searchParams.get('token');
      const error = searchParams.get('error');

      if (!token && window.location.hash && window.location.hash.startsWith('#')) {
        const hp = new URLSearchParams(window.location.hash.substring(1));
        token = hp.get('token');
        // Clean hash
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }

      if (error) {
        console.error('❌ OAuth error:', error);
        setStatus('error');
        setTimeout(() => {
          navigate('/login?error=oauth_failed', { replace: true });
        }, 1200);
        return;
      }

      if (token) {
        try {
          // Store token
          localStorage.setItem('token', token);

          // Try to fetch user (optional, but nice for immediate UI)
          try {
            const response = await api.get('/auth/me');
            if (response.data?.success) {
              setUser(response.data.user);
            }
          } catch (e) {
            // Even if /me fails now, token is saved; AuthContext can hydrate later
          }

          setStatus('success');
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 500);
        } catch (error) {
          console.error('❌ OAuth processing error:', error);
          localStorage.removeItem('token');
          setStatus('error');
          setTimeout(() => {
            navigate('/login?error=session_failed', { replace: true });
          }, 1200);
        }
      } else {
        // No token → go to login
        navigate('/login', { replace: true });
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate, setUser]);

  return (
    <div className="oauth-callback-container">
      <div className="oauth-callback-card">
        {status === 'processing' && (
          <>
            <div className="loading-spinner-large"></div>
            <h2>Processing Authentication...</h2>
            <p>Please wait while we sign you in</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="success-icon-large">✅</div>
            <h2>Authentication Successful!</h2>
            <p>Redirecting to dashboard...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="error-icon-large">❌</div>
            <h2>Authentication Failed</h2>
            <p>Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  );
}

// 3) Main App (Dashboard/Monitor/Services)
function MainApp() {
  const [activeTab, setActiveTab] = useState('monitor');
  const [equipmentList, setEquipmentList] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [prefillData, setPrefillData] = useState(null);
  const [loading, setLoading] = useState(true);

  const { user, logout } = useAuth();

  useEffect(() => {
    if (user) {
      fetchEquipmentList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchEquipmentList = async () => {
    setLoading(true);
    try {
      const response = await api.get('/history');
      if (response.data.success) {
        setEquipmentList(response.data.history || []);
        console.log(`✅ Loaded ${response.data.history?.length || 0} equipment records`);
      } else {
        setEquipmentList([]);
      }
    } catch (error) {
      console.error('Error fetching equipment list:', error);
      setEquipmentList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReadings = (equipment) => {
    setPrefillData({
      equipmentName: equipment.equipmentName,
      equipmentType: equipment.equipmentType
    });
    setActiveTab('monitor');
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">🤖 AI Equipment Health Monitor</h1>
          <p className="app-subtitle">Intelligent Diagnostics & Predictive Maintenance</p>
        </div>
        {user && (
          <div className="user-menu">
            <div className="user-info">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="user-avatar" />
              ) : (
                <div className="user-avatar-placeholder">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="user-details">
                <div className="user-name">{user.name}</div>
                <div className="user-email">{user.email}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="logout-btn">
              🚪 Logout
            </button>
          </div>
        )}
      </header>

      <nav className="app-nav">
        <button
          className={`nav-btn ${activeTab === 'monitor' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitor')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-text">Monitor Equipment</span>
        </button>
        <button
          className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <span className="nav-icon">📈</span>
          <span className="nav-text">Dashboard</span>
        </button>
        <button
          className={`nav-btn ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          <span className="nav-icon">🔧</span>
          <span className="nav-text">Service Locator</span>
        </button>
      </nav>

      <main className="app-main">
        {loading && activeTab === 'dashboard' ? (
          <div className="loading-container">
            <div className="loading-spinner-large"></div>
            <p>Loading equipment data...</p>
          </div>
        ) : (
          <>
            {activeTab === 'monitor' && (
              <EquipmentMonitor
                equipmentList={equipmentList}
                refreshEquipmentList={fetchEquipmentList}
                selectedEquipment={selectedEquipment}
                setSelectedEquipment={setSelectedEquipment}
                prefillData={prefillData}
                setPrefillData={setPrefillData}
              />
            )}
            {activeTab === 'dashboard' && (
              <Dashboard
                equipmentList={equipmentList}
                refreshEquipmentList={fetchEquipmentList}
                setSelectedEquipment={setSelectedEquipment}
                onAddReadings={handleAddReadings}
              />
            )}
            {activeTab === 'services' && (
              <ServiceLocator equipmentList={equipmentList} />
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Powered by AI-Driven Predictive Analytics |
          <span className="footer-stats">
            {equipmentList.length > 0 && ` ${equipmentList.length} Total Records`}
          </span>
        </p>
      </footer>
    </div>
  );
}

// 4) Root App with Routing
function App() {
  const [bootReady, setBootReady] = useState(false);

  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Capture token before rendering routes to avoid race with PrivateRoute */}
        {!bootReady ? (
          <>
            <TokenCapture onReady={setBootReady} />
            <div className="oauth-callback-container">
              <div className="oauth-callback-card">
                <div className="loading-spinner-large"></div>
                <h2>Loading...</h2>
              </div>
            </div>
          </>
        ) : (
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-email/:token" element={<VerifyEmail />} />

            {/* OAuth callback (public) */}
            <Route path="/auth/callback" element={<OAuthCallback />} />

            {/* Protected */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <MainApp />
                </PrivateRoute>
              }
            />
            <Route
              path="/monitor"
              element={
                <PrivateRoute>
                  <MainApp />
                </PrivateRoute>
              }
            />
            <Route
              path="/services"
              element={
                <PrivateRoute>
                  <MainApp />
                </PrivateRoute>
              }
            />

            {/* Root redirect */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Navigate to="/dashboard" replace />
                </PrivateRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        )}
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;