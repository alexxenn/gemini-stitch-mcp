import type { RetryOptions } from "../types.js";

function isRetryableStatus(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    return status === 429 || status >= 500;
  }
  if (error instanceof Error && error.message.includes("ECONNRESET")) {
    return true;
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    retryOn = isRetryableStatus,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !retryOn(error)) {
        throw error;
      }

      const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5);
      await new Promise((resolve) => setTimeout(resolve, jitter));
    }
  }

  throw lastError;
}
