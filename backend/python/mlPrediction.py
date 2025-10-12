#!/usr/bin/env python3
"""
Equipment Health Analysis - Python ML Engine with Model Loading
Loads trained .pkl models for prediction with rule-based fallback
"""

import sys
import json
import os
from datetime import datetime
import warnings

warnings.filterwarnings('ignore')

# Try to import ML libraries
try:
    import joblib
    import numpy as np
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    print("Warning: ML libraries not available, using rule-based analysis", file=sys.stderr)

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(SCRIPT_DIR, 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'health_predictor.pkl')
SCALER_PATH = os.path.join(MODEL_DIR, 'scaler.pkl')
FEATURE_NAMES_PATH = os.path.join(MODEL_DIR, 'feature_names.pkl')


class EquipmentAnalyzer:
    """Equipment health analyzer with ML model loading and rule-based fallback"""
    
    def __init__(self):
        self.equipment_type = None
        self.data = None
        self.use_ml = False
        self.model = None
        self.scaler = None
        self.feature_names = None
        
        # Try to load ML model
        if ML_AVAILABLE:
            self.load_ml_model()
    
    def load_ml_model(self):
        """Load trained ML model from .pkl files"""
        try:
            if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH) and os.path.exists(FEATURE_NAMES_PATH):
                self.model = joblib.load(MODEL_PATH)
                self.scaler = joblib.load(SCALER_PATH)
                self.feature_names = joblib.load(FEATURE_NAMES_PATH)
                self.use_ml = True
                print("✅ ML model loaded successfully", file=sys.stderr)
            else:
                print("⚠️  ML model files not found, using rule-based analysis", file=sys.stderr)
                print(f"   Expected: {MODEL_PATH}", file=sys.stderr)
                self.use_ml = False
        except Exception as e:
            print(f"⚠️  Failed to load ML model: {e}", file=sys.stderr)
            print("   Falling back to rule-based analysis", file=sys.stderr)
            self.use_ml = False
    
    def analyze(self, data):
        """Main analysis function - uses ML if available, else rule-based"""
        self.data = data
        self.equipment_type = data.get('equipment_type', 'unknown')
        
        # Try ML prediction first
        if self.use_ml:
            try:
                return self.ml_predict(data)
            except Exception as e:
                print(f"⚠️  ML prediction failed: {e}", file=sys.stderr)
                print("   Falling back to rule-based analysis", file=sys.stderr)
        
        # Fallback to rule-based analysis
        return self.rule_based_analyze(data)
    
    def ml_predict(self, data):
        """ML-based prediction using trained model"""
        print("🤖 Using ML model for prediction", file=sys.stderr)
        
        # Prepare features
        features = self.prepare_features(data)
        
        # Scale features
        features_scaled = self.scaler.transform([features])
        
        # Predict health score
        predicted_health = self.model.predict(features_scaled)[0]
        predicted_health = float(np.clip(predicted_health, 0, 100))
        
        # Calculate other metrics based on predicted health
        risk_level = self.calculate_risk_level(predicted_health)
        remaining_life_days = self.calculate_remaining_life(predicted_health)
        maintenance_days = self.calculate_maintenance_days(predicted_health, risk_level)
        
        # Get rule-based recommendations for specific issues
        recommendations = self.get_ml_recommendations(data, predicted_health)
        critical_issues = [r for r in recommendations if 'CRITICAL' in r or '🚨' in r]
        warnings = [r for r in recommendations if '⚠️' in r and 'CRITICAL' not in r]
        
        # Analysis breakdown
        analysis = self.create_analysis_summary(data, predicted_health)
        
        return {
            'health_score': round(predicted_health, 1),
            'remaining_life_days': remaining_life_days,
            'maintenance_needed_days': maintenance_days,
            'risk_level': risk_level,
            'recommendations': recommendations if recommendations else [
                '✅ Equipment is operating within normal parameters.',
                'Continue regular monitoring and maintenance schedule.'
            ],
            'critical_issues': critical_issues,
            'warnings': warnings,
            'analysis': analysis,
            'equipment_type': self.equipment_type,
            'analyzed_at': datetime.now().isoformat(),
            'prediction_method': 'ml_model'
        }
    
    def prepare_features(self, data):
        """Prepare features for ML model"""
        # Equipment type encoding
        equipment_types = ['laptop', 'phone', 'tablet', 'desktop', 
                          'industrial_machine', 'motor', 'pump', 'compressor', 'hvac']
        eq_type_encoded = equipment_types.index(data.get('equipment_type', 'laptop')) if data.get('equipment_type') in equipment_types else 0
        
        # Extract all features in correct order
        features = [
            eq_type_encoded,
            float(data.get('operating_hours', 0)),
            float(data.get('battery_health', 100)),
            float(data.get('cpu_usage', 50)),
            float(data.get('ram_usage', 8)),
            float(data.get('thermal_throttling', 0)),
            float(data.get('gpu_usage', 0)),
            float(data.get('fan_speed', 2000)),
            float(data.get('power_consumption', 50)),
            float(data.get('screen_brightness', 50)),
            float(data.get('network_activity', 0)),
            float(data.get('load_percentage', 0)),
            float(data.get('noise_level', 0)),
            float(data.get('rotation_speed', 0)),
            float(data.get('current_draw', 0)),
            float(data.get('oil_quality', 100)),
            float(data.get('efficiency_rating', 100))
        ]
        
        return features
    
    def get_ml_recommendations(self, data, health_score):
        """Generate recommendations based on ML prediction and sensor data"""
        recommendations = []
        
        # Add critical sensor-based recommendations
        if 'battery_health' in data and data['battery_health'] is not None:
            if data['battery_health'] < 40:
                recommendations.append('🔋 CRITICAL: Battery health critically low! Replace immediately.')
            elif data['battery_health'] < 60:
                recommendations.append('🔋 Battery health poor. Plan for replacement soon.')
        
        if 'thermal_throttling' in data and data['thermal_throttling'] is not None:
            if data['thermal_throttling'] > 30:
                recommendations.append('🌡️ CRITICAL: Severe thermal throttling detected! Clean cooling system.')
            elif data['thermal_throttling'] > 15:
                recommendations.append('🌡️ High thermal throttling. Improve cooling.')
        
        if 'cpu_usage' in data and data['cpu_usage'] is not None:
            if data['cpu_usage'] > 95:
                recommendations.append('💻 CRITICAL: CPU at maximum load constantly!')
        
        if 'load_percentage' in data and data['load_percentage'] is not None:
            if data['load_percentage'] > 95:
                recommendations.append('⚙️ CRITICAL: Equipment overloaded! Reduce load immediately.')
        
        if 'oil_quality' in data and data['oil_quality'] is not None:
            if data['oil_quality'] < 40:
                recommendations.append('🛢️ CRITICAL: Oil quality critical! Change immediately.')
        
        if 'noise_level' in data and data['noise_level'] is not None:
            eq_type = data.get('equipment_type', 'unknown')
            thresholds = {'motor': 80, 'pump': 75, 'compressor': 90, 'hvac': 70}
            threshold = thresholds.get(eq_type, 80)
            if data['noise_level'] > threshold + 15:
                recommendations.append(f'🔊 CRITICAL: Noise at {data["noise_level"]}dB! Inspect for failure.')
        
        # Health-based recommendations
        if health_score < 50:
            recommendations.append('🚨 URGENT: Schedule immediate inspection and maintenance.')
        elif health_score < 70:
            recommendations.append('⚠️ Schedule maintenance within the next week.')
        elif health_score < 85:
            recommendations.append('📅 Plan preventive maintenance within 30 days.')
        
        return recommendations
    
    def create_analysis_summary(self, data, health_score):
        """Create analysis summary"""
        analysis = {
            'power_status': 'Good',
            'thermal_status': 'Good',
            'mechanical_status': 'N/A',
            'performance_status': 'Good',
            'battery_status': 'N/A',
            'overall_condition': self.get_overall_condition(health_score)
        }
        
        # Update based on specific sensors
        if 'battery_health' in data and data['battery_health'] is not None:
            if data['battery_health'] < 40:
                analysis['battery_status'] = 'Critical'
            elif data['battery_health'] < 60:
                analysis['battery_status'] = 'Poor'
            elif data['battery_health'] < 80:
                analysis['battery_status'] = 'Fair'
            else:
                analysis['battery_status'] = 'Good'
        
        if 'thermal_throttling' in data and data['thermal_throttling'] is not None:
            if data['thermal_throttling'] > 30:
                analysis['thermal_status'] = 'Critical'
            elif data['thermal_throttling'] > 15:
                analysis['thermal_status'] = 'High'
            elif data['thermal_throttling'] > 5:
                analysis['thermal_status'] = 'Moderate'
        
        if 'load_percentage' in data and data['load_percentage'] is not None:
            if data['load_percentage'] > 95:
                analysis['mechanical_status'] = 'Overload'
            elif data['load_percentage'] > 85:
                analysis['mechanical_status'] = 'High Load'
            else:
                analysis['mechanical_status'] = 'Good'
        
        return analysis
    
    def rule_based_analyze(self, data):
        """Rule-based analysis (fallback)"""
        print("📊 Using rule-based analysis", file=sys.stderr)
        
        health_score = 100.0
        recommendations = []
        critical_issues = []
        warnings = []
        
        analysis = {
            'power_status': 'Good',
            'thermal_status': 'Good',
            'mechanical_status': 'N/A',
            'performance_status': 'Good',
            'battery_status': 'N/A',
            'overall_condition': 'Good'
        }
        
        # Operating hours
        if 'operating_hours' in data and data['operating_hours'] is not None:
            result = self.analyze_operating_hours(data['operating_hours'])
            health_score -= result['penalty']
            recommendations.extend(result['recommendations'])
            if result.get('critical'):
                critical_issues.extend(result['recommendations'])
        
        # Computer equipment
        if self.equipment_type in ['laptop', 'phone', 'tablet', 'desktop']:
            health_score, analysis = self.analyze_computer_equipment(
                health_score, analysis, recommendations, critical_issues, warnings
            )
        
        # Industrial equipment
        elif self.equipment_type in ['industrial_machine', 'motor', 'pump', 'compressor', 'hvac']:
            health_score, analysis = self.analyze_industrial_equipment(
                health_score, analysis, recommendations, critical_issues, warnings
            )
        
        health_score = max(0.0, min(100.0, health_score))
        risk_level = self.calculate_risk_level(health_score)
        remaining_life_days = self.calculate_remaining_life(health_score)
        maintenance_days = self.calculate_maintenance_days(health_score, risk_level)
        analysis['overall_condition'] = self.get_overall_condition(health_score)
        
        if not recommendations:
            recommendations.append('✅ Equipment is operating within normal parameters.')
            recommendations.append('Continue regular monitoring and maintenance schedule.')
        
        return {
            'health_score': round(health_score, 1),
            'remaining_life_days': remaining_life_days,
            'maintenance_needed_days': maintenance_days,
            'risk_level': risk_level,
            'recommendations': recommendations,
            'critical_issues': critical_issues,
            'warnings': warnings,
            'analysis': analysis,
            'equipment_type': self.equipment_type,
            'analyzed_at': datetime.now().isoformat(),
            'prediction_method': 'rule_based'
        }
    
    # ==================== RULE-BASED ANALYSIS METHODS ====================
    # (Keep all your existing rule-based methods from the previous implementation)
    
    def analyze_operating_hours(self, hours):
        thresholds = {
            'laptop': {'moderate': 10000, 'high': 15000, 'critical': 20000},
            'phone': {'moderate': 15000, 'high': 20000, 'critical': 25000},
            'tablet': {'moderate': 12000, 'high': 18000, 'critical': 22000},
            'desktop': {'moderate': 20000, 'high': 30000, 'critical': 40000},
            'industrial_machine': {'moderate': 30000, 'high': 50000, 'critical': 70000},
            'motor': {'moderate': 40000, 'high': 60000, 'critical': 80000},
            'pump': {'moderate': 35000, 'high': 55000, 'critical': 75000},
            'compressor': {'moderate': 30000, 'high': 50000, 'critical': 70000},
            'hvac': {'moderate': 25000, 'high': 40000, 'critical': 60000}
        }
        threshold = thresholds.get(self.equipment_type, thresholds['laptop'])
        
        if hours >= threshold['critical']:
            return {'penalty': 30, 'status': 'Critical', 'critical': True,
                    'recommendations': ['🚨 CRITICAL: Operating hours exceed maximum lifespan.']}
        elif hours >= threshold['high']:
            return {'penalty': 20, 'status': 'High Usage', 'critical': False,
                    'recommendations': ['⚠️ HIGH: Operating hours very high. Plan replacement.']}
        elif hours >= threshold['moderate']:
            return {'penalty': 10, 'status': 'Moderate Usage', 'critical': False,
                    'recommendations': ['📊 Moderate operating hours. Monitor closely.']}
        return {'penalty': 0, 'status': 'Good', 'critical': False, 'recommendations': []}
    
    def analyze_computer_equipment(self, health_score, analysis, recommendations, critical_issues, warnings):
        """Analyze computer equipment"""
        
        if 'battery_health' in self.data and self.data['battery_health'] is not None:
            if self.equipment_type != 'desktop':
                bh = self.data['battery_health']
                if bh < 40:
                    health_score -= 30
                    critical_issues.append('🔋 CRITICAL: Battery critically low!')
                    analysis['battery_status'] = 'Critical'
                elif bh < 60:
                    health_score -= 20
                    recommendations.append('🔋 Battery poor. Replace soon.')
                    analysis['battery_status'] = 'Poor'
                elif bh < 80:
                    health_score -= 10
                    recommendations.append('🔋 Battery degrading.')
                    analysis['battery_status'] = 'Fair'
        
        if 'cpu_usage' in self.data and self.data['cpu_usage'] is not None:
            cpu = self.data['cpu_usage']
            if cpu > 95:
                health_score -= 15
                critical_issues.append('💻 CRITICAL: CPU at maximum!')
            elif cpu > 80:
                health_score -= 10
                recommendations.append('💻 CPU usage very high.')
        
        if 'thermal_throttling' in self.data and self.data['thermal_throttling'] is not None:
            tt = self.data['thermal_throttling']
            if tt > 30:
                health_score -= 25
                critical_issues.append('🌡️ CRITICAL: Severe thermal throttling!')
                analysis['thermal_status'] = 'Critical'
            elif tt > 15:
                health_score -= 15
                recommendations.append('🌡️ High thermal throttling.')
                analysis['thermal_status'] = 'High'
        
        if 'fan_speed' in self.data and self.data['fan_speed'] is not None:
            fs = self.data['fan_speed']
            if fs > 4500:
                health_score -= 10
                recommendations.append('🌀 Fan at maximum speed!')
            elif fs < 500 and fs > 0:
                health_score -= 15
                critical_issues.append('🌀 CRITICAL: Fan speed too low!')
        
        return health_score, analysis
    
    def analyze_industrial_equipment(self, health_score, analysis, recommendations, critical_issues, warnings):
        """Analyze industrial equipment"""
        
        if 'load_percentage' in self.data and self.data['load_percentage'] is not None:
            load = self.data['load_percentage']
            if load > 95:
                health_score -= 20
                critical_issues.append('⚙️ CRITICAL: Equipment overloaded!')
                analysis['mechanical_status'] = 'Overload'
            elif load > 85:
                health_score -= 12
                recommendations.append('⚙️ High load detected.')
                analysis['mechanical_status'] = 'High Load'
        
        if 'noise_level' in self.data and self.data['noise_level'] is not None:
            noise = self.data['noise_level']
            thresholds = {'motor': 80, 'pump': 75, 'compressor': 90, 'hvac': 70}
            threshold = thresholds.get(self.equipment_type, 80)
            if noise > threshold + 15:
                health_score -= 18
                critical_issues.append(f'🔊 CRITICAL: Noise at {noise}dB!')
        
        if 'oil_quality' in self.data and self.data['oil_quality'] is not None:
            oil = self.data['oil_quality']
            if oil < 40:
                health_score -= 25
                critical_issues.append('🛢️ CRITICAL: Oil quality critical!')
                analysis['mechanical_status'] = 'Critical'
            elif oil < 60:
                health_score -= 15
                recommendations.append('🛢️ Oil quality poor.')
        
        if 'efficiency_rating' in self.data and self.data['efficiency_rating'] is not None:
            eff = self.data['efficiency_rating']
            if eff < 60:
                health_score -= 18
                recommendations.append(f'📉 Efficiency at {eff}% is poor.')
        
        return health_score, analysis
    
    # ==================== HELPER METHODS ====================
    
    def calculate_risk_level(self, health_score):
        if health_score >= 85:
            return 'low'
        elif health_score >= 70:
            return 'medium'
        elif health_score >= 50:
            return 'high'
        else:
            return 'critical'
    
    def calculate_remaining_life(self, health_score):
        base_life_days = {
            'laptop': 1825, 'phone': 1095, 'tablet': 1460, 'desktop': 2555,
            'industrial_machine': 5475, 'motor': 7300, 'pump': 5475,
            'compressor': 5475, 'hvac': 5475
        }
        base_life = base_life_days.get(self.equipment_type, 1825)
        return int(base_life * (health_score / 100))
    
    def calculate_maintenance_days(self, health_score, risk_level):
        if risk_level == 'critical':
            return 3
        elif risk_level == 'high':
            return 7
        elif health_score < 75:
            return 30
        elif health_score < 85:
            return 60
        else:
            return 90
    
    def get_overall_condition(self, health_score):
        if health_score >= 90:
            return 'Excellent'
        elif health_score >= 75:
            return 'Good'
        elif health_score >= 60:
            return 'Fair'
        elif health_score >= 40:
            return 'Poor'
        else:
            return 'Critical'


def main():
    """Main function - entry point"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Create analyzer
        analyzer = EquipmentAnalyzer()
        
        # Perform analysis
        prediction = analyzer.analyze(input_data)
        
        # Return result
        result = {
            'success': True,
            'prediction': prediction
        }
        
        print(json.dumps(result))
        sys.exit(0)
        
    except json.JSONDecodeError as e:
        error_result = {
            'success': False,
            'error': f'Invalid JSON input: {str(e)}'
        }
        print(json.dumps(error_result))
        sys.exit(1)
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': f'Analysis failed: {str(e)}'
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == '__main__':
    main()