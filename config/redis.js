const { Redis } = require('ioredis');

let redis;

const getRedisConnection = () => {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      }
    });

    redis.on('connect', async () => {
      console.log('Redis connected');
      // Fix eviction policy
      try {
        await redis.config('SET', 'maxmemory-policy', 'noeviction');
        console.log('Redis eviction policy set to noeviction');
      } catch (err) {
        // Redis Cloud free tier may not allow this
        console.log('Could not set eviction policy — set it manually in dashboard');
      }
    });

    redis.on('error', (err) => console.error('Redis error:', err.message));
  }

  return redis;
};
module.exports = { getRedisConnection };