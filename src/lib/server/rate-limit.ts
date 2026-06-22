type RateLimitEntry = { count: number; resetAt: number };

const attempts = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 5;

export function allowRequest(key: string, now = Date.now()): boolean {
  const previous = attempts.get(key);
  if (!previous || previous.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (previous.count >= MAX_REQUESTS) {
    return false;
  }

  previous.count += 1;
  return true;
}
