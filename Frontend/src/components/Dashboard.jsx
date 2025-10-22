import { useState, useEffect } from 'react';
import './Dashboard.css';
import api from '../services/api';

function Dashboard({ equipmentList, refreshEquipmentList, setSelectedEquipment, onAddReadings }) {
  const [timeRange, setTimeRange] = useState('7days');
  const [sortBy, setSortBy] = useState('health');
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonDevice, setComparisonDevice] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const getGroupedDevices = () => {
    const grouped = {};
    
    equipmentList.forEach(equipment => {
      const key = `${equipment.equipmentName}_${equipment.equipmentType}`.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = {
          name: equipment.equipmentName,
          type: equipment.equipmentType,
          records: []
        };
      }
      grouped[key].records.push(equipment);
    });

    Object.values(grouped).forEach(group => {
      group.records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    });

    return grouped;
  };

  const groupedDevices = getGroupedDevices();

  const getSummaryStats = () => {
    if (equipmentList.length === 0) {
      return {
        total: 0,
        healthy: 0,
        needsAttention: 0,
        critical: 0,
        avgHealth: 0,
        uniqueDevices: 0
      };
    }

    const total = equipmentList.length;
    const uniqueDevices = Object.keys(groupedDevices).length;
    const healthy = equipmentList.filter(eq => eq.prediction?.health_score >= 85).length;
    const needsAttention = equipmentList.filter(eq =>
      eq.prediction?.health_score >= 50 && eq.prediction?.health_score < 85
    ).length;
    const critical = equipmentList.filter(eq => eq.prediction?.health_score < 50).length;
    const avgHealth = equipmentList.reduce((sum, eq) => sum + (eq.prediction?.health_score || 0), 0) / total;

    return { total, healthy, needsAttention, critical, avgHealth, uniqueDevices };
  };

  const stats = getSummaryStats();

  const filterByTimeRange = (equipment) => {
    const timestamp = new Date(equipment.timestamp);
    const now = new Date();
    const hoursDiff = (now - timestamp) / (1000 * 60 * 60);

    switch (timeRange) {
      case '24hours':
        return hoursDiff <= 24;
      case '7days':
        return hoursDiff <= 24 * 7;
      case '30days':
        return hoursDiff <= 24 * 30;
      case 'all':
      default:
        return true;
    }
  };

  const filteredEquipment = equipmentList.filter(filterByTimeRange);

  const getLatestRecords = () => {
    return Object.values(groupedDevices).map(group => ({
      ...group.records[0],
      totalRecords: group.records.length
    }));
  };

  const latestRecords = getLatestRecords().filter(filterByTimeRange);

  const handleDeleteEquipment = (id) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async (id) => {
    setDeleting(true);
    try {
      const response = await api.delete(`/history/${id}`);
      const data = response.data;

      if (data.success) {
        await refreshEquipmentList();
        setDeleteConfirm(null);
        setSelectedEquipment(prev => prev?._id === id ? null : prev);
      } else {
        alert('Failed to delete: ' + data.error);
      }
    } catch (error) {
      alert('Failed to delete equipment.');
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  const handleViewComparison = (equipment) => {
    const key = `${equipment.equipmentName}_${equipment.equipmentType}`.toLowerCase();
    const deviceHistory = groupedDevices[key];
    
    if (deviceHistory && deviceHistory.records.length > 1) {
      setComparisonDevice(deviceHistory);
      setShowComparison(true);
    }
  };

  const handleDeleteAllRecords = async (deviceKey) => {
    const device = groupedDevices[deviceKey];
    const idsToDelete = device.records.map(r => r._id);
    
    if (!window.confirm(`Delete all ${device.records.length} records for "${device.name}"?`)) {
      return;
    }

    setDeleting(true);
    try {
      const deletePromises = idsToDelete.map(id => api.delete(`/history/${id}`));
      await Promise.all(deletePromises);
      
      console.log(`✅ Deleted ${idsToDelete.length} records for ${device.name}`);
      
      await refreshEquipmentList();
      setShowComparison(false);
    } catch (error) {
      console.error('Delete all error:', error);
      alert('Failed to delete all records. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const getHealthColor = (score) => {
    if (score >= 85) return '#10b981';
    if (score >= 70) return '#3b82f6';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'low': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'high': return '#ef4444';
      case 'critical': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getHealthTrend = (records) => {
    if (records.length < 2) return null;
    
    const latest = records[0].prediction?.health_score || 0;
    const previous = records[1].prediction?.health_score || 0;
    const diff = latest - previous;

    if (Math.abs(diff) < 2) return { icon: '➡️', text: 'Stable', color: '#3b82f6' };
    if (diff > 0) return { icon: '📈', text: `+${diff.toFixed(1)}`, color: '#10b981' };
    return { icon: '📉', text: `${diff.toFixed(1)}`, color: '#ef4444' };
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Equipment Dashboard</h2>
        <div className="dashboard-controls">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="control-select"
          >
            <option value="24hours">Last 24 Hours</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <button 
            onClick={refreshEquipmentList} 
            className="refresh-btn"
            title="Refresh from database"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-value">{stats.uniqueDevices}</div>
            <div className="stat-label">Unique Devices</div>
            <div className="stat-sublabel">{stats.total} total records</div>
          </div>
        </div>

        <div className="stat-card healthy">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.healthy}</div>
            <div className="stat-label">Healthy</div>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.needsAttention}</div>
            <div className="stat-label">Needs Attention</div>
          </div>
        </div>

        <div className="stat-card critical">
          <div className="stat-icon">🚨</div>
          <div className="stat-content">
            <div className="stat-value">{stats.critical}</div>
            <div className="stat-label">Critical</div>
          </div>
        </div>
      </div>

      {stats.total > 0 && (
        <div className="avg-health-section">
          <h3>Average Fleet Health</h3>
          <div className="health-bar-container">
            <div
              className="health-bar-fill"
              style={{
                width: `${stats.avgHealth}%`,
                background: getHealthColor(stats.avgHealth)
              }}
            >
              <span className="health-bar-text">{Math.round(stats.avgHealth)}%</span>
            </div>
          </div>
        </div>
      )}

      <div className="equipment-list-section">
        <div className="list-header">
          <h3>Equipment Inventory</h3>
          <div className="sort-controls">
            <label>Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="health">Health Score</option>
              <option value="maintenance">Maintenance Due</option>
              <option value="risk">Risk Level</option>
            </select>
          </div>
        </div>

        {latestRecords.length === 0 ? (
          <div className="empty-dashboard">
            <div className="empty-icon">📊</div>
            <h3>No Equipment Monitored Yet</h3>
            <p>Start monitoring equipment to see analytics and insights here.</p>
          </div>
        ) : (
          <div className="equipment-cards">
            {latestRecords
              .sort((a, b) => {
                if (sortBy === 'health') {
                  return (b.prediction?.health_score || 0) - (a.prediction?.health_score || 0);
                } else if (sortBy === 'maintenance') {
                  return (a.prediction?.maintenance_needed_days || 999) - (b.prediction?.maintenance_needed_days || 999);
                } else if (sortBy === 'risk') {
                  const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                  return (riskOrder[a.prediction?.risk_level] || 4) - (riskOrder[b.prediction?.risk_level] || 4);
                }
                return 0;
              })
              .map((equipment) => {
                const key = `${equipment.equipmentName}_${equipment.equipmentType}`.toLowerCase();
                const deviceHistory = groupedDevices[key];
                const trend = getHealthTrend(deviceHistory.records);

                return (
                  <div key={equipment._id} className="equipment-card">
                    <div className="equipment-card-header">
                      <div className="equipment-info">
                        <h4 className="equipment-name">
                          {equipment.equipmentName}
                          {equipment.totalRecords > 1 && (
                            <span className="record-count-badge">
                              {equipment.totalRecords} records
                            </span>
                          )}
                        </h4>
                        <span className="equipment-type">{equipment.equipmentType}</span>
                      </div>
                      <div className="equipment-header-right">
                        <div
                          className="health-badge"
                          style={{ backgroundColor: getHealthColor(equipment.prediction?.health_score || 0) }}
                        >
                          {Math.round(equipment.prediction?.health_score || 0)}
                        </div>
                        {trend && (
                          <div className="trend-badge" style={{ color: trend.color }}>
                            {trend.icon} {trend.text}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="equipment-card-body">
                      <div className="equipment-metric">
                        <span className="metric-icon">🔧</span>
                        <div className="metric-info">
                          <div className="metric-value-small">
                            {equipment.prediction?.maintenance_needed_days || 'N/A'} days
                          </div>
                          <div className="metric-label-small">Until Maintenance</div>
                        </div>
                      </div>

                      <div className="equipment-metric">
                        <span className="metric-icon">📅</span>
                        <div className="metric-info">
                          <div className="metric-value-small">
                            {equipment.prediction?.remaining_life_days || 'N/A'} days
                          </div>
                          <div className="metric-label-small">Remaining Life</div>
                        </div>
                      </div>

                      <div className="equipment-metric">
                        <span className="metric-icon">⚡</span>
                        <div className="metric-info">
                          <div
                            className="risk-indicator"
                            style={{ backgroundColor: getRiskColor(equipment.prediction?.risk_level) }}
                          >
                            {equipment.prediction?.risk_level?.toUpperCase() || 'UNKNOWN'}
                          </div>
                          <div className="metric-label-small">Risk Level</div>
                        </div>
                      </div>
                    </div>

                    <div className="equipment-card-footer">
                      <span className="timestamp">
                        Last checked: {new Date(equipment.timestamp).toLocaleString()}
                      </span>
                      <div className="equipment-actions">
                        {equipment.totalRecords > 1 && (
                          <button
                            className="btn-comparison"
                            onClick={() => handleViewComparison(equipment)}
                            title="View history & comparison"
                          >
                            📊 History
                          </button>
                        )}
                        <button
                          className="btn-add-readings"
                          onClick={() => onAddReadings(equipment)}
                          title="Add new sensor readings for this equipment"
                        >
                          ➕ Add Readings
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDeleteEquipment(equipment._id)}
                          disabled={deleting}
                          title="Delete this record"
                        >
                          {deleting && deleteConfirm === equipment._id ? '⏳' : '🗑️'}
                        </button>
                      </div>
                    </div>

                    {deleteConfirm === equipment._id && (
                      <div className="delete-confirmation">
                        <p>Delete this record from MongoDB?</p>
                        <div className="delete-actions">
                          <button 
                            className="btn-confirm-delete" 
                            onClick={() => confirmDelete(equipment._id)}
                            disabled={deleting}
                          >
                            {deleting ? '⏳ Deleting...' : '✓ Yes, Delete'}
                          </button>
                          <button 
                            className="btn-cancel-delete" 
                            onClick={cancelDelete}
                            disabled={deleting}
                          >
                            ✗ Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {showComparison && comparisonDevice && (
        <div className="comparison-modal-overlay" onClick={() => setShowComparison(false)}>
          <div className="comparison-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comparison-header">
              <div>
                <h2>📊 {comparisonDevice.name} - History & Comparison</h2>
                <p className="comparison-subtitle">
                  {comparisonDevice.type} • {comparisonDevice.records.length} diagnostic records from MongoDB
                </p>
              </div>
              <button className="btn-close-modal" onClick={() => setShowComparison(false)}>
                ✕
              </button>
            </div>

            <div className="comparison-stats">
              <div className="comparison-stat">
                <div className="stat-label">Current Health</div>
                <div className="stat-value" style={{ color: getHealthColor(comparisonDevice.records[0].prediction?.health_score) }}>
                  {Math.round(comparisonDevice.records[0].prediction?.health_score || 0)}%
                </div>
              </div>
              <div className="comparison-stat">
                <div className="stat-label">First Recorded</div>
                <div className="stat-value">
                  {Math.round(comparisonDevice.records[comparisonDevice.records.length - 1].prediction?.health_score || 0)}%
                </div>
              </div>
              <div className="comparison-stat">
                <div className="stat-label">Average Health</div>
                <div className="stat-value">
                  {Math.round(
                    comparisonDevice.records.reduce((sum, r) => sum + (r.prediction?.health_score || 0), 0) / 
                    comparisonDevice.records.length
                  )}%
                </div>
              </div>
              <div className="comparison-stat">
                <div className="stat-label">Total Records</div>
                <div className="stat-value">{comparisonDevice.records.length}</div>
              </div>
            </div>

            <div className="comparison-timeline">
              <h3>Health Timeline</h3>
              <div className="timeline">
                {comparisonDevice.records.map((record, index) => (
                  <div key={record._id} className="timeline-item">
                    <div className="timeline-marker">
                      <div 
                        className="timeline-dot" 
                        style={{ backgroundColor: getHealthColor(record.prediction?.health_score || 0) }}
                      />
                      {index < comparisonDevice.records.length - 1 && <div className="timeline-line" />}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-content-header">
                        <div className="timeline-date">
                          {new Date(record.timestamp).toLocaleDateString()} • {new Date(record.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="timeline-actions">
                          <button
                            className="btn-view-small"
                            onClick={() => {
                              setSelectedEquipment(record);
                              setShowComparison(false);
                            }}
                          >
                            👁️ View
                          </button>
                          <button
                            className="btn-delete-small"
                            onClick={async () => {
                              if (window.confirm('Delete this record from MongoDB?')) {
                                await confirmDelete(record._id);
                                if (comparisonDevice.records.length === 1) {
                                  setShowComparison(false);
                                }
                              }
                            }}
                            disabled={deleting}
                          >
                            {deleting ? '⏳' : '🗑️'}
                          </button>
                        </div>
                      </div>
                      <div className="timeline-details">
                        <div className="timeline-metric">
                          <span className="timeline-label">Health Score:</span>
                          <span className="timeline-value" style={{ color: getHealthColor(record.prediction?.health_score) }}>
                            {Math.round(record.prediction?.health_score || 0)}%
                          </span>
                        </div>
                        <div className="timeline-metric">
                          <span className="timeline-label">Risk Level:</span>
                          <span 
                            className="timeline-risk-badge"
                            style={{ backgroundColor: getRiskColor(record.prediction?.risk_level) }}
                          >
                            {record.prediction?.risk_level?.toUpperCase()}
                          </span>
                        </div>
                        <div className="timeline-metric">
                          <span className="timeline-label">Maintenance:</span>
                          <span className="timeline-value">{record.prediction?.maintenance_needed_days} days</span>
                        </div>
                        <div className="timeline-metric">
                          <span className="timeline-label">Remaining Life:</span>
                          <span className="timeline-value">{record.prediction?.remaining_life_days} days</span>
                        </div>
                      </div>
                      {record.prediction?.critical_issues && record.prediction.critical_issues.length > 0 && (
                        <div className="timeline-issues">
                          <strong>Critical Issues:</strong>
                          <ul>
                            {record.prediction.critical_issues.map((issue, i) => (
                              <li key={i}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="comparison-footer">
              <button 
                className="btn-delete-all"
                onClick={() => handleDeleteAllRecords(`${comparisonDevice.name}_${comparisonDevice.type}`.toLowerCase())}
                disabled={deleting}
              >
                {deleting ? '⏳ Deleting...' : '🗑️ Delete All Records from MongoDB'}
              </button>
              <button className="btn-close" onClick={() => setShowComparison(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;