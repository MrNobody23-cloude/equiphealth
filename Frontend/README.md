# AI Equipment Health Monitoring System

A comprehensive full-stack application for monitoring equipment health using AI-powered predictive analytics.

## 🎯 Features

- **Real-time Equipment Monitoring** - Track multiple equipment types (laptops, phones, industrial machines, etc.)
- **AI Health Prediction** - ML-based health scoring and predictive maintenance scheduling
- **Auto System Detection** - Automatically detect device parameters for laptops/phones
- **Service Locator** - Find nearby maintenance service providers with distance calculation
- **Interactive Dashboard** - Visual analytics and equipment inventory management
- **History Tracking** - MongoDB-backed equipment analysis history

## 🏗️ Architecture

### Frontend (React + JavaScript)
- Location: `/src` folder
- Tech Stack: React 18, Vite, CSS3
- Responsive design for all devices
- Real-time system information detection

### Backend (Node.js + Express)
- Location: `/backend` folder
- Tech Stack: Express.js, MongoDB, Mongoose
- RESTful API endpoints
- ML prediction algorithms
- Service provider location engine

## 🚀 Setup Instructions

### 1. Install Frontend Dependencies
```bash
npm install
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

### 3. Configure MongoDB
Edit `backend/.env` and replace with your MongoDB connection string:
```
MONGODB_URI=your_mongodb_connection_string_here
```

### 4. Start Backend Server
```bash
cd backend
nodemon server.js
```
Backend will run on `http://localhost:5000`

### 5. Start Frontend Development Server
```bash
npm run dev
```
Frontend will run on `http://localhost:5173`

## 📡 API Endpoints

### Health Prediction
**POST** `/api/predict`
```json
{
  "equipmentName": "My Laptop",
  "equipment_type": "laptop",
  "temperature": 65,
  "cpu_usage": 45,
  "ram_usage": 60,
  "battery_health": 85,
  "disk_usage": 70
}
```

### Service Locator
**GET** `/api/service-locator?equipmentType=laptop&latitude=40.7128&longitude=-74.0060`

### Equipment History
**GET** `/api/history`

## 🎨 UI Features

- **Modern Dark Theme** - Professional blue gradient design
- **Fully Responsive** - Adapts to mobile, tablet, and desktop
- **Smooth Animations** - Enhanced user experience with transitions
- **Real-time Updates** - Live data visualization
- **Auto-detection** - System information gathering via browser APIs

## 📊 ML Prediction Algorithm

The backend implements sophisticated ML algorithms that analyze:
- Temperature variations
- Vibration levels (for industrial equipment)
- CPU/RAM usage patterns
- Battery health degradation
- Disk usage trends

Provides:
- Health score (0-100)
- Remaining operational life estimate
- Maintenance scheduling recommendations
- Risk level assessment (low/medium/high/critical)
- Detailed component analysis

## 🛠️ Technology Stack

**Frontend:**
- React 18
- Vite
- CSS3 with responsive design
- Browser APIs (Battery, Storage, Navigator)

**Backend:**
- Node.js
- Express.js
- MongoDB + Mongoose
- CORS enabled
- RESTful architecture

## 📝 Notes

- Ensure backend server is running before starting frontend
- MongoDB connection is optional - app works with in-memory storage if DB is unavailable
- Frontend will display error if backend is not accessible
- All UI components are pure JavaScript (no TypeScript)

## 🔒 Security

- CORS configured for local development
- MongoDB connection string stored in environment variables
- Input validation on all API endpoints
- Error handling throughout the application

## 💡 Usage Tips

1. Start with the **Equipment Monitor** tab to analyze devices
2. Enable **Auto-detect** for laptops/phones to gather system info automatically
3. View all monitored equipment in the **Dashboard** tab
4. Find nearby service centers in the **Service Locator** tab
5. Use geolocation for accurate distance-based provider sorting

## 🐛 Troubleshooting

**Backend connection error:**
- Verify backend is running on port 5000
- Check CORS settings if using different ports

**MongoDB connection warning:**
- Replace dummy MongoDB URI in `backend/.env`
- App will continue working with in-memory storage

**Auto-detect not working:**
- Some browser APIs require HTTPS in production
- Battery API may not be available on all devices
