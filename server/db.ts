import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure Neon with retries and better error handling
const maxRetries = 3;
const retryDelay = 1000; // 1 second

async function createNeonConnection(retries = 0) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    // Test the connection
    await sql`SELECT 1`;
    console.log('Successfully connected to database');
    return sql;
  } catch (error) {
    console.error('Database connection error:', error);
    if (retries < maxRetries) {
      console.log(`Retrying connection in ${retryDelay}ms... (Attempt ${retries + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return createNeonConnection(retries + 1);
    }
    throw error;
  }
}

// Create drizzle connection with the resilient sql connection
const sql = await createNeonConnection();
export const db = drizzle(sql, { schema });

// Export the reconnect function for use in error handlers
export async function reconnectDatabase() {
  console.log('Attempting to reconnect to database...');
  const newSql = await createNeonConnection();
  return drizzle(newSql, { schema });
}