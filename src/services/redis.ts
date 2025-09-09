import { createClient, RedisClientType } from "redis";
import { appConfig } from "../config.js";

export class RedisCache {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private readonly ttlSeconds: number;

  constructor() {
    this.ttlSeconds = appConfig.redis.ttlMinutes * 60;
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    try {
      this.client = createClient({
        url: appConfig.redis.url,
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.error('📦 Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.warn('⚠️ Redis disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      this.isConnected = true;

    } catch (error) {
      console.error('❌ Redis connection failed:', (error as Error).message);
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Generate cache key with prefix
   */
  private generateKey(category: string, identifier: string): string {
    return `kaayaan:${category}:${identifier}`;
  }

  /**
   * Set data in cache with TTL
   */
  async set(category: string, identifier: string, data: any, customTTL?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const key = this.generateKey(category, identifier);
      const value = JSON.stringify({
        data,
        timestamp: Date.now(),
        source: "redis_cache",
      });
      
      const ttl = customTTL || this.ttlSeconds;
      await this.client!.setEx(key, ttl, value);
      
      return true;
    } catch (error) {
      console.error(`Redis set error for ${category}:${identifier}:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Get data from cache
   */
  async get<T>(category: string, identifier: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const key = this.generateKey(category, identifier);
      const cached = await this.client!.get(key);
      
      if (!cached) {
        return null;
      }

      const parsed = JSON.parse(cached);
      return parsed.data as T;
      
    } catch (error) {
      console.error(`Redis get error for ${category}:${identifier}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Get cached data with metadata
   */
  async getWithMetadata<T>(category: string, identifier: string): Promise<{
    data: T;
    timestamp: number;
    age: number;
  } | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const key = this.generateKey(category, identifier);
      const cached = await this.client!.get(key);
      
      if (!cached) {
        return null;
      }

      const parsed = JSON.parse(cached);
      const age = Date.now() - parsed.timestamp;
      
      return {
        data: parsed.data as T,
        timestamp: parsed.timestamp,
        age,
      };
      
    } catch (error) {
      console.error(`Redis getWithMetadata error for ${category}:${identifier}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Delete from cache
   */
  async delete(category: string, identifier: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const key = this.generateKey(category, identifier);
      await this.client!.del(key);
      return true;
    } catch (error) {
      console.error(`Redis delete error for ${category}:${identifier}:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(category: string, identifier: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const key = this.generateKey(category, identifier);
      const exists = await this.client!.exists(key);
      return exists === 1;
    } catch (error) {
      console.error(`Redis exists error for ${category}:${identifier}:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  async getTTL(category: string, identifier: string): Promise<number> {
    if (!this.isAvailable()) {
      return -1;
    }

    try {
      const key = this.generateKey(category, identifier);
      return await this.client!.ttl(key);
    } catch (error) {
      console.error(`Redis TTL error for ${category}:${identifier}:`, (error as Error).message);
      return -1;
    }
  }

  /**
   * Clear all keys with pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const keys = await this.client!.keys(`kaayaan:${pattern}*`);
      if (keys.length === 0) {
        return 0;
      }
      
      await this.client!.del(keys);
      return keys.length;
    } catch (error) {
      console.error(`Redis clearPattern error for ${pattern}:`, (error as Error).message);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    totalKeys: number;
    memoryUsage?: string;
    ttlMinutes: number;
  }> {
    const stats: {
      connected: boolean;
      totalKeys: number;
      memoryUsage?: string;
      ttlMinutes: number;
    } = {
      connected: this.isAvailable(),
      totalKeys: 0,
      ttlMinutes: appConfig.redis.ttlMinutes,
    };

    if (!this.isAvailable()) {
      return stats;
    }

    try {
      // Count keys with our prefix
      const keys = await this.client!.keys('kaayaan:*');
      stats.totalKeys = keys.length;

      // Get memory info if available
      try {
        const info = await this.client!.info('memory');
        const memMatch = info.match(/used_memory_human:([^\r\n]+)/);
        if (memMatch) {
          stats.memoryUsage = memMatch[1];
        }
      } catch (memError) {
        // Memory info not critical
      }

    } catch (error) {
      console.error('Redis stats error:', (error as Error).message);
    }

    return stats;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        this.isConnected = false;
      } catch (error) {
        console.error('Redis close error:', (error as Error).message);
      }
    }
  }
}

// Export singleton instance
export const redisCache = new RedisCache();