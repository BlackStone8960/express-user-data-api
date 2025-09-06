import cors from "cors";
import express, { Application, Request, Response } from "express";
import helmet from "helmet";
import {
  clearCache,
  getCacheStats,
  getFromCache,
  setCache,
  startCacheCleanup,
} from "./services/cache";
import { getUserById } from "./services/mockData";
import { logError, logInfo } from "./utils/logger";
import { ResponseHelper } from "./utils/response";

const createApp = (): Application => {
  const app = express();

  setupMiddlewares(app);
  setupRoutes(app);
  setupErrorHandling(app);

  // Start cache cleanup background task
  startCacheCleanup();

  return app;
};

const setupMiddlewares = (app: Application): void => {
  // Security middleware
  app.use(helmet());

  // CORS middleware
  app.use(
    cors({
      origin: process.env["ALLOWED_ORIGINS"]?.split(",") || [
        "http://localhost:3000",
      ],
      credentials: true,
    })
  );

  // Body parsing middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Request logging middleware
  app.use((req: Request, res: Response, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      logInfo(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get("User-Agent"),
        ip: req.ip,
      });
    });

    next();
  });
};

const setupRoutes = (app: Application): void => {
  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    ResponseHelper.success(
      res,
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
      "Service is healthy"
    );
  });

  // API routes will be added here
  app.get("/api", (_req: Request, res: Response) => {
    ResponseHelper.success(
      res,
      {
        message: "User Data API",
        version: "1.0.0",
        endpoints: [
          "GET /api/users/:id - Get user by ID",
          "POST /api/users - Create new user",
          "GET /api/cache-status - Get cache statistics",
          "DELETE /api/cache - Clear cache",
        ],
      },
      "API information"
    );
  });

  // Cache status endpoint
  app.get("/api/cache-status", (_req: Request, res: Response) => {
    const stats = getCacheStats();
    ResponseHelper.success(res, stats, "Cache statistics retrieved");
  });

  // Get user by ID endpoint with caching
  app.get("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params["id"] || "0", 10);

      if (isNaN(userId) || userId <= 0) {
        ResponseHelper.badRequest(
          res,
          "Invalid user ID. Must be a positive integer."
        );
        return;
      }

      const cacheKey = `user:${userId}`;

      // Try to get from cache first
      const cachedUser = getFromCache(cacheKey);
      if (cachedUser) {
        logInfo(`User ${userId} retrieved from cache`);
        ResponseHelper.success(res, cachedUser, "User retrieved from cache");
        return;
      }

      // If not in cache, fetch from database
      logInfo(`User ${userId} not in cache, fetching from database`);
      const user = await getUserById(userId);

      if (!user) {
        ResponseHelper.notFound(res, `User with ID ${userId} not found`);
        return;
      }

      // Cache the result
      setCache(cacheKey, user);
      logInfo(`User ${userId} cached for future requests`);

      ResponseHelper.success(res, user, "User retrieved from database");
    } catch (error) {
      logError("Error retrieving user", error);
      ResponseHelper.internalError(res, "Failed to retrieve user");
    }
  });

  // Clear cache endpoint
  app.delete("/api/cache", (_req: Request, res: Response) => {
    try {
      clearCache();
      ResponseHelper.success(
        res,
        { message: "Cache cleared successfully" },
        "Cache cleared"
      );
    } catch (error) {
      logError("Error clearing cache", error);
      ResponseHelper.internalError(res, "Failed to clear cache");
    }
  });

  // 404 handler for undefined routes
  app.use("*", (req: Request, res: Response) => {
    ResponseHelper.notFound(res, `Route ${req.originalUrl} not found`);
  });
};

const setupErrorHandling = (app: Application): void => {
  // Global error handler
  app.use(
    (
      error: Error,
      _req: Request,
      res: Response,
      _next: express.NextFunction
    ) => {
      logError("Unhandled error occurred", error);
      ResponseHelper.internalError(res, "An unexpected error occurred");
    }
  );

  // Handle uncaught exceptions
  process.on("uncaughtException", (error: Error) => {
    logError("Uncaught Exception", error);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason: unknown) => {
    logError("Unhandled Rejection", reason);
    process.exit(1);
  });
};

const startServer = (app: Application, port: number): void => {
  app.listen(port, () => {
    logInfo(`Server is running on port ${port}`);
    logInfo(`Health check available at http://localhost:${port}/health`);
    logInfo(`API documentation at http://localhost:${port}/api`);
  });
};

export { createApp, startServer };
