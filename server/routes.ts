import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { mortiseTemplateSchema } from "@shared/schema";
import * as path from 'path';
import * as fs from 'fs/promises';

export function registerRoutes(app: Express): Server {
  app.post("/api/generate", async (req, res) => {
    try {
      const params = mortiseTemplateSchema.parse(req.body);
      const { filePath, content } = await storage.generateSTLFile(params);

      // Set proper headers for STL file
      res.setHeader('Content-Type', 'application/sla');
      res.setHeader('Content-Disposition', `attachment; filename="mortise_template.stl"`);

      // Send the actual STL file content
      res.send(content);
    } catch (error) {
      console.error('Error generating STL:', error);
      res.status(400).json({ error: "Failed to generate STL file" });
    }
  });

  app.get("/api/preview/:filename", async (req, res) => {
    const filePath = path.join(process.cwd(), 'temp', req.params.filename);
    try {
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) {
        return res.status(404).json({ error: "File not found" });
      }

      // Set proper headers for STL preview
      res.setHeader('Content-Type', 'application/sla');
      res.sendFile(filePath);
    } catch (error) {
      console.error('Error serving preview:', error);
      res.status(500).json({ error: "Failed to serve preview file" });
    }
  });

  app.get("/api/download/:filename", async (req, res) => {
    const filePath = path.join(process.cwd(), 'temp', req.params.filename);
    try {
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) {
        return res.status(404).json({ error: "File not found" });
      }
      res.download(filePath, "mortise_template.stl", async (err) => {
        if (!err) {
          // Delete the file after successful download
          await fs.unlink(filePath).catch(console.error);
        }
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}