// Retry wrapper for Anthropic SDK calls. Distinguishes transient (network,
// rate-limit, 5xx, overloaded) from terminal (bad request, auth, invalid schema)
// errors so we don't waste retries on errors that won't fix themselves.

export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void;
};

const DEFAULTS = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 8000,
};

function isTransient(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  // Anthropic SDK errors expose `status` and sometimes `name`.
  // Reference: https://github.com/anthropics/anthropic-sdk-typescript#error-handling
  const e = err as { status?: number; name?: string; message?: string };

  // HTTP status-based: 408, 429, 500-599 are retriable.
  if (typeof e.status === "number") {
    if (e.status === 408) return true;
    if (e.status === 429) return true;
    if (e.status >= 500 && e.status < 600) return true;
    return false; // 4xx other than 408/429 is terminal
  }

  // Network-level errors don't have status — typically ECONNRESET, ETIMEDOUT,
  // ENOTFOUND, fetch failed, AbortError, etc. Retry these.
  const msg = (e.message ?? "").toLowerCase();
  if (
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("enotfound") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("timeout") ||
    msg.includes("aborted")
  ) {
    return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULTS, ...options };
  let lastErr: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === opts.maxAttempts || !isTransient(err)) {
        throw err;
      }
      // Exponential backoff with jitter (Full Jitter, AWS style).
      const exp = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1));
      const delay = Math.floor(Math.random() * exp);
      options.onRetry?.(attempt, err, delay);
      await sleep(delay);
    }
  }

  throw lastErr;
}
