import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {
      isAdmin: boolean; // Matches the schema definition
    }
  }
}

const scryptAsync = promisify(scrypt);

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
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        // Ensure isAdmin is a boolean
        return done(null, {
          ...user,
          isAdmin: Boolean(user.isAdmin)
        });
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      // Ensure isAdmin is a boolean
      done(null, {
        ...user,
        isAdmin: Boolean(user.isAdmin)
      });
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    const { username, password, email } = req.body;

    try {
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const uniqueEmail = generateUniqueEmail(username);
      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        email: email || uniqueEmail,
        uniqueEmail,
        isAdmin: false // Explicitly set isAdmin to false for new users
      });

      // Ensure isAdmin is boolean in the session
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
}