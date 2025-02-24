import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertTicketSchema, insertPaymentSchema } from "@shared/schema";

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

  // Payments
  app.get("/api/payments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const payments = await storage.getPayments(req.user.id);
    res.json(payments);
  });

  const httpServer = createServer(app);
  return httpServer;
}
