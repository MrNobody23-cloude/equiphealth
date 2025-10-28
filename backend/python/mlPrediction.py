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
LABEL_ENCODER_PATH = os.path.join(MODEL_DIR, 'label_encoder.pkl')
METADATA_PATH = os.path.join(MODEL_DIR, 'model_metadata.json')


class EquipmentAnalyzer:
    """Equipment health analyzer with ML model loading and rule-based fallback"""
    
    def __init__(self):
        self.equipment_type = None
        self.data = None
        self.use_ml = False
        self.model = None
        self.scaler = None
        self.feature_names = None
        self.label_encoder = None
        self.equipment_type_mapping = None
        
        # Try to load ML model
        if ML_AVAILABLE:
            self.load_ml_model()
    
    def load_ml_model(self):
        """Load trained ML model from .pkl files"""
        try:
            # Check if all required files exist
            required_files = [
                MODEL_PATH, SCALER_PATH, FEATURE_NAMES_PATH, LABEL_ENCODER_PATH
            ]
            
            if not all(os.path.exists(f) for f in required_files):
                print("⚠️  ML model files not found. Please train the model first:", file=sys.stderr)
                print(f"   Run: python3 {os.path.join(SCRIPT_DIR, 'train_model.py')}", file=sys.stderr)
                self.use_ml = False
                return
            
            # Load model components
            self.model = joblib.load(MODEL_PATH)
            self.scaler = joblib.load(SCALER_PATH)
            self.feature_names = joblib.load(FEATURE_NAMES_PATH)
            self.label_encoder = joblib.load(LABEL_ENCODER_PATH)
            
            # Load metadata for equipment type mapping
            if os.path.exists(METADATA_PATH):
                with open(METADATA_PATH, 'r') as f:
                    metadata = json.load(f)
                    self.equipment_type_mapping = metadata.get('equipment_type_mapping', {})
            
            self.use_ml = True
            print("✅ ML model loaded successfully", file=sys.stderr)
            print(f"   Model type: RandomForestRegressor", file=sys.stderr)
            print(f"   Features: {len(self.feature_names)}", file=sys.stderr)
            
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
                import traceback
                traceback.print_exc(file=sys.stderr)
        
        # Fallback to rule-based analysis
        return self.rule_based_analyze(data)
    
    def ml_predict(self, data):
        """ML-based prediction using trained model"""
        print("🤖 Using ML model for prediction", file=sys.stderr)
        
        # Prepare features in exact order
        features = self.prepare_features(data)
        
        print(f"   Prepared features: {features}", file=sys.stderr)
        
        # Scale features
        features_scaled = self.scaler.transform([features])
        
        # Predict health score
        predicted_health = self.model.predict(features_scaled)[0]
        predicted_health = float(np.clip(predicted_health, 0, 100))
        
        print(f"   Predicted health score: {predicted_health:.2f}", file=sys.stderr)
        
        # Calculate other metrics based on predicted health
        risk_level = self.calculate_risk_level(predicted_health)
        remaining_life_days = self.calculate_remaining_life(predicted_health)
        maintenance_days = self.calculate_maintenance_days(predicted_health, risk_level)
        
        # Get recommendations based on sensor data and health score
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
        """Prepare features for ML model in exact training order"""
        
        # Encode equipment type using saved label encoder
        eq_type = data.get('equipment_type', 'laptop')
        try:
            if self.label_encoder is not None:
                # Use the trained label encoder
                eq_type_encoded = self.label_encoder.transform([eq_type])[0]
            elif self.equipment_type_mapping is not None:
                # Use mapping from metadata
                eq_type_encoded = self.equipment_type_mapping.get(eq_type, 0)
            else:
                # Fallback
                eq_type_encoded = 0
        except ValueError:
            # Unknown equipment type
            print(f"⚠️  Unknown equipment type: {eq_type}, using default", file=sys.stderr)
            eq_type_encoded = 0
        
        # Extract features in exact order as training
        features = [
            float(eq_type_encoded),
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
        
        # Critical sensor-based recommendations
        if 'battery_health' in data and data['battery_health'] is not None:
            bh = data['battery_health']
            if bh < 40:
                recommendations.append('🔋 CRITICAL: Battery health critically low! Replace immediately.')
            elif bh < 60:
                recommendations.append('🔋 Battery health poor. Plan for replacement soon.')
            elif bh < 80:
                recommendations.append('🔋 Battery degrading. Monitor closely.')
        
        if 'thermal_throttling' in data and data['thermal_throttling'] is not None:
            tt = data['thermal_throttling']
            if tt > 30:
                recommendations.append('🌡️ CRITICAL: Severe thermal throttling detected! Clean cooling system immediately.')
            elif tt > 15:
                recommendations.append('🌡️ High thermal throttling. Improve cooling and check thermal paste.')
            elif tt > 5:
                recommendations.append('🌡️ Moderate thermal throttling detected. Monitor temperatures.')
        
        if 'cpu_usage' in data and data['cpu_usage'] is not None:
            cpu = data['cpu_usage']
            if cpu > 95:
                recommendations.append('💻 CRITICAL: CPU at maximum load constantly! Check for runaway processes.')
            elif cpu > 80:
                recommendations.append('💻 High CPU usage detected. Review running applications.')
        
        if 'load_percentage' in data and data['load_percentage'] is not None:
            load = data['load_percentage']
            if load > 95:
                recommendations.append('⚙️ CRITICAL: Equipment overloaded! Reduce load immediately to prevent damage.')
            elif load > 85:
                recommendations.append('⚙️ High load detected. Consider load balancing or capacity increase.')
        
        if 'oil_quality' in data and data['oil_quality'] is not None:
            oil = data['oil_quality']
            if oil < 40:
                recommendations.append('🛢️ CRITICAL: Oil quality critical! Change oil immediately.')
            elif oil < 60:
                recommendations.append('🛢️ Oil quality poor. Schedule oil change soon.')
            elif oil < 80:
                recommendations.append('🛢️ Oil quality degrading. Plan for oil change.')
        
        if 'noise_level' in data and data['noise_level'] is not None:
            noise = data['noise_level']
            eq_type = data.get('equipment_type', 'unknown')
            thresholds = {'motor': 80, 'pump': 75, 'compressor': 90, 'hvac': 70}
            threshold = thresholds.get(eq_type, 80)
            
            if noise > threshold + 15:
                recommendations.append(f'🔊 CRITICAL: Noise at {noise}dB exceeds safe limits! Inspect for mechanical failure.')
            elif noise > threshold:
                recommendations.append(f'🔊 Elevated noise level at {noise}dB. Inspect bearings and alignment.')
        
        if 'fan_speed' in data and data['fan_speed'] is not None:
            fs = data['fan_speed']
            if fs > 4500:
                recommendations.append('🌀 Fan running at maximum speed! Check for thermal issues.')
            elif fs < 500 and fs > 0:
                recommendations.append('🌀 CRITICAL: Fan speed too low! Fan may be failing.')
        
        if 'efficiency_rating' in data and data['efficiency_rating'] is not None:
            eff = data['efficiency_rating']
            if eff < 60:
                recommendations.append(f'📉 CRITICAL: Efficiency at {eff}% is critically low! Investigate immediately.')
            elif eff < 75:
                recommendations.append(f'📉 Efficiency at {eff}% is below optimal. Maintenance required.')
        
        # Health-based recommendations
        if health_score < 40:
            recommendations.append('🚨 URGENT: Equipment health critical! Schedule immediate inspection.')
        elif health_score < 50:
            recommendations.append('🚨 Equipment health poor. Schedule maintenance within 3 days.')
        elif health_score < 70:
            recommendations.append('⚠️ Schedule preventive maintenance within the next week.')
        elif health_score < 85:
            recommendations.append('📅 Plan preventive maintenance within 30 days.')
        else:
            if not recommendations:  # Only add if no other recommendations
                recommendations.append('✅ Equipment health is good. Continue regular monitoring.')
        
        return recommendations
    
    def create_analysis_summary(self, data, health_score):
        """Create detailed analysis summary"""
        analysis = {
            'power_status': 'Good',
            'thermal_status': 'Good',
            'mechanical_status': 'N/A',
            'performance_status': 'Good',
            'battery_status': 'N/A',
            'overall_condition': self.get_overall_condition(health_score)
        }
        
        # Battery status
        if 'battery_health' in data and data['battery_health'] is not None:
            bh = data['battery_health']
            if bh < 40:
                analysis['battery_status'] = 'Critical'
            elif bh < 60:
                analysis['battery_status'] = 'Poor'
            elif bh < 80:
                analysis['battery_status'] = 'Fair'
            else:
                analysis['battery_status'] = 'Good'
        
        # Thermal status
        if 'thermal_throttling' in data and data['thermal_throttling'] is not None:
            tt = data['thermal_throttling']
            if tt > 30:
                analysis['thermal_status'] = 'Critical'
            elif tt > 15:
                analysis['thermal_status'] = 'High'
            elif tt > 5:
                analysis['thermal_status'] = 'Moderate'
            else:
                analysis['thermal_status'] = 'Good'
        
        # Mechanical status (for industrial equipment)
        if 'load_percentage' in data and data['load_percentage'] is not None:
            load = data['load_percentage']
            if load > 95:
                analysis['mechanical_status'] = 'Overload'
            elif load > 85:
                analysis['mechanical_status'] = 'High Load'
            else:
                analysis['mechanical_status'] = 'Good'
        
        if 'oil_quality' in data and data['oil_quality'] is not None:
            oil = data['oil_quality']
            if oil < 40:
                analysis['mechanical_status'] = 'Critical'
            elif oil < 60 and analysis['mechanical_status'] != 'Critical':
                analysis['mechanical_status'] = 'Poor'
        
        # Performance status
        if 'cpu_usage' in data and data['cpu_usage'] is not None:
            cpu = data['cpu_usage']
            if cpu > 95:
                analysis['performance_status'] = 'Critical'
            elif cpu > 80:
                analysis['performance_status'] = 'High Load'
            else:
                analysis['performance_status'] = 'Good'
        
        if 'efficiency_rating' in data and data['efficiency_rating'] is not None:
            eff = data['efficiency_rating']
            if eff < 60:
                analysis['performance_status'] = 'Critical'
            elif eff < 75:
                analysis['performance_status'] = 'Poor'
        
        return analysis
    
    def rule_based_analyze(self, data):
        """Rule-based analysis (fallback when ML is not available)"""
        print("📊 Using rule-based analysis (ML model not available)", file=sys.stderr)
        
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
        
        # Operating hours analysis
        if 'operating_hours' in data and data['operating_hours'] is not None:
            hours = data['operating_hours']
            if hours > 40000:
                health_score -= 30
                critical_issues.append('⏱️ Operating hours exceed maximum lifespan')
            elif hours > 20000:
                health_score -= 15
                warnings.append('⏱️ Operating hours very high')
            elif hours > 10000:
                health_score -= 5
                
        # Computer equipment analysis
        if self.equipment_type in ['laptop', 'phone', 'tablet', 'desktop']:
            # Battery
            if 'battery_health' in data and data['battery_health'] is not None:
                bh = data['battery_health']
                if bh < 40:
                    health_score -= 30
                    critical_issues.append('🔋 Battery critically low')
                    analysis['battery_status'] = 'Critical'
                elif bh < 60:
                    health_score -= 15
                    warnings.append('🔋 Battery poor')
                    analysis['battery_status'] = 'Poor'
            
            # CPU
            if 'cpu_usage' in data and data['cpu_usage'] is not None:
                if data['cpu_usage'] > 95:
                    health_score -= 15
                    critical_issues.append('💻 CPU at maximum')
            
            # Thermal
            if 'thermal_throttling' in data and data['thermal_throttling'] is not None:
                tt = data['thermal_throttling']
                if tt > 30:
                    health_score -= 25
                    critical_issues.append('🌡️ Severe thermal throttling')
                    analysis['thermal_status'] = 'Critical'
                elif tt > 15:
                    health_score -= 15
                    warnings.append('🌡️ High thermal throttling')
        
        # Industrial equipment analysis
        elif self.equipment_type in ['industrial_machine', 'motor', 'pump', 'compressor', 'hvac']:
            # Load
            if 'load_percentage' in data and data['load_percentage'] is not None:
                load = data['load_percentage']
                if load > 95:
                    health_score -= 20
                    critical_issues.append('⚙️ Equipment overloaded')
                    analysis['mechanical_status'] = 'Overload'
            
            # Oil
            if 'oil_quality' in data and data['oil_quality'] is not None:
                oil = data['oil_quality']
                if oil < 40:
                    health_score -= 25
                    critical_issues.append('🛢️ Oil quality critical')
            
            # Noise
            if 'noise_level' in data and data['noise_level'] is not None:
                noise = data['noise_level']
                if noise > 95:
                    health_score -= 18
                    critical_issues.append(f'🔊 Noise at {noise}dB excessive')
        
        health_score = max(0.0, min(100.0, health_score))
        risk_level = self.calculate_risk_level(health_score)
        remaining_life_days = self.calculate_remaining_life(health_score)
        maintenance_days = self.calculate_maintenance_days(health_score, risk_level)
        analysis['overall_condition'] = self.get_overall_condition(health_score)
        
        # Combine all recommendations
        recommendations = critical_issues + warnings
        if not recommendations:
            recommendations.append('✅ Equipment operating within normal parameters')
        
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
    
    # ==================== HELPER METHODS ====================
    
    def calculate_risk_level(self, health_score):
        """Calculate risk level from health score"""
        if health_score >= 85:
            return 'low'
        elif health_score >= 70:
            return 'medium'
        elif health_score >= 50:
            return 'high'
        else:
            return 'critical'
    
    def calculate_remaining_life(self, health_score):
        """Estimate remaining life in days"""
        base_life_days = {
            'laptop': 1825, 'phone': 1095, 'tablet': 1460, 'desktop': 2555,
            'industrial_machine': 5475, 'motor': 7300, 'pump': 5475,
            'compressor': 5475, 'hvac': 5475
        }
        base_life = base_life_days.get(self.equipment_type, 1825)
        return int(base_life * (health_score / 100))
    
    def calculate_maintenance_days(self, health_score, risk_level):
        """Calculate days until maintenance needed"""
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
        """Get overall condition description"""
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
        
        print(f"Received data: {json.dumps(input_data, indent=2)}", file=sys.stderr)
        
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