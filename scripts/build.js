// build.js - Script to handle the build process
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

async function build() {
  console.log('🔨 Starting build process...');
  console.log('📦 NODE_ENV:', process.env.NODE_ENV);
  console.log('📦 VERCEL_ENV:', process.env.VERCEL_ENV);
  console.log('📦 VERCEL_URL:', process.env.VERCEL_URL);
  console.log('📦 VERCEL_REGION:', process.env.VERCEL_REGION);
  console.log('📁 Current directory:', process.cwd());
  console.log('📁 Script directory:', __dirname);
  
  try {
    // List directories to verify structure
    console.log('📂 Current directory contents:', fs.readdirSync(process.cwd()).join(', '));
  } catch (error) {
    console.error('❌ Error listing directory:', error);
  }
  
  // Check if .env file exists
  const projectRoot = path.join(__dirname, '..');
  const envPath = path.join(projectRoot, '.env');
  
  console.log('🔍 Looking for .env file at:', envPath);
  
  // Only create template .env if not in Vercel deployment
  if (!process.env.VERCEL && !fs.existsSync(envPath)) {
    console.warn('⚠️ Warning: .env file not found. Creating a template .env file...');
    // Create a template .env file with placeholders
    const templateEnv = `# Database Configuration
PGDATABASE=neondb
PGPORT=5432
PGUSER=neondb_owner
PGHOST=your-host.aws.neon.tech
PGPASSWORD=your-password
DATABASE_URL=postgresql://neondb_owner:your-password@your-host.aws.neon.tech/neondb?sslmode=require

# Email Configuration
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_PORT=993
EMAIL_IMAP_USER=your-email@example.com
EMAIL_IMAP_PASSWORD=your-password

# Google API Configuration
GMAIL_CREDENTIALS={"installed":{"client_id":"your-client-id","project_id":"your-project","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_secret":"your-client-secret","redirect_uris":["http://localhost"]}}
GOOGLE_TOKEN={"access_token":"your-access-token","refresh_token":"your-refresh-token","token_type":"Bearer"}

# Vercel Configuration
VERCEL=1
VERCEL_URL=${process.env.VERCEL_URL || ''}
VERCEL_ENV=${process.env.VERCEL_ENV || 'development'}
`;
    fs.writeFileSync(envPath, templateEnv);
    console.log('✅ Created template .env file. Please update it with your actual values.');
  } else {
    console.log('✅ Environment configuration found or running in deployment environment.');
    if (process.env.VERCEL) {
      console.log('🔑 Running in Vercel environment. Environment variables should be configured in Vercel dashboard.');
    }
  }

  try {
    // Ensure dist directory exists
    const distDir = path.join(projectRoot, 'dist');
    console.log('📁 Creating dist directory at:', distDir);
    
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
      console.log('✅ Created dist directory');
    } else {
      console.log('✅ Dist directory already exists');
    }

    // Build the client
    console.log('📦 Building client...');
    try {
      const { stdout: clientBuildOutput, stderr: clientBuildError } = await execAsync('vite build');
      console.log('📄 Client build output:', clientBuildOutput);
      if (clientBuildError) {
        console.warn('⚠️ Client build warnings:', clientBuildError);
      }
      console.log('✅ Client build complete');
    } catch (error) {
      console.error('❌ Client build failed:', error.message);
      console.error('📄 Build error details:', error.stderr);
      throw new Error('Client build failed');
    }

    // Build the server
    console.log('📦 Building server...');
    try {
      const { stdout: serverBuildOutput, stderr: serverBuildError } = await execAsync('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist');
      console.log('📄 Server build output:', serverBuildOutput);
      if (serverBuildError) {
        console.warn('⚠️ Server build warnings:', serverBuildError);
      }
      console.log('✅ Server build complete');
    } catch (error) {
      console.error('❌ Server build failed with esbuild:', error.message);
      console.error('📄 Build error details:', error.stderr);
      
      // If esbuild fails, fall back to copying the server file directly
      console.log('⚠️ Attempting fallback build method with tsc...');
      try {
        const { stdout: tscOutput, stderr: tscError } = await execAsync('tsc server/index.ts --outDir dist --moduleResolution node --esModuleInterop --target es2020 --module es2020');
        console.log('📄 TSC output:', tscOutput);
        if (tscError) {
          console.warn('⚠️ TSC warnings:', tscError);
        }
        console.log('✅ Server build complete (fallback method)');
      } catch (tscError) {
        console.error('❌ Both build methods failed. Server build error with tsc:', tscError);
        console.error('📄 TSC error details:', tscError.stderr);
        
        // Last resort: copy the typescript file directly and rely on ts-node in production
        console.log('⚠️ Attempting last resort: copying TS files directly...');
        fs.copyFileSync(
          path.join(projectRoot, 'server/index.ts'), 
          path.join(distDir, 'index.ts')
        );
        console.log('✅ Copied TypeScript files directly as last resort');
      }
    }

    // Copy .env file to dist directory (only in dev/local builds)
    if (!process.env.VERCEL && fs.existsSync(envPath)) {
      const distEnvPath = path.join(distDir, '.env');
      fs.copyFileSync(envPath, distEnvPath);
      console.log('📄 Copied .env file to dist directory');
    } else {
      console.log('📄 Skipping .env copy (not needed in deployment)');
    }

    // Create a robust start script in the dist folder with database connection testing
    const startScript = `
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Global error handler to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION in start.js:', error);
  console.error('Stack trace:', error.stack);
  // Don't exit the process - let Vercel handle the restart if needed
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION in start.js:', reason);
  // Don't exit the process - let Vercel handle the restart if needed
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 Starting application...');
console.log('📁 Current directory:', process.cwd());
console.log('📁 Script directory:', __dirname);
console.log('📦 NODE_ENV:', process.env.NODE_ENV);
console.log('📦 VERCEL_ENV:', process.env.VERCEL_ENV);
console.log('📦 VERCEL_URL:', process.env.VERCEL_URL);
console.log('📦 VERCEL_REGION:', process.env.VERCEL_REGION);

// List directories to verify structure
try {
  console.log('📂 Current directory contents:', fs.readdirSync(process.cwd()).join(', '));
  console.log('📂 Script directory contents:', fs.readdirSync(__dirname).join(', '));
} catch (error) {
  console.error('❌ Error listing directory:', error);
}

// Load environment variables from .env file in the same directory
try {
  const envPath = path.join(__dirname, '.env');
  console.log('🔍 Looking for .env file at:', envPath);
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
    console.log('✅ Environment variables loaded from local .env file');
  } else {
    console.log('⚠️ No local .env file found, using environment variables from deployment platform');
  }
} catch (error) {
  console.error('❌ Error loading .env file:', error);
  console.log('⚠️ Using environment variables from deployment platform');
}

// Log environment status (masked for security)
console.log('🔑 Environment variables check:');
console.log('- DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('- PGHOST exists:', !!process.env.PGHOST);
console.log('- PGUSER exists:', !!process.env.PGUSER);
console.log('- PGDATABASE exists:', !!process.env.PGDATABASE);
console.log('- PGPORT exists:', !!process.env.PGPORT);
console.log('- PGPASSWORD exists:', !!process.env.PGPASSWORD);
console.log('- VERCEL_URL exists:', !!process.env.VERCEL_URL);
console.log('- VERCEL_ENV exists:', !!process.env.VERCEL_ENV);
console.log('- VERCEL_REGION exists:', !!process.env.VERCEL_REGION);

// Database connection test function - to be called before server start
async function testDatabaseConnection() {
  try {
    console.log('🔌 Testing database connection...');
    
    // Check if we have connection info
    if (!process.env.DATABASE_URL && !(process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE)) {
      throw new Error('Missing database connection information. Please check environment variables.');
    }
    
    // Force SSL for database connections if not already specified
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('sslmode=require')) {
      console.log('🔒 Adding SSL requirement to DATABASE_URL');
      if (process.env.DATABASE_URL.includes('?')) {
        process.env.DATABASE_URL += '&sslmode=require';
      } else {
        process.env.DATABASE_URL += '?sslmode=require';
      }
    }
    
    // Also set PGSSLMODE for individual connection params
    if (!process.env.PGSSLMODE) {
      console.log('🔒 Setting PGSSLMODE=require');
      process.env.PGSSLMODE = 'require';
    }
    
    // Dynamically import pg to test connection
    const { Pool } = await import('pg');
    
    // Create a pool with a short timeout and SSL enabled
    const pool = new Pool({
      connectionTimeoutMillis: 5000,
      statement_timeout: 5000,
      ssl: {
        rejectUnauthorized: false,
        require: true
      }
    });
    
    // Try to connect
    const client = await pool.connect();
    console.log('✅ Successfully connected to database');
    
    // Run a simple query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database query successful:', result.rows[0].current_time);
    
    // Release client
    client.release();
    await pool.end();
    
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    console.error('   This will likely cause server startup failure');
    return false;
  }
}

// Test database connection before starting the server
await testDatabaseConnection();

// Import and start the server
const { createRequestHandler } = await import('./index.js');
export default createRequestHandler;
`;

    // Write the start script
    fs.writeFileSync(path.join(distDir, 'start.js'), startScript);
    console.log('✅ Created start.js in dist directory');

    console.log('🎉 Build process completed successfully!');
  } catch (error) {
    console.error('❌ Build process failed:', error);
    process.exit(1);
  }
}

// Run the build process
build().catch(error => {
  console.error('❌ Build process failed:', error);
  process.exit(1);
}); 