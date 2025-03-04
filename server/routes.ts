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
    try {
      const result = await initGmailScraper();
      if (result?.scraper) {
        scraper = result.scraper;
        console.log('Gmail scraper initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize Gmail scraper:', error);
    }
  })();

  // Admin Export Routes
  app.get("/api/admin/export/tickets", requireAdmin, async (req, res) => {
    try {
      const tickets = await storage.getAllTickets();
      const csvData = tickets.map(ticket => ({
        id: ticket.id,
        eventName: ticket.eventName,
        eventDate: ticket.eventDate,
        venue: ticket.venue,
        section: ticket.section,
        row: ticket.row,
        seat: ticket.seat,
        status: ticket.status,
        askingPrice: ticket.askingPrice,
        createdAt: ticket.createdAt,
        userName: ticket.userName // Join with users table
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=tickets-${new Date().toISOString().split('T')[0]}.csv`);

      // CSV header
      res.write(Object.keys(csvData[0] || {}).join(',') + '\n');

      // CSV rows
      csvData.forEach(row => {
        res.write(
          Object.values(row)
            .map(value => `"${value?.toString().replace(/"/g, '""')}"`)
            .join(',') + '\n'
        );
      });

      res.end();
    } catch (error) {
      console.error('Error exporting tickets:', error);
      res.status(500).json({ error: 'Failed to export tickets' });
    }
  });

  app.get("/api/admin/export/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const csvData = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        ticketCount: user.ticketCount,
        totalRevenue: user.totalRevenue,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=users-${new Date().toISOString().split('T')[0]}.csv`);

      res.write(Object.keys(csvData[0] || {}).join(',') + '\n');
      csvData.forEach(row => {
        res.write(
          Object.values(row)
            .map(value => `"${value?.toString().replace(/"/g, '""')}"`)
            .join(',') + '\n'
        );
      });

      res.end();
    } catch (error) {
      console.error('Error exporting users:', error);
      res.status(500).json({ error: 'Failed to export users' });
    }
  });

  app.get("/api/admin/export/sales", requireAdmin, async (req, res) => {
    try {
      const sales = await storage.getAllSales();
      const csvData = sales.map(sale => ({
        id: sale.id,
        ticketId: sale.ticketId,
        eventName: sale.eventName,
        salePrice: sale.salePrice,
        saleDate: sale.saleDate,
        buyerEmail: sale.buyerEmail,
        sellerUsername: sale.sellerUsername,
        commission: sale.commission
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=sales-${new Date().toISOString().split('T')[0]}.csv`);

      res.write(Object.keys(csvData[0] || {}).join(',') + '\n');
      csvData.forEach(row => {
        res.write(
          Object.values(row)
            .map(value => `"${value?.toString().replace(/"/g, '""')}"`)
            .join(',') + '\n'
        );
      });

      res.end();
    } catch (error) {
      console.error('Error exporting sales:', error);
      res.status(500).json({ error: 'Failed to export sales' });
    }
  });

  // Existing endpoints (unchanged)
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
        subject: req.body.subject,
        rawData: req.body // Log full data for debugging
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

      // Enhanced ticket data extraction
      const ticketData = {
        eventName: emailData.subject.split(" - ")[0] || '',
        eventDate: emailData.parsed?.date || null,
        venue: emailData.parsed?.venue || '',
        section: emailData.parsed?.section || '',
        row: emailData.parsed?.row || '',
        seat: emailData.parsed?.seat || '',
        price: emailData.parsed?.price || null,
        sellerInfo: emailData.parsed?.sellerInfo || '',
        transferDetails: emailData.parsed?.transferDetails || '',
        fullEmailBody: emailData.text || emailData.html || '', // Store full email content for reference
      };

      console.log("Extracted ticket data:", ticketData);

      // Create a pending ticket from the email
      const pendingTicket = await storage.createPendingTicket({
        userId: user.id,
        recipientEmail: toEmail,
        emailSubject: emailData.subject,
        emailFrom: emailData.from,
        rawEmailData: emailData,
        extractedData: ticketData,
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

  // Add email monitoring endpoint
  app.post("/api/admin/email/start-monitoring", requireAdmin, async (req, res) => {
    try {
      if (!scraper) {
        return res.status(500).json({ 
          error: "Gmail scraper not initialized",
          details: "Please try again in a few moments"
        });
      }

      const authResult = await scraper.authenticate();

      if (!authResult.isAuthenticated && authResult.authUrl) {
        return res.status(401).json({
          needsAuth: true,
          authUrl: authResult.authUrl,
          message: "Gmail authentication required"
        });
      }

      await scraper.startMonitoring();

      res.json({ 
        message: "Email monitoring started successfully",
        isAuthenticated: true,
        isMonitoring: true
      });
    } catch (error) {
      console.error("Error in email monitoring:", error);
      res.status(500).json({ 
        error: "Failed to start email monitoring",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Add email status endpoint
  app.get("/api/admin/email/status", requireAdmin, async (req, res) => {
    try {
      if (!scraper) {
        return res.status(500).json({ 
          error: "Gmail scraper not initialized",
          isConnected: false,
          isMonitoring: false
        });
      }

      const authResult = await scraper.authenticate();

      res.json({
        isConnected: authResult.isAuthenticated,
        isAuthenticated: authResult.isAuthenticated,
        authUrl: authResult.authUrl,
        isMonitoring: scraper.isMonitoring(),
        lastChecked: scraper.getLastChecked(),
        recentEmails: await scraper.getRecentEmails()
      });
    } catch (error) {
      console.error("Error getting email status:", error);
      res.status(500).json({ 
        error: "Failed to get email status",
        details: error instanceof Error ? error.message : "Unknown error",
        isConnected: false,
        isMonitoring: false
      });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}