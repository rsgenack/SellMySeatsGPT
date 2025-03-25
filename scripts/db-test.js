// Simple script to test database connectivity
import { config } from 'dotenv';
import { neon, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Load environment variables
config();

neonConfig.webSocketConstructor = ws;

async function testConnection() {
  console.log("Testing database connection...");
  
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: No DATABASE_URL found in environment");
    process.exit(1);
  }
  
  console.log("Using connection string:", process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@'));
  
  try {
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT 1 as test`;
    console.log("✅ Connection successful!");
    console.log("Result:", result);
    
    // Try a simple schema query
    console.log("\nTesting table access...");
    try {
      const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
      console.log("✅ Available tables:", tables.map(row => row.table_name).join(', '));
    } catch (e) {
      console.error("❌ Failed to query tables:", e.message);
    }
  } catch (error) {
    console.error("❌ Connection failed:", error);
    console.error("Error details:", error.message);
    
    if (error.message.includes("password authentication failed")) {
      console.log("\nPossible solutions:");
      console.log("1. Check if the password in your DATABASE_URL is correct");
      console.log("2. Verify that your database user exists and has the correct permissions");
    } else if (error.message.includes("connect ETIMEDOUT") || error.message.includes("getaddrinfo")) {
      console.log("\nPossible solutions:");
      console.log("1. Check if the hostname in your DATABASE_URL is correct");
      console.log("2. Ensure your network allows connections to the database server");
      console.log("3. Check if the database server is running and accessible");
    }
  }
}

testConnection(); 