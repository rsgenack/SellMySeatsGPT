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

// Simple API handler for Vercel
export default async function handler(req, res) {
  console.log('Received request:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  try {
    // Basic health check response
    res.status(200).json({
      status: 'ok',
      message: 'API is running',
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_REGION: process.env.VERCEL_REGION
      }
    });
  } catch (error) {
    console.error('Error handling request:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
} 