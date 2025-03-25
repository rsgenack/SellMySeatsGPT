// Script to manually apply SQL migrations to the database
import { config } from 'dotenv';
import { neon, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';

// Load environment variables
config();

// Set up Neon configuration
neonConfig.webSocketConstructor = ws;

async function applyMigration() {
  console.log('=== Database Migration Script ===');
  
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  // Read migration SQL file
  const migrationPath = path.join(process.cwd(), 'migrations', '0000_thin_killmonger.sql');
  console.log(`Reading migration file: ${migrationPath}`);
  
  try {
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('Migration SQL loaded successfully');
    
    // Connect to database
    console.log('Connecting to database...');
    const sql = neon(dbUrl);
    
    // Create the tables individually using proper SQL statements
    console.log('Creating tables...');
    
    // 1. Create users table
    console.log('Creating users table...');
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS "users" (
          "id" SERIAL PRIMARY KEY,
          "username" TEXT NOT NULL UNIQUE,
          "password" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "uniqueEmail" VARCHAR(255) NOT NULL UNIQUE,
          "isAdmin" BOOLEAN NOT NULL DEFAULT false,
          "created_at" TIMESTAMP DEFAULT now()
        )
      `;
      console.log('✅ Users table created successfully');
    } catch (error) {
      console.error('❌ Error creating users table:', error.message);
    }
    
    // 2. Create password_reset_tokens table
    console.log('Creating password_reset_tokens table...');
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL,
          "token" TEXT NOT NULL UNIQUE,
          "expires_at" TIMESTAMP NOT NULL,
          "created_at" TIMESTAMP DEFAULT now(),
          "used_at" TIMESTAMP
        )
      `;
      console.log('✅ Password reset tokens table created successfully');
      
      // Add foreign key
      await sql`
        ALTER TABLE "password_reset_tokens" 
        ADD CONSTRAINT "password_reset_tokens_user_id_fkey" 
        FOREIGN KEY ("user_id") 
        REFERENCES "users"("id") 
        ON DELETE CASCADE
      `;
      console.log('✅ Password reset tokens foreign key added');
    } catch (error) {
      console.error('❌ Error creating password_reset_tokens table:', error.message);
    }
    
    // 3. Create pendingTickets table
    console.log('Creating pendingTickets table...');
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS "pendingTickets" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL,
          "recipient_email" VARCHAR(255) NOT NULL,
          "event_name" TEXT,
          "event_date" TIMESTAMP,
          "event_time" TEXT,
          "venue" TEXT,
          "city" TEXT,
          "state" TEXT,
          "section" TEXT,
          "row" TEXT,
          "seat" TEXT,
          "email_subject" TEXT,
          "email_from" TEXT,
          "raw_email_data" TEXT,
          "extracted_data" JSONB,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "created_at" TIMESTAMP DEFAULT now()
        )
      `;
      console.log('✅ PendingTickets table created successfully');
      
      // Add foreign key and indexes
      await sql`
        ALTER TABLE "pendingTickets" 
        ADD CONSTRAINT "pendingTickets_user_id_fkey" 
        FOREIGN KEY ("user_id") 
        REFERENCES "users"("id") 
        ON DELETE CASCADE
      `;
      console.log('✅ PendingTickets foreign key added');
      
      await sql`
        CREATE INDEX IF NOT EXISTS "pending_tickets_user_id_idx" 
        ON "pendingTickets" ("user_id")
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS "pending_tickets_status_idx" 
        ON "pendingTickets" ("status")
      `;
      console.log('✅ PendingTickets indexes created');
    } catch (error) {
      console.error('❌ Error creating pendingTickets table:', error.message);
    }
    
    // 4. Create session table
    console.log('Creating session table...');
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS "session" (
          "sid" VARCHAR(255) NOT NULL PRIMARY KEY,
          "sess" JSONB NOT NULL,
          "expire" TIMESTAMP NOT NULL
        )
      `;
      console.log('✅ Session table created successfully');
    } catch (error) {
      console.error('❌ Error creating session table:', error.message);
    }
    
    // 5. Create tickets table
    console.log('Creating tickets table...');
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS "tickets" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL,
          "event_name" TEXT,
          "event_date" TIMESTAMP,
          "venue" TEXT,
          "section" TEXT,
          "row" TEXT,
          "seat" TEXT,
          "asking_price" INTEGER DEFAULT 0,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "created_at" TIMESTAMP DEFAULT now()
        )
      `;
      console.log('✅ Tickets table created successfully');
      
      // Add foreign key and index
      await sql`
        ALTER TABLE "tickets" 
        ADD CONSTRAINT "tickets_user_id_fkey" 
        FOREIGN KEY ("user_id") 
        REFERENCES "users"("id") 
        ON DELETE CASCADE
      `;
      console.log('✅ Tickets foreign key added');
      
      await sql`
        CREATE INDEX IF NOT EXISTS "tickets_user_id_idx" 
        ON "tickets" ("user_id")
      `;
      console.log('✅ Tickets index created');
    } catch (error) {
      console.error('❌ Error creating tickets table:', error.message);
    }
    
    // 6. Create payments table
    console.log('Creating payments table...');
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS "payments" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL,
          "amount" INTEGER NOT NULL,
          "created_at" TIMESTAMP DEFAULT now()
        )
      `;
      console.log('✅ Payments table created successfully');
      
      // Add foreign key and index
      await sql`
        ALTER TABLE "payments" 
        ADD CONSTRAINT "payments_user_id_fkey" 
        FOREIGN KEY ("user_id") 
        REFERENCES "users"("id") 
        ON DELETE CASCADE
      `;
      console.log('✅ Payments foreign key added');
      
      await sql`
        CREATE INDEX IF NOT EXISTS "payments_user_id_idx" 
        ON "payments" ("user_id")
      `;
      console.log('✅ Payments index created');
    } catch (error) {
      console.error('❌ Error creating payments table:', error.message);
    }
    
    console.log('\n✅ Migration completed!');
    
    // Verify tables were created
    console.log('\nVerifying tables were created...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log('Tables in database:');
    tables.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 