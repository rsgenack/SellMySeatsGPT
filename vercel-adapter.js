// This file is a specialized adapter for running the application on Vercel
console.log('🚀 Vercel adapter starting...');
console.log('📁 Current directory:', process.cwd());
console.log('📦 NODE_ENV:', process.env.NODE_ENV);
console.log('📦 VERCEL_ENV:', process.env.VERCEL_ENV);
console.log('📦 VERCEL_REGION:', process.env.VERCEL_REGION);

// Log if critical files exist
const fs = require('fs');
console.log('📂 Directory contents:', fs.readdirSync('.').join(', '));
console.log('📂 dist directory exists:', fs.existsSync('./dist'));
if (fs.existsSync('./dist')) {
  console.log('📂 dist directory contents:', fs.readdirSync('./dist').join(', '));
}

// Log environment variables (masked for security)
console.log('🔑 DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('🔑 PGHOST exists:', !!process.env.PGHOST);
console.log('🔑 PGDATABASE exists:', !!process.env.PGDATABASE);

// Express app instance for standalone handling
let expressApp = null;

// Try to initialize the Express app only once
try {
  console.log('📥 Importing start.js...');
  
  // Wrap the import in a process-level try/catch to prevent immediate crash
  process.on('uncaughtException', (error) => {
    console.error('❌ UNCAUGHT EXCEPTION:', error);
    console.error('Stack trace:', error.stack);
  });
  
  // Delay import to ensure error handler is registered
  import('./dist/start.js').catch(error => {
    console.error('❌ Error importing start.js:', error);
    console.error('Stack trace:', error.stack);
  });
  
  console.log('✅ Successfully imported start.js');
} catch (error) {
  console.error('❌ Critical error importing start.js:', error);
  console.error('Stack trace:', error.stack);
}

// Export a simple handler function for Vercel
export default function handler(req, res) {
  console.log('🔄 Request received:', req.method, req.url);
  
  try {
    // Check if we have critical database environment variables
    if (!process.env.DATABASE_URL && !process.env.PGHOST) {
      console.error('❌ Missing critical database environment variables');
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Missing database connection information. Please check environment variables.',
        timestamp: new Date().toISOString()
      });
    }
    
    // Return a basic health check response for /api/health
    if (req.url === '/api/health') {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        region: process.env.VERCEL_REGION || 'unknown',
        env: process.env.VERCEL_ENV || process.env.NODE_ENV
      });
    }
    
    // The actual request handling is done through the imported start.js
    // If we reach this point without being handled by Express, show a fallback error
    console.error('⚠️ Request reached fallback handler - Express app not handling request');
    res.status(500).json({ 
      error: 'Application not properly initialized',
      message: 'The server application failed to initialize properly. Please check logs.',
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method
    });
  } catch (error) {
    console.error('❌ Error in request handler:', error);
    res.status(500).json({ 
      error: 'Handler error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
} 