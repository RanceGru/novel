// 缓存服务 — Redis (优先) / 内存缓存 (回退)
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { redisConfig } from '../../config/redis.config';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private memoryStore: Map<string, { value: any; expiresAt: number }> = new Map();
  private useRedis = false;

  async onModuleInit() {
    try {
      this.redis = new Redis({
        ...redisConfig(),
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
      });
      await this.redis.connect();
      this.useRedis = true;
      this.logger.log('Redis 已连接');
    } catch {
      this.logger.warn('Redis 不可用，使用内存缓存');
      this.redis = null;
      this.useRedis = false;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => {});
    }
  }

  getClient(): Redis | null {
    return this.redis;
  }

  async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (this.useRedis && this.redis) {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } else {
      this.memoryStore.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.useRedis && this.redis) {
      const val = await this.redis.get(key);
      return val ? (JSON.parse(val) as T) : null;
    } else {
      const entry = this.memoryStore.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        this.memoryStore.delete(key);
        return null;
      }
      return entry.value as T;
    }
  }

  async del(key: string): Promise<void> {
    if (this.useRedis && this.redis) {
      await this.redis.del(key);
    } else {
      this.memoryStore.delete(key);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (this.useRedis && this.redis) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) await this.redis.del(...keys);
    } else {
      // 内存模式下的简单通配符匹配
      const regex = new RegExp(pattern.replace('*', '.*'));
      for (const key of this.memoryStore.keys()) {
        if (regex.test(key)) this.memoryStore.delete(key);
      }
    }
  }
}
