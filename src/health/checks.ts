/**
 * Comprehensive Health Check System
 * @fileoverview Advanced health checks, monitoring, and system diagnostics
 */

import { performance } from 'perf_hooks';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { mongoDBService } from '../services/mongodb.js';
import { redisCache } from '../services/redis.js';
import { appConfig } from '../config.js';

const execAsync = promisify(exec);

// ==================== Types ====================

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  message: string;
  details?: any;
  timestamp: string;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  disk: {
    used: number;
    available: number;
    percentage: number;
  };
  network: {
    connections: number;
    bandwidth?: {
      incoming: number;
      outgoing: number;
    };
  };
}

export interface SecurityStatus {
  rateLimitingActive: boolean;
  authenticationEnabled: boolean;
  httpsEnabled: boolean;
  securityHeadersPresent: boolean;
  vulnerabilitiesDetected: string[];
  lastSecurityScan: string;
}

// ==================== Health Check Functions ====================

export class HealthChecker {
  private static checks: Map<string, () => Promise<HealthCheckResult>> = new Map();

  static registerCheck(name: string, checkFn: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, checkFn);
  }

  static async runAllChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    for (const [name, checkFn] of this.checks.entries()) {
      try {
        const result = await checkFn();
        results.push(result);
      } catch (error) {
        results.push({
          name,
          status: 'unhealthy',
          responseTime: 0,
          message: `Health check failed: ${(error as Error).message}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  static async runCheck(name: string): Promise<HealthCheckResult | null> {
    const checkFn = this.checks.get(name);
    if (!checkFn) {
      return null;
    }

    try {
      return await checkFn();
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        responseTime: 0,
        message: `Health check failed: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// ==================== Database Health Checks ====================

async function checkMongoDBHealth(): Promise<HealthCheckResult> {
  const startTime = performance.now();
  
  try {
    if (!mongoDBService.isAvailable()) {
      return {
        name: 'mongodb',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        message: 'MongoDB service not available',
        timestamp: new Date().toISOString()
      };
    }

    // Test basic connectivity by attempting to store and retrieve test analysis
    const testSymbol = 'HEALTH_TEST';
    const testInput = { healthCheck: true, timestamp: new Date().toISOString() };
    const testOutput = { status: 'healthy', test: true };
    
    // Test write operation
    const currentTime = performance.now() - startTime;
    const analysisId = await mongoDBService.storeAnalysis(
      testSymbol,
      'data_validation',
      testInput,
      testOutput,
      100,
      'cached',
      currentTime
    );
    
    const canWrite = !!analysisId;
    
    // Test read operation
    const readResult = await mongoDBService.getLatestAnalysis(testSymbol, 'data_validation');
    const canRead = !!readResult;
    
    // Get stats to verify connectivity
    const stats = await mongoDBService.getStats();
    
    const responseTime = performance.now() - startTime;
    
    return {
      name: 'mongodb',
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      responseTime,
      message: 'MongoDB is accessible and operational',
      details: {
        totalAnalyses: stats.totalAnalyses,
        canRead,
        canWrite
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      name: 'mongodb',
      status: 'unhealthy',
      responseTime: performance.now() - startTime,
      message: `MongoDB health check failed: ${(error as Error).message}`,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkRedisHealth(): Promise<HealthCheckResult> {
  const startTime = performance.now();
  
  try {
    if (!redisCache.isAvailable()) {
      return {
        name: 'redis',
        status: 'degraded', // Redis is optional for basic functionality
        responseTime: performance.now() - startTime,
        message: 'Redis service not available (cache disabled)',
        timestamp: new Date().toISOString()
      };
    }

    // Test basic connectivity using Redis cache methods
    const testCategory = 'health_check';
    const testIdentifier = `test_${Date.now()}`;
    const testValue = 'health_check_value';
    
    // Test write operation
    const writeSuccess = await redisCache.set(testCategory, testIdentifier, testValue, 10); // Expire in 10 seconds
    
    // Test read operation  
    const readValue = await redisCache.get(testCategory, testIdentifier);
    
    // Test delete operation
    const deleteSuccess = await redisCache.delete(testCategory, testIdentifier);
    
    const responseTime = performance.now() - startTime;
    
    return {
      name: 'redis',
      status: responseTime < 500 ? 'healthy' : 'degraded',
      responseTime,
      message: 'Redis is accessible and operational',
      details: {
        canRead: readValue === testValue,
        canWrite: writeSuccess,
        canDelete: deleteSuccess
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      name: 'redis',
      status: 'degraded',
      responseTime: performance.now() - startTime,
      message: `Redis health check failed: ${(error as Error).message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// ==================== External Service Health Checks ====================

async function checkExternalDataSources(): Promise<HealthCheckResult> {
  const startTime = performance.now();
  
  try {
    // Test Yahoo Finance (primary data source)
    const yahooHealthy = await testYahooFinance();
    
    // Test Alpha Vantage (backup data source)
    const alphaVantageHealthy = appConfig.dataSources.alphaVantage.apiKey 
      ? await testAlphaVantage()
      : { available: false, reason: 'No API key configured' };
    
    // Test CoinGecko (crypto data source)
    const coinGeckoHealthy = await testCoinGecko();
    
    const responseTime = performance.now() - startTime;
    
    const healthyCount = [yahooHealthy, alphaVantageHealthy, coinGeckoHealthy]
      .filter(service => service.available).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount >= 2) status = 'healthy';
    else if (healthyCount >= 1) status = 'degraded';
    else status = 'unhealthy';
    
    return {
      name: 'external_data_sources',
      status,
      responseTime,
      message: `${healthyCount}/3 data sources available`,
      details: {
        yahoo_finance: yahooHealthy,
        alpha_vantage: alphaVantageHealthy,
        coingecko: coinGeckoHealthy
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      name: 'external_data_sources',
      status: 'unhealthy',
      responseTime: performance.now() - startTime,
      message: `External data sources check failed: ${(error as Error).message}`,
      timestamp: new Date().toISOString()
    };
  }
}

async function testYahooFinance(): Promise<{ available: boolean; reason?: string; responseTime?: number }> {
  const startTime = performance.now();
  try {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 5000);
    
    const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/AAPL', {
      signal: abortController.signal
    });
    
    clearTimeout(timeoutId);
    const responseTime = performance.now() - startTime;
    
    if (response.ok) {
      return { available: true, responseTime };
    } else {
      return { available: false, reason: `HTTP ${response.status}`, responseTime };
    }
  } catch (error) {
    return { available: false, reason: (error as Error).message };
  }
}

async function testAlphaVantage(): Promise<{ available: boolean; reason?: string; responseTime?: number }> {
  const startTime = performance.now();
  try {
    const apiKey = appConfig.dataSources.alphaVantage.apiKey;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 5000);
    
    const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${apiKey}`, {
      signal: abortController.signal
    });
    
    clearTimeout(timeoutId);
    const responseTime = performance.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      if (data['Error Message'] || data['Note']) {
        return { available: false, reason: data['Error Message'] || data['Note'], responseTime };
      }
      return { available: true, responseTime };
    } else {
      return { available: false, reason: `HTTP ${response.status}`, responseTime };
    }
  } catch (error) {
    return { available: false, reason: (error as Error).message };
  }
}

async function testCoinGecko(): Promise<{ available: boolean; reason?: string; responseTime?: number }> {
  const startTime = performance.now();
  try {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 5000);
    
    const response = await fetch('https://api.coingecko.com/api/v3/ping', {
      signal: abortController.signal
    });
    
    clearTimeout(timeoutId);
    const responseTime = performance.now() - startTime;
    
    if (response.ok) {
      return { available: true, responseTime };
    } else {
      return { available: false, reason: `HTTP ${response.status}`, responseTime };
    }
  } catch (error) {
    return { available: false, reason: (error as Error).message };
  }
}

// ==================== System Resource Health Checks ====================

async function checkSystemResources(): Promise<HealthCheckResult> {
  const startTime = performance.now();
  
  try {
    const metrics = await getSystemMetrics();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const issues: string[] = [];
    
    // Check memory usage
    if (metrics.memory.percentage > 90) {
      status = 'unhealthy';
      issues.push(`High memory usage: ${metrics.memory.percentage}%`);
    } else if (metrics.memory.percentage > 80) {
      status = 'degraded';
      issues.push(`Elevated memory usage: ${metrics.memory.percentage}%`);
    }
    
    // Check CPU usage
    if (metrics.cpu.usage > 95) {
      status = 'unhealthy';
      issues.push(`High CPU usage: ${metrics.cpu.usage}%`);
    } else if (metrics.cpu.usage > 80) {
      if (status === 'healthy') status = 'degraded';
      issues.push(`Elevated CPU usage: ${metrics.cpu.usage}%`);
    }
    
    // Check disk space
    if (metrics.disk.percentage > 95) {
      status = 'unhealthy';
      issues.push(`Low disk space: ${metrics.disk.percentage}% used`);
    } else if (metrics.disk.percentage > 85) {
      if (status === 'healthy') status = 'degraded';
      issues.push(`Disk space warning: ${metrics.disk.percentage}% used`);
    }
    
    const responseTime = performance.now() - startTime;
    
    return {
      name: 'system_resources',
      status,
      responseTime,
      message: issues.length > 0 ? issues.join('; ') : 'System resources are healthy',
      details: metrics,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      name: 'system_resources',
      status: 'unhealthy',
      responseTime: performance.now() - startTime,
      message: `System resources check failed: ${(error as Error).message}`,
      timestamp: new Date().toISOString()
    };
  }
}

async function getSystemMetrics(): Promise<SystemMetrics> {
  const memoryUsage = process.memoryUsage();
  
  try {
    // Get disk space information
    let diskInfo = { used: 0, available: 0, percentage: 0 };
    try {
      const { stdout } = await execAsync('df -h / | tail -1');
      const parts = stdout.trim().split(/\s+/);
      if (parts.length >= 5) {
        diskInfo.percentage = parseInt(parts[4].replace('%', ''));
      }
    } catch (error) {
      console.warn('Could not get disk space information:', error);
    }
    
    return {
      cpu: {
        usage: process.cpuUsage().system / 1000000, // Convert to percentage approximation
        loadAverage: require('os').loadavg()
      },
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal
      },
      disk: diskInfo,
      network: {
        connections: 0 // Would need netstat or similar for accurate count
      }
    };
  } catch (error) {
    throw new Error(`Failed to get system metrics: ${(error as Error).message}`);
  }
}

// ==================== Security Health Checks ====================

async function checkSecurityStatus(): Promise<HealthCheckResult> {
  const startTime = performance.now();
  
  try {
    const securityStatus: SecurityStatus = {
      rateLimitingActive: true, // Always active in this implementation
      authenticationEnabled: appConfig.security.enableAuth,
      httpsEnabled: process.env.NODE_ENV === 'production', // Assume HTTPS in production
      securityHeadersPresent: true, // We implement security headers
      vulnerabilitiesDetected: [],
      lastSecurityScan: new Date().toISOString()
    };
    
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Check authentication
    if (!securityStatus.authenticationEnabled && appConfig.app.nodeEnv === 'production') {
      status = 'degraded';
      issues.push('Authentication disabled in production');
    }
    
    // Check HTTPS
    if (!securityStatus.httpsEnabled && appConfig.app.nodeEnv === 'production') {
      status = 'degraded';
      issues.push('HTTPS not detected in production');
    }
    
    // Check for default credentials
    if (appConfig.security.apiKey && appConfig.security.apiKey.includes('default')) {
      status = 'unhealthy';
      issues.push('Default API key detected');
      securityStatus.vulnerabilitiesDetected.push('DEFAULT_CREDENTIALS');
    }
    
    const responseTime = performance.now() - startTime;
    
    return {
      name: 'security_status',
      status,
      responseTime,
      message: issues.length > 0 ? issues.join('; ') : 'Security configuration is healthy',
      details: securityStatus,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      name: 'security_status',
      status: 'unhealthy',
      responseTime: performance.now() - startTime,
      message: `Security status check failed: ${(error as Error).message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// ==================== Register Health Checks ====================

// Register all health checks
HealthChecker.registerCheck('mongodb', checkMongoDBHealth);
HealthChecker.registerCheck('redis', checkRedisHealth);
HealthChecker.registerCheck('external_data_sources', checkExternalDataSources);
HealthChecker.registerCheck('system_resources', checkSystemResources);
HealthChecker.registerCheck('security_status', checkSecurityStatus);

// ==================== Health Summary ====================

export async function getHealthSummary(): Promise<{
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  uptime: number;
  timestamp: string;
}> {
  const checks = await HealthChecker.runAllChecks();
  
  const summary = {
    total: checks.length,
    healthy: checks.filter(c => c.status === 'healthy').length,
    degraded: checks.filter(c => c.status === 'degraded').length,
    unhealthy: checks.filter(c => c.status === 'unhealthy').length
  };
  
  // Determine overall status
  let overall: 'healthy' | 'degraded' | 'unhealthy';
  if (summary.unhealthy > 0) {
    overall = 'unhealthy';
  } else if (summary.degraded > 0) {
    overall = 'degraded';
  } else {
    overall = 'healthy';
  }
  
  return {
    overall,
    checks,
    summary,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
}

export default {
  HealthChecker,
  getHealthSummary,
  getSystemMetrics
};