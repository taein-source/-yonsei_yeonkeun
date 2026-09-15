import type { Request, Response } from "express";
import app from "../server.ts";

export default function handler(req: Request, res: Response) {
  // Vercel routes /api/(.*) to /api, which strips the /api prefix in req.url.
  // Restore /api so all Express endpoints registered in server.ts match reliably.
  if (req.url && !req.url.startsWith("/api")) {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }
  return (app as any)(req, res);
}

