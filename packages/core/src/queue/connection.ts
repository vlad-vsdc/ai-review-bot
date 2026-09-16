import { Redis } from 'ioredis'

export const redisConnection = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/1', {
  maxRetriesPerRequest: null,
})
