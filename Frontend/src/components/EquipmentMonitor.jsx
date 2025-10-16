import { useState, useEffect, useRef } from 'react';
import './EquipmentMonitor.css';

import api from '../services/api';

function EquipmentMonitor({ equipmentList, refreshEquipmentList, selectedEquipment, setSelectedEquipment, prefillData, setPrefillData }) {
  const [equipmentType, setEquipmentType] = useState('laptop');
  const [equipmentName, setEquipmentName] = useState('');
  const [sensorData, setSensorData] = useState({
    operating_hours: '',
    power_consumption: '',
    fan_speed: '',
    thermal_throttling: '',
    gpu_usage: '',
    screen_brightness: '',
    network_activity: '',
    battery_health: '',
    cpu_usage: '',
    ram_usage: '',
    load_percentage: '',
    noise_level: '',
    rotation_speed: '',
    current_draw: '',
    oil_quality: '',
    efficiency_rating: ''
  });
  const [systemInfo, setSystemInfo] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [autoDetect, setAutoDetect] = useState(false);
  const [detectedValues, setDetectedValues] = useState(null);
  
  const batteryHistoryRef = useRef([]);
  const batteryIntervalRef = useRef(null);
  const ambientLightSensorRef = useRef(null);

  // Handle prefill data when adding readings for existing equipment
  useEffect(() => {
    if (prefillData) {
      setEquipmentName(prefillData.equipmentName);
      setEquipmentType(prefillData.equipmentType);
      
      // Reset sensor data for new readings
      setSensorData({
        operating_hours: '',
        power_consumption: '',
        fan_speed: '',
        thermal_throttling: '',
        gpu_usage: '',
        screen_brightness: '',
        network_activity: '',
        battery_health: '',
        cpu_usage: '',
        ram_usage: '',
        load_percentage: '',
        noise_level: '',
        rotation_speed: '',
        current_draw: '',
        oil_quality: '',
        efficiency_rating: ''
      });

      // Clear prediction
      setPrediction(null);
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Clear prefill data after using it
      if (setPrefillData) {
        setPrefillData(null);
      }

      alert(`📝 Adding new readings for: ${prefillData.equipmentName}`);
    }
  }, [prefillData, setPrefillData]);

  useEffect(() => {
    if (autoDetect && (equipmentType === 'laptop' || equipmentType === 'phone' || equipmentType === 'tablet')) {
      detectSystemInfo();
    } else {
      cleanup();
    }

    return () => cleanup();
  }, [autoDetect, equipmentType]);

  const cleanup = () => {
    if (batteryIntervalRef.current) clearInterval(batteryIntervalRef.current);
    if (ambientLightSensorRef.current) {
      try { ambientLightSensorRef.current.stop(); } catch (e) {}
    }
  };

  const detectSystemInfo = async () => {
    // Basic system information
    const info = {
      cpuCores: navigator.hardwareConcurrency || 'N/A',
      memory: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'N/A',
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      connection: navigator.connection ? navigator.connection.effectiveType : 'N/A',
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine
    };

    setSystemInfo(info);

    const detected = {
      battery: null,
      brightness: null,
      ram: null,
      network: null,
      cpu: null,
      thermal: null
    };

    // ==================== BATTERY (Real Data - Level Only) ====================
    if ('getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery();
        
        detected.battery = {
          level: Math.round(battery.level * 100),
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
          isReal: true,
          canDetectHealth: false
        };

        batteryHistoryRef.current = [{
          level: battery.level,
          timestamp: Date.now(),
          charging: battery.charging
        }];

        batteryIntervalRef.current = setInterval(async () => {
          const currentBattery = await navigator.getBattery();
          trackBatteryChange(currentBattery, detected);
        }, 10000);

        battery.addEventListener('chargingchange', async () => {
          const updated = await navigator.getBattery();
          batteryHistoryRef.current = [];
          updateBatteryData(updated, detected);
        });

        battery.addEventListener('levelchange', async () => {
          const updated = await navigator.getBattery();
          trackBatteryChange(updated, detected);
        });

        updateBatteryData(battery, detected);
      } catch (e) {
        console.log('Battery API Error:', e);
      }
    }

    // ==================== SCREEN BRIGHTNESS (Estimate) ====================
    if ('AmbientLightSensor' in window) {
      try {
        const sensor = new AmbientLightSensor({ frequency: 2 });
        
        sensor.addEventListener('reading', () => {
          const lux = sensor.illuminance;
          
          let estimate;
          if (lux < 1) estimate = 5;
          else if (lux < 10) estimate = 15;
          else if (lux < 50) estimate = 30;
          else if (lux < 100) estimate = 50;
          else if (lux < 200) estimate = 65;
          else if (lux < 500) estimate = 80;
          else if (lux < 1000) estimate = 90;
          else estimate = 100;

          detected.brightness = {
            value: estimate,
            lux: Math.round(lux),
            method: 'Ambient Light Sensor',
            confidence: 'Medium',
            isReal: false,
            note: 'Estimated from ambient light - not actual system brightness'
          };

          setDetectedValues({ ...detected });
        });

        sensor.start();
        ambientLightSensorRef.current = sensor;
      } catch (e) {
        console.log('Ambient Light Sensor Error:', e);
      }
    }

    if (!detected.brightness) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const hour = new Date().getHours();
      
      let estimate = 50;
      if (hour >= 0 && hour < 6) estimate = 20;
      else if (hour >= 6 && hour < 9) estimate = 50;
      else if (hour >= 9 && hour < 17) estimate = 70;
      else if (hour >= 17 && hour < 20) estimate = 60;
      else if (hour >= 20 && hour < 24) estimate = 30;
      
      if (isDark) estimate = Math.max(15, estimate - 15);

      detected.brightness = {
        value: estimate,
        method: 'Time & Preferences Based',
        confidence: 'Low',
        isReal: false,
        colorScheme: isDark ? 'Dark' : 'Light',
        note: 'Browser cannot access actual brightness - this is an estimate'
      };
    }

    // ==================== RAM (Limited Browser Data) ====================
    const totalRAM = navigator.deviceMemory || null;
    let heapUsed = 0;
    let heapLimit = 0;

    if (performance.memory) {
      heapUsed = (performance.memory.usedJSHeapSize / (1024 ** 3)).toFixed(2);
      heapLimit = (performance.memory.jsHeapSizeLimit / (1024 ** 3)).toFixed(2);
    }

    if (totalRAM) {
      detected.ram = {
        totalRAM: totalRAM,
        usableRAM: (totalRAM * 0.90).toFixed(1),
        heapUsed: parseFloat(heapUsed),
        heapLimit: parseFloat(heapLimit),
        estimatedUsage: (totalRAM * 0.40).toFixed(2),
        isReal: false,
        note: 'Browser cannot access actual RAM usage - showing JS heap only'
      };
    }

    // ==================== NETWORK (Real Data) ====================
    if ('connection' in navigator) {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection) {
        detected.network = {
          downlink: connection.downlink ? connection.downlink.toFixed(1) : null,
          effectiveType: connection.effectiveType,
          rtt: connection.rtt,
          saveData: connection.saveData,
          isReal: true
        };

        if (connection.downlink) {
          setSensorData(prev => ({ ...prev, network_activity: connection.downlink.toFixed(1) }));
        }
      }
    }

    // ==================== CPU (Benchmark Estimate) ====================
    try {
      const iterations = 500000;
      const benchmarks = [];
      
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        let result = 0;
        for (let j = 0; j < iterations; j++) {
          result += Math.sqrt(j) * Math.sin(j);
        }
        const end = performance.now();
        benchmarks.push(end - start);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const avgTime = benchmarks.reduce((a, b) => a + b) / benchmarks.length;
      const baselineTime = 10;
      const cpuEstimate = Math.min(100, Math.max(0, (avgTime / baselineTime) * 30)).toFixed(1);
      
      detected.cpu = {
        estimatedUsage: parseFloat(cpuEstimate),
        benchmarkTime: avgTime.toFixed(2),
        isReal: false,
        note: 'Estimated from performance benchmark - not actual CPU usage'
      };

      const performanceDrop = ((benchmarks[4] - benchmarks[0]) / benchmarks[0]) * 100;
      const throttling = performanceDrop > 0 ? Math.min(100, Math.max(0, performanceDrop)).toFixed(1) : '0';
      
      detected.thermal = {
        throttlingPercent: parseFloat(throttling),
        performanceDrop: performanceDrop.toFixed(2),
        isReal: false
      };
    } catch (e) {
      console.log('CPU Benchmark Error:', e);
    }

    setDetectedValues(detected);
  };

  const trackBatteryChange = (battery, detected) => {
    batteryHistoryRef.current.push({
      level: battery.level,
      timestamp: Date.now(),
      charging: battery.charging
    });

    if (batteryHistoryRef.current.length > 10) {
      batteryHistoryRef.current.shift();
    }

    updateBatteryData(battery, detected);
  };

  const updateBatteryData = (battery, detected) => {
    const batteryLevel = Math.round(battery.level * 100);
    const history = batteryHistoryRef.current;
    
    let chargingTime = 'Calculating...';
    let dischargingTime = 'Calculating...';

    if (history.length >= 2) {
      const oldest = history[0];
      const newest = history[history.length - 1];
      const timeDiff = (newest.timestamp - oldest.timestamp) / 1000;
      const levelDiff = newest.level - oldest.level;
      
      if (timeDiff > 0 && Math.abs(levelDiff) > 0.001) {
        const ratePerSecond = levelDiff / timeDiff;
        
        if (battery.charging) {
          const remaining = 1.0 - battery.level;
          if (ratePerSecond > 0) {
            const seconds = remaining / ratePerSecond;
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            chargingTime = battery.level >= 0.99 ? 'Fully Charged' : (hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`);
          }
          dischargingTime = 'Charging';
        } else {
          chargingTime = 'Not Charging';
          if (ratePerSecond < 0) {
            const seconds = Math.abs(battery.level / ratePerSecond);
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            dischargingTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
          }
        }
      }
    } else {
      chargingTime = battery.charging ? (battery.level >= 0.99 ? 'Fully Charged' : 'Monitoring...') : 'Not Charging';
      dischargingTime = battery.charging ? 'Charging' : 'Monitoring...';
    }

    detected.battery = {
      ...detected.battery,
      level: batteryLevel,
      charging: battery.charging,
      chargingTime,
      dischargingTime
    };

    setDetectedValues({ ...detected });
  };

  const handleInputChange = (field, value) => {
    setSensorData(prev => ({ ...prev, [field]: value }));
  };

  const analyzeEquipment = async () => {
  if (!equipmentName.trim()) {
    alert('Please enter equipment name');
    return;
  }

  setAnalyzing(true);
  setPrediction(null);

  const payload = {
    equipmentName: equipmentName.trim(),
    equipmentType: equipmentType,
    temperature: parseFloat(temperature),
    vibration: parseFloat(vibration),
    pressure: parseFloat(pressure),
    runtime: parseFloat(runtime),
  };

  try {
    const response = await api.post('/predict', payload); // CHANGED

    const result = response.data; // CHANGED

    if (result.success) {
      setPrediction(result.prediction);
      
      if (refreshEquipmentList) {
        await refreshEquipmentList();
      }
      
      alert('✅ Equipment analyzed successfully!');
    } else {
      alert('Error: ' + result.error);
    }
  } catch (e) {
    console.log('Backend connection error:', e);
    alert('❌ Failed to connect to backend.');
  } finally {
    setAnalyzing(false);
  }
  };

  const getRiskColor = (risk) => {
    const colors = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' };
    return colors[risk] || '#6b7280';
  };

  const getHealthColor = (score) => {
    if (score >= 85) return '#10b981';
    if (score >= 70) return '#3b82f6';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const getDeviceSpecificHelp = () => {
    const isComputerDevice = ['laptop', 'phone', 'tablet', 'desktop'].includes(equipmentType);
    const isIndustrialDevice = ['industrial_machine', 'motor', 'pump', 'compressor', 'hvac'].includes(equipmentType);

    if (isComputerDevice) {
      return {
        title: '💻 Consumer Electronics Monitoring Guide',
        sections: [
          {
            icon: '🪟',
            title: 'Windows Users',
            items: [
              { label: 'CPU, RAM, GPU', value: 'Task Manager (Ctrl+Shift+Esc) → Performance tab' },
              { label: 'Screen Brightness', value: 'Settings → System → Display → Brightness slider' },
              { label: 'Battery Health', value: 'Run: powercfg /batteryreport in Command Prompt, open generated HTML file' },
              { label: 'Detailed Hardware', value: 'Download HWMonitor or HWiNFO for temperatures, fan speeds, voltages' },
              { label: 'Thermal Data', value: 'Core Temp or Open Hardware Monitor for CPU/GPU temperatures' }
            ]
          },
          {
            icon: '🍎',
            title: 'Mac Users',
            items: [
              { label: 'CPU & Memory', value: 'Activity Monitor → CPU/Memory tabs' },
              { label: 'Screen Brightness', value: 'System Preferences → Displays → Brightness slider' },
              { label: 'Battery Health', value: 'Option+Click battery icon in menu bar → Battery condition' },
              { label: 'Detailed Monitoring', value: 'iStat Menus ($) or Intel Power Gadget (free) for comprehensive stats' },
              { label: 'Power Usage', value: 'Activity Monitor → Energy tab shows app power consumption' }
            ]
          },
          {
            icon: '🐧',
            title: 'Linux Users',
            items: [
              { label: 'CPU Usage', value: 'Commands: top, htop, or glances' },
              { label: 'RAM Usage', value: 'free -h or cat /proc/meminfo' },
              { label: 'Battery Info', value: 'upower -i /org/freedesktop/UPower/devices/battery_BAT0' },
              { label: 'Sensors', value: 'Install lm-sensors, run: sensors (shows temps, fan speeds)' },
              { label: 'Brightness', value: 'xrandr --verbose or Settings → Displays' }
            ]
          }
        ]
      };
    } else if (isIndustrialDevice) {
      return {
        title: '🏭 Industrial Equipment Monitoring Guide',
        sections: [
          {
            icon: '📊',
            title: 'Direct Measurement Methods',
            items: [
              { label: 'Operating Hours', value: 'Check equipment hour meter or control panel display' },
              { label: 'Load Percentage', value: 'Read from PLC/SCADA system or equipment controller' },
              { label: 'Rotation Speed', value: 'Use tachometer (contact or laser) pointed at shaft/belt' },
              { label: 'Noise Level', value: 'Use sound level meter (dB meter) at 1 meter distance' },
              { label: 'Current Draw', value: 'Clamp meter around power cable (measures amps)' }
            ]
          },
          {
            icon: '🔧',
            title: 'Specialized Equipment',
            items: [
              { label: 'Vibration Analysis', value: 'Vibration meter for bearing/alignment issues' },
              { label: 'Oil Quality', value: 'Oil analysis kit or send sample to lab (check viscosity, contamination)' },
              { label: 'Thermal Imaging', value: 'IR thermal camera to detect hot spots and overheating' },
              { label: 'Power Analyzer', value: 'Power quality analyzer for efficiency, power factor' },
              { label: 'Ultrasonic Testing', value: 'Detect air leaks, arcing, bearing failures' }
            ]
          },
          {
            icon: '📱',
            title: 'IoT & SCADA Integration',
            items: [
              { label: 'SCADA Systems', value: 'Connect to existing SCADA/DCS for real-time data' },
              { label: 'IoT Sensors', value: 'Install wireless sensors for continuous monitoring' },
              { label: 'Smart Controllers', value: 'Modern VFDs/PLCs often have built-in diagnostics' },
              { label: 'Modbus/OPC', value: 'Read data directly from equipment via industrial protocols' }
            ]
          }
        ]
      };
    }

    return null;
  };

  const deviceHelp = getDeviceSpecificHelp();
    return (
    <div className="equipment-monitor">
      <div className="monitor-grid">
        <div className="input-section">
          <h2 className="section-title">⚙️ Equipment Configuration</h2>

          {/* Prefill Notification */}
          {equipmentName && equipmentType && (
            <div className="prefill-notification">
              ℹ️ Adding new readings for: <strong>{equipmentName}</strong> ({equipmentType})
            </div>
          )}

          <div className="form-group">
            <label>Equipment Type</label>
            <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} className="form-select">
              <option value="laptop">💻 Laptop</option>
              <option value="phone">📱 Phone</option>
              <option value="tablet">📱 Tablet</option>
              <option value="desktop">🖥️ Desktop</option>
              <option value="industrial_machine">🏭 Industrial Machine</option>
              <option value="hvac">❄️ HVAC System</option>
              <option value="motor">⚙️ Motor</option>
              <option value="pump">💧 Pump</option>
              <option value="compressor">🔧 Compressor</option>
            </select>
          </div>

          <div className="form-group">
            <label>Equipment Name / Model</label>
            <input
              type="text"
              value={equipmentName}
              onChange={(e) => setEquipmentName(e.target.value)}
              placeholder="e.g., Dell XPS 15, iPhone 13, ABB Motor M3000"
              className="form-input"
            />
          </div>

          {(equipmentType === 'laptop' || equipmentType === 'phone' || equipmentType === 'tablet') && (
            <div className="form-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={autoDetect} onChange={(e) => setAutoDetect(e.target.checked)} />
                <span>🔍 Auto-detect available system information (for reference only)</span>
              </label>
            </div>
          )}

          <h3 className="subsection-title">📊 Sensor Readings</h3>

          <div className="sensor-grid">
            <div className="form-group">
              <label>⏱️ Operating Hours</label>
              <input
                type="number"
                value={sensorData.operating_hours}
                onChange={(e) => handleInputChange('operating_hours', e.target.value)}
                placeholder="0-20000"
                className="form-input"
              />
            </div>

            {(equipmentType === 'industrial_machine' || equipmentType === 'motor' || equipmentType === 'pump' || equipmentType === 'compressor' || equipmentType === 'hvac') && (
              <>
                <div className="form-group">
                  <label>📊 Load Percentage (%)</label>
                  <input type="number" value={sensorData.load_percentage} onChange={(e) => handleInputChange('load_percentage', e.target.value)} placeholder="0-100" className="form-input" />
                </div>
                <div className="form-group">
                  <label>🔊 Noise Level (dB)</label>
                  <input type="number" value={sensorData.noise_level} onChange={(e) => handleInputChange('noise_level', e.target.value)} placeholder="40-110" className="form-input" />
                </div>
                <div className="form-group">
                  <label>🔄 Rotation Speed (RPM)</label>
                  <input type="number" value={sensorData.rotation_speed} onChange={(e) => handleInputChange('rotation_speed', e.target.value)} placeholder="0-6000" className="form-input" />
                </div>
                <div className="form-group">
                  <label>⚡ Current Draw (Amps)</label>
                  <input type="number" value={sensorData.current_draw} onChange={(e) => handleInputChange('current_draw', e.target.value)} placeholder="0-100" className="form-input" />
                </div>
                <div className="form-group">
                  <label>🛢️ Oil Quality (%)</label>
                  <input type="number" value={sensorData.oil_quality} onChange={(e) => handleInputChange('oil_quality', e.target.value)} placeholder="0-100" className="form-input" />
                </div>
                <div className="form-group">
                  <label>⚡ Efficiency Rating (%)</label>
                  <input type="number" value={sensorData.efficiency_rating} onChange={(e) => handleInputChange('efficiency_rating', e.target.value)} placeholder="0-100" className="form-input" />
                </div>
              </>
            )}

            {(equipmentType === 'laptop' || equipmentType === 'phone' || equipmentType === 'tablet' || equipmentType === 'desktop') && (
              <>
                <div className="form-group">
                  <label>💻 CPU Usage (%)</label>
                  <input type="number" value={sensorData.cpu_usage} onChange={(e) => handleInputChange('cpu_usage', e.target.value)} placeholder="0-100" className="form-input" />
                </div>
                <div className="form-group">
                  <label>💾 RAM Usage (GB)</label>
                  <input type="number" step="0.01" value={sensorData.ram_usage} onChange={(e) => handleInputChange('ram_usage', e.target.value)} placeholder="0-32" className="form-input" />
                </div>
                <div className="form-group">
                  <label>🔋 Battery Health (%)</label>
                  <input type="number" value={sensorData.battery_health} onChange={(e) => handleInputChange('battery_health', e.target.value)} placeholder="0-100" className="form-input" />
                </div>
                <div className="form-group">
                  <label>⚡ Power Consumption (W)</label>
                  <input type="number" value={sensorData.power_consumption} onChange={(e) => handleInputChange('power_consumption', e.target.value)} placeholder="0-100" className="form-input" />
                </div>
                <div className="form-group">
                  <label>🌀 Fan Speed (RPM)</label>
                  <input type="number" value={sensorData.fan_speed} onChange={(e) => handleInputChange('fan_speed', e.target.value)} placeholder="0-5000" className="form-input" />
                </div>
                <div className="form-group">
                  <label>🌡️ Thermal Throttling (%)</label>
                  <input type="number" value={sensorData.thermal_throttling} onChange={(e) => handleInputChange('thermal_throttling', e.target.value)} placeholder="0-100" className="form-input" />
                </div>
                <div className="form-group">
                  <label>🎮 GPU Usage (%)</label>
                  <input type="number" value={sensorData.gpu_usage} onChange={(e) => handleInputChange('gpu_usage', e.target.value)} placeholder="0-100" className="form-input" />
                </div>
                <div className="form-group">
                  <label>☀️ Screen Brightness (%)</label>
                  <input type="number" value={sensorData.screen_brightness} onChange={(e) => handleInputChange('screen_brightness', e.target.value)} placeholder="0-100" className="form-input" />
                </div>
                <div className="form-group">
                  <label>🌐 Network Activity (Mbps) {sensorData.network_activity && <span className="detected-badge real">✓ Auto</span>}</label>
                  <input type="number" value={sensorData.network_activity} onChange={(e) => handleInputChange('network_activity', e.target.value)} placeholder="0-1000" className="form-input" />
                </div>
              </>
            )}
          </div>

          {systemInfo && (
            <div className="system-info-container">
              <div className="system-info-header">
                <h4>🔍 System Information (Reference Only)</h4>
                <span className="info-badge">Auto-Detected</span>
              </div>
              
              <div className="browser-limitation-notice">
                <div className="notice-icon">⚠️</div>
                <div className="notice-content">
                  <strong>Browser Security Limitations</strong>
                  <p>For privacy and security, browsers cannot access most system values. Below shows what's available vs. what you need to enter manually.</p>
                </div>
              </div>

              <div className="info-grid">
                <div className="info-item verified">
                  <span className="info-icon">✅</span>
                  <div className="info-details">
                    <span className="info-label">CPU Cores</span>
                    <span className="info-value">{systemInfo.cpuCores}</span>
                  </div>
                </div>
                <div className="info-item verified">
                  <span className="info-icon">✅</span>
                  <div className="info-details">
                    <span className="info-label">Total RAM</span>
                    <span className="info-value">{systemInfo.memory}</span>
                  </div>
                </div>
                <div className="info-item verified">
                  <span className="info-icon">✅</span>
                  <div className="info-details">
                    <span className="info-label">Platform</span>
                    <span className="info-value">{systemInfo.platform}</span>
                  </div>
                </div>
                <div className="info-item verified">
                  <span className="info-icon">✅</span>
                  <div className="info-details">
                    <span className="info-label">Online Status</span>
                    <span className="info-value">{systemInfo.onLine ? '🟢 Online' : '🔴 Offline'}</span>
                  </div>
                </div>
              </div>

              {detectedValues?.battery && (
                <div className="detection-card real-data">
                  <div className="card-header">
                    <h5>🔋 Battery Information</h5>
                    <span className="data-badge real">✓ Real Data</span>
                  </div>
                  <div className="card-grid">
                    <div className="card-item">
                      <span className="card-label">Current Level</span>
                      <span className="card-value">{detectedValues.battery.level}%</span>
                    </div>
                    <div className="card-item">
                      <span className="card-label">Status</span>
                      <span className="card-value">{detectedValues.battery.charging ? '⚡ Charging' : '🔋 Discharging'}</span>
                    </div>
                    <div className="card-item">
                      <span className="card-label">Time to Full</span>
                      <span className="card-value">{detectedValues.battery.chargingTime}</span>
                    </div>
                    <div className="card-item">
                      <span className="card-label">Time Remaining</span>
                      <span className="card-value">{detectedValues.battery.dischargingTime}</span>
                    </div>
                  </div>
                  <div className="card-note warning">
                    <span className="note-icon">⚠️</span>
                    <span className="note-text"><strong>Battery Health cannot be detected by browsers.</strong> Please check your system settings to find actual battery health percentage.</span>
                  </div>
                </div>
              )}

              {detectedValues?.network && (
                <div className="detection-card real-data">
                  <div className="card-header">
                    <h5>🌐 Network Information</h5>
                    <span className="data-badge real">✓ Real Data</span>
                  </div>
                  <div className="card-grid">
                    {detectedValues.network.downlink && (
                      <div className="card-item">
                        <span className="card-label">Download Speed</span>
                        <span className="card-value">{detectedValues.network.downlink} Mbps</span>
                      </div>
                    )}
                    <div className="card-item">
                      <span className="card-label">Connection Type</span>
                      <span className="card-value">{detectedValues.network.effectiveType}</span>
                    </div>
                    {detectedValues.network.rtt && (
                      <div className="card-item">
                        <span className="card-label">Latency</span>
                        <span className="card-value">{detectedValues.network.rtt} ms</span>
                      </div>
                    )}
                  </div>
                  <div className="card-note success">
                    <span className="note-icon">✓</span>
                    <span className="note-text">Network speed auto-populated in Network Activity field</span>
                  </div>
                </div>
              )}

              <div className="reference-estimates">
                <div className="estimates-header">
                  <h5>📝 Reference Estimates Only - Manual Entry Required</h5>
                  <p>These values are approximations. Please verify and enter actual values from your system monitor.</p>
                </div>

                <div className="estimates-grid">
                  {detectedValues?.brightness && (
                    <div className="estimate-card">
                      <div className="estimate-header">
                        <span className="estimate-icon">☀️</span>
                        <div className="estimate-title">
                          <strong>Screen Brightness</strong>
                          <span className="confidence-badge low">{detectedValues.brightness.confidence} Confidence</span>
                        </div>
                      </div>
                      <div className="estimate-value">
                        <span className="estimate-label">Our Estimate:</span>
                        <span className="estimate-number">{detectedValues.brightness.value}%</span>
                      </div>
                      <div className="estimate-details">
                        <div className="detail-row">
                          <span className="detail-label">Method:</span>
                          <span className="detail-value">{detectedValues.brightness.method}</span>
                        </div>
                        {detectedValues.brightness.lux && (
                          <div className="detail-row">
                            <span className="detail-label">Ambient Light:</span>
                            <span className="detail-value">{detectedValues.brightness.lux} lux</span>
                          </div>
                        )}
                      </div>
                      <div className="estimate-note">
                        <span className="note-icon">ℹ️</span>
                        <span className="note-text">{detectedValues.brightness.note}</span>
                      </div>
                    </div>
                  )}

                  {detectedValues?.cpu && (
                    <div className="estimate-card">
                      <div className="estimate-header">
                        <span className="estimate-icon">🖥️</span>
                        <div className="estimate-title">
                          <strong>CPU Usage</strong>
                          <span className="confidence-badge low">Low Confidence</span>
                        </div>
                      </div>
                      <div className="estimate-value">
                        <span className="estimate-label">Our Estimate:</span>
                        <span className="estimate-number">{detectedValues.cpu.estimatedUsage}%</span>
                      </div>
                      <div className="estimate-details">
                        <div className="detail-row">
                          <span className="detail-label">Benchmark Time:</span>
                          <span className="detail-value">{detectedValues.cpu.benchmarkTime} ms</span>
                        </div>
                      </div>
                      <div className="estimate-note">
                        <span className="note-icon">ℹ️</span>
                        <span className="note-text">{detectedValues.cpu.note}</span>
                      </div>
                    </div>
                  )}

                  {detectedValues?.thermal && (
                    <div className="estimate-card">
                      <div className="estimate-header">
                        <span className="estimate-icon">🌡️</span>
                        <div className="estimate-title">
                          <strong>Thermal Throttling</strong>
                          <span className="confidence-badge low">Low Confidence</span>
                        </div>
                      </div>
                      <div className="estimate-value">
                        <span className="estimate-label">Our Estimate:</span>
                        <span className="estimate-number">{detectedValues.thermal.throttlingPercent}%</span>
                      </div>
                      <div className="estimate-details">
                        <div className="detail-row">
                          <span className="detail-label">Performance Variance:</span>
                          <span className="detail-value">{detectedValues.thermal.performanceDrop}%</span>
                        </div>
                      </div>
                      <div className="estimate-note">
                        <span className="note-icon">ℹ️</span>
                        <span className="note-text">Estimated from benchmark performance variation</span>
                      </div>
                    </div>
                  )}

                  {detectedValues?.ram && (
                    <div className="estimate-card">
                      <div className="estimate-header">
                        <span className="estimate-icon">💾</span>
                        <div className="estimate-title">
                          <strong>RAM Usage</strong>
                          <span className="confidence-badge low">Low Confidence</span>
                        </div>
                      </div>
                      <div className="estimate-value">
                        <span className="estimate-label">Our Estimate:</span>
                        <span className="estimate-number">{detectedValues.ram.estimatedUsage} GB</span>
                      </div>
                      <div className="estimate-details">
                        <div className="detail-row">
                          <span className="detail-label">Total RAM:</span>
                          <span className="detail-value">{detectedValues.ram.totalRAM} GB</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">JS Heap Used:</span>
                          <span className="detail-value">{detectedValues.ram.heapUsed} GB</span>
                        </div>
                      </div>
                      <div className="estimate-note">
                        <span className="note-icon">ℹ️</span>
                        <span className="note-text">{detectedValues.ram.note}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {deviceHelp && (
            <div className="device-help-guide">
              <div className="help-guide-header">
                <h4>{deviceHelp.title}</h4>
                <p>Follow these methods to get accurate sensor readings for your equipment:</p>
              </div>

              <div className="help-sections">
                {deviceHelp.sections.map((section, idx) => (
                  <div key={idx} className="help-section">
                    <div className="help-section-header">
                      <span className="help-icon">{section.icon}</span>
                      <h5>{section.title}</h5>
                    </div>
                    <div className="help-items">
                      {section.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="help-item">
                          <div className="help-item-label">{item.label}</div>
                          <div className="help-item-value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={analyzeEquipment} disabled={analyzing} className="analyze-btn">
            {analyzing ? (
              <>
                <span className="spinner"></span>
                <span>Analyzing Equipment...</span>
              </>
            ) : (
              <>
                <span className="btn-icon">🔍</span>
                <span>Analyze Equipment Health</span>
              </>
            )}
          </button>
        </div>

        <div className="results-section">
          {prediction ? (
            <>
              <h2 className="section-title">🤖 AI Health Analysis</h2>
              <div className="health-score-card">
                <div className="score-circle" style={{
                  background: `conic-gradient(${getHealthColor(prediction.health_score)} ${prediction.health_score * 3.6}deg, #334155 0deg)`
                }}>
                  <div className="score-inner">
                    <span className="score-value">{Math.round(prediction.health_score)}</span>
                    <span className="score-label">Health Score</span>
                  </div>
                </div>
                <div className="risk-badge" style={{ backgroundColor: getRiskColor(prediction.risk_level) }}>
                  Risk Level: {prediction.risk_level.toUpperCase()}
                </div>
              </div>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-icon">📅</div>
                  <div className="metric-content">
                    <div className="metric-value">{prediction.remaining_life_days}</div>
                    <div className="metric-label">Days Remaining Life</div>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">🔧</div>
                  <div className="metric-content">
                    <div className="metric-value">{prediction.maintenance_needed_days}</div>
                    <div className="metric-label">Days Until Maintenance</div>
                  </div>
                </div>
              </div>
              <div className="recommendations">
                <h3>💡 AI Recommendations</h3>
                <ul className="recommendation-list">
                  {prediction.recommendations.map((rec, index) => (
                    <li key={index} className="recommendation-item">
                      <span className="rec-icon">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🤖</div>
              <h3>Ready for AI Analysis</h3>
              <p>Configure your equipment and enter sensor readings to begin health analysis.</p>
              <div className="empty-features">
                <div className="feature-item">
                  <span className="feature-icon">✓</span>
                  <span>AI-Powered Diagnostics</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">✓</span>
                  <span>Predictive Maintenance</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">✓</span>
                  <span>Risk Assessment</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EquipmentMonitor;