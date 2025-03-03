import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Set up Neon connection with proper typing
const sql = neon(process.env.DATABASE_URL!);
const client = {
  query: sql,
  // Add other required NeonClient properties if needed
};

// Create drizzle connection with the properly typed client
export const db = drizzle(client, { schema });