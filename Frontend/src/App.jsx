import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './components/Dashboard';
import EquipmentMonitor from './components/EquipmentMonitor';
import ServiceLocator from './components/ServiceLocator';
import api from './services/api';
import './App.css';
import VerifyEmail from './pages/VerifyEmail';

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
                  {user.name.charAt(0).toUpperCase()}
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <MainApp />
              </PrivateRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;