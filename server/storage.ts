import { users, tickets, payments, pendingTickets, type User, type InsertUser, type Ticket, type InsertTicket, type Payment, type PendingTicket, type InsertPendingTicket } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getTickets(userId: number): Promise<Ticket[]>;
  createTicket(userId: number, ticket: InsertTicket): Promise<Ticket>;
  getPayments(userId: number): Promise<Payment[]>;
  getPendingTickets(userId: number): Promise<PendingTicket[]>;
  createPendingTicket(pendingTicket: InsertPendingTicket): Promise<PendingTicket>;
  confirmPendingTicket(pendingTicketId: number): Promise<Ticket>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getTickets(userId: number): Promise<Ticket[]> {
    console.log(`[Storage] Getting tickets for userId: ${userId}`);
    try {
      const userTickets = await db
        .select()
        .from(tickets)
        .where(eq(tickets.userId, userId));

      console.log(`[Storage] Found ${userTickets.length} tickets:`, userTickets);
      return userTickets;
    } catch (error) {
      console.error('[Storage] Error getting tickets:', error);
      throw error;
    }
  }

  async createTicket(userId: number, ticket: InsertTicket): Promise<Ticket> {
    console.log(`[Storage] Creating ticket for userId: ${userId}`, ticket);
    try {
      const [newTicket] = await db
        .insert(tickets)
        .values({
          ...ticket,
          userId,
          status: "pending",
        })
        .returning();

      console.log('[Storage] Created new ticket:', newTicket);
      return newTicket;
    } catch (error) {
      console.error('[Storage] Error creating ticket:', error);
      throw error;
    }
  }

  async getPayments(userId: number): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.userId, userId));
  }

  async getPendingTickets(userId: number): Promise<PendingTicket[]> {
    return await db.select().from(pendingTickets).where(eq(pendingTickets.userId, userId));
  }

  async createPendingTicket(pendingTicket: InsertPendingTicket): Promise<PendingTicket> {
    const [newPendingTicket] = await db
      .insert(pendingTickets)
      .values({
        ...pendingTicket,
        status: "pending",
      })
      .returning();
    return newPendingTicket;
  }

  async confirmPendingTicket(pendingTicketId: number): Promise<Ticket> {
    const [pendingTicket] = await db
      .select()
      .from(pendingTickets)
      .where(eq(pendingTickets.id, pendingTicketId));

    if (!pendingTicket) {
      throw new Error("Pending ticket not found");
    }

    const ticketData = pendingTicket.extractedData as {
      eventName: string;
      eventDate: string;
      venue: string;
      section: string;
      row: string;
      seat: string;
    };

    const [confirmedTicket] = await db
      .insert(tickets)
      .values({
        userId: pendingTicket.userId,
        eventName: ticketData.eventName,
        eventDate: ticketData.eventDate,
        venue: ticketData.venue,
        section: ticketData.section,
        row: ticketData.row,
        seat: ticketData.seat,
        askingPrice: 0, 
        status: "pending",
      })
      .returning();

    await db
      .update(pendingTickets)
      .set({ status: "processed" })
      .where(eq(pendingTickets.id, pendingTicketId));

    return confirmedTicket;
  }
}

export const storage = new DatabaseStorage();