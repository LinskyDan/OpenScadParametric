import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { nanoid } from "nanoid";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add cache control headers
app.use((req, res, next) => {
  // Prevent caching for HTML files
  if (req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Enhanced logging middleware with request tracking
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  let server: any;

  // Graceful shutdown handler with enhanced logging
  const shutdown = () => {
    log("Initiating graceful shutdown...");
    if (server) {
      log("Attempting to close server connections...");
      server.close(() => {
        log("Server closed successfully");
        process.exit(0);
      });

      // Force close after 10s
      setTimeout(() => {
        log("Force closing server after timeout");
        process.exit(1);
      }, 10000);
    }
  };

  // Handle process signals
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    log("Starting server initialization...");
    server = registerRoutes(app);
    log("Routes registered successfully");

    // Error handling middleware with detailed logging
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error occurred: ${status} - ${message}`);
      res.status(status).json({ message });
      throw err;
    });

    // Environment-specific setup with enhanced logging
    const isDev = process.env.NODE_ENV !== "production";
    log(`Running in ${isDev ? 'development' : 'production'} mode`);

    if (isDev) {
      log("Setting up Vite development server...");
      await setupVite(app, server);
      log("Vite development server setup complete");
    } else {
      log("Setting up static file serving for production...");
      serveStatic(app);
      log("Static file serving setup complete");
    }

    // Use Replit-assigned port or fallback to 5000
    const PORT = process.env.PORT || 5000;
    log(`Attempting to bind to port ${PORT}...`);

    server.listen(PORT, "0.0.0.0", () => {
      log(`Server successfully bound to port ${PORT}`);
    });

    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        log(`Port ${PORT} is already in use. Please ensure no other instance is running.`);
        process.exit(1);
      } else {
        log(`Server error occurred: ${error.message}`);
        throw error;
      }
    });
  } catch (error) {
    log(`Fatal error during server initialization: ${error}`);
    process.exit(1);
  }
})();