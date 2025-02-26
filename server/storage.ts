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
      pruneSessionInterval: 60,
      tableName: 'session'
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const [newUser] = await db.insert(users).values(user).returning();
      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async getTickets(userId: number): Promise<Ticket[]> {
    try {
      return await db.select().from(tickets).where(eq(tickets.userId, userId));
    } catch (error) {
      console.error('Error getting tickets:', error);
      throw error;
    }
  }

  async createTicket(userId: number, ticket: InsertTicket): Promise<Ticket> {
    try {
      const [newTicket] = await db
        .insert(tickets)
        .values({
          ...ticket,
          userId,
          status: "pending",
        })
        .returning();
      return newTicket;
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }
  }

  async getPayments(userId: number): Promise<Payment[]> {
    try {
      return await db.select().from(payments).where(eq(payments.userId, userId));
    } catch (error) {
      console.error('Error getting payments:', error);
      throw error;
    }
  }

  async getPendingTickets(userId: number): Promise<PendingTicket[]> {
    try {
      console.log('Fetching pending tickets for user:', userId);
      const results = await db
        .select()
        .from(pendingTickets)
        .where(eq(pendingTickets.userId, userId));
      console.log('Found pending tickets:', results);
      return results;
    } catch (error) {
      console.error('Error getting pending tickets:', error);
      throw error;
    }
  }

  async createPendingTicket(pendingTicket: InsertPendingTicket): Promise<PendingTicket> {
    try {
      console.log('Creating pending ticket:', pendingTicket);
      const [newPendingTicket] = await db
        .insert(pendingTickets)
        .values({
          ...pendingTicket,
          status: "pending",
          createdAt: new Date(),
        })
        .returning();
      console.log('Created pending ticket:', newPendingTicket);
      return newPendingTicket;
    } catch (error) {
      console.error('Error creating pending ticket:', error);
      throw error;
    }
  }

  async confirmPendingTicket(pendingTicketId: number): Promise<Ticket> {
    try {
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
          eventDate: new Date(ticketData.eventDate),
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
    } catch (error) {
      console.error('Error confirming pending ticket:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();