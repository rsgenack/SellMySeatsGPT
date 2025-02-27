import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertTicketSchema, insertPaymentSchema } from "@shared/schema";
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from '@shared/schema';
import { config } from 'dotenv';
import { requireAdmin } from "./middleware/admin";
import { GmailScraper, initGmailScraper } from './gmail-scraper';

config();

let scraper: GmailScraper | null = null;

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Initialize Gmail scraper
  (async () => {
    scraper = new GmailScraper();
    await initGmailScraper();
  })();

  // Get Gmail auth URL (open to authenticated users, not just admins)
  app.get('/api/gmail/auth-url', async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!scraper) return res.status(500).json({ error: 'Gmail scraper not initialized' });
    try {
      const authResult = await scraper.authenticate();
      if (!authResult.isAuthenticated && authResult.authUrl) {
        res.json({ authUrl: authResult.authUrl, message: 'Please visit this URL to authenticate Gmail access' });
      } else {
        res.json({ authUrl: null, isAuthenticated: true, message: 'Gmail scraper is authenticated' });
      }
    } catch (error) {
      console.error("Gmail auth URL error:", error);
      res.status(500).json({ error: "Failed to generate Gmail auth URL" });
    }
  });

  // Handle Gmail auth callback (open to authenticated users)
  app.get('/api/gmail/callback', async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { code } = req.query;
    if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Authorization code required' });
    if (!scraper) return res.status(500).json({ error: 'Gmail scraper not initialized' });
    try {
      await scraper.handleAuthCallback(code);
      await scraper.startMonitoring();
      res.json({ status: 'authenticated', message: 'Gmail API authenticated successfully' });
    } catch (error) {
      console.error("Gmail authentication error:", error);
      res.status(500).json({ error: "Failed to authenticate with Gmail" });
    }
  });

  // Existing endpoints (unchanged, maintained for compatibility)
  app.get("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log('[Routes] Unauthenticated request to /api/profile');
      return res.sendStatus(401);
    }

    try {
      const { password, ...userProfile } = req.user;
      res.json({
        ...userProfile,
        ticketSubmissionEmail: userProfile.uniqueEmail,
        isAdmin: userProfile.isAdmin
      });
    } catch (error) {
      console.error('[Routes] Error getting user profile:', error);
      res.status(500).json({ error: 'Failed to retrieve user profile' });
    }
  });

  app.get("/api/gmail/status", requireAdmin, async (req, res) => {
    try {
      const authResult = await scraper!.authenticate();
      res.json({
        isAuthenticated: authResult.isAuthenticated,
        authUrl: authResult.authUrl,
        message: authResult.authUrl 
          ? 'Please visit the following URL to authenticate Gmail access:' 
          : 'Gmail scraper is authenticated and monitoring for ticket emails'
      });
    } catch (error) {
      console.error("Gmail status check error:", error);
      res.status(500).json({ error: "Failed to check Gmail status" });
    }
  });

  app.get("/api/tickets", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log('[Routes] Unauthenticated request to /api/tickets');
      return res.sendStatus(401);
    }

    try {
      console.log(`[Routes] Getting tickets for authenticated user: ${req.user.id}`);
      const tickets = await storage.getTickets(req.user.id);
      console.log(`[Routes] Successfully retrieved ${tickets.length} tickets for user ${req.user.id}`);
      res.json(tickets);
    } catch (error) {
      console.error('[Routes] Error getting tickets:', error);
      res.status(500).json({ error: 'Failed to retrieve tickets' });
    }
  });

  app.post("/api/tickets", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log('[Routes] Unauthenticated request to POST /api/tickets');
      return res.sendStatus(401);
    }

    try {
      console.log(`[Routes] Creating new ticket for user ${req.user.id}:`, req.body);
      const validated = insertTicketSchema.parse({
        ...req.body,
        eventDate: new Date(req.body.eventDate)
      });
      const ticket = await storage.createTicket(req.user.id, validated);
      console.log('[Routes] Successfully created ticket:', ticket);
      res.status(201).json(ticket);
    } catch (error) {
      console.error('[Routes] Error creating ticket:', error);
      res.status(400).json({ error: 'Failed to create ticket' });
    }
  });

  app.get("/api/pending-tickets", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log('[Routes] Unauthenticated request to /api/pending-tickets');
      return res.sendStatus(401);
    }

    try {
      console.log(`[Routes] Getting pending tickets for user ${req.user.id}`);
      const pendingTickets = await storage.getPendingTickets(req.user.id);
      console.log(`[Routes] Successfully retrieved ${pendingTickets.length} pending tickets`);
      res.json(pendingTickets);
    } catch (error) {
      console.error('[Routes] Error getting pending tickets:', error);
      res.status(500).json({ error: 'Failed to retrieve pending tickets' });
    }
  });

  app.post("/api/pending-tickets/:id/confirm", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log('[Routes] Unauthenticated request to confirm pending ticket');
      return res.sendStatus(401);
    }

    try {
      console.log(`[Routes] Confirming pending ticket ${req.params.id}`);
      const ticket = await storage.confirmPendingTicket(parseInt(req.params.id));
      console.log('[Routes] Successfully confirmed pending ticket:', ticket);
      res.json(ticket);
    } catch (error) {
      console.error('[Routes] Error confirming pending ticket:', error);
      const err = error as Error;
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/email-webhook", async (req, res) => {
    try {
      console.log("Received email webhook:", {
        to: req.body.to,
        from: req.body.from,
        subject: req.body.subject
      });

      const emailData = req.body;

      // Extract the recipient email to find the corresponding user
      const toEmail = emailData.to;
      console.log("Looking for user with unique email:", toEmail);

      const [user] = await db.select().from(users).where(eq(users.uniqueEmail, toEmail));

      if (!user) {
        console.log("No user found for email:", toEmail);
        return res.status(404).json({ error: "User not found for this email address" });
      }

      console.log("Found user:", user.username);

      // Create a pending ticket from the email, including recipientEmail
      const pendingTicket = await storage.createPendingTicket({
        userId: user.id,
        recipientEmail: toEmail, // Add recipientEmail to match the schema
        emailSubject: emailData.subject,
        emailFrom: emailData.from,
        rawEmailData: emailData,
        extractedData: {
          // Initial parsing of the email data to extract ticket information
          eventName: emailData.subject.split(" - ")[0] || '',
          eventDate: emailData.parsed?.date || null,
          venue: emailData.parsed?.venue || '',
          section: emailData.parsed?.section || '',
          row: emailData.parsed?.row || '',
          seat: emailData.parsed?.seat || '',
        },
      });

      console.log("Created pending ticket:", pendingTicket);
      res.status(201).json(pendingTicket);
    } catch (error) {
      console.error("Error processing email:", error);
      res.status(500).json({ error: "Failed to process email" });
    }
  });

  app.get("/api/payments", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log('[Routes] Unauthenticated request to /api/payments');
      return res.sendStatus(401);
    }

    try {
      console.log(`[Routes] Getting payments for authenticated user: ${req.user.id}`);
      const payments = await storage.getPayments(req.user.id);
      console.log(`[Routes] Successfully retrieved ${payments.length} payments for user ${req.user.id}`);
      res.json(payments);
    } catch (error) {
      console.error('[Routes] Error getting payments:', error);
      res.status(500).json({ error: 'Failed to retrieve payments' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}