#!/usr/bin/env python3
"""
Equipment Health Prediction Model Training
Trains ML models and saves them as .pkl files
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import warnings

warnings.filterwarnings('ignore')

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(SCRIPT_DIR, 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

MODEL_PATH = os.path.join(MODEL_DIR, 'health_predictor.pkl')
SCALER_PATH = os.path.join(MODEL_DIR, 'scaler.pkl')
FEATURE_NAMES_PATH = os.path.join(MODEL_DIR, 'feature_names.pkl')
LABEL_ENCODER_PATH = os.path.join(MODEL_DIR, 'label_encoder.pkl')
METADATA_PATH = os.path.join(MODEL_DIR, 'model_metadata.json')


class EquipmentMLTrainer:
    """Train ML models for equipment health prediction"""
    
    def __init__(self):
        self.model = None
        self.scaler = None
        self.feature_names = None
        self.label_encoder = None
        
    def generate_synthetic_data(self, n_samples=10000):
        """Generate synthetic training data"""
        print(f"\n{'='*60}")
        print(f"Generating {n_samples} synthetic training samples...")
        print(f"{'='*60}\n")
        
        np.random.seed(42)
        
        equipment_types = ['laptop', 'phone', 'tablet', 'desktop', 
                          'industrial_machine', 'motor', 'pump', 'compressor', 'hvac']
        
        data = []
        
        for i in range(n_samples):
            eq_type = np.random.choice(equipment_types)
            
            # Base features
            operating_hours = np.random.randint(100, 50000)
            
            # Computer equipment features
            if eq_type in ['laptop', 'phone', 'tablet', 'desktop']:
                battery_health = np.random.uniform(20, 100)
                cpu_usage = np.random.uniform(10, 100)
                ram_usage = np.random.uniform(1, 32)
                thermal_throttling = np.random.uniform(0, 50)
                gpu_usage = np.random.uniform(0, 100)
                fan_speed = np.random.uniform(800, 5000)
                power_consumption = np.random.uniform(10, 150)
                screen_brightness = np.random.uniform(20, 100)
                network_activity = np.random.uniform(0, 1000)
                
                # Industrial features set to neutral/N/A
                load_percentage = 0
                noise_level = 0
                rotation_speed = 0
                current_draw = 0
                oil_quality = 100
                efficiency_rating = 100
                
            # Industrial equipment features
            else:
                load_percentage = np.random.uniform(20, 120)
                noise_level = np.random.uniform(40, 110)
                rotation_speed = np.random.uniform(500, 4000)
                current_draw = np.random.uniform(10, 100)
                oil_quality = np.random.uniform(30, 100)
                efficiency_rating = np.random.uniform(50, 100)
                
                # Computer features set to neutral/N/A
                battery_health = 100
                cpu_usage = 50
                ram_usage = 8
                thermal_throttling = 0
                gpu_usage = 0
                fan_speed = 2000
                power_consumption = 50
                screen_brightness = 50
                network_activity = 0
            
            # Calculate health score based on risk factors
            health_score = 100.0
            
            # Operating hours penalty
            if operating_hours > 40000:
                health_score -= 30
            elif operating_hours > 20000:
                health_score -= 15
            elif operating_hours > 10000:
                health_score -= 5
            
            # Computer-specific penalties
            if eq_type in ['laptop', 'phone', 'tablet', 'desktop']:
                if battery_health < 40:
                    health_score -= 30
                elif battery_health < 60:
                    health_score -= 15
                elif battery_health < 80:
                    health_score -= 8
                
                if cpu_usage > 95:
                    health_score -= 15
                elif cpu_usage > 80:
                    health_score -= 8
                
                if thermal_throttling > 30:
                    health_score -= 25
                elif thermal_throttling > 15:
                    health_score -= 12
                
                if fan_speed > 4500:
                    health_score -= 10
                elif fan_speed < 500:
                    health_score -= 15
                
                ram_percentage = (ram_usage / 16) * 100
                if ram_percentage > 90:
                    health_score -= 15
                elif ram_percentage > 75:
                    health_score -= 8
            
            # Industrial-specific penalties
            else:
                if load_percentage > 95:
                    health_score -= 25
                elif load_percentage > 85:
                    health_score -= 15
                
                if noise_level > 100:
                    health_score -= 20
                elif noise_level > 85:
                    health_score -= 10
                
                if oil_quality < 40:
                    health_score -= 25
                elif oil_quality < 60:
                    health_score -= 15
                
                if efficiency_rating < 60:
                    health_score -= 18
                elif efficiency_rating < 75:
                    health_score -= 10
                
                if current_draw > 80:
                    health_score -= 15
            
            # Add some random noise
            health_score += np.random.normal(0, 5)
            health_score = np.clip(health_score, 0, 100)
            
            data.append({
                'equipment_type': eq_type,
                'operating_hours': operating_hours,
                'battery_health': battery_health,
                'cpu_usage': cpu_usage,
                'ram_usage': ram_usage,
                'thermal_throttling': thermal_throttling,
                'gpu_usage': gpu_usage,
                'fan_speed': fan_speed,
                'power_consumption': power_consumption,
                'screen_brightness': screen_brightness,
                'network_activity': network_activity,
                'load_percentage': load_percentage,
                'noise_level': noise_level,
                'rotation_speed': rotation_speed,
                'current_draw': current_draw,
                'oil_quality': oil_quality,
                'efficiency_rating': efficiency_rating,
                'health_score': health_score
            })
        
        df = pd.DataFrame(data)
        
        print(f"✅ Generated {len(df)} samples")
        print(f"\nEquipment Type Distribution:")
        print(df['equipment_type'].value_counts())
        print(f"\nHealth Score Statistics:")
        print(df['health_score'].describe())
        
        return df
    
    def prepare_features(self, df):
        """Prepare features for training"""
        print(f"\n{'='*60}")
        print("Preparing Features...")
        print(f"{'='*60}\n")
        
        # Encode equipment type with LabelEncoder
        self.label_encoder = LabelEncoder()
        df['equipment_type_encoded'] = self.label_encoder.fit_transform(df['equipment_type'])
        
        print(f"Equipment Type Encoding Mapping:")
        for idx, eq_type in enumerate(self.label_encoder.classes_):
            print(f"  {eq_type}: {idx}")
        
        # Define feature columns in exact order
        feature_cols = [
            'equipment_type_encoded',
            'operating_hours',
            'battery_health',
            'cpu_usage',
            'ram_usage',
            'thermal_throttling',
            'gpu_usage',
            'fan_speed',
            'power_consumption',
            'screen_brightness',
            'network_activity',
            'load_percentage',
            'noise_level',
            'rotation_speed',
            'current_draw',
            'oil_quality',
            'efficiency_rating'
        ]
        
        X = df[feature_cols].copy()
        y = df['health_score'].copy()
        
        self.feature_names = feature_cols
        
        print(f"\n✅ Features prepared: {len(feature_cols)} features")
        print(f"   Feature order: {feature_cols}")
        
        return X, y
    
    def train_model(self, X, y):
        """Train the ML model"""
        print(f"\n{'='*60}")
        print("Training Machine Learning Model...")
        print(f"{'='*60}\n")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        print(f"Training set: {len(X_train)} samples")
        print(f"Test set: {len(X_test)} samples\n")
        
        # Scale features
        print("Scaling features...")
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train Random Forest model
        print("Training Random Forest Regressor...")
        self.model = RandomForestRegressor(
            n_estimators=200,
            max_depth=20,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
            verbose=0
        )
        
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        print("\n" + "="*60)
        print("Model Evaluation")
        print("="*60 + "\n")
        
        # Training predictions
        y_train_pred = self.model.predict(X_train_scaled)
        train_rmse = np.sqrt(mean_squared_error(y_train, y_train_pred))
        train_r2 = r2_score(y_train, y_train_pred)
        train_mae = mean_absolute_error(y_train, y_train_pred)
        
        # Test predictions
        y_test_pred = self.model.predict(X_test_scaled)
        test_rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))
        test_r2 = r2_score(y_test, y_test_pred)
        test_mae = mean_absolute_error(y_test, y_test_pred)
        
        print(f"Training Metrics:")
        print(f"  RMSE: {train_rmse:.2f}")
        print(f"  R² Score: {train_r2:.4f}")
        print(f"  MAE: {train_mae:.2f}\n")
        
        print(f"Test Metrics:")
        print(f"  RMSE: {test_rmse:.2f}")
        print(f"  R² Score: {test_r2:.4f}")
        print(f"  MAE: {test_mae:.2f}\n")
        
        # Feature importance
        print("Top 10 Important Features:")
        feature_importance = pd.DataFrame({
            'feature': self.feature_names,
            'importance': self.model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        print(feature_importance.head(10).to_string(index=False))
        
        # Cross-validation
        print("\nPerforming 5-fold cross-validation...")
        cv_scores = cross_val_score(
            self.model, X_train_scaled, y_train, 
            cv=5, scoring='r2', n_jobs=-1
        )
        print(f"CV R² Scores: {cv_scores}")
        print(f"Mean CV R² Score: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
        
        return {
            'train_rmse': float(train_rmse),
            'train_r2': float(train_r2),
            'train_mae': float(train_mae),
            'test_rmse': float(test_rmse),
            'test_r2': float(test_r2),
            'test_mae': float(test_mae),
            'cv_r2_mean': float(cv_scores.mean()),
            'cv_r2_std': float(cv_scores.std()),
            'feature_importance': feature_importance.to_dict('records')
        }
    
    def save_model(self, metrics):
        """Save trained model and metadata"""
        print(f"\n{'='*60}")
        print("Saving Model...")
        print(f"{'='*60}\n")
        
        # Save model
        joblib.dump(self.model, MODEL_PATH)
        print(f"✅ Model saved: {MODEL_PATH}")
        
        # Save scaler
        joblib.dump(self.scaler, SCALER_PATH)
        print(f"✅ Scaler saved: {SCALER_PATH}")
        
        # Save feature names
        joblib.dump(self.feature_names, FEATURE_NAMES_PATH)
        print(f"✅ Feature names saved: {FEATURE_NAMES_PATH}")
        
        # Save label encoder
        joblib.dump(self.label_encoder, LABEL_ENCODER_PATH)
        print(f"✅ Label encoder saved: {LABEL_ENCODER_PATH}")
        
        # Save metadata
        metadata = {
            'trained_at': datetime.now().isoformat(),
            'model_type': 'RandomForestRegressor',
            'n_features': len(self.feature_names),
            'feature_names': self.feature_names,
            'metrics': metrics,
            'equipment_type_mapping': {
                eq_type: int(idx) 
                for idx, eq_type in enumerate(self.label_encoder.classes_)
            }
        }
        
        with open(METADATA_PATH, 'w') as f:
            json.dump(metadata, f, indent=2)
        print(f"✅ Metadata saved: {METADATA_PATH}")
        
        print(f"\n{'='*60}")
        print("✅ MODEL TRAINING COMPLETED SUCCESSFULLY!")
        print(f"{'='*60}\n")
        
        print("Generated files:")
        print(f"  - {MODEL_PATH}")
        print(f"  - {SCALER_PATH}")
        print(f"  - {FEATURE_NAMES_PATH}")
        print(f"  - {LABEL_ENCODER_PATH}")
        print(f"  - {METADATA_PATH}")
        
        return metadata


def main():
    """Main training function"""
    try:
        print("\n" + "="*60)
        print("EQUIPMENT HEALTH PREDICTION - MODEL TRAINING")
        print("="*60)
        
        trainer = EquipmentMLTrainer()
        
        # Generate synthetic data
        df = trainer.generate_synthetic_data(n_samples=10000)
        
        # Prepare features
        X, y = trainer.prepare_features(df)
        
        # Train model
        metrics = trainer.train_model(X, y)
        
        # Save model
        metadata = trainer.save_model(metrics)
        
        print("\n🎉 Training complete! You can now use the ML model for predictions.\n")
        print("Next step: Run your backend server and the predictions will use ML model!\n")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())