const mongoose = require('mongoose');

const equipmentHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  equipmentName: {
    type: String,
    required: true,
    trim: true
  },
  equipmentType: {
    type: String,
    required: true,
    enum: [
      'laptop', 'phone', 'tablet', 'desktop',
      'industrial_machine', 'motor', 'pump', 'compressor', 'hvac'
    ]
  },
  model: {
    type: String,
    trim: true
  },
  sensorData: {
    operating_hours: Number,
    power_consumption: Number,
    fan_speed: Number,
    thermal_throttling: Number,
    gpu_usage: Number,
    screen_brightness: Number,
    network_activity: Number,
    battery_health: Number,
    cpu_usage: Number,
    ram_usage: Number,
    load_percentage: Number,
    noise_level: Number,
    rotation_speed: Number,
    current_draw: Number,
    oil_quality: Number,
    efficiency_rating: Number
  },
  prediction: {
    health_score: Number,
    remaining_life_days: Number,
    maintenance_needed_days: Number,
    risk_level: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    recommendations: [String],
    critical_issues: [String],
    warnings: [String],
    analysis: {
      power_status: String,
      thermal_status: String,
      mechanical_status: String,
      performance_status: String,
      battery_status: String,
      overall_condition: String
    },
    analyzed_at: Date
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
equipmentHistorySchema.index({ user: 1, timestamp: -1 });
equipmentHistorySchema.index({ user: 1, equipmentType: 1 });
equipmentHistorySchema.index({ 'prediction.risk_level': 1 });
equipmentHistorySchema.index({ 'prediction.health_score': 1 });

module.exports = mongoose.model('EquipmentHistory', equipmentHistorySchema);