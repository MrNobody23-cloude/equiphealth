import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
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

// OAuth Callback Handler Component
function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuth();
  const [status, setStatus] = useState('processing');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const token = searchParams.get('token');
      const error = searchParams.get('error');

      if (error) {
        console.error('❌ OAuth error:', error);
        setStatus('error');
        setTimeout(() => {
          navigate('/login?error=oauth_failed', { replace: true });
        }, 2000);
        return;
      }

      if (token) {
        console.log('✅ OAuth token received');
        
        try {
          // Store token
          localStorage.setItem('token', token);
          
          // Fetch user data
          const response = await api.get('/auth/me');
          
          if (response.data.success) {
            console.log('✅ User authenticated:', response.data.user.email);
            setUser(response.data.user);
            setStatus('success');
            
            // Redirect to dashboard
            setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 1000);
          } else {
            throw new Error('Failed to fetch user data');
          }
        } catch (error) {
          console.error('❌ Error processing OAuth:', error);
          setStatus('error');
          localStorage.removeItem('token');
          
          setTimeout(() => {
            navigate('/login?error=session_failed', { replace: true });
          }, 2000);
        }
      } else {
        // No token, redirect to login
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

// Main App Component (Dashboard/Monitor/Services)
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

// Root App Component with Routing
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          
          {/* OAuth callback route */}
          <Route path="/auth/callback" element={<OAuthCallback />} />
          
          {/* Protected routes */}
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
          
          {/* Catch all - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;