import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { mortiseTemplateSchema } from "@shared/schema";

export function registerRoutes(app: Express): Server {
  app.post("/api/generate", async (req, res) => {
    try {
      const params = mortiseTemplateSchema.parse(req.body);
      const stlContent = await storage.generateSTLFile(params);

      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="mortise_template.stl"'
      });

      res.send(stlContent);
    } catch (error) {
      console.error('Error:', error);
      res.status(400).json({ error: "Failed to generate STL file" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}