import { QueueJob } from "../types";
import { logDebug, logError, logInfo, logWarn } from "../utils/logger";

interface QueueProcessor<T> {
  (job: QueueJob): Promise<T>;
}

interface QueueConfig {
  maxConcurrency: number;
  retryAttempts: number;
  retryDelay: number;
}

// Queue configuration
const QUEUE_CONFIG: QueueConfig = {
  maxConcurrency: 5, // Maximum concurrent jobs
  retryAttempts: 3, // Number of retry attempts
  retryDelay: 1000, // Delay between retries in milliseconds
};

// Global queue state
let jobQueue: QueueJob[] = [];
let activeJobs = new Map<string, Promise<unknown>>();
let jobResults = new Map<
  string,
  { result?: unknown; error?: Error; timestamp: number }
>();
let queueStats = {
  totalJobs: 0,
  completedJobs: 0,
  failedJobs: 0,
  activeJobs: 0,
  queuedJobs: 0,
};

const generateJobId = (): string => {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const createJob = (userId: number): QueueJob => {
  return {
    id: generateJobId(),
    userId,
    timestamp: Date.now(),
    retries: 0,
  };
};

const updateQueueStats = (): void => {
  queueStats.activeJobs = activeJobs.size;
  queueStats.queuedJobs = jobQueue.length;
};

const processJob = async <T>(
  job: QueueJob,
  processor: QueueProcessor<T>
): Promise<T> => {
  try {
    logDebug(`Processing job ${job.id} for user ${job.userId}`);
    const result = await processor(job);

    // Store successful result
    jobResults.set(job.id, {
      result,
      timestamp: Date.now(),
    });

    queueStats.completedJobs++;
    logDebug(`Job ${job.id} completed successfully`);

    return result;
  } catch (error) {
    logError(`Job ${job.id} failed`, error);

    // Store error result
    jobResults.set(job.id, {
      error: error as Error,
      timestamp: Date.now(),
    });

    queueStats.failedJobs++;
    throw error;
  }
};

const retryJob = async <T>(
  job: QueueJob,
  processor: QueueProcessor<T>
): Promise<T> => {
  if (job.retries >= QUEUE_CONFIG.retryAttempts) {
    throw new Error(`Job ${job.id} exceeded maximum retry attempts`);
  }

  job.retries++;
  logWarn(
    `Retrying job ${job.id} (attempt ${job.retries}/${QUEUE_CONFIG.retryAttempts})`
  );

  // Wait before retry
  await new Promise((resolve) =>
    setTimeout(resolve, QUEUE_CONFIG.retryDelay * job.retries)
  );

  return processJob(job, processor);
};

const executeJob = async <T>(
  job: QueueJob,
  processor: QueueProcessor<T>
): Promise<T> => {
  try {
    return await processJob(job, processor);
  } catch (error) {
    if (job.retries < QUEUE_CONFIG.retryAttempts) {
      return retryJob(job, processor);
    }
    throw error;
  }
};

const processQueue = async <T>(processor: QueueProcessor<T>): Promise<void> => {
  while (jobQueue.length > 0 && activeJobs.size < QUEUE_CONFIG.maxConcurrency) {
    const job = jobQueue.shift();
    if (!job) continue;

    // Check if we already have a result for this user
    const existingResult = Array.from(jobResults.values()).find((_result) => {
      // Find jobs for the same user that completed recently (within 5 seconds)
      const recentJobs = Array.from(jobResults.entries()).filter(
        ([_, result]) => Date.now() - result.timestamp < 5000
      );
      return recentJobs.some(([jobId, _]) => {
        const jobData = jobId.split("_")[2]; // Extract user part from job ID
        return jobData === job.userId.toString();
      });
    });

    if (existingResult && !existingResult.error) {
      // Reuse existing result
      jobResults.set(job.id, existingResult);
      queueStats.completedJobs++;
      logDebug(`Reusing result for job ${job.id} (user ${job.userId})`);
      continue;
    }

    // Execute job
    const jobPromise = executeJob(job, processor).finally(() => {
      activeJobs.delete(job.id);
      updateQueueStats();
    });

    activeJobs.set(job.id, jobPromise);
    updateQueueStats();
  }
};

export const addJob = <T>(
  userId: number,
  processor: QueueProcessor<T>
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const job = createJob(userId);
    queueStats.totalJobs++;

    // Check if we already have a pending job for this user
    const existingJob = jobQueue.find((j) => j.userId === userId);
    if (existingJob) {
      logDebug(`User ${userId} already has a pending job, queuing new job`);
    }

    jobQueue.push(job);
    updateQueueStats();

    logInfo(`Added job ${job.id} for user ${userId} to queue`);

    // Start processing if not already running
    processQueue(processor).catch((error) => {
      logError("Queue processing error", error);
    });

    // Poll for result
    const pollForResult = (): void => {
      const result = jobResults.get(job.id);
      if (result) {
        if (result.error) {
          reject(result.error);
        } else {
          resolve(result.result as T);
        }
        return;
      }

      // Continue polling
      setTimeout(pollForResult, 100);
    };

    pollForResult();
  });
};

export const getQueueStats = () => {
  updateQueueStats();
  return { ...queueStats };
};

export const getActiveJobs = (): string[] => {
  return Array.from(activeJobs.keys());
};

export const getQueuedJobs = (): QueueJob[] => {
  return [...jobQueue];
};

export const clearQueue = (): void => {
  jobQueue = [];
  activeJobs.clear();
  jobResults.clear();
  queueStats = {
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    activeJobs: 0,
    queuedJobs: 0,
  };
  logInfo("Queue cleared");
};

export const getJobResult = (
  jobId: string
): { result?: unknown; error?: Error; timestamp: number } | null => {
  return jobResults.get(jobId) || null;
};

// Background cleanup task to remove old results
let cleanupInterval: NodeJS.Timeout | null = null;

export const startQueueCleanup = (): void => {
  if (cleanupInterval) {
    return; // Already running
  }

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let removedCount = 0;

    for (const [jobId, result] of jobResults.entries()) {
      // Remove results older than 5 minutes
      if (now - result.timestamp > 5 * 60 * 1000) {
        jobResults.delete(jobId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logDebug(`Cleaned up ${removedCount} old job results`);
    }
  }, 60 * 1000); // Run every minute

  logInfo("Started queue cleanup background task");
};

export const stopQueueCleanup = (): void => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logInfo("Stopped queue cleanup background task");
  }
};
