import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { mortiseTemplateSchema } from "@shared/schema";

export function registerRoutes(app: Express): Server {
  app.post("/api/generate", async (req, res) => {
    try {
      const params = mortiseTemplateSchema.parse(req.body);
      const scadContent = await storage.generateOpenSCADFile(params);
      res.json({ content: scadContent });
    } catch (error) {
      res.status(400).json({ error: "Invalid parameters" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
