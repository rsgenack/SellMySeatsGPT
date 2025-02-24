import { users, tickets, payments, pendingTickets, type User, type InsertUser, type Ticket, type InsertTicket, type Payment, type PendingTicket } from "@shared/schema";
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
  confirmPendingTicket(pendingTicketId: number, ticketData: InsertTicket): Promise<Ticket>;
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
    return await db.select().from(tickets).where(eq(tickets.userId, userId));
  }

  async createTicket(userId: number, ticket: InsertTicket): Promise<Ticket> {
    const [newTicket] = await db
      .insert(tickets)
      .values({
        ...ticket,
        userId,
        status: "pending",
      })
      .returning();
    return newTicket;
  }

  async getPayments(userId: number): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.userId, userId));
  }

  async getPendingTickets(userId: number): Promise<PendingTicket[]> {
    return await db
      .select()
      .from(pendingTickets)
      .where(eq(pendingTickets.userId, userId))
      .orderBy(pendingTickets.createdAt);
  }

  async confirmPendingTicket(pendingTicketId: number, ticketData: InsertTicket): Promise<Ticket> {
    // Update pending ticket status
    await db
      .update(pendingTickets)
      .set({ status: 'confirmed' })
      .where(eq(pendingTickets.id, pendingTicketId));

    // Create confirmed ticket
    const [newTicket] = await db
      .insert(tickets)
      .values(ticketData)
      .returning();

    return newTicket;
  }
}

export const storage = new DatabaseStorage();