import { getKvConfig, kvCommand } from "@/lib/kv";

/**
 * Rate limiter sliding-window.
 *
 * - KV/Upstash: ZSET di Redis dengan satu skrip Lua atomik.
 * - Tanpa KV: fallback penghitung dalam memori (per-proses).
 *
 * Cocok untuk melindungi endpoint sensitif seperti login (anti brute-force).
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter: number;
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
}

const RATE_LUA = `local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = window
  if oldest[2] then
    retry = math.ceil(window - (now - tonumber(oldest[2])))
  end
  return {0, 0, retry}
end
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, window)
return {1, limit - count - 1, 0}`;

interface MemoryBucket {
  timestamps: number[];
}

const memory = new Map<string, MemoryBucket>();

function memoryLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const bucket = memory.get(options.key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= options.limit) {
    const oldest = bucket.timestamps[0];
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    memory.set(options.key, bucket);
    return {
      allowed: false,
      remaining: 0,
      limit: options.limit,
      retryAfter,
    };
  }

  bucket.timestamps.push(now);
  memory.set(options.key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, options.limit - bucket.timestamps.length),
    limit: options.limit,
    retryAfter: 0,
  };
}

export async function rateLimit(
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const kv = getKvConfig();
  if (!kv) return memoryLimit(options);

  const now = Date.now();
  const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const result = await kvCommand<number[]>(kv, [
      "EVAL",
      RATE_LUA,
      "1",
      `ratelimit:${options.key}`,
      String(now),
      String(options.windowSeconds),
      String(options.limit),
      member,
    ]);

    if (Array.isArray(result) && result.length >= 3) {
      const [allowed, remaining, retryAfter] = result.map(Number);
      return {
        allowed: allowed === 1,
        remaining,
        limit: options.limit,
        retryAfter,
      };
    }
  } catch (err) {
    console.warn("[rateLimit] KV gagal, memakai fallback memori:", err);
  }

  return memoryLimit(options);
}
