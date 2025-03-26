import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { db } from "./db";
import { passwordResetTokens, users } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

declare global {
  namespace Express {
    interface User extends SelectUser {
      isAdmin: boolean;
    }
  }
}

const scryptAsync = promisify(scrypt);

// Admin user credentials
const ADMIN_EMAIL = "greenbaumamichael@gmail.com";
const ADMIN_PASSWORD = "michael101";

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function generateUniqueEmail(username: string): string {
  const randomStr = randomBytes(6).toString('hex');
  return `${username}.${randomStr}@seatxfer.com`;
}

async function generatePasswordResetToken(userId: number): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.insert(passwordResetTokens).values({
    userId,
    token,
    expiresAt,
  });

  return token;
}

async function validatePasswordResetToken(token: string): Promise<number | null> {
  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        isNull(passwordResetTokens.usedAt),
        eq(passwordResetTokens.expiresAt > new Date(), true)
      )
    );

  if (!resetToken) {
    return null;
  }

  return resetToken.userId;
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: 'email' },
      async (email, password, done) => {
        try {
          // Special case for admin user with hardcoded credentials
          if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            console.log('[Auth] Admin login detected');
            // Check if admin user exists in database
            const [adminUser] = await db
              .select()
              .from(users)
              .where(eq(users.email, ADMIN_EMAIL));
              
            if (adminUser) {
              // Admin exists, return with admin privileges forced to true
              return done(null, {
                ...adminUser,
                isAdmin: true
              });
            } else {
              // Create admin user if it doesn't exist
              console.log('[Auth] Creating admin user account');
              const uniqueEmail = generateUniqueEmail('admin');
              const adminUser = await storage.createUser({
                username: 'admin',
                password: await hashPassword(ADMIN_PASSWORD),
                email: ADMIN_EMAIL,
                uniqueEmail,
                isAdmin: true
              });
              
              return done(null, {
                ...adminUser,
                isAdmin: true
              });
            }
          }
          
          // Regular user authentication
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email));

          if (!user || !(await comparePasswords(password, user.password))) {
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

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      
      // Force admin status for the specific email
      const isAdmin = user.email === ADMIN_EMAIL ? true : Boolean(user.isAdmin);
      
      done(null, {
        ...user,
        isAdmin
      });
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    const { username, password, email } = req.body;

    try {
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

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
      console.error('Registration error:', error);
      res.status(500).json({ message: "Internal server error during registration" });
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Password reset request
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { email } = req.body;
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const token = await generatePasswordResetToken(user.id);

      // In a real system, you would send this token via email
      // For development, we'll return it in the response
      res.json({
        message: "Password reset initiated",
        resetToken: token // Only for development!
      });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ message: "Failed to initiate password reset" });
    }
  });

  // Reset password with token
  app.post("/api/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { newPassword } = req.body;

      const userId = await validatePasswordResetToken(token);
      if (!userId) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      const hashedPassword = await hashPassword(newPassword);
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, userId));

      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.token, token));

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
}