import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config(); // Load environment variables from Replit Secrets

export default defineConfig({
  schema: './shared/schema.ts', // Path to your schema file
  out: './migrations', // Directory for migration files
  dialect: 'postgresql', // Specify the dialect
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!, // Use DATABASE_URL from Replit Secrets
  },
  verbose: true,
  strict: true,
});