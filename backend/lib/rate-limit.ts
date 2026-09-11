// In-memory sliding window rate limiter for security-sensitive endpoints

interface RateLimitRecord {
  timestamps: number[];
}

const cache = new Map<string, RateLimitRecord>();

export function checkRateLimit(key: string, maxRequests = 10, windowMs = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = cache.get(key) ?? { timestamps: [] };

  // Remove timestamps outside window
  const validTimestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (validTimestamps.length >= maxRequests) {
    cache.set(key, { timestamps: validTimestamps });
    return { allowed: false, remaining: 0 };
  }

  validTimestamps.push(now);
  cache.set(key, { timestamps: validTimestamps });
  return { allowed: true, remaining: maxRequests - validTimestamps.length };
}
