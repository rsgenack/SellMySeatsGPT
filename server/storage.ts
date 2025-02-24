import { IStorage } from "./storage";
import { User, InsertUser, Ticket, InsertTicket, Payment } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private tickets: Map<number, Ticket>;
  private payments: Map<number, Payment>;
  sessionStore: session.Store;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.tickets = new Map();
    this.payments = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.currentId++;
    const newUser = { ...user, id };
    this.users.set(id, newUser);
    return newUser;
  }

  async getTickets(userId: number): Promise<Ticket[]> {
    return Array.from(this.tickets.values()).filter(
      (ticket) => ticket.userId === userId,
    );
  }

  async createTicket(userId: number, ticket: InsertTicket): Promise<Ticket> {
    const id = this.currentId++;
    const newTicket = {
      ...ticket,
      id,
      userId,
      createdAt: new Date(),
      status: "pending",
    };
    this.tickets.set(id, newTicket);
    return newTicket;
  }

  async getPayments(userId: number): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(
      (payment) => payment.userId === userId,
    );
  }
}

export const storage = new MemStorage();
