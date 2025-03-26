// ES Module API Entry Point
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import vercelAdapter from './vercel-adapter.cjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize adapter and create logs directory
vercelAdapter.createLogsDirectory();

// Load environment variables
vercelAdapter.loadEnvFile();

// Write initial startup log
vercelAdapter.writeLog('startup.json', {
  timestamp: new Date().toISOString(),
  environment: {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_REGION: process.env.VERCEL_REGION
  },
  runtime: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    memory: process.memoryUsage()
  }
});

// Export the request handler
export default async function handler(req, res) {
  try {
    // Log request details
    vercelAdapter.writeLog(`request-${Date.now()}.json`, {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: req.headers
    });

    // Basic response for now
    res.status(200).json({
      status: 'ok',
      message: 'Vercel API is running',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Log error
    vercelAdapter.writeLog(`error-${Date.now()}.json`, {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack
      }
    });

    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
} 