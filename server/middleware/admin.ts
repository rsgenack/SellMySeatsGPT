import { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    console.log('[Admin Middleware] Unauthorized: User not authenticated');
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.user.isAdmin) {
    console.log('[Admin Middleware] Forbidden: User not admin', { username: req.user.username });
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }

  console.log('[Admin Middleware] Admin access granted for user:', req.user.username);
  next();
}