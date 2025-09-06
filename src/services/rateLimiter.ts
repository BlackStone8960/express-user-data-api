import { RateLimitInfo } from "../types";
import { logDebug, logWarn } from "../utils/logger";

interface RateLimitEntry {
  requests: number[];
  burstRequests: number[];
}

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  burstWindowMs: number; // Burst window in milliseconds
  maxBurstRequests: number; // Maximum burst requests
}

// Rate limit configuration
const RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  burstWindowMs: 10 * 1000, // 10 seconds
  maxBurstRequests: 5, // 5 requests per 10 seconds
};

// Global rate limit storage (in production, this would be Redis or similar)
let rateLimitStore = new Map<string, RateLimitEntry>();

const getClientIdentifier = (req: {
  ip?: string | undefined;
  get: (header: string) => string | undefined;
}): string => {
  // Try to get real IP from various headers (for reverse proxy scenarios)
  const forwardedFor = req.get("X-Forwarded-For");
  const realIp = req.get("X-Real-IP");
  const clientIp =
    forwardedFor?.split(",")[0]?.trim() || realIp || req.ip || "unknown";

  return clientIp;
};

const cleanupExpiredRequests = (
  requests: number[],
  windowMs: number
): number[] => {
  const now = Date.now();
  return requests.filter((timestamp) => now - timestamp < windowMs);
};

const isRateLimited = (
  entry: RateLimitEntry,
  config: RateLimitConfig
): boolean => {
  // Clean up expired requests
  entry.requests = cleanupExpiredRequests(entry.requests, config.windowMs);
  entry.burstRequests = cleanupExpiredRequests(
    entry.burstRequests,
    config.burstWindowMs
  );

  // Check burst limit (5 requests in 10 seconds)
  if (entry.burstRequests.length >= config.maxBurstRequests) {
    logWarn(
      `Burst rate limit exceeded: ${entry.burstRequests.length}/${config.maxBurstRequests} in ${config.burstWindowMs}ms`
    );
    return true;
  }

  // Check main rate limit (10 requests in 1 minute)
  if (entry.requests.length >= config.maxRequests) {
    logWarn(
      `Rate limit exceeded: ${entry.requests.length}/${config.maxRequests} in ${config.windowMs}ms`
    );
    return true;
  }

  return false;
};

const addRequest = (entry: RateLimitEntry, config: RateLimitConfig): void => {
  const now = Date.now();

  // Add to both windows
  entry.requests.push(now);
  entry.burstRequests.push(now);

  // Clean up expired requests
  entry.requests = cleanupExpiredRequests(entry.requests, config.windowMs);
  entry.burstRequests = cleanupExpiredRequests(
    entry.burstRequests,
    config.burstWindowMs
  );
};

const getRateLimitInfo = (
  entry: RateLimitEntry,
  config: RateLimitConfig
): RateLimitInfo => {
  // Clean up expired requests
  entry.requests = cleanupExpiredRequests(entry.requests, config.windowMs);
  entry.burstRequests = cleanupExpiredRequests(
    entry.burstRequests,
    config.burstWindowMs
  );

  // Calculate reset time (when the oldest request in the window expires)
  const now = Date.now();
  const oldestRequest = Math.min(
    ...entry.requests,
    ...entry.burstRequests,
    now
  );

  const resetTime = oldestRequest + config.windowMs;

  return {
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.requests.length),
    resetTime: Math.ceil(resetTime / 1000), // Convert to seconds
  };
};

export const checkRateLimit = (req: {
  ip?: string | undefined;
  get: (header: string) => string | undefined;
}): {
  allowed: boolean;
  info: RateLimitInfo;
} => {
  const clientId = getClientIdentifier(req);

  // Get or create rate limit entry for this client
  let entry = rateLimitStore.get(clientId);
  if (!entry) {
    entry = {
      requests: [],
      burstRequests: [],
    };
    rateLimitStore.set(clientId, entry);
  }

  // Check if rate limited
  const isLimited = isRateLimited(entry, RATE_LIMIT_CONFIG);

  if (!isLimited) {
    // Add the request
    addRequest(entry, RATE_LIMIT_CONFIG);
    logDebug(`Rate limit check passed for client: ${clientId}`);
  } else {
    logWarn(`Rate limit check failed for client: ${clientId}`);
  }

  const info = getRateLimitInfo(entry, RATE_LIMIT_CONFIG);

  return {
    allowed: !isLimited,
    info,
  };
};

export const getRateLimitStats = (): {
  totalClients: number;
  activeClients: number;
  config: RateLimitConfig;
} => {
  let activeClients = 0;

  // Count active clients (those with recent requests)
  const now = Date.now();
  for (const entry of rateLimitStore.values()) {
    const recentRequests = entry.requests.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_CONFIG.windowMs
    );
    if (recentRequests.length > 0) {
      activeClients++;
    }
  }

  return {
    totalClients: rateLimitStore.size,
    activeClients,
    config: RATE_LIMIT_CONFIG,
  };
};

export const clearRateLimitStore = (): void => {
  rateLimitStore.clear();
  logDebug("Rate limit store cleared");
};

// Background cleanup task to remove old entries
let cleanupInterval: NodeJS.Timeout | null = null;

export const startRateLimitCleanup = (): void => {
  if (cleanupInterval) {
    return; // Already running
  }

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let removedCount = 0;

    for (const [clientId, entry] of rateLimitStore.entries()) {
      // Remove entries that have no recent activity
      const recentRequests = entry.requests.filter(
        (timestamp) => now - timestamp < RATE_LIMIT_CONFIG.windowMs * 2 // Keep for 2 windows
      );

      if (recentRequests.length === 0) {
        rateLimitStore.delete(clientId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logDebug(`Cleaned up ${removedCount} inactive rate limit entries`);
    }
  }, 5 * 60 * 1000); // Run every 5 minutes

  logDebug("Started rate limit cleanup background task");
};

export const stopRateLimitCleanup = (): void => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logDebug("Stopped rate limit cleanup background task");
  }
};
