import cors from "cors";
import express, { Application, Request, Response } from "express";
import helmet from "helmet";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import {
  clearCache,
  deleteFromCache,
  getCacheStats,
  getFromCache,
  setCache,
  startCacheCleanup,
} from "./services/cache";
import { createUser, getUserById } from "./services/mockData";
import { addJob, getQueueStats, startQueueCleanup } from "./services/queue";
import {
  getRateLimitStats,
  startRateLimitCleanup,
} from "./services/rateLimiter";
import { logError, logInfo } from "./utils/logger";
import { ResponseHelper } from "./utils/response";

const createApp = (): Application => {
  const app = express();

  setupMiddlewares(app);
  setupRoutes(app);
  setupErrorHandling(app);

  // Start background tasks
  startCacheCleanup();
  startRateLimitCleanup();
  startQueueCleanup();

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

  // Rate limiting middleware (applied to all routes)
  app.use(rateLimitMiddleware);

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
          "DELETE /api/cache/:key - Delete specific cache entry",
          "GET /api/rate-limit-status - Get rate limit statistics",
          "GET /api/queue-status - Get queue statistics",
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

  // Get user by ID endpoint with caching and async processing
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

      // If not in cache, process through queue
      logInfo(`User ${userId} not in cache, processing through queue`);

      const user = await addJob(userId, async (job) => {
        logInfo(
          `Processing database request for user ${job.userId} (job: ${job.id})`
        );
        const userData = await getUserById(job.userId);

        if (!userData) {
          throw new Error(`User with ID ${job.userId} not found`);
        }

        // Cache the result
        setCache(cacheKey, userData);
        logInfo(`User ${job.userId} cached for future requests`);

        return userData;
      });

      ResponseHelper.success(
        res,
        user,
        "User retrieved from database via queue"
      );
    } catch (error) {
      logError("Error retrieving user", error);
      if (error instanceof Error && error.message.includes("not found")) {
        ResponseHelper.notFound(res, error.message);
      } else {
        ResponseHelper.internalError(res, "Failed to retrieve user");
      }
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

  // Delete specific cache entry endpoint
  app.delete("/api/cache/:key", (req: Request, res: Response) => {
    try {
      const cacheKey = req.params["key"];

      if (!cacheKey) {
        ResponseHelper.badRequest(res, "Cache key is required");
        return;
      }

      const deleted = deleteFromCache(cacheKey);

      if (deleted) {
        ResponseHelper.success(
          res,
          { message: `Cache entry '${cacheKey}' deleted successfully` },
          "Cache entry deleted"
        );
      } else {
        ResponseHelper.notFound(res, `Cache entry '${cacheKey}' not found`);
      }
    } catch (error) {
      logError("Error deleting cache entry", error);
      ResponseHelper.internalError(res, "Failed to delete cache entry");
    }
  });

  // Rate limit status endpoint
  app.get("/api/rate-limit-status", (_req: Request, res: Response) => {
    try {
      const stats = getRateLimitStats();
      ResponseHelper.success(res, stats, "Rate limit statistics retrieved");
    } catch (error) {
      logError("Error retrieving rate limit stats", error);
      ResponseHelper.internalError(
        res,
        "Failed to retrieve rate limit statistics"
      );
    }
  });

  // Queue status endpoint
  app.get("/api/queue-status", (_req: Request, res: Response) => {
    try {
      const stats = getQueueStats();
      ResponseHelper.success(res, stats, "Queue statistics retrieved");
    } catch (error) {
      logError("Error retrieving queue stats", error);
      ResponseHelper.internalError(res, "Failed to retrieve queue statistics");
    }
  });

  // Create user endpoint
  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const { name, email } = req.body;

      // Validate required fields
      if (!name || !email) {
        ResponseHelper.badRequest(res, "Name and email are required fields");
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        ResponseHelper.badRequest(res, "Invalid email format");
        return;
      }

      // Validate name length
      if (name.length < 2 || name.length > 100) {
        ResponseHelper.badRequest(
          res,
          "Name must be between 2 and 100 characters"
        );
        return;
      }

      logInfo(`Creating new user: ${name} (${email})`);

      const newUser = await createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
      });

      // Cache the new user
      const cacheKey = `user:${newUser.id}`;
      setCache(cacheKey, newUser);
      logInfo(`New user ${newUser.id} cached`);

      ResponseHelper.success(res, newUser, "User created successfully", 201);
    } catch (error) {
      logError("Error creating user", error);
      ResponseHelper.internalError(res, "Failed to create user");
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
