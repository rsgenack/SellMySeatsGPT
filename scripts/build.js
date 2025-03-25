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
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
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
    console.log('✅ .env file found.');
  }

  try {
    // Build the client
    console.log('📦 Building client...');
    await execAsync('vite build');
    console.log('✅ Client build complete');

    // Build the server
    console.log('📦 Building server...');
    await execAsync('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist');
    console.log('✅ Server build complete');

    // Copy .env file to dist directory
    const distEnvPath = path.join(__dirname, 'dist', '.env');
    fs.copyFileSync(envPath, distEnvPath);
    console.log('📄 Copied .env file to dist directory');

    // Create a simplified start script in the dist folder
    const startScript = `
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file in the same directory
config({ path: path.join(__dirname, '.env') });

// Log environment status
console.log('Environment variables loaded');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

// Import the server
import './index.js';
`;

    const startScriptPath = path.join(__dirname, 'dist', 'start.js');
    fs.writeFileSync(startScriptPath, startScript);
    console.log('📄 Created start script in dist directory');

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