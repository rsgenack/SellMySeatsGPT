import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertTicketSchema, insertPaymentSchema } from "@shared/schema";
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from '@shared/schema';
import { EmailService } from "./services/email-service";
import { config } from 'dotenv';
import { requireAdmin } from "./middleware/admin";
import { GmailScraper } from './gmail-scraper';

config(); // Initialize dotenv

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Admin-only email configuration endpoints
  app.post("/api/admin/email-setup", requireAdmin, async (req, res) => {
    if (!req.body.user || !req.body.password || !req.body.host || !req.body.port) {
      return res.status(400).json({ error: "Missing required email configuration" });
    }

    try {
      console.log('Testing IMAP connection with settings:', {
        user: req.body.user,
        host: req.body.host,
        port: req.body.port,
        tls: true
      });

      // Initialize email service
      const emailService = EmailService.getInstance({
        user: req.body.user,
        password: req.body.password,
        host: req.body.host,
        port: req.body.port,
        tls: true
      });

      // Test connection and start monitoring
      await emailService.startMonitoring();
      const status = emailService.getStatus();

      res.json({ 
        message: "Email configuration saved and monitoring started",
        status: status
      });
    } catch (error) {
      console.error("Email setup error:", error);
      res.status(500).json({ 
        error: "Failed to configure email service",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Gmail authentication routes
  app.get("/api/gmail/auth", requireAdmin, async (req, res) => {
    const scraper = new GmailScraper();
    const isAuthenticated = await scraper.authenticate();
    if (isAuthenticated) {
      res.json({ status: 'already_authenticated' });
    } else {
      res.json({ status: 'needs_authentication' });
    }
  });

  app.get("/api/gmail/callback", requireAdmin, async (req, res) => {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const scraper = new GmailScraper();
    const success = await scraper.handleAuthCallback(code);

    if (success) {
      res.json({ status: 'authenticated' });
      // Start monitoring after successful authentication
      scraper.startMonitoring();
    } else {
      res.status(500).json({ error: 'Failed to authenticate with Gmail' });
    }
  });

  // Tickets
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

  // Pending Tickets
  app.get("/api/pending-tickets", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const pendingTickets = await storage.getPendingTickets(req.user.id);
    res.json(pendingTickets);
  });

  app.post("/api/pending-tickets/:id/confirm", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const ticket = await storage.confirmPendingTicket(parseInt(req.params.id));
      res.json(ticket);
    } catch (error: unknown) {
      const err = error as Error;
      res.status(400).json({ error: err.message });
    }
  });

  // Email Webhook Endpoint
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

      // Create a pending ticket from the email
      const pendingTicket = await storage.createPendingTicket({
        userId: user.id,
        emailSubject: emailData.subject,
        emailFrom: emailData.from,
        rawEmailData: emailData,
        extractedData: {
          // Initial parsing of the email data to extract ticket information
          eventName: emailData.subject.split(" - ")[0],
          eventDate: emailData.parsed?.date || "",
          venue: emailData.parsed?.venue || "",
          section: emailData.parsed?.section || "",
          row: emailData.parsed?.row || "",
          seat: emailData.parsed?.seat || "",
        },
      });

      console.log("Created pending ticket:", pendingTicket);
      res.status(201).json(pendingTicket);
    } catch (error) {
      console.error("Error processing email:", error);
      res.status(500).json({ error: "Failed to process email" });
    }
  });

  // Payments
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