import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from project root
dotenv.config({ path: resolve(__dirname, '../.env') });

export default defineConfig({
  schema: './shared/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Use environment variable with fallback
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_jgNX7sKvY3Bb@ep-tiny-field-a42m9gei.us-east-1.aws.neon.tech/neondb?sslmode=require',
  },
  verbose: true,
  strict: true,
}); 