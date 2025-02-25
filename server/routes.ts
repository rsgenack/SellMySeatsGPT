import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertTicketSchema, insertPaymentSchema } from "@shared/schema";
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from '@shared/schema';
import { EmailService } from "./services/email-service"; // Fixed import path

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

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