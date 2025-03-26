// CommonJS Vercel Adapter
const fs = require('fs');
const path = require('path');

// Initialize logging
console.log('\n=== VERCEL SERVERLESS FUNCTION STARTUP ===');
console.log('Timestamp:', new Date().toISOString());
console.log('Node Version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('Memory Usage:', JSON.stringify(process.memoryUsage(), null, 2));
console.log('Current Directory:', process.cwd());

// Create debug logs directory
try {
  if (!fs.existsSync('debugging_logs')) {
    fs.mkdirSync('debugging_logs', { recursive: true });
    console.log('✅ Created debugging_logs directory');
  }
} catch (error) {
  console.error('Failed to create debugging_logs directory:', error);
}

// Helper functions
function writeLog(filename, data) {
  try {
    const logPath = path.join('debugging_logs', filename);
    fs.writeFileSync(logPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to write log:', error);
    return false;
  }
}

function loadEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      return true;
    }
  } catch (error) {
    console.error('Error loading .env file:', error);
  }
  return false;
}

// Export functions for ES module usage
module.exports = {
  writeLog,
  loadEnvFile,
  createLogsDirectory: () => {
    try {
      if (!fs.existsSync('debugging_logs')) {
        fs.mkdirSync('debugging_logs', { recursive: true });
      }
      return true;
    } catch (error) {
      console.error('Failed to create debugging_logs directory:', error);
      return false;
    }
  }
}; 