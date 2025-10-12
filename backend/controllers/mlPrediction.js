const { spawn } = require('child_process');
const path = require('path');

/**
 * ML Prediction Controller
 * Calls Python script for all machine learning logic
 */

class MLPredictionController {
  
  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.timeout = parseInt(process.env.PYTHON_TIMEOUT) || 30000;
  }

  /**
   * Main equipment analysis function
   * Calls Python ML script for prediction
   */
  async analyzeEquipment(data) {
    try {
      console.log('🐍 Calling Python ML engine...');
      const result = await this.runPythonScript(data);
      return result;
    } catch (error) {
      console.error('❌ Python ML error:', error.message);
      throw new Error(`ML Analysis Failed: ${error.message}`);
    }
  }

  /**
   * Execute Python prediction script
   */
  runPythonScript(data) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../python/mlPrediction.py');
      
      console.log(`   Script: ${scriptPath}`);
      console.log(`   Python: ${this.pythonPath}`);

      const pythonProcess = spawn(this.pythonPath, [scriptPath]);
      
      let dataString = '';
      let errorString = '';

      // Send input data to Python
      pythonProcess.stdin.write(JSON.stringify(data));
      pythonProcess.stdin.end();

      // Collect output
      pythonProcess.stdout.on('data', (data) => {
        dataString += data.toString();
      });

      // Collect errors
      pythonProcess.stderr.on('data', (data) => {
        errorString += data.toString();
      });

      // Handle process completion
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Python stderr:', errorString);
          reject(new Error(`Python process exited with code ${code}: ${errorString}`));
        } else {
          try {
            const result = JSON.parse(dataString);
            
            if (!result.success) {
              reject(new Error(result.error || 'Python analysis failed'));
            } else {
              resolve(result.prediction);
            }
          } catch (parseError) {
            console.error('Python output:', dataString);
            reject(new Error(`Failed to parse Python output: ${parseError.message}`));
          }
        }
      });

      // Handle process errors
      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });

      // Timeout handling
      const timeoutId = setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Python process timeout'));
      }, this.timeout);

      pythonProcess.on('close', () => {
        clearTimeout(timeoutId);
      });
    });
  }
}

module.exports = new MLPredictionController();