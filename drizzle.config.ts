
import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config(); // Load .env for DATABASE_URL

export default defineConfig({
  schema: './shared/schema.ts',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
