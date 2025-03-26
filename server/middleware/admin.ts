import { Request, Response, NextFunction } from "express";

// Admin user email
const ADMIN_EMAIL = "greenbaumamichael@gmail.com";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    console.log('[Admin Middleware] Unauthorized: User not authenticated');
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Only allow the specific admin email
  if (req.user.email !== ADMIN_EMAIL) {
    console.log('[Admin Middleware] Forbidden: Access restricted to specific admin email', { 
      attempted: req.user.email, 
      required: ADMIN_EMAIL 
    });
    return res.status(403).json({ error: "Forbidden - Admin access restricted" });
  }

  // Double-check isAdmin flag as well
  if (!req.user.isAdmin) {
    console.log('[Admin Middleware] Forbidden: User not admin', { username: req.user.username });
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }

  console.log('[Admin Middleware] Admin access granted for user:', req.user.username);
  next();
}