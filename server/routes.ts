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
import { GmailScraper } from './gmail-scraper';

config();

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Initialize Gmail scraper
  const scraper = new GmailScraper();
  scraper.startMonitoring();

  // Add user profile endpoint
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

  // Gmail scraper authorization status
  app.get("/api/gmail/status", requireAdmin, async (req, res) => {
    try {
      const isAuthenticated = await scraper.authenticate();
      res.json({
        isAuthenticated,
        message: isAuthenticated ? 
          'Gmail scraper is authenticated and monitoring for ticket emails' : 
          'Gmail authorization required. Please check server logs for the authorization URL.'
      });
    } catch (error) {
      console.error("Gmail status check error:", error);
      res.status(500).json({ error: "Failed to check Gmail status" });
    }
  });

  // Gmail authentication callback
  app.get("/api/gmail/callback", requireAdmin, async (req, res) => {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    try {
      await scraper.handleAuthCallback(code);
      await scraper.startMonitoring();
      res.json({ status: 'authenticated' });
    } catch (error) {
      console.error("Gmail authentication error:", error);
      res.status(500).json({ error: "Failed to authenticate with Gmail" });
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