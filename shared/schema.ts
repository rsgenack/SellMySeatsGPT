
import { pgTable, varchar, text, timestamp, serial, boolean, jsonb, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  uniqueEmail: varchar('uniqueEmail', { length: 255 }).notNull().unique(),
  isAdmin: boolean('isAdmin').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  email: text('email'),
  unique_email: text('unique_email'),
  email_credentials: text('email_credentials'),
  is_admin: boolean('is_admin'),
});

export const pendingTickets = pgTable('pendingTickets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  emailSubject: text('email_subject'),
  emailFrom: text('email_from'),
  rawEmailData: text('raw_email_data'),
  extractedData: jsonb('extracted_data'),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

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
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  amount: integer('amount').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PendingTicket = typeof pendingTickets.$inferSelect;
export type InsertPendingTicket = typeof pendingTickets.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;
