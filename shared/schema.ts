import { pgTable, varchar, text, timestamp, serial, integer, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  email: text('email').notNull(),
  uniqueEmail: varchar('uniqueEmail', { length: 255 }).notNull().unique(),
  isAdmin: boolean('isAdmin').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  usedAt: timestamp('used_at'),
});

export const pendingTickets = pgTable('pendingTickets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
  eventName: text('event_name'),
  eventDate: timestamp('event_date'),
  eventTime: text('event_time'),
  venue: text('venue'),
  city: text('city'),
  state: text('state'),
  section: text('section'),
  row: text('row'),
  seat: text('seat'),
  emailSubject: text('email_subject'),
  emailFrom: text('email_from'),
  rawEmailData: text('raw_email_data'),
  extractedData: jsonb('extracted_data'),
  status: text('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('pending_tickets_user_id_idx').on(table.userId),
  statusIdx: index('pending_tickets_status_idx').on(table.status),
}));

export const session = pgTable('session', {
  sid: varchar('sid', { length: 255 }).notNull().primaryKey(),
  sess: jsonb('sess').notNull(),
  expire: timestamp('expire').notNull(),
});

export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  eventName: text('event_name'),
  eventDate: timestamp('event_date'),
  venue: text('venue'),
  section: text('section'),
  row: text('row'),
  seat: text('seat'),
  askingPrice: integer('asking_price').default(0),
  status: text('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('tickets_user_id_idx').on(table.userId),
}));

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  amount: integer('amount').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('payments_user_id_idx').on(table.userId),
}));

// Create Zod schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  uniqueEmail: z.string().email("Invalid email format"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email format")
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens, {
  token: z.string(),
  expiresAt: z.date(),
  userId: z.number(),
});

export const insertTicketSchema = createInsertSchema(tickets, {
  eventName: z.string().min(1, "Event name is required"),
  eventDate: z.date().optional(),
  venue: z.string().optional(),
  section: z.string().optional(),
  row: z.string().optional(),
  seat: z.string().optional(),
  askingPrice: z.number().default(0),
});

export const insertPaymentSchema = createInsertSchema(payments);

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type PendingTicket = typeof pendingTickets.$inferSelect;
export type InsertPendingTicket = typeof pendingTickets.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;