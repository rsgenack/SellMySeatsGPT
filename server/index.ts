import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initGmailScraper } from "./gmail-scraper";
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables with more robust path resolution
config({ path: resolve(process.cwd(), '.env') });

// Log important environment variables for debugging (masking sensitive parts)
console.log('=== Environment Configuration ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  console.log('DATABASE_URL present:', maskedUrl.substring(0, 20) + '...');
} else {
  console.error('WARNING: DATABASE_URL is not defined!');
}
console.log('PGHOST present:', !!process.env.PGHOST);
console.log('PGUSER present:', !!process.env.PGUSER);
console.log('PGDATABASE present:', !!process.env.PGDATABASE);
console.log('PGPORT present:', !!process.env.PGPORT);
console.log('PGPASSWORD present:', !!process.env.PGPASSWORD);
console.log('==============================');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS and security middleware with support for multiple domains
app.use((req, res, next) => {
  // Allow both Replit domains and custom domains
  const allowedOrigins = [
    process.env.REPLIT_DOMAIN,  // Replit domain
    process.env.CUSTOM_DOMAIN,  // Custom domain
    process.env.HEROKU_APP_URL, // Heroku app URL
    'http://localhost:5000'     // Local development
  ].filter(Boolean); // Remove undefined values

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log('Registering routes...');
    const server = await registerRoutes(app);
    console.log('Routes registered successfully');

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // Setup Vite in development mode
    if (process.env.NODE_ENV !== "production") {
      console.log("Setting up Vite middleware for development...");
      await setupVite(app, server);
    } else {
      console.log("Setting up static file serving for production...");
      serveStatic(app);
    }

    // Initialize Gmail scraper with better error handling
    try {
      console.log('Starting Gmail scraper initialization...');
      console.log('Checking environment variables:');
      console.log('- GOOGLE_CLIENT_ID exists:', !!process.env.GOOGLE_CLIENT_ID);
      console.log('- GOOGLE_CLIENT_SECRET exists:', !!process.env.GOOGLE_CLIENT_SECRET);
      console.log('- GOOGLE_TOKEN exists:', !!process.env.GOOGLE_TOKEN);

      const scraperResult = await initGmailScraper();
      console.log('Gmail scraper initialization result:', 
        scraperResult ? (scraperResult.authUrl ? 'Authentication needed' : 'Success') : 'Failed');

      if (scraperResult?.error) {
        console.error('Gmail scraper initialization error details:', scraperResult.error);
      }
    } catch (error) {
      console.error('Gmail scraper initialization error:', error);
    }

    // Use PORT from environment variable (for Heroku) or default to 5001 (instead of 5000)
    const port = process.env.PORT || 5001;
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`Server running at http://0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();