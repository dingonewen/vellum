import type { Request, Response, NextFunction } from "express";
import type { SessionStore } from "../stores/sessionStore";

export function requireAuth(sessionStore: SessionStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const sessionId = req.cookies?.session_id as string | undefined;
    if (!sessionId) {
      res.status(401).json({ error: "Not authenticated. Connect a mailbox first." });
      return;
    }
    const session = sessionStore.find(sessionId);
    if (!session) {
      res.status(401).json({ error: "Session expired. Please reconnect." });
      return;
    }
    req.userId = session.userId;
    next();
  };
}
