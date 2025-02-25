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

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Admin-only email configuration endpoints
  app.post("/api/admin/email-setup", requireAdmin, async (req, res) => {
    if (!req.body.user || !req.body.password || !req.body.host || !req.body.port) {
      return res.status(400).json({ error: "Missing required email configuration" });
    }

    try {
      // Store email configuration in environment variables
      process.env.EMAIL_IMAP_USER = req.body.user;
      process.env.EMAIL_IMAP_PASSWORD = req.body.password;
      process.env.EMAIL_IMAP_HOST = req.body.host;
      process.env.EMAIL_IMAP_PORT = req.body.port.toString();

      // Test the connection
      const emailService = new EmailService({
        user: req.body.user,
        password: req.body.password,
        host: req.body.host,
        port: req.body.port,
        tls: true
      });

      await emailService.processNewEmails();
      res.json({ message: "Email configuration saved and tested successfully" });
    } catch (error) {
      console.error("Email setup error:", error);
      res.status(500).json({ error: "Failed to configure email service" });
    }
  });

  app.post("/api/admin/email/start-monitoring", requireAdmin, async (req, res) => {
    try {
      const emailService = new EmailService({
        user: process.env.EMAIL_IMAP_USER!,
        password: process.env.EMAIL_IMAP_PASSWORD!,
        host: process.env.EMAIL_IMAP_HOST!,
        port: parseInt(process.env.EMAIL_IMAP_PORT!),
        tls: true
      });

      await emailService.processNewEmails();
      res.json({ message: "Email monitoring started successfully" });
    } catch (error) {
      console.error("Error starting email monitoring:", error);
      res.status(500).json({ error: "Failed to start email monitoring" });
    }
  });

  // Initialize email service with environment variables
  app.post("/api/email/start-monitoring", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const emailService = new EmailService({
        user: process.env.EMAIL_IMAP_USER!,
        password: process.env.EMAIL_IMAP_PASSWORD!,
        host: process.env.EMAIL_IMAP_HOST!,
        port: parseInt(process.env.EMAIL_IMAP_PORT!),
        tls: true
      });

      await emailService.processNewEmails();
      res.json({ message: "Email monitoring started successfully" });
    } catch (error) {
      console.error("Error starting email monitoring:", error);
      res.status(500).json({ error: "Failed to start email monitoring" });
    }
  });

  // Tickets
  app.get("/api/tickets", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const tickets = await storage.getTickets(req.user.id);
    res.json(tickets);
  });

  app.post("/api/tickets", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const validated = insertTicketSchema.parse(req.body);
    const ticket = await storage.createTicket(req.user.id, validated);
    res.status(201).json(ticket);
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const payments = await storage.getPayments(req.user.id);
    res.json(payments);
  });

  const httpServer = createServer(app);
  return httpServer;
}