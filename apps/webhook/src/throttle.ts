import type { Redis } from 'ioredis'

export async function shouldThrottle(
  redis: Redis,
  repoFullName: string,
  prNumber: number,
  throttleMinutes: number
): Promise<boolean> {
  const key = `pr-review:throttle:${repoFullName}:${prNumber}`
  const result = await redis.set(key, '1', 'EX', throttleMinutes * 60, 'NX')
  return result === null // null = ключ уже существовал → троттлим
}
