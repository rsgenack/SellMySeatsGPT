var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2, { Response } from "express";

// server/routes.ts
import { createServer } from "http";

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session3 from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  insertPasswordResetTokenSchema: () => insertPasswordResetTokenSchema,
  insertPaymentSchema: () => insertPaymentSchema,
  insertTicketSchema: () => insertTicketSchema,
  insertUserSchema: () => insertUserSchema,
  passwordResetTokens: () => passwordResetTokens,
  payments: () => payments,
  pendingTickets: () => pendingTickets,
  session: () => session,
  tickets: () => tickets,
  users: () => users
});
import { pgTable, varchar, text, timestamp, serial, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  uniqueEmail: varchar("uniqueEmail", { length: 255 }).notNull().unique(),
  isAdmin: boolean("isAdmin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow()
});
var passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  usedAt: timestamp("used_at")
});
var pendingTickets = pgTable("pendingTickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  eventName: text("event_name"),
  eventDate: timestamp("event_date"),
  eventTime: text("event_time"),
  venue: text("venue"),
  city: text("city"),
  state: text("state"),
  section: text("section"),
  row: text("row"),
  seat: text("seat"),
  emailSubject: text("email_subject"),
  emailFrom: text("email_from"),
  rawEmailData: text("raw_email_data"),
  extractedData: jsonb("extracted_data"),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  userIdIdx: index("pending_tickets_user_id_idx").on(table.userId),
  statusIdx: index("pending_tickets_status_idx").on(table.status)
}));
var session = pgTable("session", {
  sid: varchar("sid", { length: 255 }).notNull().primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull()
});
var tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  eventName: text("event_name"),
  eventDate: timestamp("event_date"),
  venue: text("venue"),
  section: text("section"),
  row: text("row"),
  seat: text("seat"),
  askingPrice: integer("asking_price").default(0),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  userIdIdx: index("tickets_user_id_idx").on(table.userId)
}));
var payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  userIdIdx: index("payments_user_id_idx").on(table.userId)
}));
var insertUserSchema = createInsertSchema(users, {
  uniqueEmail: z.string().email("Invalid email format"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email format")
});
var insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens, {
  token: z.string(),
  expiresAt: z.date(),
  userId: z.number()
});
var insertTicketSchema = createInsertSchema(tickets, {
  eventName: z.string().min(1, "Event name is required"),
  eventDate: z.date().optional(),
  venue: z.string().optional(),
  section: z.string().optional(),
  row: z.string().optional(),
  seat: z.string().optional(),
  askingPrice: z.number().default(0)
});
var insertPaymentSchema = createInsertSchema(payments);

// server/db.ts
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import ws from "ws";
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") });
neonConfig.webSocketConstructor = ws;
neonConfig.fetchConnectionCache = true;
neonConfig.useSecureWebSocket = true;
var dbUrlParts = process.env.DATABASE_URL?.split("@");
if (dbUrlParts && dbUrlParts.length > 1) {
  const serverPart = dbUrlParts[1];
  console.log("Database connection host:", serverPart.split("/")[0]);
} else {
  console.log("DATABASE_URL is not properly formatted or missing");
}
if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL not found, attempting to build from individual parameters...");
  const pgHost = process.env.PGHOST;
  const pgUser = process.env.PGUSER;
  const pgPassword = process.env.PGPASSWORD;
  const pgDatabase = process.env.PGDATABASE;
  const pgPort = process.env.PGPORT || 5432;
  if (pgHost && pgUser && pgPassword && pgDatabase) {
    process.env.DATABASE_URL = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=require`;
    console.log("Built DATABASE_URL from individual parameters");
  } else {
    console.error("Could not build DATABASE_URL from individual parameters:");
    console.error("- PGHOST exists:", !!pgHost);
    console.error("- PGUSER exists:", !!pgUser);
    console.error("- PGPASSWORD exists:", !!pgPassword);
    console.error("- PGDATABASE exists:", !!pgDatabase);
    console.error("- PGPORT exists:", !!pgPort);
    throw new Error(
      "DATABASE_URL must be set or provide individual Postgres connection parameters. Did you forget to create an .env file?"
    );
  }
}
var maxRetries = 3;
var retryDelay = 1e3;
async function createNeonConnection(retries = 0) {
  try {
    console.log(`Attempting database connection (attempt ${retries + 1}/${maxRetries + 1})...`);
    const sql2 = neon(process.env.DATABASE_URL, {
      fullResults: true
      // Get full result objects
    });
    console.log("Testing connection...");
    const result = await sql2`SELECT 1 as test`;
    console.log("Connection test result:", result);
    console.log("Successfully connected to database");
    return sql2;
  } catch (error) {
    console.error("Database connection error details:", error);
    if (error instanceof Error) {
      console.error(`Error type: ${error.name}, Message: ${error.message}`);
      console.error(`Stack trace: ${error.stack}`);
    }
    if (retries < maxRetries) {
      console.log(`Retrying connection in ${retryDelay}ms... (Attempt ${retries + 1}/${maxRetries})`);
      await new Promise((resolve3) => setTimeout(resolve3, retryDelay));
      return createNeonConnection(retries + 1);
    }
    throw error;
  }
}
console.log("Initializing database connection...");
var sql;
try {
  sql = await createNeonConnection();
  console.log("SQL connection established");
} catch (error) {
  console.error("Failed to establish SQL connection:", error);
  throw error;
}
var db = drizzle(sql, { schema: schema_exports });
console.log("Drizzle ORM initialized successfully");
try {
  console.log("Testing schema access by querying users table...");
  const testQuery = await db.query.users.findFirst();
  console.log("Database schema test: Users table query successful");
} catch (error) {
  console.error("Database schema test failed:", error);
  console.error("This might indicate a schema mismatch or table access issue");
}

// server/storage.ts
import { eq } from "drizzle-orm";
import session2 from "express-session";
import connectPg from "connect-pg-simple";
var PostgresSessionStore = connectPg(session2);
var DatabaseStorage = class {
  sessionStore;
  constructor() {
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === "production"
      },
      createTableIfMissing: true,
      pruneSessionInterval: 60,
      tableName: "session"
    });
  }
  async getUser(id) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Error getting user:", error);
      throw error;
    }
  }
  async getUserByUsername(username) {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error("Error getting user by username:", error);
      throw error;
    }
  }
  async createUser(user) {
    try {
      const [newUser] = await db.insert(users).values(user).returning();
      return newUser;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }
  async getTickets(userId) {
    try {
      return await db.select().from(tickets).where(eq(tickets.userId, userId));
    } catch (error) {
      console.error("Error getting tickets:", error);
      throw error;
    }
  }
  async createTicket(userId, ticket) {
    try {
      const [newTicket] = await db.insert(tickets).values({
        ...ticket,
        userId,
        status: "pending"
      }).returning();
      return newTicket;
    } catch (error) {
      console.error("Error creating ticket:", error);
      throw error;
    }
  }
  async getPayments(userId) {
    try {
      return await db.select().from(payments).where(eq(payments.userId, userId));
    } catch (error) {
      console.error("Error getting payments:", error);
      throw error;
    }
  }
  async getPendingTickets(userId) {
    try {
      console.log("Fetching pending tickets for user:", userId);
      const results = await db.select().from(pendingTickets).where(eq(pendingTickets.userId, userId));
      console.log("Found pending tickets:", results);
      return results;
    } catch (error) {
      console.error("Error getting pending tickets:", error);
      throw error;
    }
  }
  async createPendingTicket(pendingTicket) {
    try {
      console.log("Creating pending ticket:", pendingTicket);
      const [newPendingTicket] = await db.insert(pendingTickets).values({
        ...pendingTicket,
        status: "pending",
        createdAt: /* @__PURE__ */ new Date()
      }).returning();
      console.log("Created pending ticket:", newPendingTicket);
      return newPendingTicket;
    } catch (error) {
      console.error("Error creating pending ticket:", error);
      throw error;
    }
  }
  async confirmPendingTicket(pendingTicketId) {
    try {
      const [pendingTicket] = await db.select().from(pendingTickets).where(eq(pendingTickets.id, pendingTicketId));
      if (!pendingTicket) {
        throw new Error("Pending ticket not found");
      }
      const ticketData = pendingTicket.extractedData;
      const [confirmedTicket] = await db.insert(tickets).values({
        userId: pendingTicket.userId,
        eventName: ticketData.eventName,
        eventDate: new Date(ticketData.eventDate),
        venue: ticketData.venue,
        section: ticketData.section,
        row: ticketData.row,
        seat: ticketData.seat,
        askingPrice: 0,
        status: "pending"
      }).returning();
      await db.update(pendingTickets).set({ status: "processed" }).where(eq(pendingTickets.id, pendingTicketId));
      return confirmedTicket;
    } catch (error) {
      console.error("Error confirming pending ticket:", error);
      throw error;
    }
  }
};
var storage = new DatabaseStorage();

// server/auth.ts
import { eq as eq2, and, isNull } from "drizzle-orm";
var scryptAsync = promisify(scrypt);
var ADMIN_EMAIL = "greenbaumamichael@gmail.com";
var ADMIN_PASSWORD = "michael101";
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
function generateUniqueEmail(username) {
  const randomStr = randomBytes(6).toString("hex");
  return `${username}.${randomStr}@seatxfer.com`;
}
async function generatePasswordResetToken(userId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3);
  await db.insert(passwordResetTokens).values({
    userId,
    token,
    expiresAt
  });
  return token;
}
async function validatePasswordResetToken(token) {
  const [resetToken] = await db.select().from(passwordResetTokens).where(
    and(
      eq2(passwordResetTokens.token, token),
      isNull(passwordResetTokens.usedAt),
      eq2(passwordResetTokens.expiresAt > /* @__PURE__ */ new Date(), true)
    )
  );
  if (!resetToken) {
    return null;
  }
  return resetToken.userId;
}
function setupAuth(app2) {
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore
  };
  app2.set("trust proxy", 1);
  app2.use(session3(sessionSettings));
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            console.log("[Auth] Admin login detected");
            const [adminUser] = await db.select().from(users).where(eq2(users.email, ADMIN_EMAIL));
            if (adminUser) {
              return done(null, {
                ...adminUser,
                isAdmin: true
              });
            } else {
              console.log("[Auth] Creating admin user account");
              const uniqueEmail = generateUniqueEmail("admin");
              const adminUser2 = await storage.createUser({
                username: "admin",
                password: await hashPassword(ADMIN_PASSWORD),
                email: ADMIN_EMAIL,
                uniqueEmail,
                isAdmin: true
              });
              return done(null, {
                ...adminUser2,
                isAdmin: true
              });
            }
          }
          const [user] = await db.select().from(users).where(eq2(users.email, email));
          if (!user || !await comparePasswords(password, user.password)) {
            return done(null, false);
          }
          return done(null, {
            ...user,
            isAdmin: Boolean(user.isAdmin)
          });
        } catch (error) {
          return done(error);
        }
      }
    )
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      const isAdmin = user.email === ADMIN_EMAIL ? true : Boolean(user.isAdmin);
      done(null, {
        ...user,
        isAdmin
      });
    } catch (err) {
      done(err);
    }
  });
  app2.post("/api/register", async (req, res, next) => {
    const { username, password, email } = req.body;
    try {
      const [existingUser] = await db.select().from(users).where(eq2(users.email, email));
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }
      const uniqueEmail = generateUniqueEmail(username);
      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        email,
        uniqueEmail,
        isAdmin: false
      });
      const userWithBooleanAdmin = {
        ...user,
        isAdmin: Boolean(user.isAdmin)
      };
      req.login(userWithBooleanAdmin, (err) => {
        if (err) return next(err);
        res.status(201).json(userWithBooleanAdmin);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Internal server error during registration" });
    }
  });
  app2.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });
  app2.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
  app2.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });
  app2.post("/api/reset-password", async (req, res) => {
    try {
      const { email } = req.body;
      const [user] = await db.select().from(users).where(eq2(users.email, email));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const token = await generatePasswordResetToken(user.id);
      res.json({
        message: "Password reset initiated",
        resetToken: token
        // Only for development!
      });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Failed to initiate password reset" });
    }
  });
  app2.post("/api/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { newPassword } = req.body;
      const userId = await validatePasswordResetToken(token);
      if (!userId) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      const hashedPassword = await hashPassword(newPassword);
      await db.update(users).set({ password: hashedPassword }).where(eq2(users.id, userId));
      await db.update(passwordResetTokens).set({ usedAt: /* @__PURE__ */ new Date() }).where(eq2(passwordResetTokens.token, token));
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
}

// server/routes.ts
import { eq as eq4 } from "drizzle-orm";
import { config as config2 } from "dotenv";

// server/middleware/admin.ts
var ADMIN_EMAIL2 = "greenbaumamichael@gmail.com";
function requireAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    console.log("[Admin Middleware] Unauthorized: User not authenticated");
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.user.email !== ADMIN_EMAIL2) {
    console.log("[Admin Middleware] Forbidden: Access restricted to specific admin email", {
      attempted: req.user.email,
      required: ADMIN_EMAIL2
    });
    return res.status(403).json({ error: "Forbidden - Admin access restricted" });
  }
  if (!req.user.isAdmin) {
    console.log("[Admin Middleware] Forbidden: User not admin", { username: req.user.username });
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }
  console.log("[Admin Middleware] Admin access granted for user:", req.user.username);
  next();
}

// server/gmail-scraper.ts
import { google } from "googleapis";
import { JSDOM } from "jsdom";
import { eq as eq3 } from "drizzle-orm";
var SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
var GmailScraper = class {
  oauth2Client;
  gmail;
  isMonitoringActive = false;
  lastChecked = null;
  monitoringInterval = null;
  constructor() {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth credentials are required");
    }
    console.log("Initializing Gmail scraper with client ID:", process.env.GOOGLE_CLIENT_ID.substring(0, 8) + "...");
    const baseUrl = "https://api.sellmyseats.com";
    const redirectUri = `${baseUrl}/api/gmail/callback`;
    console.log("Using redirect URI:", redirectUri);
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    this.loadToken();
  }
  // Load token from Replit Secrets
  loadToken() {
    try {
      const token = process.env.GOOGLE_TOKEN;
      if (token) {
        const parsedToken = JSON.parse(token);
        this.oauth2Client.setCredentials(parsedToken);
        this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
        console.log("Successfully loaded Gmail token from Replit Secrets");
      } else {
        console.log("No Gmail token found in Replit Secrets, authentication will be required");
      }
    } catch (error) {
      console.error("Error loading token from Replit Secrets:", error.message);
    }
  }
  isMonitoring() {
    return this.isMonitoringActive;
  }
  getLastChecked() {
    return this.lastChecked;
  }
  async getRecentEmails() {
    try {
      if (!this.gmail) {
        console.log("Gmail API not initialized");
        return [];
      }
      console.log(`Checking all recent emails in inbox`);
      const response = await this.gmail.users.messages.list({
        userId: "me",
        q: "",
        maxResults: 20
      });
      const messages = response.data.messages || [];
      console.log(`Found ${messages.length} recent messages`);
      const recentEmails = [];
      for (const message of messages) {
        const email = await this.gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "full"
        });
        const headers = email.data.payload.headers;
        const toAddress = headers.find((h) => h.name === "To")?.value;
        const fromAddress = headers.find((h) => h.name === "From")?.value;
        const subject = headers.find((h) => h.name === "Subject")?.value;
        const date = headers.find((h) => h.name === "Date")?.value;
        const recipientEmail = this.extractOriginalRecipient(email.data.payload) || toAddress;
        console.log("Processing email:", {
          to: toAddress,
          recipientEmail,
          from: fromAddress,
          subject,
          date
        });
        let emailHtml = "";
        if (email.data.payload.body?.data) {
          emailHtml = Buffer.from(email.data.payload.body.data, "base64").toString();
        } else if (email.data.payload.parts) {
          const htmlPart = email.data.payload.parts.find((part) => part.mimeType === "text/html");
          if (htmlPart?.body?.data) {
            emailHtml = Buffer.from(htmlPart.body.data, "base64").toString();
          }
        }
        if (recipientEmail?.endsWith("@seatxfer.com")) {
          const ticketInfo = this.parseTicketmasterEmail(emailHtml, recipientEmail);
          if (ticketInfo.length > 0) {
            console.log(`Found ticket information for ${recipientEmail}`);
            recentEmails.push({
              subject,
              from: fromAddress,
              date: new Date(date).toISOString(),
              status: "pending",
              recipientEmail,
              userName: await this.getUsernameFromEmail(recipientEmail).then((user) => user?.username || "Unknown User"),
              ticketInfo: ticketInfo[0]
            });
          }
        }
      }
      return recentEmails;
    } catch (error) {
      console.error("Error getting recent emails:", error);
      return [];
    }
  }
  extractOriginalRecipient(payload) {
    try {
      const headers = payload.headers || [];
      const originalTo = headers.find(
        (h) => h.name === "X-Original-To" || h.name === "Delivered-To" || h.name === "X-Forwarded-To" || h.name === "To" || h.name === "Original-To"
      )?.value;
      if (originalTo?.endsWith("@seatxfer.com")) {
        return originalTo;
      }
      const receivedHeaders = headers.filter((h) => h.name === "Received");
      for (const header of receivedHeaders) {
        const match = header.value?.match(/[a-zA-Z0-9._%+-]+@seatxfer\.com/g);
        if (match && match.length > 0) {
          return match[0];
        }
      }
      let emailBody = "";
      if (payload.body?.data) {
        emailBody = Buffer.from(payload.body.data, "base64").toString();
      } else if (payload.parts) {
        const textPart = payload.parts.find((part) => part.mimeType === "text/plain");
        const htmlPart = payload.parts.find((part) => part.mimeType === "text/html");
        if (textPart?.body?.data) {
          emailBody = Buffer.from(textPart.body.data, "base64").toString();
        } else if (htmlPart?.body?.data) {
          emailBody = Buffer.from(htmlPart.body.data, "base64").toString();
        }
      }
      const matches = emailBody.match(/[a-zA-Z0-9._%+-]+@seatxfer\.com/g);
      if (matches && matches.length > 0) {
        return matches[0];
      }
      const subjectHeader = headers.find((h) => h.name === "Subject")?.value;
      if (subjectHeader) {
        const subjectMatches = subjectHeader.match(/[a-zA-Z0-9._%+-]+@seatxfer\.com/g);
        if (subjectMatches && subjectMatches.length > 0) {
          return subjectMatches[0];
        }
      }
      return null;
    } catch (error) {
      console.error("Error extracting original recipient:", error);
      return null;
    }
  }
  parseTicketmasterEmail(html, recipientEmail) {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const tickets2 = [];
    const eventNameElement = Array.from(doc.getElementsByTagName("p")).find((p) => p instanceof HTMLParagraphElement && !p.textContent?.toLowerCase().includes("transfer"));
    const eventName = eventNameElement?.textContent?.trim() || "Unknown Event";
    const dateTimeElement = Array.from(doc.getElementsByTagName("p")).find((p) => p instanceof HTMLParagraphElement && p.textContent?.includes("@"));
    const dateTimeText = dateTimeElement?.textContent?.trim() || "";
    let eventDate = null;
    let eventTime = "";
    if (dateTimeText) {
      const [datePart, timePart] = dateTimeText.split("@").map((part) => part.trim());
      const dateStr = datePart.split(", ")[1];
      eventTime = timePart;
      try {
        const parsedDate = /* @__PURE__ */ new Date(`${dateStr}, 2025 ${timePart}`);
        eventDate = parsedDate;
      } catch (error) {
        console.error("Error parsing date:", error);
        eventDate = null;
      }
    }
    const locationElement = Array.from(doc.getElementsByTagName("p")).find((p) => p instanceof HTMLParagraphElement && p.textContent?.includes(","));
    const locationText = locationElement?.textContent?.trim() || "";
    let [venue, city, state] = ["", "", ""];
    if (locationText) {
      const parts = locationText.split(",").map((part) => part.trim());
      if (parts.length >= 3) {
        [venue, city, state] = parts;
      } else if (parts.length === 2) {
        venue = parts[0];
        city = parts[0];
        state = parts[1];
      }
    }
    const seatingInfos = Array.from(doc.getElementsByTagName("p")).filter((p) => p instanceof HTMLParagraphElement && (p.textContent?.includes("Section") || p.textContent?.toUpperCase().includes("GENERAL ADMISSION")));
    if (seatingInfos.length === 0 && doc.body.textContent?.toUpperCase().includes("GENERAL ADMISSION")) {
      tickets2.push({
        eventName,
        eventDate,
        eventTime,
        venue,
        city,
        state,
        section: "FLOOR2",
        row: "N/A",
        seat: "N/A",
        recipientEmail,
        status: "pending"
      });
    } else {
      for (const seatInfo of seatingInfos) {
        const text2 = seatInfo.textContent || "";
        const isGeneralAdmission = text2.toUpperCase().includes("GENERAL ADMISSION");
        if (isGeneralAdmission) {
          tickets2.push({
            eventName,
            eventDate,
            eventTime,
            venue,
            city,
            state,
            section: "FLOOR2",
            row: "N/A",
            seat: "N/A",
            recipientEmail,
            status: "pending"
          });
        } else {
          const match = text2.match(/Section\s+(\w+),\s*Row\s+(\d+),\s*Seat\s+(\d+)/i);
          if (match) {
            tickets2.push({
              eventName,
              eventDate,
              eventTime,
              venue,
              city,
              state,
              section: match[1],
              row: match[2],
              seat: match[3],
              recipientEmail,
              status: "pending"
            });
          }
        }
      }
    }
    return tickets2;
  }
  async getUsernameFromEmail(email) {
    try {
      const [user] = await db.select().from(users).where(eq3(users.uniqueEmail, email));
      return user ? { id: user.id, username: user.username } : null;
    } catch (error) {
      console.error("Error getting user by email:", error);
      return null;
    }
  }
  async authenticate() {
    try {
      if (this.oauth2Client.credentials && this.oauth2Client.credentials.access_token) {
        if (this.oauth2Client.credentials.expiry_date && this.oauth2Client.credentials.expiry_date <= Date.now()) {
          console.log("Token expired, refreshing...");
          await this.oauth2Client.refreshAccessToken();
          const newTokens = this.oauth2Client.credentials;
          console.log("New token obtained after refresh:", newTokens);
          console.log("Please manually update the GOOGLE_TOKEN secret in Replit Secrets with the following value:");
          console.log(JSON.stringify(newTokens));
        }
        this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
        return { isAuthenticated: true };
      }
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
        state: "gmail_auth"
      });
      console.log("Please authorize the Gmail API by visiting this URL:", authUrl);
      return { isAuthenticated: false, authUrl };
    } catch (error) {
      console.error("Error during Gmail authentication:", error);
      return { isAuthenticated: false };
    }
  }
  async handleAuthCallback(code) {
    try {
      console.log("Handling auth callback with code:", code);
      const { tokens } = await this.oauth2Client.getToken(code);
      console.log("Received tokens:", tokens);
      this.oauth2Client.setCredentials(tokens);
      this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
      console.log("Gmail API authenticated successfully. Please manually update the GOOGLE_TOKEN secret in Replit Secrets with the following value:");
      console.log(JSON.stringify(tokens));
    } catch (error) {
      console.error("Error handling auth callback:", error.message);
      console.error("Error details:", error);
      throw error;
    }
  }
  async scrapeTickets() {
    try {
      console.log("Starting to scrape tickets from Gmail...");
      this.lastChecked = /* @__PURE__ */ new Date();
      const recentEmails = await this.getRecentEmails();
      for (const email of recentEmails) {
        if (email.ticketInfo) {
          try {
            const user = await this.getUsernameFromEmail(email.recipientEmail);
            if (!user) {
              console.error(`No user found for email: ${email.recipientEmail}`);
              continue;
            }
            const pendingTicket = {
              userId: user.id,
              recipientEmail: email.recipientEmail,
              eventName: email.ticketInfo.eventName || "",
              eventDate: email.ticketInfo.eventDate || /* @__PURE__ */ new Date(),
              eventTime: email.ticketInfo.eventTime || "",
              venue: email.ticketInfo.venue || "",
              city: email.ticketInfo.city || "",
              state: email.ticketInfo.state || "",
              section: email.ticketInfo.section || "",
              row: email.ticketInfo.row || "",
              seat: email.ticketInfo.seat || "",
              emailSubject: email.subject || "",
              emailFrom: email.from || "",
              rawEmailData: "",
              extractedData: email.ticketInfo,
              status: "pending"
            };
            await db.insert(pendingTickets).values(pendingTicket);
            console.log("Successfully created pending ticket for user:", user.username);
          } catch (error) {
            console.error("Error inserting pending ticket:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error scraping tickets:", error);
    }
  }
  async startMonitoring(intervalMs = 3e5) {
    const authResult = await this.authenticate();
    if (!authResult.isAuthenticated && authResult.authUrl) {
      console.log("Gmail scraper not authenticated. Please authorize using this URL:", authResult.authUrl);
      return authResult;
    }
    this.isMonitoringActive = true;
    console.log("Starting Gmail monitoring...");
    this.monitoringInterval = setInterval(async () => {
      await this.scrapeTickets();
    }, intervalMs);
  }
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.isMonitoringActive = false;
      console.log("Gmail monitoring stopped.");
    }
  }
};
async function initGmailScraper() {
  try {
    console.log("Initializing Gmail scraper...");
    const scraper2 = new GmailScraper();
    try {
      const authResult = await scraper2.authenticate();
      if (!authResult.isAuthenticated && authResult.authUrl) {
        console.log("Authentication required. Please visit this URL to authenticate:");
        console.log(authResult.authUrl);
        return { scraper: scraper2, authUrl: authResult.authUrl };
      } else {
        console.log("Gmail scraper authenticated successfully.");
        return { scraper: scraper2, authUrl: null };
      }
    } catch (error) {
      console.error("Authentication error:", error);
      return { error: "Failed to authenticate with Gmail API" };
    }
  } catch (error) {
    console.error("Failed to initialize Gmail scraper:", error);
    return { error: "Failed to initialize Gmail scraper" };
  }
}

// server/routes.ts
config2();
var scraper = null;
async function registerRoutes(app2) {
  setupAuth(app2);
  (async () => {
    try {
      const result = await initGmailScraper();
      if (result?.scraper) {
        scraper = result.scraper;
        console.log("Gmail scraper initialized successfully");
      }
    } catch (error) {
      console.error("Failed to initialize Gmail scraper:", error);
    }
  })();
  app2.get("/api/admin/export/tickets", requireAdmin, async (req, res) => {
    try {
      const tickets2 = await storage.getAllTickets();
      const csvData = tickets2.map((ticket) => ({
        id: ticket.id,
        eventName: ticket.eventName,
        eventDate: ticket.eventDate,
        venue: ticket.venue,
        section: ticket.section,
        row: ticket.row,
        seat: ticket.seat,
        status: ticket.status,
        askingPrice: ticket.askingPrice,
        createdAt: ticket.createdAt,
        userName: ticket.userName
        // Join with users table
      }));
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=tickets-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`);
      res.write(Object.keys(csvData[0] || {}).join(",") + "\n");
      csvData.forEach((row) => {
        res.write(
          Object.values(row).map((value) => `"${value?.toString().replace(/"/g, '""')}"`).join(",") + "\n"
        );
      });
      res.end();
    } catch (error) {
      console.error("Error exporting tickets:", error);
      res.status(500).json({ error: "Failed to export tickets" });
    }
  });
  app2.get("/api/admin/export/users", requireAdmin, async (req, res) => {
    try {
      const users2 = await storage.getAllUsers();
      const csvData = users2.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        ticketCount: user.ticketCount,
        totalRevenue: user.totalRevenue,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }));
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=users-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`);
      res.write(Object.keys(csvData[0] || {}).join(",") + "\n");
      csvData.forEach((row) => {
        res.write(
          Object.values(row).map((value) => `"${value?.toString().replace(/"/g, '""')}"`).join(",") + "\n"
        );
      });
      res.end();
    } catch (error) {
      console.error("Error exporting users:", error);
      res.status(500).json({ error: "Failed to export users" });
    }
  });
  app2.get("/api/admin/export/sales", requireAdmin, async (req, res) => {
    try {
      const sales = await storage.getAllSales();
      const csvData = sales.map((sale) => ({
        id: sale.id,
        ticketId: sale.ticketId,
        eventName: sale.eventName,
        salePrice: sale.salePrice,
        saleDate: sale.saleDate,
        buyerEmail: sale.buyerEmail,
        sellerUsername: sale.sellerUsername,
        commission: sale.commission
      }));
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=sales-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`);
      res.write(Object.keys(csvData[0] || {}).join(",") + "\n");
      csvData.forEach((row) => {
        res.write(
          Object.values(row).map((value) => `"${value?.toString().replace(/"/g, '""')}"`).join(",") + "\n"
        );
      });
      res.end();
    } catch (error) {
      console.error("Error exporting sales:", error);
      res.status(500).json({ error: "Failed to export sales" });
    }
  });
  app2.get("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("[Routes] Unauthenticated request to /api/profile");
      return res.sendStatus(401);
    }
    try {
      const { password, ...userProfile } = req.user;
      res.json({
        ...userProfile,
        ticketSubmissionEmail: userProfile.uniqueEmail,
        isAdmin: userProfile.isAdmin
      });
    } catch (error) {
      console.error("[Routes] Error getting user profile:", error);
      res.status(500).json({ error: "Failed to retrieve user profile" });
    }
  });
  app2.get("/api/tickets", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("[Routes] Unauthenticated request to /api/tickets");
      return res.sendStatus(401);
    }
    try {
      console.log(`[Routes] Getting tickets for authenticated user: ${req.user.id}`);
      const tickets2 = await storage.getTickets(req.user.id);
      console.log(`[Routes] Successfully retrieved ${tickets2.length} tickets for user ${req.user.id}`);
      res.json(tickets2);
    } catch (error) {
      console.error("[Routes] Error getting tickets:", error);
      res.status(500).json({ error: "Failed to retrieve tickets" });
    }
  });
  app2.post("/api/tickets", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("[Routes] Unauthenticated request to POST /api/tickets");
      return res.sendStatus(401);
    }
    try {
      console.log(`[Routes] Creating new ticket for user ${req.user.id}:`, req.body);
      const validated = insertTicketSchema.parse({
        ...req.body,
        eventDate: new Date(req.body.eventDate)
      });
      const ticket = await storage.createTicket(req.user.id, validated);
      console.log("[Routes] Successfully created ticket:", ticket);
      res.status(201).json(ticket);
    } catch (error) {
      console.error("[Routes] Error creating ticket:", error);
      res.status(400).json({ error: "Failed to create ticket" });
    }
  });
  app2.get("/api/pending-tickets", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("[Routes] Unauthenticated request to /api/pending-tickets");
      return res.sendStatus(401);
    }
    try {
      console.log(`[Routes] Getting pending tickets for user ${req.user.id}`);
      const pendingTickets2 = await storage.getPendingTickets(req.user.id);
      console.log(`[Routes] Successfully retrieved ${pendingTickets2.length} pending tickets`);
      res.json(pendingTickets2);
    } catch (error) {
      console.error("[Routes] Error getting pending tickets:", error);
      res.status(500).json({ error: "Failed to retrieve pending tickets" });
    }
  });
  app2.post("/api/pending-tickets/:id/confirm", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("[Routes] Unauthenticated request to confirm pending ticket");
      return res.sendStatus(401);
    }
    try {
      console.log(`[Routes] Confirming pending ticket ${req.params.id}`);
      const ticket = await storage.confirmPendingTicket(parseInt(req.params.id));
      console.log("[Routes] Successfully confirmed pending ticket:", ticket);
      res.json(ticket);
    } catch (error) {
      console.error("[Routes] Error confirming pending ticket:", error);
      const err = error;
      res.status(400).json({ error: err.message });
    }
  });
  app2.post("/api/email-webhook", async (req, res) => {
    try {
      console.log("Received email webhook:", {
        to: req.body.to,
        from: req.body.from,
        subject: req.body.subject,
        rawData: req.body
        // Log full data for debugging
      });
      const emailData = req.body;
      const toEmail = emailData.to;
      console.log("Looking for user with unique email:", toEmail);
      const [user] = await db.select().from(users).where(eq4(users.uniqueEmail, toEmail));
      if (!user) {
        console.log("No user found for email:", toEmail);
        return res.status(404).json({ error: "User not found for this email address" });
      }
      console.log("Found user:", user.username);
      const ticketData = {
        eventName: emailData.subject.split(" - ")[0] || "",
        eventDate: emailData.parsed?.date || null,
        venue: emailData.parsed?.venue || "",
        section: emailData.parsed?.section || "",
        row: emailData.parsed?.row || "",
        seat: emailData.parsed?.seat || "",
        price: emailData.parsed?.price || null,
        sellerInfo: emailData.parsed?.sellerInfo || "",
        transferDetails: emailData.parsed?.transferDetails || "",
        fullEmailBody: emailData.text || emailData.html || ""
        // Store full email content for reference
      };
      console.log("Extracted ticket data:", ticketData);
      const pendingTicket = await storage.createPendingTicket({
        userId: user.id,
        recipientEmail: toEmail,
        emailSubject: emailData.subject,
        emailFrom: emailData.from,
        rawEmailData: emailData,
        extractedData: ticketData
      });
      console.log("Created pending ticket:", pendingTicket);
      res.status(201).json(pendingTicket);
    } catch (error) {
      console.error("Error processing email:", error);
      res.status(500).json({ error: "Failed to process email" });
    }
  });
  app2.get("/api/payments", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("[Routes] Unauthenticated request to /api/payments");
      return res.sendStatus(401);
    }
    try {
      console.log(`[Routes] Getting payments for authenticated user: ${req.user.id}`);
      const payments2 = await storage.getPayments(req.user.id);
      console.log(`[Routes] Successfully retrieved ${payments2.length} payments for user ${req.user.id}`);
      res.json(payments2);
    } catch (error) {
      console.error("[Routes] Error getting payments:", error);
      res.status(500).json({ error: "Failed to retrieve payments" });
    }
  });
  app2.get("/api/admin/gmail/setup", async (req, res) => {
    try {
      if (!scraper) {
        console.error("[Routes] Gmail scraper not initialized");
        return res.status(500).json({
          error: "Gmail scraper not initialized",
          details: "Please try again in a few moments"
        });
      }
      const authResult = await scraper.authenticate();
      if (!authResult.isAuthenticated) {
        console.log("[Routes] Gmail authentication required, returning auth URL");
        return res.json({
          needsAuth: true,
          authUrl: authResult.authUrl,
          message: "Please visit the following URL to authenticate Gmail access"
        });
      } else {
        console.log("[Routes] Gmail already authenticated");
        return res.json({
          status: "success",
          message: "Gmail already authenticated"
        });
      }
    } catch (error) {
      console.error("[Routes] Error setting up Gmail:", error);
      res.status(500).json({ error: "Failed to setup Gmail integration" });
    }
  });
  app2.get("/api/gmail/callback", async (req, res) => {
    try {
      console.log("[Routes] Received Gmail callback with query:", req.query);
      if (!scraper) {
        throw new Error("Gmail scraper not initialized");
      }
      const state = req.query.state;
      if (state !== "gmail_auth") {
        throw new Error("Invalid state parameter");
      }
      const code = req.query.code;
      if (!code || typeof code !== "string") {
        throw new Error("Invalid or missing authorization code");
      }
      await scraper.handleAuthCallback(code);
      console.log("[Routes] Gmail callback successful, redirecting to /admin/email-monitor");
      res.redirect("/admin/email-monitor");
    } catch (error) {
      console.error("[Routes] Error handling Gmail callback:", error);
      res.status(500).json({
        error: "Failed to handle Gmail callback",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/admin/email/start-monitoring", requireAdmin, async (req, res) => {
    try {
      if (!scraper) {
        return res.status(500).json({
          error: "Gmail scraper not initialized",
          details: "Please try again in a few moments"
        });
      }
      const authResult = await scraper.authenticate();
      if (!authResult.isAuthenticated && authResult.authUrl) {
        return res.status(401).json({
          needsAuth: true,
          authUrl: authResult.authUrl,
          message: "Gmail authentication required"
        });
      }
      await scraper.startMonitoring();
      res.json({
        message: "Email monitoring started successfully",
        isAuthenticated: true,
        isMonitoring: true
      });
    } catch (error) {
      console.error("[Routes] Error in email monitoring:", error);
      res.status(500).json({
        error: "Failed to start email monitoring",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.get("/api/admin/email/status", requireAdmin, async (req, res) => {
    try {
      if (!scraper) {
        return res.status(500).json({
          error: "Gmail scraper not initialized",
          isConnected: false,
          isMonitoring: false
        });
      }
      const authResult = await scraper.authenticate();
      res.json({
        isConnected: authResult.isAuthenticated,
        isAuthenticated: authResult.isAuthenticated,
        authUrl: authResult.authUrl,
        isMonitoring: scraper.isMonitoring(),
        lastChecked: scraper.getLastChecked(),
        recentEmails: await scraper.getRecentEmails()
      });
    } catch (error) {
      console.error("[Routes] Error getting email status:", error);
      res.status(500).json({
        error: "Failed to get email status",
        details: error instanceof Error ? error.message : "Unknown error",
        isConnected: false,
        isMonitoring: false
      });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
import { config as config3 } from "dotenv";
import { resolve as resolve2 } from "path";
config3({ path: resolve2(process.cwd(), ".env") });
console.log("=== Environment Configuration ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
var dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ":****@");
  console.log("DATABASE_URL present:", maskedUrl.substring(0, 20) + "...");
} else {
  console.error("WARNING: DATABASE_URL is not defined!");
}
console.log("PGHOST present:", !!process.env.PGHOST);
console.log("PGUSER present:", !!process.env.PGUSER);
console.log("PGDATABASE present:", !!process.env.PGDATABASE);
console.log("PGPORT present:", !!process.env.PGPORT);
console.log("PGPASSWORD present:", !!process.env.PGPASSWORD);
console.log("==============================");
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.REPLIT_DOMAIN,
    // Replit domain
    process.env.CUSTOM_DOMAIN,
    // Custom domain
    process.env.HEROKU_APP_URL,
    // Heroku app URL
    "http://localhost:5000",
    // Local development
    "https://sellmyseats.rgnack.com"
    // Our Cloudflare domain
  ].filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });
  next();
});
async function createRequestHandler(request) {
  if (!globalThis.server) {
    try {
      console.log("Registering routes...");
      const server = await registerRoutes(app);
      console.log("Routes registered successfully");
      app.use((err, _req, res, _next) => {
        console.error("Server error:", err);
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
      });
      console.log("Setting up static file serving for production...");
      serveStatic(app);
      try {
        console.log("Starting Gmail scraper initialization...");
        console.log("Checking environment variables:");
        console.log("- GOOGLE_CLIENT_ID exists:", !!process.env.GOOGLE_CLIENT_ID);
        console.log("- GOOGLE_CLIENT_SECRET exists:", !!process.env.GOOGLE_CLIENT_SECRET);
        console.log("- GOOGLE_TOKEN exists:", !!process.env.GOOGLE_TOKEN);
        const scraperResult = await initGmailScraper();
        console.log(
          "Gmail scraper initialization result:",
          scraperResult ? scraperResult.authUrl ? "Authentication needed" : "Success" : "Failed"
        );
        if (scraperResult?.error) {
          console.error("Gmail scraper initialization error details:", scraperResult.error);
        }
      } catch (error) {
        console.error("Gmail scraper initialization error:", error);
      }
      globalThis.server = server;
    } catch (error) {
      console.error("Failed to initialize server:", error);
      throw error;
    }
  }
  try {
    return new Promise((resolve3, reject) => {
      const expressRequest = createExpressRequest(request);
      const expressResponse = createExpressResponse(resolve3);
      app(expressRequest, expressResponse);
    });
  } catch (error) {
    console.error("Error handling request:", error);
    return new Response("Server Error", { status: 500 });
  }
}
function createExpressRequest(workerRequest) {
  const url = new URL(workerRequest.url);
  return {
    method: workerRequest.method,
    url: url.pathname + url.search,
    headers: Object.fromEntries(workerRequest.headers.entries()),
    body: workerRequest.body,
    query: Object.fromEntries(url.searchParams),
    params: {}
  };
}
function createExpressResponse(resolve3) {
  const headers = new Headers();
  let statusCode = 200;
  let body = "";
  return {
    setHeader: (name, value) => {
      headers.set(name, value);
      return this;
    },
    status: (code) => {
      statusCode = code;
      return this;
    },
    send: (data) => {
      body = data;
      resolve3(new Response(body, { status: statusCode, headers }));
    },
    json: (data) => {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(data);
      resolve3(new Response(body, { status: statusCode, headers }));
    }
    // Add other response methods as needed
  };
}
if (process.env.NODE_ENV !== "cloudflare") {
  (async () => {
    try {
      console.log("Registering routes...");
      const server = await registerRoutes(app);
      console.log("Routes registered successfully");
      app.use((err, _req, res, _next) => {
        console.error("Server error:", err);
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
      });
      if (process.env.NODE_ENV !== "production") {
        console.log("Setting up Vite middleware for development...");
        await setupVite(app, server);
      } else {
        console.log("Setting up static file serving for production...");
        serveStatic(app);
      }
      try {
        console.log("Starting Gmail scraper initialization...");
        console.log("Checking environment variables:");
        console.log("- GOOGLE_CLIENT_ID exists:", !!process.env.GOOGLE_CLIENT_ID);
        console.log("- GOOGLE_CLIENT_SECRET exists:", !!process.env.GOOGLE_CLIENT_SECRET);
        console.log("- GOOGLE_TOKEN exists:", !!process.env.GOOGLE_TOKEN);
        const scraperResult = await initGmailScraper();
        console.log(
          "Gmail scraper initialization result:",
          scraperResult ? scraperResult.authUrl ? "Authentication needed" : "Success" : "Failed"
        );
        if (scraperResult?.error) {
          console.error("Gmail scraper initialization error details:", scraperResult.error);
        }
      } catch (error) {
        console.error("Gmail scraper initialization error:", error);
      }
      const port = process.env.PORT || 5001;
      server.listen({
        port,
        host: "0.0.0.0"
      }, () => {
        log(`Server running at http://0.0.0.0:${port}`);
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  })();
}
export {
  createRequestHandler
};
