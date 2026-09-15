import type { Request, Response } from "express";
import app from "../server.ts";

export default function handler(req: Request, res: Response) {
  // CORS header setup for Vercel Serverless Function entrypoint
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Vercel routes /api/(.*) to /api, which strips the /api prefix in req.url.
  // Restore /api so all Express endpoints registered in server.ts match reliably.
  if (req.url && !req.url.startsWith("/api")) {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }

  return (app as any)(req, res);
}


