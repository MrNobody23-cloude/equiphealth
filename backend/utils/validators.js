
function validatePredictionInput(data) {
  if (!data.equipment_type) {
    return {
      valid: false,
      error: 'Equipment type is required'
    };
  }

  const validTypes = [
    'laptop', 'phone', 'tablet', 'desktop',
    'industrial_machine', 'motor', 'pump', 'compressor', 'hvac'
  ];

  if (!validTypes.includes(data.equipment_type)) {
    return {
      valid: false,
      error: `Invalid equipment type. Must be one of: ${validTypes.join(', ')}`
    };
  }

  const numericFields = {
    operating_hours: { min: 0, max: 100000 },
    power_consumption: { min: 0, max: 1000 },
    fan_speed: { min: 0, max: 10000 },
    thermal_throttling: { min: 0, max: 100 },
    gpu_usage: { min: 0, max: 100 },
    screen_brightness: { min: 0, max: 100 },
    network_activity: { min: 0, max: 10000 },
    battery_health: { min: 0, max: 100 },
    cpu_usage: { min: 0, max: 100 },
    ram_usage: { min: 0, max: 256 },
    load_percentage: { min: 0, max: 150 },
    noise_level: { min: 0, max: 150 },
    rotation_speed: { min: 0, max: 10000 },
    current_draw: { min: 0, max: 500 },
    oil_quality: { min: 0, max: 100 },
    efficiency_rating: { min: 0, max: 100 }
  };

  for (const [field, range] of Object.entries(numericFields)) {
    if (data[field] !== undefined) {
      const value = parseFloat(data[field]);
      
      if (isNaN(value)) {
        return {
          valid: false,
          error: `${field} must be a valid number`
        };
      }

      if (value < range.min || value > range.max) {
        return {
          valid: false,
          error: `${field} must be between ${range.min} and ${range.max}`
        };
      }
    }
  }

  return { valid: true };
}

function sanitizeString(str, maxLength = 200) {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength);
}

module.exports = {
  validatePredictionInput,
  sanitizeString
};