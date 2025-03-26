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

try {
  console.log('📥 Importing start.js...');
  import('./dist/start.js');
  console.log('✅ Successfully imported start.js');
} catch (error) {
  console.error('❌ Error importing start.js:', error);
}

// Export a simple handler function for Vercel
export default function handler(req, res) {
  console.log('🔄 Request received:', req.method, req.url);
  console.log('🔄 Headers:', JSON.stringify(req.headers));
  
  try {
    // This function will be automatically used by the @vercel/node runtime
    // The actual handling is done by importing the start.js file above
    // which initializes our Express application
    
    // If we reach this point, it means the request is not being handled by the Express app
    console.error('⚠️ Request reached fallback handler - Express app not handling request');
    res.status(500).json({ 
      error: 'Application not properly initialized',
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method
    });
  } catch (error) {
    console.error('❌ Error in request handler:', error);
    res.status(500).json({ 
      error: 'Handler error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 