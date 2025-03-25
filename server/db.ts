import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import ws from "ws";
import * as schema from "@shared/schema";
import { config } from 'dotenv';
import { resolve } from 'path';

// Make sure environment variables are loaded
config({ path: resolve(process.cwd(), '.env') });

// Set up Neon configuration
neonConfig.webSocketConstructor = ws;
neonConfig.fetchConnectionCache = true;
neonConfig.useSecureWebSocket = true;

// Log database connection details (masking sensitive information)
const dbUrlParts = process.env.DATABASE_URL?.split('@');
if (dbUrlParts && dbUrlParts.length > 1) {
  const serverPart = dbUrlParts[1];
  console.log('Database connection host:', serverPart.split('/')[0]);
} else {
  console.log('DATABASE_URL is not properly formatted or missing');
}

// Try to construct DATABASE_URL from individual parameters if not provided directly
if (!process.env.DATABASE_URL) {
  console.log('DATABASE_URL not found, attempting to build from individual parameters...');
  const pgHost = process.env.PGHOST;
  const pgUser = process.env.PGUSER;
  const pgPassword = process.env.PGPASSWORD;
  const pgDatabase = process.env.PGDATABASE;
  const pgPort = process.env.PGPORT || 5432;
  
  if (pgHost && pgUser && pgPassword && pgDatabase) {
    process.env.DATABASE_URL = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=require`;
    console.log('Built DATABASE_URL from individual parameters');
  } else {
    console.error('Could not build DATABASE_URL from individual parameters:');
    console.error('- PGHOST exists:', !!pgHost);
    console.error('- PGUSER exists:', !!pgUser);
    console.error('- PGPASSWORD exists:', !!pgPassword);
    console.error('- PGDATABASE exists:', !!pgDatabase);
    console.error('- PGPORT exists:', !!pgPort);
    
    throw new Error(
      "DATABASE_URL must be set or provide individual Postgres connection parameters. Did you forget to create an .env file?"
    );
  }
}

// Configure Neon with retries and better error handling
const maxRetries = 3;
const retryDelay = 1000; // 1 second

async function createNeonConnection(retries = 0) {
  try {
    console.log(`Attempting database connection (attempt ${retries + 1}/${maxRetries + 1})...`);
    
    // Create Neon SQL client
    const sql = neon(process.env.DATABASE_URL!, { 
      fullResults: true, // Get full result objects
    });
    
    // Test the connection
    console.log('Testing connection...');
    const result = await sql`SELECT 1 as test`;
    console.log('Connection test result:', result);
    console.log('Successfully connected to database');
    return sql;
  } catch (error) {
    console.error('Database connection error details:', error);
    
    // Log more specific error information
    if (error instanceof Error) {
      console.error(`Error type: ${error.name}, Message: ${error.message}`);
      console.error(`Stack trace: ${error.stack}`);
    }
    
    if (retries < maxRetries) {
      console.log(`Retrying connection in ${retryDelay}ms... (Attempt ${retries + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return createNeonConnection(retries + 1);
    }
    throw error;
  }
}

// Create drizzle connection with the resilient sql connection
console.log('Initializing database connection...');
let sql;
try {
  sql = await createNeonConnection();
  console.log('SQL connection established');
} catch (error) {
  console.error('Failed to establish SQL connection:', error);
  throw error;
}

export const db = drizzle(sql, { schema });
console.log('Drizzle ORM initialized successfully');

// Export the reconnect function for use in error handlers
export async function reconnectDatabase() {
  console.log('Attempting to reconnect to database...');
  const newSql = await createNeonConnection();
  return drizzle(newSql, { schema });
}

// Test query to verify schema access
try {
  console.log('Testing schema access by querying users table...');
  const testQuery = await db.query.users.findFirst();
  console.log('Database schema test: Users table query successful');
} catch (error) {
  console.error('Database schema test failed:', error);
  console.error('This might indicate a schema mismatch or table access issue');
}