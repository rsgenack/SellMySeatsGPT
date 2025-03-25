// Database connection test script
import { config } from 'dotenv';
import { neon, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Load environment variables
config();

// Set up Neon configuration
neonConfig.webSocketConstructor = ws;
neonConfig.fetchConnectionCache = true;
neonConfig.useSecureWebSocket = true;

async function testDatabaseConnection() {
  console.log('=== Database Connection Test ===');
  
  // Check if DATABASE_URL exists
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    return false;
  }
  
  // Mask the password in the connection string for logging
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`Connection string: ${maskedUrl.substring(0, 25)}...`);
  
  try {
    console.log('Attempting to connect to the database...');
    const sql = neon(dbUrl);
    
    // Basic connection test
    console.log('Running test query...');
    const result = await sql`SELECT 1 as connection_test`;
    console.log('✅ Basic connection test successful!');
    
    // List all tables
    console.log('\nFetching available tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    if (tables.length === 0) {
      console.log('⚠️ No tables found in the public schema.');
    } else {
      console.log('✅ Found tables:');
      tables.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
    }
    
    // Test a query on the users table
    console.log('\nTesting query on users table...');
    try {
      const usersCount = await sql`SELECT COUNT(*) FROM users`;
      console.log(`✅ Users table query successful! Count: ${usersCount[0].count}`);
    } catch (error) {
      console.error(`❌ Failed to query users table: ${error.message}`);
    }
    
    console.log('\n✅ Database connection test completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error(`Error: ${error.message}`);
    
    // Provide helpful diagnostics based on the error
    if (error.message.includes('password authentication failed')) {
      console.log('\nPossible issues:');
      console.log('1. Incorrect password in DATABASE_URL');
      console.log('2. User does not have access to the database');
      console.log('\nSolution: Check your DATABASE_URL password and user permissions');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.log('\nPossible issues:');
      console.log('1. Incorrect hostname in DATABASE_URL');
      console.log('2. Network connectivity issues');
      console.log('\nSolution: Verify the hostname and check your network connection');
    } else if (error.message.includes('ETIMEDOUT')) {
      console.log('\nPossible issues:');
      console.log('1. Firewall blocking the connection');
      console.log('2. Database server is down or not accepting connections');
      console.log('\nSolution: Check firewall settings and database server status');
    }
    
    return false;
  }
}

// Run the test
testDatabaseConnection().catch(error => {
  console.error('Unhandled error during database test:', error);
  process.exit(1);
}); 