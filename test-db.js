// Simple script to test database connectivity
import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;
dotenv.config();

console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('PGHOST exists:', !!process.env.PGHOST);
console.log('PGUSER exists:', !!process.env.PGUSER);
console.log('PGDATABASE exists:', !!process.env.PGDATABASE);

async function testDB() {
  try {
    // Define pool options with SSL required
    const poolOptions = {
      connectionTimeoutMillis: 10000,
      ssl: {
        rejectUnauthorized: false, // Less secure but more compatible
        require: true
      }
    };
    
    // Use DATABASE_URL if available, otherwise use individual PG* vars
    if (process.env.DATABASE_URL) {
      console.log('Using DATABASE_URL for connection...');
      // Keep the URL private by not logging it
    } else {
      console.log('Using individual PG* variables for connection...');
      // Individual connection params will be used automatically by pg
    }
    
    const pool = new Pool(poolOptions);
    
    console.log('Attempting to connect to database...');
    const client = await pool.connect();
    console.log('Successfully connected to database');
    
    const result = await client.query('SELECT NOW() as time');
    console.log('Database query successful:', result.rows[0].time);
    
    client.release();
    await pool.end();
    
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    return false;
  }
}

testDB()
  .then(success => {
    console.log('Test completed with status:', success ? 'SUCCESS' : 'FAILURE');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  }); 