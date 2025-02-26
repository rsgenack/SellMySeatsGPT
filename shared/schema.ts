// shared/schema.ts
import { pgTable, varchar, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: integer('id').primaryKey().notNull(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  uniqueEmail: varchar('uniqueEmail', { length: 255 }).notNull().unique(), // e.g., "john.randomhash@seatxfer.com"
  isAdmin: boolean('isAdmin').default(false), // Use the imported boolean from pg-core
  createdAt: timestamp('created_at').defaultNow(),
});

export const tickets = pgTable('tickets', {
  id: integer('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  filePath: text('file_path').notNull(), // This can be removed or replaced if not needed for text tickets
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

export const pendingTickets = pgTable('pendingTickets', {
  id: integer('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  emailSubject: text('email_subject'),
  emailFrom: text('email_from'),
  rawEmailData: text('raw_email_data'),
  extractedData: jsonb('extracted_data'),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;
export type PendingTicket = typeof pendingTickets.$inferSelect;
export type InsertPendingTicket = typeof pendingTickets.$inferInsert;