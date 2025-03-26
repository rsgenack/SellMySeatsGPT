
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
