import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initGmailScraper } from "./gmail-scraper";
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables with more robust path resolution
config({ path: resolve(process.cwd(), '.env') });

// Debug environment in production
console.log('=== Environment Configuration ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('VERCEL_ENV:', process.env.VERCEL_ENV);
console.log('VERCEL_REGION:', process.env.VERCEL_REGION);
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);

// Check for critical environment variables
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
    'http://localhost:5000',    // Local development
    'https://sellmyseats.rgnack.com', // Our Cloudflare domain
    'https://sell-my-seats-gpt.vercel.app', // Vercel domain
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null, // Dynamic Vercel URL
    process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null, // Vercel branch URL
    process.env.VERCEL_GIT_COMMIT_REF ? `https://${process.env.VERCEL_GIT_COMMIT_REF}-${process.env.VERCEL_PROJECT_NAME}.vercel.app` : null // Vercel preview URL
  ].filter(Boolean); // Remove undefined values

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');

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
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    log(logLine);
  });

  next();
});

// Add a health check endpoint for Vercel
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = await testDatabaseConnection();
    
    // Check environment variables
    const envStatus = {
      database: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        PGHOST: !!process.env.PGHOST,
        PGUSER: !!process.env.PGUSER,
        PGDATABASE: !!process.env.PGDATABASE,
        PGPORT: !!process.env.PGPORT,
        PGPASSWORD: !!process.env.PGPASSWORD
      },
      vercel: {
        VERCEL: !!process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_URL: process.env.VERCEL_URL,
        VERCEL_REGION: process.env.VERCEL_REGION
      }
    };

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus ? 'connected' : 'disconnected',
        environment: envStatus
      },
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Export adapter for Cloudflare Workers
export async function createRequestHandler(request) {
  // Initialize server if not already done
  if (!globalThis.server) {
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

      // Setup production static serving
      console.log("Setting up static file serving for production...");
      serveStatic(app);

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
      
      globalThis.server = server;
    } catch (error) {
      console.error("Failed to initialize server:", error);
      throw error;
    }
  }
  
  // Use adapter-cloudflare to convert request/response
  try {
    return new Promise((resolve, reject) => {
      const expressRequest = createExpressRequest(request);
      const expressResponse = createExpressResponse(resolve);
      
      app(expressRequest, expressResponse);
    });
  } catch (error) {
    console.error("Error handling request:", error);
    return new Response("Server Error", { status: 500 });
  }
}

// Helper functions to convert between Cloudflare Workers and Express.js
function createExpressRequest(workerRequest) {
  const url = new URL(workerRequest.url);
  return {
    method: workerRequest.method,
    url: url.pathname + url.search,
    headers: Object.fromEntries(workerRequest.headers.entries()),
    body: workerRequest.body,
    query: Object.fromEntries(url.searchParams),
    params: {},
  };
}

function createExpressResponse(resolve) {
  const headers = new Headers();
  let statusCode = 200;
  let body = '';
  
  return {
    setHeader: (name, value) => {
      headers.set(name, value);
      return this;
    },
    status: (code) => {
      statusCode = code;
      return this;
    },
    send: (data) => {
      body = data;
      resolve(new Response(body, { status: statusCode, headers }));
    },
    json: (data) => {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(data);
      resolve(new Response(body, { status: statusCode, headers }));
    },
    // Add other response methods as needed
  };
}

// Regular Node.js server start (for local development)
if (process.env.NODE_ENV !== "cloudflare") {
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
}