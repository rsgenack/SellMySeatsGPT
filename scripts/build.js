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
  
  // Check if .env file exists
  const projectRoot = path.join(__dirname, '..');
  const envPath = path.join(projectRoot, '.env');
  
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
`;
    fs.writeFileSync(envPath, templateEnv);
    console.log('✅ Created template .env file. Please update it with your actual values.');
  } else {
    console.log('✅ Environment configuration found or running in deployment environment.');
  }

  try {
    // Ensure dist directory exists
    const distDir = path.join(projectRoot, 'dist');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    // Build the client
    console.log('📦 Building client...');
    await execAsync('vite build');
    console.log('✅ Client build complete');

    // Build the server
    console.log('📦 Building server...');
    try {
      await execAsync('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist');
      console.log('✅ Server build complete');
    } catch (error) {
      console.error('❌ Server build failed:', error);
      // If esbuild fails, fall back to copying the server file directly
      console.log('Attempting fallback build method...');
      await execAsync('tsc server/index.ts --outDir dist --moduleResolution node --esModuleInterop --target es2020 --module es2020');
      console.log('✅ Server build complete (fallback method)');
    }

    // Copy .env file to dist directory (only in dev/local builds)
    if (!process.env.VERCEL && fs.existsSync(envPath)) {
      const distEnvPath = path.join(distDir, '.env');
      fs.copyFileSync(envPath, distEnvPath);
      console.log('📄 Copied .env file to dist directory');
    } else {
      console.log('📄 Skipping .env copy (not needed in deployment)');
    }

    // Create a simplified start script in the dist folder
    const startScript = `
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file in the same directory
try {
  config({ path: path.join(__dirname, '.env') });
  console.log('Environment variables loaded from local .env file');
} catch (error) {
  console.log('Using environment variables from deployment platform');
}

// Log environment status
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

// Import the server
import './index.js';
`;

    const startScriptPath = path.join(distDir, 'start.js');
    fs.writeFileSync(startScriptPath, startScript);
    console.log('📄 Created start script in dist directory');

    // Copy vercel.json to the dist directory if in Vercel deployment
    if (process.env.VERCEL) {
      const vercelConfigPath = path.join(projectRoot, 'vercel.json');
      if (fs.existsSync(vercelConfigPath)) {
        const distVercelConfigPath = path.join(distDir, 'vercel.json');
        fs.copyFileSync(vercelConfigPath, distVercelConfigPath);
        console.log('📄 Copied vercel.json to dist directory for Vercel deployment');
      }
    }

    console.log('🎉 Build process completed successfully!');
    console.log('To start the application in production mode:');
    console.log('1. Update the .env file with your production credentials');
    console.log('2. Run: node dist/start.js');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build().catch(error => {
  console.error('Unhandled error during build:', error);
  process.exit(1);
}); 