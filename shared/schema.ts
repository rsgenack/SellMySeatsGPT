import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  uniqueEmail: text("unique_email"),
});

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  eventName: text("event_name").notNull(),
  eventDate: text("event_date").notNull(),
  venue: text("venue").notNull(),
  section: text("section").notNull(),
  row: text("row").notNull(),
  seat: text("seat").notNull(),
  askingPrice: integer("asking_price").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  ticketId: integer("ticket_id").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pendingTickets = pgTable("pending_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  emailSubject: text("email_subject").notNull(),
  emailFrom: text("email_from").notNull(),
  rawEmailData: jsonb("raw_email_data").notNull(),
  extractedData: jsonb("extracted_data").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ uniqueEmail: true });
export const insertTicketSchema = createInsertSchema(tickets).omit({ id: true, userId: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export const insertPendingTicketSchema = createInsertSchema(pendingTickets).omit({ id: true, status: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type PendingTicket = typeof pendingTickets.$inferSelect;
export type InsertPendingTicket = z.infer<typeof insertPendingTicketSchema>;