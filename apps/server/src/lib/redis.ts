/**
 * Redis client for Moltblox API
 * Used for nonce storage, session caching, and rate limiting.
 */
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    if (times > 3) {
      console.error('[Redis] Max retries reached, giving up');
      return null;
    }
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

redis.on('connect', () => console.log('[Redis] Connected'));
redis.on('error', (err) => console.error('[Redis] Error:', err.message));

export default redis;
