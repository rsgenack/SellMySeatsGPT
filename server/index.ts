import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initGmailScraper } from "./gmail-scraper";
import { config } from 'dotenv';

config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS and error handling middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
    const server = await registerRoutes(app);

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
      console.log('- REPL_SLUG:', process.env.REPL_SLUG);
      console.log('- REPL_OWNER:', process.env.REPL_OWNER);
      console.log('- Server URL:', `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);

      const scraperResult = await initGmailScraper();
      console.log('Gmail scraper initialization result:', 
        scraperResult ? (scraperResult.authUrl ? 'Authentication needed' : 'Success') : 'Failed');

      if (scraperResult?.error) {
        console.error('Gmail scraper initialization error details:', scraperResult.error);
      }
    } catch (error) {
      console.error('Gmail scraper initialization error:', error);
    }

    // ALWAYS serve the app on port 5000 as required
    const port = 5000;
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