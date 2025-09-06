import { createApp, startServer } from "./app";
import { logError, logInfo } from "./utils/logger";

// Get port from environment variable or use default
const PORT = process.env["PORT"] ? parseInt(process.env["PORT"], 10) : 3000;

// Validate port number
if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  logError(
    "Invalid port number. Please provide a valid port between 1 and 65535."
  );
  process.exit(1);
}

// Graceful shutdown handling
const gracefulShutdown = (signal: string): void => {
  logInfo(`Received ${signal}. Starting graceful shutdown...`);

  // Give ongoing requests time to complete
  setTimeout(() => {
    logInfo("Graceful shutdown completed");
    process.exit(0);
  }, 5000);
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Create and start the application
try {
  const app = createApp();
  startServer(app, PORT);
} catch (error) {
  logError("Failed to start server", error);
  process.exit(1);
}
