// Ultra-detailed database connection debugger
console.log('[debug-db.js:1] Starting database connection debug script');

const startTime = Date.now();
console.log(`[debug-db.js:4] Script started at: ${new Date(startTime).toISOString()}`);

// Trace function for better logging
function trace(lineNumber, message, ...args) {
  const elapsed = Date.now() - startTime;
  console.log(`[debug-db.js:${lineNumber}] [+${elapsed}ms] ${message}`, ...args);
}

function traceError(lineNumber, message, error) {
  const elapsed = Date.now() - startTime;
  console.error(`[debug-db.js:${lineNumber}] [+${elapsed}ms] ERROR: ${message}`);
  if (error) {
    console.error(`[debug-db.js:${lineNumber}:error] [+${elapsed}ms] ${error.message}`);
    if (error.stack) {
      console.error(`[debug-db.js:${lineNumber}:stack] [+${elapsed}ms]\n${error.stack.split('\n').map(line => `   ${line}`).join('\n')}`);
    }
  }
}

// 1. Load environment variables
trace(20, 'Loading modules');
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

trace(28, 'Current directory:', process.cwd());
trace(29, 'Script directory:', __dirname);
trace(30, 'Script filename:', __filename);

// Load environment variables from different possible locations
trace(33, 'Looking for .env files');
const envPaths = [
  './.env',
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, 'dist', '.env')
];

let envFound = false;
for (const envPath of envPaths) {
  try {
    trace(43, `Checking for .env at: ${envPath}`);
    if (fs.existsSync(envPath)) {
      trace(45, `Found .env at ${envPath}, loading variables`);
      dotenv.config({ path: envPath });
      envFound = true;
      break;
    }
  } catch (error) {
    traceError(51, `Error checking ${envPath}`, error);
  }
}

if (!envFound) {
  trace(56, 'No .env file found, using existing environment variables');
}

// 2. Check environment variables
trace(60, 'Checking environment variables');
const dbVars = [
  'DATABASE_URL', 'PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGPORT', 'PGSSLMODE'
];

for (const varName of dbVars) {
  if (process.env[varName]) {
    const value = varName.includes('PASSWORD') ? '******' : 
                  varName === 'DATABASE_URL' ? process.env[varName].replace(/:([^:@]+)@/, ':****@') : 
                  process.env[varName];
    trace(70, `${varName} exists:`, value);
  } else {
    trace(72, `${varName} is missing`);
  }
}

// 3. Initialize SSL settings
trace(76, 'Setting up SSL requirements');
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('sslmode=require')) {
  trace(78, 'DATABASE_URL does not include sslmode=require, adding it');
  if (process.env.DATABASE_URL.includes('?')) {
    process.env.DATABASE_URL += '&sslmode=require';
    trace(81, 'Added sslmode=require with &');
  } else {
    process.env.DATABASE_URL += '?sslmode=require';
    trace(84, 'Added sslmode=require with ?');
  }
} else if (process.env.DATABASE_URL) {
  trace(87, 'DATABASE_URL already includes sslmode=require');
}

if (!process.env.PGSSLMODE) {
  trace(91, 'PGSSLMODE not set, setting to require');
  process.env.PGSSLMODE = 'require';
} else {
  trace(94, 'PGSSLMODE already set to:', process.env.PGSSLMODE);
}

// 4. Attempt multiple connection methods
trace(98, 'Importing pg module');
import pkg from 'pg';
const { Pool, Client } = pkg;
trace(101, 'pg module imported successfully');

async function testConnection() {
  trace(104, '=== Starting connection tests ===');
  
  // Test 1: Standard Pool
  try {
    trace(108, 'TEST 1: Standard Pool without SSL options');
    const pool1 = new Pool({ 
      connectionTimeoutMillis: 15000 
    });
    trace(112, 'Pool created, connecting...');
    const client1 = await pool1.connect();
    trace(114, 'Connection successful!');
    const result1 = await client1.query('SELECT NOW() as time');
    trace(116, 'Query executed successfully:', result1.rows[0].time);
    client1.release();
    await pool1.end();
    trace(119, 'Connection closed');
  } catch (error) {
    traceError(121, 'TEST 1 FAILED: Standard Pool connection failed', error);
  }
  
  // Test 2: Pool with explicit SSL options
  try {
    trace(126, 'TEST 2: Pool with explicit SSL options');
    const sslConfig = {
      ssl: {
        rejectUnauthorized: false,
        require: true
      }
    };
    trace(133, 'SSL config:', JSON.stringify(sslConfig));
    const pool2 = new Pool({ 
      connectionTimeoutMillis: 15000,
      ...sslConfig
    });
    trace(138, 'Pool with SSL created, connecting...');
    const client2 = await pool2.connect();
    trace(140, 'Connection with SSL successful!');
    const result2 = await client2.query('SELECT NOW() as time');
    trace(142, 'Query executed successfully:', result2.rows[0].time);
    client2.release();
    await pool2.end();
    trace(145, 'Connection closed');
  } catch (error) {
    traceError(147, 'TEST 2 FAILED: SSL Pool connection failed', error);
  }
  
  // Test 3: Direct Client with connection string
  if (process.env.DATABASE_URL) {
    try {
      trace(153, 'TEST 3: Direct Client with connection string');
      const client3 = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
          require: true
        }
      });
      trace(161, 'Client created, connecting...');
      await client3.connect();
      trace(163, 'Direct connection successful!');
      const result3 = await client3.query('SELECT NOW() as time');
      trace(165, 'Query executed successfully:', result3.rows[0].time);
      await client3.end();
      trace(167, 'Connection closed');
    } catch (error) {
      traceError(169, 'TEST 3 FAILED: Direct Client connection failed', error);
    }
  } else {
    trace(172, 'TEST 3 SKIPPED: No DATABASE_URL available');
  }
  
  // Test 4: Separate connection parameters
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE) {
    try {
      trace(178, 'TEST 4: Connection with individual parameters');
      const client4 = new Client({
        host: process.env.PGHOST,
        port: process.env.PGPORT || 5432,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        ssl: {
          rejectUnauthorized: false,
          require: true
        }
      });
      trace(190, 'Client with parameters created, connecting...');
      await client4.connect();
      trace(192, 'Parameter-based connection successful!');
      const result4 = await client4.query('SELECT NOW() as time');
      trace(194, 'Query executed successfully:', result4.rows[0].time);
      await client4.end();
      trace(196, 'Connection closed');
    } catch (error) {
      traceError(198, 'TEST 4 FAILED: Parameter-based connection failed', error);
    }
  } else {
    trace(201, 'TEST 4 SKIPPED: Missing one or more required PG* variables');
  }
  
  trace(204, '=== Connection tests completed ===');
}

// 5. Run the tests
trace(208, 'Starting connection tests');
testConnection()
  .then(() => {
    trace(211, 'All tests completed');
    const endTime = Date.now();
    const duration = endTime - startTime;
    trace(214, `Script completed in ${duration}ms`);
  })
  .catch(error => {
    traceError(217, 'Unhandled error in test execution', error);
    process.exit(1);
  }); 