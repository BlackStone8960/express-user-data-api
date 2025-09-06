import { CacheEntry, CacheStats } from "../types";
import { logDebug, logInfo } from "../utils/logger";

// Cache configuration
const CACHE_TTL = 60 * 1000; // 60 seconds in milliseconds
const MAX_CACHE_SIZE = 100; // Maximum number of items in cache

// Global cache state
let cache = new Map<string, CacheEntry<unknown>>();
let stats: CacheStats = {
  hits: 0,
  misses: 0,
  size: 0,
  maxSize: MAX_CACHE_SIZE,
  averageResponseTime: 0,
};

// Track response times for average calculation
let responseTimes: number[] = [];

const isExpired = (entry: CacheEntry<unknown>): boolean => {
  return Date.now() - entry.timestamp > entry.ttl;
};

const removeExpiredEntries = (): void => {
  const now = Date.now();
  let removedCount = 0;

  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    logDebug(`Removed ${removedCount} expired cache entries`);
    updateStats();
  }
};

const evictLRU = (): void => {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Find the least recently used entry (oldest timestamp)
    let oldestKey = "";
    let oldestTime = Date.now();

    for (const [key, entry] of cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey);
      logDebug(`Evicted LRU cache entry: ${oldestKey}`);
    }
  }
};

const updateStats = (): void => {
  stats.size = cache.size;

  // Calculate average response time
  if (responseTimes.length > 0) {
    const sum = responseTimes.reduce((acc, time) => acc + time, 0);
    stats.averageResponseTime = Math.round(sum / responseTimes.length);
  }
};

const recordResponseTime = (responseTime: number): void => {
  responseTimes.push(responseTime);

  // Keep only last 100 response times for average calculation
  if (responseTimes.length > 100) {
    responseTimes = responseTimes.slice(-100);
  }

  updateStats();
};

export const getFromCache = <T>(key: string): T | null => {
  const startTime = Date.now();

  const entry = cache.get(key);

  if (!entry) {
    stats.misses++;
    logDebug(`Cache miss for key: ${key}`);
    recordResponseTime(Date.now() - startTime);
    return null;
  }

  if (isExpired(entry)) {
    cache.delete(key);
    stats.misses++;
    logDebug(`Cache expired for key: ${key}`);
    recordResponseTime(Date.now() - startTime);
    return null;
  }

  // Update timestamp to mark as recently used
  entry.timestamp = Date.now();
  cache.set(key, entry);

  stats.hits++;
  logDebug(`Cache hit for key: ${key}`);
  recordResponseTime(Date.now() - startTime);

  return entry.value as T;
};

export const setCache = <T>(
  key: string,
  value: T,
  ttl: number = CACHE_TTL
): void => {
  const startTime = Date.now();

  // Remove expired entries before adding new one
  removeExpiredEntries();

  // Evict LRU if cache is full
  evictLRU();

  const entry: CacheEntry<T> = {
    value,
    timestamp: Date.now(),
    ttl,
  };

  cache.set(key, entry);
  logDebug(`Cached value for key: ${key} with TTL: ${ttl}ms`);
  recordResponseTime(Date.now() - startTime);
};

export const deleteFromCache = (key: string): boolean => {
  const startTime = Date.now();
  const existed = cache.delete(key);

  if (existed) {
    logDebug(`Deleted cache entry: ${key}`);
  }

  recordResponseTime(Date.now() - startTime);
  return existed;
};

export const clearCache = (): void => {
  const startTime = Date.now();
  const size = cache.size;

  cache.clear();
  stats.hits = 0;
  stats.misses = 0;
  stats.size = 0;
  responseTimes = [];

  logInfo(`Cleared entire cache (${size} entries removed)`);
  recordResponseTime(Date.now() - startTime);
};

export const getCacheStats = (): CacheStats => {
  // Remove expired entries before returning stats
  removeExpiredEntries();
  updateStats();

  return { ...stats };
};

export const getCacheKeys = (): string[] => {
  removeExpiredEntries();
  return Array.from(cache.keys());
};

// Background task to clean up expired entries every 30 seconds
let cleanupInterval: NodeJS.Timeout | null = null;

export const startCacheCleanup = (): void => {
  if (cleanupInterval) {
    return; // Already running
  }

  cleanupInterval = setInterval(() => {
    removeExpiredEntries();
  }, 30 * 1000); // Run every 30 seconds

  logInfo("Started cache cleanup background task");
};

export const stopCacheCleanup = (): void => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logInfo("Stopped cache cleanup background task");
  }
};
