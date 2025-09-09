/**
 * HTTP Server for Kaayaan Strategist AI Universal MCP Server
 * @fileoverview Production-ready HTTP server supporting REST API and MCP-over-HTTP protocols
 * 
 * Universal MCP Architecture - HTTP Components:
 * 1. HTTP REST API (for general HTTP clients) 
 * 2. HTTP MCP Protocol (for n8n-nodes-mcp compatibility)
 * 3. Enhanced security and authentication
 * 4. Comprehensive monitoring and health checks
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import { z } from 'zod';
import { performance } from 'perf_hooks';

// Import services
import { redisCache } from './services/redis.js';
import { mongoDBService } from './services/mongodb.js';
import { appConfig } from './config.js';

// Import MCP tools
import { analyzeMarketStructure } from './tools/marketAnalysis.js';
import { generateTradingSignal } from './tools/signalGeneration.js';
import { calculateIndicators } from './tools/indicators.js';
import { storeAnalysis } from './tools/storage.js';
import { getAnalysisHistory } from './tools/history.js';
import { validateDataQuality } from './tools/validation.js';

// Import types and schemas
import type {
  HttpApiResponse,
  HttpApiError,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  McpToolDefinition,
  McpToolsListResponse,
  McpToolCallParams,
  McpToolCallResponse,
  HealthCheckResponse,
  MetricsResponse,
  MarketStructureParams,
  TradingSignalParams,
  TechnicalIndicatorsParams,
  StoreAnalysisParams,
  AnalysisHistoryParams,
  DataQualityParams
} from './types/http.js';

import {
  marketStructureSchema,
  tradingSignalSchema,
  technicalIndicatorsSchema,
  storeAnalysisSchema,
  analysisHistorySchema,
  dataQualitySchema,
  isValidJsonRpcRequest
} from './types/http.js';

import type { MCPToolDefinition } from './types/index.js';

// ==================== Universal Server Metrics ====================

interface UniversalServerMetrics {
  startTime: number;
  totalRequests: number;
  totalErrors: number;
  responseTimes: number[];
  activeConnections: number;
  protocolStats: {
    httpRest: {
      requests: number;
      errors: number;
    };
    httpMcp: {
      requests: number;
      errors: number;
    };
    websocket: {
      connections: number;
      messages: number;
      errors: number;
    };
  };
}

const serverMetrics: UniversalServerMetrics = {
  startTime: Date.now(),
  totalRequests: 0,
  totalErrors: 0,
  responseTimes: [],
  activeConnections: 0,
  protocolStats: {
    httpRest: {
      requests: 0,
      errors: 0
    },
    httpMcp: {
      requests: 0,
      errors: 0
    },
    websocket: {
      connections: 0,
      messages: 0,
      errors: 0
    }
  }
};

// ==================== Tool Definitions ====================

const tools: MCPToolDefinition[] = [
  {
    name: "analyze_market_structure",
    description: "Analyze market structure including support/resistance levels, trend analysis, price ranges, and market phases. Provides comprehensive technical analysis of market conditions.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock symbol (1-10 characters, e.g., 'AAPL', 'MSFT')" },
        period: { type: "string", enum: ["1d", "5d", "1mo", "3mo", "6mo", "1y"], description: "Analysis time period (default: '1mo')" },
        include_support_resistance: { type: "boolean", description: "Include support and resistance level analysis (default: true)" },
        include_volatility: { type: "boolean", description: "Include volatility analysis (default: true)" },
        lookback_days: { type: "number", minimum: 5, maximum: 100, description: "Number of days to analyze (default: 20)" }
      },
      required: ["symbol"]
    }
  },
  {
    name: "generate_trading_signal",
    description: "Generate systematic trading signals (BUY/SELL/WAIT) with confidence scores based on multiple technical indicators. Includes risk management levels and educational disclaimers.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock symbol (1-10 characters)" },
        timeframe: { type: "string", enum: ["short", "medium", "long"], description: "Analysis timeframe: short (day trading), medium (swing), long (position) - default: 'medium'" },
        risk_tolerance: { type: "string", enum: ["conservative", "moderate", "aggressive"], description: "Risk tolerance level affecting signal sensitivity (default: 'moderate')" },
        include_stop_loss: { type: "boolean", description: "Include stop loss level suggestions (default: true)" },
        include_take_profit: { type: "boolean", description: "Include take profit level suggestions (default: true)" },
        min_confidence: { type: "number", minimum: 0, maximum: 100, description: "Minimum confidence threshold for signals (default: 60)" }
      },
      required: ["symbol"]
    }
  },
  {
    name: "calculate_indicators",
    description: "Calculate technical indicators including RSI, MACD, Simple and Exponential Moving Averages with interpretations. Supports custom periods and parameters.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock symbol (1-10 characters)" },
        indicators: { type: "array", items: { type: "string", enum: ["rsi", "macd", "sma", "ema", "all"] }, description: "Indicators to calculate (default: ['all'])" },
        period: { type: "string", enum: ["1d", "5d", "1mo", "3mo", "6mo", "1y"], description: "Data period for calculations (default: '1mo')" },
        rsi_period: { type: "number", minimum: 5, maximum: 50, description: "RSI calculation period (default: 14)" },
        macd_fast: { type: "number", minimum: 5, maximum: 30, description: "MACD fast EMA period (default: 12)" },
        macd_slow: { type: "number", minimum: 20, maximum: 50, description: "MACD slow EMA period (default: 26)" },
        macd_signal: { type: "number", minimum: 5, maximum: 20, description: "MACD signal line period (default: 9)" },
        sma_period: { type: "number", minimum: 5, maximum: 200, description: "Simple Moving Average period (default: 20)" },
        ema_period: { type: "number", minimum: 5, maximum: 200, description: "Exponential Moving Average period (default: 20)" },
        include_interpretation: { type: "boolean", description: "Include human-readable interpretations (default: true)" }
      },
      required: ["symbol"]
    }
  },
  {
    name: "store_analysis",
    description: "Store analysis results in MongoDB for future reference. Supports tagging, notes, and metadata for organized storage and retrieval.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock symbol (1-10 characters)" },
        analysis_type: { type: "string", enum: ["market_structure", "trading_signal", "technical_indicators", "data_validation"], description: "Type of analysis being stored" },
        analysis_data: { type: "object", description: "Analysis results object (flexible structure)" },
        notes: { type: "string", description: "Optional notes about the analysis" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for categorizing the analysis" },
        confidence: { type: "number", minimum: 0, maximum: 100, description: "Confidence score for the analysis" },
        data_source: { type: "string", enum: ["yahoo", "alpha_vantage", "cached"], description: "Source of the underlying data (default: 'yahoo')" }
      },
      required: ["symbol", "analysis_type", "analysis_data"]
    }
  },
  {
    name: "get_analysis_history",
    description: "Retrieve historical analysis records from MongoDB with flexible filtering by symbol, type, date range, and sorting options.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Filter by stock symbol (optional)" },
        analysis_type: { type: "string", enum: ["market_structure", "trading_signal", "technical_indicators", "data_validation"], description: "Filter by analysis type (optional)" },
        from_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Start date filter in YYYY-MM-DD format (optional)" },
        to_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "End date filter in YYYY-MM-DD format (optional)" },
        limit: { type: "number", minimum: 1, maximum: 100, description: "Maximum number of results (default: 20)" },
        include_details: { type: "boolean", description: "Include detailed analysis results (default: true)" },
        sort_by: { type: "string", enum: ["newest", "oldest", "confidence", "symbol"], description: "Sort order for results (default: 'newest')" }
      }
    }
  },
  {
    name: "validate_data_quality",
    description: "Validate data quality and availability across sources. Performs comprehensive checks on data freshness, completeness, and accuracy for reliable analysis.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock symbol to validate (1-10 characters)" },
        validation_type: { type: "string", enum: ["basic", "comprehensive", "real_time"], description: "Validation depth: basic (essential checks), comprehensive (detailed analysis), real_time (current conditions) - default: 'basic'" },
        check_historical: { type: "boolean", description: "Include historical data validation (default: true)" },
        check_current: { type: "boolean", description: "Include current price data validation (default: true)" },
        max_age_minutes: { type: "number", minimum: 1, maximum: 1440, description: "Maximum acceptable data age in minutes (default: 60)" },
        store_results: { type: "boolean", description: "Store validation results in MongoDB (default: false)" }
      },
      required: ["symbol"]
    }
  }
];

// ==================== Express App Setup ====================

const app = express();

// Enhanced Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false,
  hidePoweredBy: true
}));

// Additional security headers
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict transport security for HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Prevent DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  
  // Prevent Adobe Flash and PDF execution
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
});

// CORS configuration for Universal MCP
const corsOptions = {
  origin: appConfig.app.nodeEnv === 'production' 
    ? appConfig.security.allowedOrigins.length > 0 
      ? appConfig.security.allowedOrigins 
      : false // Require explicit origins in production
    : true, // Allow all origins in development
  methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  credentials: false,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced Rate limiting with security monitoring
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: appConfig.app.nodeEnv === 'production' ? 100 : 1000,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      details: 'Rate limit exceeded. If you believe this is an error, please contact support.'
    },
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP + User Agent hash for more accurate rate limiting
    const userAgent = req.get('User-Agent') || 'unknown';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `${ip}:${require('crypto').createHash('md5').update(userAgent).digest('hex').substring(0, 8)}`;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return ['/health', '/metrics'].includes(req.path);
  },
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for ${req.ip} on ${req.path}`);
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Strict rate limiter for sensitive endpoints
const strictRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: appConfig.app.nodeEnv === 'production' ? 20 : 100,
  message: {
    success: false,
    error: {
      code: 'STRICT_RATE_LIMIT_EXCEEDED',
      message: 'Too many requests to sensitive endpoint. Please try again later.'
    },
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(rateLimiter);

// ==================== Authentication Middleware ====================

/**
 * Universal MCP Authentication middleware
 */
const authenticationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Skip auth for health checks and public endpoints
  const publicEndpoints = ['/health', '/metrics', '/', '/favicon.ico'];
  if (publicEndpoints.includes(req.path) || req.path.startsWith('/assets/')) {
    return next();
  }

  // Skip auth if disabled in configuration
  if (!appConfig.security.enableAuth) {
    return next();
  }

  // Check for API key in headers
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    res.status(401).json(createApiResponse(false, undefined, {
      code: 'AUTHENTICATION_REQUIRED',
      message: 'API key required. Provide X-API-Key header or Authorization Bearer token.',
      details: 'Authentication is enabled for this Universal MCP server instance.'
    }));
    return;
  }

  // Validate API key
  if (appConfig.security.apiKey && apiKey !== appConfig.security.apiKey) {
    res.status(403).json(createApiResponse(false, undefined, {
      code: 'INVALID_API_KEY',
      message: 'Invalid API key provided.',
      details: 'The provided API key does not match the configured key.'
    }));
    return;
  }

  // Add user context to request for logging
  const keyString = Array.isArray(apiKey) ? apiKey[0] : apiKey;
  (req as any).user = { apiKey: keyString.substring(0, 8) + '...' };
  next();
};

// Apply authentication middleware
app.use(authenticationMiddleware);

// ==================== Middleware ====================

/**
 * Enhanced request logging and Universal MCP metrics middleware
 */
const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = performance.now();
  
  serverMetrics.totalRequests++;
  serverMetrics.activeConnections++;

  // Determine protocol type for metrics
  let protocolType: 'httpRest' | 'httpMcp' | 'other' = 'other';
  if (req.path.startsWith('/api/')) {
    protocolType = 'httpRest';
    serverMetrics.protocolStats.httpRest.requests++;
  } else if (req.path === '/mcp') {
    protocolType = 'httpMcp';
    serverMetrics.protocolStats.httpMcp.requests++;
  }

  // Log request with protocol info
  const userAgent = req.get('User-Agent') || 'Unknown';
  const apiKeyUsed = req.headers['x-api-key'] || req.headers['authorization'] ? 'Yes' : 'No';
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip} - Protocol: ${protocolType} - Auth: ${apiKeyUsed} - UA: ${userAgent.substring(0, 50)}`);

  // Override res.end to capture response time and errors
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    serverMetrics.responseTimes.push(responseTime);
    serverMetrics.activeConnections--;
    
    // Track protocol-specific errors
    if (res.statusCode >= 400) {
      serverMetrics.totalErrors++;
      if (protocolType === 'httpRest') {
        serverMetrics.protocolStats.httpRest.errors++;
      } else if (protocolType === 'httpMcp') {
        serverMetrics.protocolStats.httpMcp.errors++;
      }
    }
    
    // Keep only last 1000 response times for memory efficiency
    if (serverMetrics.responseTimes.length > 1000) {
      serverMetrics.responseTimes.shift();
    }
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${responseTime.toFixed(2)}ms - Protocol: ${protocolType}`);
    
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

app.use(requestLogger);

/**
 * Error tracking middleware
 */
const errorCounter = (err: any, req: Request, res: Response, next: NextFunction): void => {
  serverMetrics.totalErrors++;
  next(err);
};

// ==================== Helper Functions ====================

/**
 * Create standardized HTTP API response
 */
function createApiResponse<T>(
  success: boolean, 
  data?: T, 
  error?: { code: string; message: string; details?: any },
  processingTime?: number
): HttpApiResponse<T> | HttpApiError {
  const response: any = {
    success,
    timestamp: new Date().toISOString()
  };
  
  if (success && data !== undefined) {
    response.data = data;
  }
  
  if (!success && error) {
    response.error = error;
  }
  
  if (processingTime !== undefined) {
    response.processingTime = Math.round(processingTime * 100) / 100; // Round to 2 decimal places
  }
  
  return response;
}

/**
 * Create JSON-RPC response
 */
function createJsonRpcResponse(id: string | number | undefined, result?: any, error?: JsonRpcError): JsonRpcResponse {
  const response: JsonRpcResponse = {
    jsonrpc: "2.0"
  };
  
  if (id !== undefined) {
    response.id = id;
  }
  
  if (result !== undefined) {
    response.result = result;
  }
  
  if (error) {
    response.error = error;
  }
  
  return response;
}

/**
 * Execute MCP tool with error handling
 */
async function executeTool(toolName: string, args: any): Promise<McpToolCallResponse> {
  try {
    let result: any;
    switch (toolName) {
      case "analyze_market_structure":
        result = await analyzeMarketStructure(args);
        break;
      case "generate_trading_signal":
        result = await generateTradingSignal(args);
        break;
      case "calculate_indicators":
        result = await calculateIndicators(args);
        break;
      case "store_analysis":
        result = await storeAnalysis(args);
        break;
      case "get_analysis_history":
        result = await getAnalysisHistory(args);
        break;
      case "validate_data_quality":
        result = await validateDataQuality(args);
        break;
      default:
        return {
          content: [{ 
            type: "text" as const, 
            text: `❌ **Unknown Tool: ${toolName}**\n\nAvailable tools:\n${tools.map(t => `• **${t.name}**: ${t.description}`).join('\n')}\n\n*Kaayaan Strategist AI - Market Analysis MCP Server*`
          }],
          isError: true
        };
    }
    
    // Ensure proper type casting for content
    return {
      content: result.content.map((item: any) => ({
        type: "text" as const,
        text: item.text
      })),
      isError: result.isError
    };
    
  } catch (error) {
    console.error(`Tool execution error for ${toolName}:`, error);
    return {
      content: [{ 
        type: "text" as const, 
        text: `❌ **Tool Execution Error**\n\nTool: ${toolName}\nError: ${(error as Error).message}\n\nPlease check your parameters and try again.\n\n*If the error persists, this may indicate a system issue.*`
      }],
      isError: true
    };
  }
}

// ==================== Health Check Endpoint ====================

/**
 * GET /health - Universal MCP comprehensive health check
 */
app.get('/health', async (req: Request, res: Response): Promise<void> => {
  const startTime = performance.now();
  
  try {
    // Check service connectivity
    const mongoStatus = mongoDBService.isAvailable();
    const redisStatus = redisCache.isAvailable();
    
    // Check protocol-specific health
    const protocolHealth = {
      httpRest: {
        enabled: appConfig.protocols.httpRest,
        requests: serverMetrics.protocolStats.httpRest.requests,
        errors: serverMetrics.protocolStats.httpRest.errors,
        errorRate: serverMetrics.protocolStats.httpRest.requests > 0 
          ? (serverMetrics.protocolStats.httpRest.errors / serverMetrics.protocolStats.httpRest.requests) * 100 
          : 0
      },
      httpMcp: {
        enabled: appConfig.protocols.httpMcp,
        requests: serverMetrics.protocolStats.httpMcp.requests,
        errors: serverMetrics.protocolStats.httpMcp.errors,
        errorRate: serverMetrics.protocolStats.httpMcp.requests > 0 
          ? (serverMetrics.protocolStats.httpMcp.errors / serverMetrics.protocolStats.httpMcp.requests) * 100 
          : 0,
        n8nCompatible: true
      },
      stdio: {
        enabled: appConfig.protocols.stdio,
        status: 'ready'
      },
      websocket: {
        enabled: appConfig.protocols.websocket,
        connections: serverMetrics.protocolStats.websocket.connections,
        messages: serverMetrics.protocolStats.websocket.messages,
        errors: serverMetrics.protocolStats.websocket.errors
      }
    };
    
    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const criticalServicesDown = !mongoStatus && !redisStatus;
    const highErrorRate = (serverMetrics.totalRequests > 10 && (serverMetrics.totalErrors / serverMetrics.totalRequests) > 0.1);
    
    if (criticalServicesDown || highErrorRate) {
      status = 'unhealthy';
    } else if (!mongoStatus || !redisStatus) {
      status = 'degraded';
    }
    
    const healthResponse: HealthCheckResponse = {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - serverMetrics.startTime) / 1000),
      version: "2.0.0",
      architecture: "Universal MCP",
      environment: appConfig.app.nodeEnv,
      protocols: protocolHealth,
      services: {
        mongodb: {
          status: mongoStatus ? 'connected' : 'disconnected',
          collections: ['market_analysis', 'trading_signals', 'technical_indicators']
        },
        redis: {
          status: redisStatus ? 'connected' : 'disconnected',
          ttl_minutes: appConfig.redis.ttlMinutes
        },
        yahoo_finance: {
          status: 'available',
          rate_limit_remaining: appConfig.dataSources.yahoo.rateLimit,
          description: 'Primary data source for market data'
        },
        alpha_vantage: {
          status: appConfig.dataSources.alphaVantage.apiKey ? 'available' : 'unavailable',
          rate_limit_remaining: appConfig.dataSources.alphaVantage.rateLimit,
          description: 'Backup data source'
        },
        coingecko: {
          status: 'available',
          rate_limit_remaining: appConfig.dataSources.coinGecko.rateLimit,
          description: 'Cryptocurrency data source'
        }
      },
      performance: {
        total_requests: serverMetrics.totalRequests,
        total_errors: serverMetrics.totalErrors,
        error_rate_percent: serverMetrics.totalRequests > 0 
          ? Math.round((serverMetrics.totalErrors / serverMetrics.totalRequests) * 100 * 100) / 100 
          : 0,
        active_connections: serverMetrics.activeConnections,
        avg_response_time_ms: serverMetrics.responseTimes.length > 0 
          ? Math.round((serverMetrics.responseTimes.reduce((a, b) => a + b, 0) / serverMetrics.responseTimes.length) * 100) / 100 
          : 0
      },
      security: {
        authentication: appConfig.security.enableAuth ? 'enabled' : 'disabled',
        cors_policy: appConfig.app.nodeEnv === 'production' ? 'restricted' : 'permissive',
        rate_limiting: 'enabled'
      }
    };
    
    const processingTime = performance.now() - startTime;
    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(createApiResponse(true, healthResponse, undefined, processingTime));
  } catch (error) {
    const processingTime = performance.now() - startTime;
    res.status(500).json(createApiResponse(false, undefined, {
      code: 'HEALTH_CHECK_ERROR',
      message: 'Universal MCP health check failed',
      details: (error as Error).message
    }, processingTime));
  }
});

// ==================== Metrics Endpoint ====================

/**
 * GET /metrics - Universal MCP server performance metrics
 */
app.get('/metrics', (req: Request, res: Response): void => {
  const startTime = performance.now();
  
  try {
    const uptime = Date.now() - serverMetrics.startTime;
    const avgResponseTime = serverMetrics.responseTimes.length > 0 
      ? serverMetrics.responseTimes.reduce((a, b) => a + b, 0) / serverMetrics.responseTimes.length 
      : 0;
    
    const metricsResponse: MetricsResponse = {
      server_info: {
        name: "kaayaan-strategist-universal-mcp",
        version: "2.0.0",
        architecture: "Universal MCP",
        uptime_seconds: Math.floor(uptime / 1000),
        start_time: new Date(serverMetrics.startTime).toISOString()
      },
      protocols: {
        http_rest: {
          enabled: appConfig.protocols.httpRest,
          requests_total: serverMetrics.protocolStats.httpRest.requests,
          errors_total: serverMetrics.protocolStats.httpRest.errors,
          error_rate_percent: serverMetrics.protocolStats.httpRest.requests > 0 
            ? Math.round((serverMetrics.protocolStats.httpRest.errors / serverMetrics.protocolStats.httpRest.requests) * 100 * 100) / 100 
            : 0
        },
        http_mcp: {
          enabled: appConfig.protocols.httpMcp,
          requests_total: serverMetrics.protocolStats.httpMcp.requests,
          errors_total: serverMetrics.protocolStats.httpMcp.errors,
          error_rate_percent: serverMetrics.protocolStats.httpMcp.requests > 0 
            ? Math.round((serverMetrics.protocolStats.httpMcp.errors / serverMetrics.protocolStats.httpMcp.requests) * 100 * 100) / 100 
            : 0,
          n8n_compatible: true
        },
        stdio_mcp: {
          enabled: appConfig.protocols.stdio,
          status: "ready"
        },
        websocket_mcp: {
          enabled: appConfig.protocols.websocket,
          connections_total: serverMetrics.protocolStats.websocket.connections,
          messages_total: serverMetrics.protocolStats.websocket.messages,
          errors_total: serverMetrics.protocolStats.websocket.errors
        }
      },
      performance: {
        requests_total: serverMetrics.totalRequests,
        requests_per_minute: uptime > 0 ? Math.round((serverMetrics.totalRequests / (uptime / 60000)) * 100) / 100 : 0,
        errors_total: serverMetrics.totalErrors,
        error_rate_percent: serverMetrics.totalRequests > 0 ? Math.round((serverMetrics.totalErrors / serverMetrics.totalRequests) * 100 * 100) / 100 : 0,
        average_response_time_ms: Math.round(avgResponseTime * 100) / 100,
        active_connections: serverMetrics.activeConnections,
        response_time_percentiles: calculatePercentiles(serverMetrics.responseTimes)
      },
      system: {
        memory_usage: {
          used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
          total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
          percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100 * 100) / 100,
          external_mb: Math.round(process.memoryUsage().external / 1024 / 1024 * 100) / 100
        },
        cpu_usage: {
          user_ms: Math.round(process.cpuUsage().user / 1000),
          system_ms: Math.round(process.cpuUsage().system / 1000)
        },
        process: {
          pid: process.pid,
          node_version: process.version,
          platform: process.platform,
          arch: process.arch
        }
      },
      services: {
        mongodb: mongoDBService.isAvailable() ? 'connected' : 'disconnected',
        redis: redisCache.isAvailable() ? 'connected' : 'disconnected',
        data_sources: {
          yahoo_finance: 'available',
          alpha_vantage: appConfig.dataSources.alphaVantage.apiKey ? 'available' : 'unavailable',
          coingecko: 'available'
        }
      }
    };
    
    const processingTime = performance.now() - startTime;
    res.json(createApiResponse(true, metricsResponse, undefined, processingTime));
  } catch (error) {
    const processingTime = performance.now() - startTime;
    res.status(500).json(createApiResponse(false, undefined, {
      code: 'METRICS_ERROR',
      message: 'Failed to retrieve Universal MCP metrics',
      details: (error as Error).message
    }, processingTime));
  }
});

// Helper function to calculate response time percentiles
function calculatePercentiles(times: number[]): { p50: number; p90: number; p95: number; p99: number } {
  if (times.length === 0) {
    return { p50: 0, p90: 0, p95: 0, p99: 0 };
  }
  
  const sorted = [...times].sort((a, b) => a - b);
  return {
    p50: Math.round(sorted[Math.floor(sorted.length * 0.5)] * 100) / 100,
    p90: Math.round(sorted[Math.floor(sorted.length * 0.9)] * 100) / 100,
    p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 100) / 100,
    p99: Math.round(sorted[Math.floor(sorted.length * 0.99)] * 100) / 100
  };
}

// ==================== MCP Protocol Endpoint ====================

/**
 * POST /mcp - Enhanced MCP-over-HTTP protocol endpoint for full n8n-nodes-mcp compatibility
 */
app.post('/mcp', async (req: Request, res: Response): Promise<void> => {
  const startTime = performance.now();
  
  try {
    // Enhanced JSON-RPC validation for n8n compatibility
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json(createJsonRpcResponse(undefined, undefined, {
        code: -32600,
        message: "Invalid Request",
        data: "Request body must be a valid JSON object"
      }));
      return;
    }

    if (!isValidJsonRpcRequest(req.body)) {
      res.status(400).json(createJsonRpcResponse(req.body?.id, undefined, {
        code: -32600,
        message: "Invalid Request",
        data: "Must be a valid JSON-RPC 2.0 request"
      }));
      return;
    }
    
    const { method, params, id } = req.body;
    
    // Enhanced method handling with full n8n-nodes-mcp compatibility
    switch (method) {
      case 'tools/list':
        const toolsList: McpToolsListResponse = { 
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        };
        res.json(createJsonRpcResponse(id, toolsList));
        break;
        
      case 'tools/call':
        const callParams = params as McpToolCallParams;
        
        if (!callParams || !callParams.name) {
          res.json(createJsonRpcResponse(id, undefined, {
            code: -32602,
            message: "Invalid params",
            data: "Missing required parameter: name"
          }));
          return;
        }
        
        // Enhanced tool validation
        const toolExists = tools.some(tool => tool.name === callParams.name);
        if (!toolExists) {
          res.json(createJsonRpcResponse(id, undefined, {
            code: -32601,
            message: "Method not found",
            data: `Tool '${callParams.name}' not found. Available tools: ${tools.map(t => t.name).join(', ')}`
          }));
          return;
        }
        
        const result = await executeTool(callParams.name, callParams.arguments || {});
        res.json(createJsonRpcResponse(id, result));
        break;
        
      case 'initialize':
        // n8n-nodes-mcp initialization handshake
        res.json(createJsonRpcResponse(id, {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "kaayaan-strategist-universal-mcp",
            version: "2.0.0"
          },
          instructions: "Kaayaan Strategist AI - Professional market analysis tools"
        }));
        break;
        
      case 'notifications/initialized':
        // Client initialization notification
        res.json(createJsonRpcResponse(id, {}));
        break;
        
      case 'ping':
        // Connection health check
        res.json(createJsonRpcResponse(id, {
          pong: true,
          timestamp: new Date().toISOString(),
          server: "kaayaan-strategist-universal-mcp"
        }));
        break;
        
      case 'sampling/createMessage':
        // Sampling capability (if needed by n8n)
        res.json(createJsonRpcResponse(id, undefined, {
          code: -32601,
          message: "Method not supported",
          data: "Sampling capabilities not implemented in this server"
        }));
        break;
        
      default:
        res.json(createJsonRpcResponse(id, undefined, {
          code: -32601,
          message: "Method not found",
          data: `Unknown method: ${method}. Supported methods: tools/list, tools/call, initialize, notifications/initialized, ping`
        }));
    }
  } catch (error) {
    const processingTime = performance.now() - startTime;
    console.error('MCP protocol error:', error);
    res.status(500).json(createJsonRpcResponse(req.body?.id, undefined, {
      code: -32000,
      message: 'Internal server error',
      data: (error as Error).message
    }));
  }
});

// ==================== REST API Endpoints ====================

/**
 * POST /api/analyze-market-structure - Market Structure Analysis
 */
app.post('/api/analyze-market-structure', async (req: Request, res: Response): Promise<void> => {
  const startTime = performance.now();
  
  try {
    const validatedParams = marketStructureSchema.parse(req.body);
    const result = await executeTool('analyze_market_structure', validatedParams);
    
    const processingTime = performance.now() - startTime;
    
    if (result.isError) {
      res.status(400).json(createApiResponse(false, undefined, {
        code: 'ANALYSIS_ERROR',
        message: 'Market structure analysis failed',
        details: result.content[0]?.text
      }, processingTime));
    } else {
      res.json(createApiResponse(true, result, undefined, processingTime));
    }
  } catch (error) {
    const processingTime = performance.now() - startTime;
    if (error instanceof z.ZodError) {
      res.status(400).json(createApiResponse(false, undefined, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: error.errors
      }, processingTime));
    } else {
      res.status(500).json(createApiResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: (error as Error).message
      }, processingTime));
    }
  }
});

/**
 * POST /api/generate-trading-signal - Trading Signal Generation
 */
app.post('/api/generate-trading-signal', async (req: Request, res: Response): Promise<void> => {
  const startTime = performance.now();
  
  try {
    const validatedParams = tradingSignalSchema.parse(req.body);
    const result = await executeTool('generate_trading_signal', validatedParams);
    
    const processingTime = performance.now() - startTime;
    
    if (result.isError) {
      res.status(400).json(createApiResponse(false, undefined, {
        code: 'SIGNAL_ERROR',
        message: 'Trading signal generation failed',
        details: result.content[0]?.text
      }, processingTime));
    } else {
      res.json(createApiResponse(true, result, undefined, processingTime));
    }
  } catch (error) {
    const processingTime = performance.now() - startTime;
    if (error instanceof z.ZodError) {
      res.status(400).json(createApiResponse(false, undefined, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: error.errors
      }, processingTime));
    } else {
      res.status(500).json(createApiResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: (error as Error).message
      }, processingTime));
    }
  }
});

/**
 * POST /api/calculate-indicators - Technical Indicators Calculation
 */
app.post('/api/calculate-indicators', async (req: Request, res: Response): Promise<void> => {
  const startTime = performance.now();
  
  try {
    const validatedParams = technicalIndicatorsSchema.parse(req.body);
    const result = await executeTool('calculate_indicators', validatedParams);
    
    const processingTime = performance.now() - startTime;
    
    if (result.isError) {
      res.status(400).json(createApiResponse(false, undefined, {
        code: 'INDICATORS_ERROR',
        message: 'Technical indicators calculation failed',
        details: result.content[0]?.text
      }, processingTime));
    } else {
      res.json(createApiResponse(true, result, undefined, processingTime));
    }
  } catch (error) {
    const processingTime = performance.now() - startTime;
    if (error instanceof z.ZodError) {
      res.status(400).json(createApiResponse(false, undefined, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: error.errors
      }, processingTime));
    } else {
      res.status(500).json(createApiResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: (error as Error).message
      }, processingTime));
    }
  }
});

/**
 * POST /api/store-analysis - Store Analysis Results
 */
app.post('/api/store-analysis', async (req: Request, res: Response): Promise<void> => {
  const startTime = performance.now();
  
  try {
    const validatedParams = storeAnalysisSchema.parse(req.body);
    const result = await executeTool('store_analysis', validatedParams);
    
    const processingTime = performance.now() - startTime;
    
    if (result.isError) {
      res.status(400).json(createApiResponse(false, undefined, {
        code: 'STORAGE_ERROR',
        message: 'Analysis storage failed',
        details: result.content[0]?.text
      }, processingTime));
    } else {
      res.json(createApiResponse(true, result, undefined, processingTime));
    }
  } catch (error) {
    const processingTime = performance.now() - startTime;
    if (error instanceof z.ZodError) {
      res.status(400).json(createApiResponse(false, undefined, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: error.errors
      }, processingTime));
    } else {
      res.status(500).json(createApiResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: (error as Error).message
      }, processingTime));
    }
  }
});

/**
 * GET /api/analysis-history - Get Analysis History
 */
app.get('/api/analysis-history', async (req: Request, res: Response): Promise<void> => {
  const startTime = performance.now();
  
  try {
    const validatedParams = analysisHistorySchema.parse(req.query);
    const result = await executeTool('get_analysis_history', validatedParams);
    
    const processingTime = performance.now() - startTime;
    
    if (result.isError) {
      res.status(400).json(createApiResponse(false, undefined, {
        code: 'HISTORY_ERROR',
        message: 'Analysis history retrieval failed',
        details: result.content[0]?.text
      }, processingTime));
    } else {
      res.json(createApiResponse(true, result, undefined, processingTime));
    }
  } catch (error) {
    const processingTime = performance.now() - startTime;
    if (error instanceof z.ZodError) {
      res.status(400).json(createApiResponse(false, undefined, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid query parameters',
        details: error.errors
      }, processingTime));
    } else {
      res.status(500).json(createApiResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: (error as Error).message
      }, processingTime));
    }
  }
});

/**
 * POST /api/validate-data-quality - Data Quality Validation
 */
app.post('/api/validate-data-quality', async (req: Request, res: Response): Promise<void> => {
  const startTime = performance.now();
  
  try {
    const validatedParams = dataQualitySchema.parse(req.body);
    const result = await executeTool('validate_data_quality', validatedParams);
    
    const processingTime = performance.now() - startTime;
    
    if (result.isError) {
      res.status(400).json(createApiResponse(false, undefined, {
        code: 'VALIDATION_TOOL_ERROR',
        message: 'Data quality validation failed',
        details: result.content[0]?.text
      }, processingTime));
    } else {
      res.json(createApiResponse(true, result, undefined, processingTime));
    }
  } catch (error) {
    const processingTime = performance.now() - startTime;
    if (error instanceof z.ZodError) {
      res.status(400).json(createApiResponse(false, undefined, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: error.errors
      }, processingTime));
    } else {
      res.status(500).json(createApiResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: (error as Error).message
      }, processingTime));
    }
  }
});

// ==================== API Documentation Endpoint ====================

/**
 * GET / - Universal MCP API Documentation
 */
app.get('/', (req: Request, res: Response): void => {
  res.json({
    name: "Kaayaan Strategist AI Universal MCP Server",
    version: "2.0.0",
    description: "Professional market analysis Universal MCP server supporting all 4 protocols: STDIO MCP, HTTP REST API, HTTP MCP, and WebSocket MCP",
    architecture: "Universal MCP - Quad Protocol Support",
    protocols: {
      "stdio-mcp": {
        description: "Original MCP protocol via STDIO for Claude Desktop integration",
        usage: "Use with Claude Desktop or other STDIO MCP clients",
        status: appConfig.protocols.stdio ? "enabled" : "disabled"
      },
      "http-rest-api": {
        description: "RESTful HTTP API for general HTTP clients",
        base_url: `${req.protocol}://${req.get('host')}/api`,
        endpoints: [
          "POST /analyze-market-structure",
          "POST /generate-trading-signal", 
          "POST /calculate-indicators",
          "POST /store-analysis",
          "GET /analysis-history",
          "POST /validate-data-quality"
        ],
        status: appConfig.protocols.httpRest ? "enabled" : "disabled"
      },
      "http-mcp": {
        description: "Enhanced MCP protocol over HTTP for n8n-nodes-mcp compatibility",
        endpoint: `${req.protocol}://${req.get('host')}/mcp`,
        methods: [
          "initialize", 
          "notifications/initialized", 
          "tools/list", 
          "tools/call", 
          "ping",
          "sampling/createMessage"
        ],
        compatibility: "n8n-nodes-mcp fully supported",
        status: appConfig.protocols.httpMcp ? "enabled" : "disabled"
      },
      "websocket-mcp": {
        description: "Real-time MCP protocol over WebSocket for live clients",
        endpoint: `ws://${req.get('host')}:${appConfig.server.websocketPort}/mcp`,
        methods: [
          "tools/list", 
          "tools/call", 
          "server/info", 
          "ping"
        ],
        features: ["Real-time communication", "Connection management", "Auto-reconnection support"],
        status: appConfig.protocols.websocket ? "enabled" : "disabled"
      }
    },
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description
    })),
    system_endpoints: [
      "GET /health - Comprehensive health check and service status",
      "GET /metrics - Server performance metrics and connection stats",
      "GET / - This Universal MCP API documentation"
    ],
    security: {
      authentication: appConfig.security.enableAuth ? "enabled" : "disabled",
      api_key_required: appConfig.security.enableAuth && appConfig.security.apiKey ? true : false,
      cors_policy: appConfig.app.nodeEnv === 'production' ? "restricted" : "permissive",
      rate_limiting: "enabled"
    },
    configuration: {
      environment: appConfig.app.nodeEnv,
      timezone: appConfig.app.timezone,
      cache_ttl_minutes: appConfig.redis.ttlMinutes,
      data_sources: {
        yahoo_finance: "enabled",
        alpha_vantage: appConfig.dataSources.alphaVantage.apiKey ? "enabled" : "disabled",
        coingecko: "enabled"
      }
    },
    educational_notice: "This is an educational analysis tool. NOT financial advice.",
    repository: "https://github.com/kaayaan/mcp-kaayaan-strategist",
    documentation: "https://github.com/kaayaan/mcp-kaayaan-strategist#readme",
    support: {
      n8n_integration: "https://github.com/kaayaan/mcp-kaayaan-strategist#n8n-integration",
      websocket_examples: "https://github.com/kaayaan/mcp-kaayaan-strategist#websocket-examples"
    }
  });
});

// ==================== Error Handling ====================

// 404 handler
app.use('*', (req: Request, res: Response): void => {
  res.status(404).json(createApiResponse(false, undefined, {
    code: 'NOT_FOUND',
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    details: 'Please check the API documentation at the root endpoint'
  }));
});

// Global error handler
app.use(errorCounter);
app.use((err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error('Unhandled error:', err);
  
  res.status(500).json(createApiResponse(false, undefined, {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Please try again later'
  }));
});


// ==================== Server Export ====================

export { app, serverMetrics };