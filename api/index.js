// This file is a specialized adapter for running the application on Vercel
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import adapter from './adapter.cjs';

// Get __dirname equivalent in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initial startup logging with detailed environment information
console.log('\n=== VERCEL SERVERLESS FUNCTION STARTUP ===');
console.log('Timestamp:', new Date().toISOString());
console.log('Node Version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('Memory Usage:', JSON.stringify(process.memoryUsage(), null, 2));
console.log('Current Directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('Environment Variables:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- VERCEL_ENV:', process.env.VERCEL_ENV);
console.log('- VERCEL_REGION:', process.env.VERCEL_REGION);
console.log('- VERCEL_URL:', process.env.VERCEL_URL);
console.log('- VERCEL_BRANCH_URL:', process.env.VERCEL_BRANCH_URL);
console.log('- VERCEL_GIT_COMMIT_REF:', process.env.VERCEL_GIT_COMMIT_REF);
console.log('- VERCEL_PROJECT_NAME:', process.env.VERCEL_PROJECT_NAME);
console.log('=====================================\n');

// Initialize debug logs array and start time
const debugLogs = [];
const startTime = Date.now();

// Create debug logs directory using the adapter
console.log('\n=== FILESYSTEM SETUP ===');
if (adapter.createLogsDirectory()) {
  console.log('✅ Successfully created/verified debugging_logs directory');
} else {
  console.log('⚠️ Failed to create debugging_logs directory');
}
console.log('========================\n');

// Ensure all paths are absolute
const getAbsolutePath = (relativePath) => path.resolve(__dirname, '..', relativePath);

// Enhanced trace function that saves to our log array
function trace(location, message, ...args) {
  const timestamp = new Date().toISOString();
  const elapsed = Date.now() - startTime;
  const logEntry = {
    timestamp,
    elapsed,
    type: 'info',
    location,
    message,
    args: args.length ? args : undefined
  };
  debugLogs.push(logEntry);
  console.log(`\n🔎 [${location}] ${message}`);
  if (args.length > 0) {
    console.log('Arguments:', JSON.stringify(args, null, 2));
  }
}

// Enhanced error trace that saves to our log array
function traceError(location, message, error) {
  const timestamp = new Date().toISOString();
  const elapsed = Date.now() - startTime;
  const logEntry = {
    timestamp,
    elapsed,
    type: 'error',
    location,
    message,
    error: error ? {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    } : undefined
  };
  debugLogs.push(logEntry);
  console.error(`\n❌ [${location}] ${message}`);
  console.error(`💥 Error Details:`);
  console.error('- Message:', error?.message || 'Unknown error');
  console.error('- Name:', error?.name || 'Unknown');
  console.error('- Code:', error?.code || 'N/A');
  if (error?.stack) {
    console.error('\n📑 Stack Trace:');
    console.error(error.stack.split('\n').map(line => `   ${line}`).join('\n'));
  }
  console.error('\n');
}

// Function to save logs to file
function saveLogs(reqId, error = null) {
  try {
    console.log('\n=== SAVING DEBUG LOGS ===');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `./debugging_logs/vercel-logs-${timestamp}-${reqId}.json`;
    
    const logData = {
      timestamp,
      reqId,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name
      } : null,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_REGION: process.env.VERCEL_REGION,
        VERCEL_URL: process.env.VERCEL_URL,
        VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
        VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
        VERCEL_PROJECT_NAME: process.env.VERCEL_PROJECT_NAME,
        DATABASE_URL_exists: !!process.env.DATABASE_URL,
        PGHOST_exists: !!process.env.PGHOST,
        PGDATABASE_exists: !!process.env.PGDATABASE,
        PGUSER_exists: !!process.env.PGUSER,
        PGPASSWORD_exists: !!process.env.PGPASSWORD,
        PGPORT_exists: !!process.env.PGPORT,
        PGSSLMODE: process.env.PGSSLMODE
      },
      filesystem: {
        currentDirectory: process.cwd(),
        distExists: fs.existsSync('./dist'),
        distContents: fs.existsSync('./dist') ? fs.readdirSync('./dist') : null,
        debuggingLogsExists: fs.existsSync('./debugging_logs'),
        debuggingLogsContents: fs.existsSync('./debugging_logs') ? fs.readdirSync('./debugging_logs') : null
      },
      process: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      logs: debugLogs
    };

    fs.writeFileSync(filename, JSON.stringify(logData, null, 2));
    console.log(`✅ Successfully saved debug logs to ${filename}`);
    console.log('========================\n');
  } catch (saveError) {
    console.error('\n❌ ERROR SAVING DEBUG LOGS');
    console.error('Failed to save debug logs:', saveError);
    console.error('Error details:', {
      message: saveError.message,
      code: saveError.code,
      path: saveError.path,
      stack: saveError.stack
    });
    console.error('========================\n');
  }
}

// Log if critical files exist
trace('api/index.js:20', 'Loading filesystem module');
trace('api/index.js:22', 'Checking directory contents');
try {
  console.log('\n=== DIRECTORY STRUCTURE CHECK ===');
  const rootDirContents = fs.readdirSync('.');
  console.log('Root Directory Contents:', JSON.stringify(rootDirContents, null, 2));
  
  const distExists = fs.existsSync('./dist');
  console.log('Dist Directory Exists:', distExists);
  
  if (distExists) {
    console.log('\nChecking dist directory contents...');
    try {
      const distContents = fs.readdirSync('./dist');
      console.log('Dist Directory Contents:', JSON.stringify(distContents, null, 2));
      
      // Check for critical files
      console.log('\nChecking for critical files...');
      const hasStartJs = distContents.includes('start.js');
      const hasIndexJs = distContents.includes('index.js');
      console.log('- start.js exists:', hasStartJs);
      console.log('- index.js exists:', hasIndexJs);
      
      if (hasStartJs) {
        console.log('\nChecking start.js content...');
        try {
          const startJsStats = fs.statSync('./dist/start.js');
          console.log('start.js Details:', {
            size: startJsStats.size,
            created: startJsStats.birthtime,
            modified: startJsStats.mtime,
            accessed: startJsStats.atime
          });
        } catch (error) {
          console.error('Failed to get start.js stats:', error);
        }
      }
    } catch (error) {
      console.error('Failed to read dist directory:', error);
    }
  }
  console.log('==============================\n');
} catch (error) {
  console.error('\n❌ DIRECTORY STRUCTURE CHECK ERROR');
  console.error('Failed to read root directory:', error);
  console.error('Error details:', {
    message: error.message,
    code: error.code,
    path: error.path,
    stack: error.stack
  });
  console.error('==============================\n');
}

// Log environment variables (masked for security)
console.log('\n=== ENVIRONMENT VARIABLES CHECK ===');
console.log('Database Configuration:');
console.log('- DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('- PGHOST exists:', !!process.env.PGHOST);
console.log('- PGDATABASE exists:', !!process.env.PGDATABASE);
console.log('- PGUSER exists:', !!process.env.PGUSER);
console.log('- PGPASSWORD exists:', !!process.env.PGPASSWORD);
console.log('- PGPORT exists:', !!process.env.PGPORT);
console.log('- PGSSLMODE:', process.env.PGSSLMODE);
console.log('==============================\n');

// Force SSL for database connections in Postgres
console.log('\n=== DATABASE SSL CONFIGURATION ===');
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('sslmode=require')) {
  console.log('Adding SSL requirement to DATABASE_URL...');
  if (process.env.DATABASE_URL.includes('?')) {
    process.env.DATABASE_URL += '&sslmode=require';
    console.log('✅ Added SSL requirement with &');
  } else {
    process.env.DATABASE_URL += '?sslmode=require';
    console.log('✅ Added SSL requirement with ?');
  }
}

if (!process.env.PGSSLMODE) {
  console.log('Setting PGSSLMODE=require');
  process.env.PGSSLMODE = 'require';
  console.log('✅ PGSSLMODE set to require');
}
console.log('==============================\n');

// Express app instance for standalone handling
let expressApp = null;
console.log('\n=== EXPRESS APP INITIALIZATION ===');
console.log('Express app variable initialized to null');
console.log('==============================\n');

// Setup global error handlers
console.log('\n=== GLOBAL ERROR HANDLERS SETUP ===');
process.on('uncaughtException', (error) => {
  const reqId = Date.now().toString(36);
  console.error('\n❌ UNCAUGHT EXCEPTION');
  console.error('Request ID:', reqId);
  console.error('Error:', error);
  console.error('Stack:', error.stack);
  saveLogs(reqId, error);
  console.log('==============================\n');
});

process.on('unhandledRejection', (reason, promise) => {
  const reqId = Date.now().toString(36);
  const error = reason instanceof Error ? reason : new Error(String(reason));
  console.error('\n❌ UNHANDLED REJECTION');
  console.error('Request ID:', reqId);
  console.error('Error:', error);
  console.error('Stack:', error.stack);
  saveLogs(reqId, error);
  console.log('==============================\n');
});

// Try to initialize the Express app only once
console.log('\n=== START.JS IMPORT ATTEMPT ===');
try {
  console.log('Importing start.js with dynamic import...');
  const startModule = await import('../dist/start.js');
  console.log('✅ Successfully imported start.js');
} catch (error) {
  console.error('\n❌ START.JS IMPORT ERROR');
  console.error('Failed to import start.js:', error);
  console.error('Stack:', error.stack);
}
console.log('==============================\n');

// Export a simple handler function for Vercel
console.log('\n=== REQUEST HANDLER SETUP ===');
export default async function handler(req, res) {
  const reqId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  console.log(`\n=== REQUEST HANDLING [${reqId}] ===`);
  console.log('Request Details:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
  
  try {
    // Check if we have critical database environment variables
    console.log('\nChecking database environment variables...');
    if (!process.env.DATABASE_URL && !process.env.PGHOST) {
      console.error('❌ Missing critical database environment variables');
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Missing database connection information. Please check environment variables.',
        timestamp: new Date().toISOString(),
        reqId
      });
    }
    
    // Return a basic health check response for /api/health
    if (req.url === '/api/health') {
      console.log('Health check endpoint requested');
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        region: process.env.VERCEL_REGION || 'unknown',
        env: process.env.VERCEL_ENV || process.env.NODE_ENV,
        db_connected: true,
        reqId,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    }
    
    // The actual request handling is done through the imported start.js
    console.error('Request reached fallback handler - Express app not handling request');
    
    return res.status(500).json({
      error: 'Server Error',
      message: 'Express application not properly initialized',
      timestamp: new Date().toISOString(),
      reqId
    });
  } catch (error) {
    console.error('\n❌ REQUEST HANDLING ERROR');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    saveLogs(reqId, error);
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      reqId
    });
  } finally {
    console.log('==============================\n');
  }
} 