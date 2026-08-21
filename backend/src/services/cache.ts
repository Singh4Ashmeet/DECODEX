import Redis from 'ioredis';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

let redisWarned = false;

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const isTls = redisUrl.startsWith('rediss://');

const redis = new Redis(redisUrl, {
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
  retryStrategy(times: number): number | null {
    if (times === 1 && !redisWarned) {
      redisWarned = true;
      console.warn(
        '⚠️  Redis cache is not available — caching will be bypassed. ' +
        'Start Redis with: docker compose up -d'
      );
    }
    // Retry with exponential backoff, capped at 30 seconds
    return Math.min(times * 2000, 30000);
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

// Only log non-ECONNREFUSED errors (connection issues are handled by retryStrategy)
redis.on('error', (err: any) => {
  if (err?.code !== 'ECONNREFUSED') {
    console.error('Redis Cache Error:', err);
  }
});

// Attempt lazy connection — will silently retry if Redis is unavailable
redis.connect().catch(() => {
  // Swallowed intentionally; retryStrategy handles reconnection
});

export const getCache = async (key: string): Promise<string | null> => {
  try {
    return await redis.get(key);
  } catch (err) {
    // Silently return null when Redis is unavailable — the app can function without cache
    return null;
  }
};

export const setCache = async (key: string, value: string, ttlSeconds: number = 604800): Promise<void> => {
  try {
    // Default TTL is 7 days (604800 seconds)
    await redis.setex(key, ttlSeconds, value);
  } catch (err) {
    // Silently skip caching when Redis is unavailable
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  try {
    await redis.del(key);
  } catch (err) {
    // Silently skip when Redis is unavailable
  }
};

export const generateHashKey = (prefix: string, data: any): string => {
  const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return `${prefix}:${hash}`;
};
