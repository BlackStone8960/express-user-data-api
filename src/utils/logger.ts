interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: unknown;
}

// Global logs array (module-level state)
let logs: LogEntry[] = [];

const createLogEntry = (
  level: string,
  message: string,
  data?: unknown
): LogEntry => ({
  timestamp: new Date().toISOString(),
  level,
  message,
  data,
});

const logToConsole = (entry: LogEntry): void => {
  const { timestamp, level, message, data } = entry;
  const formattedData = data ? JSON.stringify(data, null, 2) : "";

  switch (level) {
    case "ERROR":
      console.error(`[${timestamp}] ERROR: ${message}`, data);
      break;
    case "WARN":
      console.warn(`[${timestamp}] WARN: ${message}`, formattedData);
      break;
    case "DEBUG":
      console.debug(`[${timestamp}] DEBUG: ${message}`, formattedData);
      break;
    default:
      console.log(`[${timestamp}] INFO: ${message}`, formattedData);
  }
};

export const logInfo = (message: string, data?: unknown): void => {
  const entry = createLogEntry("INFO", message, data);
  logs.push(entry);
  logToConsole(entry);
};

export const logError = (message: string, error?: Error | unknown): void => {
  const entry = createLogEntry("ERROR", message, error);
  logs.push(entry);
  logToConsole(entry);
};

export const logWarn = (message: string, data?: unknown): void => {
  const entry = createLogEntry("WARN", message, data);
  logs.push(entry);
  logToConsole(entry);
};

export const logDebug = (message: string, data?: unknown): void => {
  const entry = createLogEntry("DEBUG", message, data);
  logs.push(entry);
  logToConsole(entry);
};

export const getLogs = (limit?: number): LogEntry[] => {
  return limit ? logs.slice(-limit) : logs;
};

export const clearLogs = (): void => {
  logs = [];
};
