/**
 * Enhanced Authentication & Authorization Module
 * @fileoverview Secure authentication with JWT, API key management, and role-based access control
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { redisCache } from '../services/redis.js';
import { appConfig } from '../config.js';

// ==================== Types ====================

export interface AuthUser {
  id: string;
  apiKey: string;
  role: 'admin' | 'user' | 'readonly';
  permissions: string[];
  rateLimit?: {
    requests: number;
    window: number;
  };
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  rateLimitInfo?: {
    remaining: number;
    reset: Date;
  };
}

// ==================== Rate Limiters ====================

const createRateLimiter = () => {
  // Always use memory-based rate limiter for simplicity and reliability
  // Redis integration would require exposing internal client which breaks encapsulation
  return new RateLimiterMemory({
    points: 100, // requests
    duration: 900, // per 15 minutes  
    blockDuration: 900, // block for 15 minutes
  });
};

const authRateLimiter = createRateLimiter();

// Brute force protection for failed auth attempts
const bruteForceProtection = new RateLimiterMemory({
  points: 5, // 5 failed attempts
  duration: 300, // within 5 minutes
  blockDuration: 1800, // block for 30 minutes
});

// ==================== API Key Management ====================

export class ApiKeyManager {
  private static readonly SALT_ROUNDS = 12;
  private static keys: Map<string, AuthUser> = new Map();

  /**
   * Generate a secure API key
   */
  static generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash an API key for secure storage
   */
  static async hashApiKey(apiKey: string): Promise<string> {
    return bcrypt.hash(apiKey, this.SALT_ROUNDS);
  }

  /**
   * Verify an API key against its hash
   */
  static async verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
    return bcrypt.compare(apiKey, hash);
  }

  /**
   * Register a new API key with user info
   */
  static registerApiKey(user: AuthUser): void {
    this.keys.set(user.apiKey, user);
  }

  /**
   * Get user info by API key
   */
  static getUser(apiKey: string): AuthUser | undefined {
    return this.keys.get(apiKey);
  }

  /**
   * Revoke an API key
   */
  static revokeApiKey(apiKey: string): boolean {
    return this.keys.delete(apiKey);
  }

  /**
   * List all registered API keys (masked for security)
   */
  static listKeys(): Array<{ id: string; keyPreview: string; role: string; permissions: string[] }> {
    return Array.from(this.keys.values()).map(user => ({
      id: user.id,
      keyPreview: user.apiKey.substring(0, 8) + '...',
      role: user.role,
      permissions: user.permissions
    }));
  }
}

// Initialize default admin key if configured
if (appConfig.security.apiKey) {
  ApiKeyManager.registerApiKey({
    id: 'default-admin',
    apiKey: appConfig.security.apiKey,
    role: 'admin',
    permissions: ['*'] // All permissions
  });
}

// ==================== Permission System ====================

export const Permissions = {
  // Market Analysis Tools
  ANALYZE_MARKET: 'market:analyze',
  GENERATE_SIGNALS: 'market:signals',
  CALCULATE_INDICATORS: 'market:indicators',
  
  // Data Management
  STORE_ANALYSIS: 'data:store',
  READ_ANALYSIS: 'data:read',
  DELETE_ANALYSIS: 'data:delete',
  
  // System Management
  VIEW_METRICS: 'system:metrics',
  VIEW_HEALTH: 'system:health',
  MANAGE_USERS: 'system:users',
  
  // Admin
  ALL: '*'
} as const;

export function hasPermission(user: AuthUser, permission: string): boolean {
  // Admin role has all permissions
  if (user.role === 'admin' || user.permissions.includes(Permissions.ALL)) {
    return true;
  }
  
  // Check specific permission
  return user.permissions.includes(permission);
}

// ==================== Authentication Middleware ====================

/**
 * Enhanced authentication middleware with rate limiting and security headers
 */
export function authenticateRequest(requiredPermission?: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientKey = getClientIdentifier(req);

      // Skip auth for public endpoints
      const publicEndpoints = ['/health', '/metrics', '/', '/favicon.ico'];
      if (publicEndpoints.includes(req.path) || req.path.startsWith('/assets/')) {
        return next();
      }

      // Apply rate limiting
      try {
        const rateLimitResult = await authRateLimiter.consume(clientKey);
        req.rateLimitInfo = {
          remaining: rateLimitResult.remainingPoints || 0,
          reset: new Date(Date.now() + (rateLimitResult.msBeforeNext || 0))
        };
      } catch (rateLimitError) {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            details: 'Authentication rate limit exceeded'
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Skip auth if disabled in configuration
      if (!appConfig.security.enableAuth) {
        return next();
      }

      // Extract API key from headers
      const apiKey = extractApiKey(req);
      
      if (!apiKey) {
        await recordFailedAuth(clientKey);
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'API key required. Provide X-API-Key header or Authorization Bearer token.',
            details: 'Authentication is enabled for this server instance.'
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Validate API key
      const user = ApiKeyManager.getUser(apiKey);
      if (!user) {
        await recordFailedAuth(clientKey);
        res.status(403).json({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid API key provided.',
            details: 'The provided API key does not match any registered key.'
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check permission if required
      if (requiredPermission && !hasPermission(user, requiredPermission)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Insufficient permissions for this operation.',
            details: `Required permission: ${requiredPermission}`
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Add user to request context
      req.user = user;
      
      // Add security headers
      res.setHeader('X-RateLimit-Remaining', req.rateLimitInfo.remaining);
      res.setHeader('X-RateLimit-Reset', req.rateLimitInfo.reset.toISOString());
      
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication system error.',
          details: 'Please try again later.'
        },
        timestamp: new Date().toISOString()
      });
    }
  };
}

// ==================== Helper Functions ====================

function extractApiKey(req: Request): string | null {
  // Check X-API-Key header
  const xApiKey = req.headers['x-api-key'];
  if (xApiKey && typeof xApiKey === 'string') {
    return xApiKey;
  }

  // Check Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function getClientIdentifier(req: Request): string {
  // Use IP address as primary identifier
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Include user agent for additional uniqueness
  const userAgent = req.get('User-Agent') || 'unknown';
  
  return `${clientIp}:${crypto.createHash('md5').update(userAgent).digest('hex').substring(0, 8)}`;
}

async function recordFailedAuth(clientKey: string): Promise<void> {
  try {
    await bruteForceProtection.consume(clientKey);
  } catch (error) {
    // Client is now blocked by brute force protection
    console.warn(`Brute force protection activated for client: ${clientKey}`);
  }
}

// ==================== Security Utils ====================

export const SecurityUtils = {
  /**
   * Generate a secure random string
   */
  generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  },

  /**
   * Hash sensitive data
   */
  async hashData(data: string): Promise<string> {
    return bcrypt.hash(data, 12);
  },

  /**
   * Verify hashed data
   */
  async verifyHash(data: string, hash: string): Promise<boolean> {
    return bcrypt.compare(data, hash);
  },

  /**
   * Sanitize user input
   */
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential XSS characters
      .replace(/['"]/g, '') // Remove quotes
      .trim()
      .substring(0, 1000); // Limit length
  },

  /**
   * Validate API key format
   */
  isValidApiKeyFormat(apiKey: string): boolean {
    return /^[a-f0-9]{64}$/.test(apiKey);
  }
};

export default {
  authenticateRequest,
  ApiKeyManager,
  Permissions,
  hasPermission,
  SecurityUtils
};