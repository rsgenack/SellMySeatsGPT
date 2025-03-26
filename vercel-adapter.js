// This file is a specialized adapter for running the application on Vercel
console.log('🔍 [vercel-adapter.js:1] Execution started');
console.log('🚀 [vercel-adapter.js:2] Vercel adapter starting...');
console.log('📁 [vercel-adapter.js:3] Current directory:', process.cwd());
console.log('📦 [vercel-adapter.js:4] NODE_ENV:', process.env.NODE_ENV);
console.log('📦 [vercel-adapter.js:5] VERCEL_ENV:', process.env.VERCEL_ENV);
console.log('📦 [vercel-adapter.js:6] VERCEL_REGION:', process.env.VERCEL_REGION);

// Add at the top of the file, after the initial imports
const debugLogs = [];
const startTime = Date.now();

// Create debug logs directory if it doesn't exist
try {
  if (!fs.existsSync('./debugging_logs')) {
    fs.mkdirSync('./debugging_logs');
  }
} catch (error) {
  console.error('Failed to create debugging_logs directory:', error);
}

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
  console.log(`🔎 [${location}] ${message}`, ...args);
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
  console.error(`❌ [${location}] ${message}`);
  console.error(`💥 [${location}] Error: ${error?.message || 'Unknown error'}`);
  if (error?.stack) {
    console.error(`📑 [${location}] Stack trace:\n${error.stack.split('\n').map(line => `   ${line}`).join('\n')}`);
  }
}

// Function to save logs to file
function saveLogs(reqId, error = null) {
  try {
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
        distContents: fs.existsSync('./dist') ? fs.readdirSync('./dist') : null
      },
      logs: debugLogs
    };

    fs.writeFileSync(filename, JSON.stringify(logData, null, 2));
    console.log(`📝 Saved debug logs to ${filename}`);
  } catch (saveError) {
    console.error('Failed to save debug logs:', saveError);
  }
}

// Log if critical files exist
trace('vercel-adapter.js:20', 'Loading filesystem module');
const fs = require('fs');
trace('vercel-adapter.js:22', 'Checking directory contents');
try {
  const rootDirContents = fs.readdirSync('.');
  trace('vercel-adapter.js:24', 'Directory contents:', rootDirContents.join(', '));
  trace('vercel-adapter.js:25', 'Checking dist directory existence');
  const distExists = fs.existsSync('./dist');
  trace('vercel-adapter.js:27', 'dist directory exists:', distExists);
  
  if (distExists) {
    trace('vercel-adapter.js:30', 'Checking dist directory contents');
    try {
      const distContents = fs.readdirSync('./dist');
      trace('vercel-adapter.js:33', 'dist directory contents:', distContents.join(', '));
      
      // Check for critical files
      trace('vercel-adapter.js:36', 'Checking for critical files');
      const hasStartJs = distContents.includes('start.js');
      const hasIndexJs = distContents.includes('index.js');
      trace('vercel-adapter.js:39', 'start.js exists:', hasStartJs);
      trace('vercel-adapter.js:40', 'index.js exists:', hasIndexJs);
      
      if (hasStartJs) {
        trace('vercel-adapter.js:43', 'Checking start.js content');
        try {
          const startJsStats = fs.statSync('./dist/start.js');
          trace('vercel-adapter.js:46', 'start.js size:', startJsStats.size, 'bytes');
        } catch (error) {
          traceError('vercel-adapter.js:48', 'Failed to get start.js stats', error);
        }
      }
    } catch (error) {
      traceError('vercel-adapter.js:52', 'Failed to read dist directory', error);
    }
  }
} catch (error) {
  traceError('vercel-adapter.js:56', 'Failed to read root directory', error);
}

// Log environment variables (masked for security)
trace('vercel-adapter.js:60', 'Checking environment variables');
trace('vercel-adapter.js:61', 'DATABASE_URL exists:', !!process.env.DATABASE_URL);
trace('vercel-adapter.js:62', 'PGHOST exists:', !!process.env.PGHOST);
trace('vercel-adapter.js:63', 'PGDATABASE exists:', !!process.env.PGDATABASE);
trace('vercel-adapter.js:64', 'PGUSER exists:', !!process.env.PGUSER);
trace('vercel-adapter.js:65', 'PGPASSWORD exists:', !!process.env.PGPASSWORD);
trace('vercel-adapter.js:66', 'PGPORT exists:', !!process.env.PGPORT);

// Force SSL for database connections in Postgres
trace('vercel-adapter.js:69', 'Checking if DATABASE_URL needs SSL requirement');
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('sslmode=require')) {
  trace('vercel-adapter.js:71', 'Adding SSL requirement to DATABASE_URL');
  if (process.env.DATABASE_URL.includes('?')) {
    process.env.DATABASE_URL += '&sslmode=require';
    trace('vercel-adapter.js:74', 'Added SSL requirement with &');
  } else {
    process.env.DATABASE_URL += '?sslmode=require';
    trace('vercel-adapter.js:77', 'Added SSL requirement with ?');
  }
}

// Also set PGSSLMODE for individual connection params
trace('vercel-adapter.js:82', 'Checking PGSSLMODE');
if (!process.env.PGSSLMODE) {
  trace('vercel-adapter.js:84', 'Setting PGSSLMODE=require');
  process.env.PGSSLMODE = 'require';
}

// Express app instance for standalone handling
let expressApp = null;
trace('vercel-adapter.js:90', 'Express app variable initialized to null');

// Setup global error handlers
trace('vercel-adapter.js:93', 'Setting up global uncaughtException handler');
process.on('uncaughtException', (error) => {
  const reqId = Date.now().toString(36);
  traceError('vercel-adapter.js:uncaughtException', 'UNCAUGHT EXCEPTION IN VERCEL ADAPTER', error);
  saveLogs(reqId, error);
});

trace('vercel-adapter.js:98', 'Setting up global unhandledRejection handler');
process.on('unhandledRejection', (reason, promise) => {
  const reqId = Date.now().toString(36);
  const error = reason instanceof Error ? reason : new Error(String(reason));
  traceError('vercel-adapter.js:unhandledRejection', 'UNHANDLED REJECTION IN VERCEL ADAPTER', error);
  saveLogs(reqId, error);
});

// Try to initialize the Express app only once
trace('vercel-adapter.js:107', 'Attempting to import start.js');
try {
  // Delay import to ensure error handler is registered
  trace('vercel-adapter.js:110', 'Importing start.js with dynamic import');
  import('./dist/start.js')
    .then(() => {
      trace('vercel-adapter.js:113', 'Successfully imported start.js');
    })
    .catch(error => {
      traceError('vercel-adapter.js:116:importCatch', 'Error importing start.js', error);
    });
  
  trace('vercel-adapter.js:119', 'Import statement initiated (note: import is asynchronous)');
} catch (error) {
  traceError('vercel-adapter.js:121:tryCatch', 'Critical error importing start.js', error);
}

// Export a simple handler function for Vercel
trace('vercel-adapter.js:125', 'Defining handler function for Vercel');
export default function handler(req, res) {
  const reqId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  trace(`vercel-adapter.js:128:handler:${reqId}`, `Request received: ${req.method} ${req.url}`);
  trace(`vercel-adapter.js:129:handler:${reqId}`, `Request headers:`, JSON.stringify(req.headers));
  
  try {
    // Check if we have critical database environment variables
    trace(`vercel-adapter.js:132:handler:${reqId}`, 'Checking database environment variables');
    if (!process.env.DATABASE_URL && !process.env.PGHOST) {
      traceError(`vercel-adapter.js:134:handler:${reqId}`, 'Missing critical database environment variables');
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Missing database connection information. Please check environment variables.',
        timestamp: new Date().toISOString(),
        reqId
      });
    }
    
    // Return a basic health check response for /api/health
    if (req.url === '/api/health') {
      trace(`vercel-adapter.js:145:handler:${reqId}`, 'Health check endpoint requested');
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        region: process.env.VERCEL_REGION || 'unknown',
        env: process.env.VERCEL_ENV || process.env.NODE_ENV,
        db_connected: true,
        reqId
      });
    }
    
    // The actual request handling is done through the imported start.js
    // If we reach this point without being handled by Express, show a fallback error
    traceError(`vercel-adapter.js:158:handler:${reqId}`, 'Request reached fallback handler - Express app not handling request');
    
    // Check the status of various critical components
    trace(`vercel-adapter.js:161:handler:${reqId}`, 'Checking critical files for debugging');
    const distExists = fs.existsSync('./dist');
    const startJsExists = distExists && fs.existsSync('./dist/start.js');
    const indexJsExists = distExists && fs.existsSync('./dist/index.js');
    
    res.status(500).json({ 
      error: 'Application not properly initialized',
      message: 'The server application failed to initialize properly. Please check logs.',
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method,
      debug: {
        distExists,
        startJsExists,
        indexJsExists,
        envVars: {
          DATABASE_URL_exists: !!process.env.DATABASE_URL,
          PGHOST_exists: !!process.env.PGHOST
        }
      },
      reqId
    });
  } catch (error) {
    traceError(`vercel-adapter.js:handler:${reqId}`, 'Error in request handler', error);
    saveLogs(reqId, error);
    
    res.status(500).json({ 
      error: 'Handler error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      reqId,
      logsAvailable: true
    });
  }
} 