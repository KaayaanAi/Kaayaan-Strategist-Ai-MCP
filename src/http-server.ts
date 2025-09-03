/**
 * HTTP Server for Kaayaan Strategist AI MCP Server
 * @fileoverview Production-ready HTTP server supporting REST API and MCP-over-HTTP protocols
 * 
 * Supports three protocols:
 * 1. STDIO MCP (original - for Claude Desktop)
 * 2. HTTP REST API (for general HTTP clients) 
 * 3. HTTP MCP Protocol (for n8n-nodes-mcp compatibility)
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

// ==================== Server Metrics ====================

interface ServerMetrics {
  startTime: number;
  totalRequests: number;
  totalErrors: number;
  responseTimes: number[];
  activeConnections: number;
}

const serverMetrics: ServerMetrics = {
  startTime: Date.now(),
  totalRequests: 0,
  totalErrors: 0,
  responseTimes: [],
  activeConnections: 0
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

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com']
    : true, // Allow all origins in development
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.'
    },
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(rateLimiter);

// ==================== Middleware ====================

/**
 * Request logging and metrics middleware
 */
const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = performance.now();
  
  serverMetrics.totalRequests++;
  serverMetrics.activeConnections++;

  // Log request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    serverMetrics.responseTimes.push(responseTime);
    serverMetrics.activeConnections--;
    
    // Keep only last 1000 response times for memory efficiency
    if (serverMetrics.responseTimes.length > 1000) {
      serverMetrics.responseTimes.shift();
    }
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${responseTime.toFixed(2)}ms`);
    
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
 * GET /health - Comprehensive health check
 */
app.get('/health', async (req: Request, res: Response): Promise<void> => {
  const startTime = performance.now();
  
  try {
    // Check service connectivity
    const mongoStatus = mongoDBService.isAvailable();
    const redisStatus = redisCache.isAvailable();
    
    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!mongoStatus && !redisStatus) {
      status = 'unhealthy';
    } else if (!mongoStatus || !redisStatus) {
      status = 'degraded';
    }
    
    const healthResponse: HealthCheckResponse = {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - serverMetrics.startTime) / 1000),
      services: {
        mongodb: {
          status: mongoStatus ? 'connected' : 'disconnected'
        },
        redis: {
          status: redisStatus ? 'connected' : 'disconnected'
        },
        yahoo_finance: {
          status: 'available', // Yahoo Finance doesn't require auth
          rate_limit_remaining: appConfig.dataSources.yahoo.rateLimit
        },
        alpha_vantage: {
          status: appConfig.dataSources.alphaVantage.apiKey ? 'available' : 'unavailable',
          rate_limit_remaining: appConfig.dataSources.alphaVantage.rateLimit
        }
      },
      version: "1.0.0",
      environment: appConfig.app.nodeEnv
    };
    
    const processingTime = performance.now() - startTime;
    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(createApiResponse(true, healthResponse, undefined, processingTime));
  } catch (error) {
    const processingTime = performance.now() - startTime;
    res.status(500).json(createApiResponse(false, undefined, {
      code: 'HEALTH_CHECK_ERROR',
      message: 'Health check failed',
      details: (error as Error).message
    }, processingTime));
  }
});

// ==================== Metrics Endpoint ====================

/**
 * GET /metrics - Server performance metrics
 */
app.get('/metrics', (req: Request, res: Response): void => {
  const startTime = performance.now();
  
  try {
    const uptime = Date.now() - serverMetrics.startTime;
    const avgResponseTime = serverMetrics.responseTimes.length > 0 
      ? serverMetrics.responseTimes.reduce((a, b) => a + b, 0) / serverMetrics.responseTimes.length 
      : 0;
    
    const metricsResponse: MetricsResponse = {
      requests_total: serverMetrics.totalRequests,
      requests_per_minute: Math.round((serverMetrics.totalRequests / (uptime / 60000)) * 100) / 100,
      error_rate: serverMetrics.totalRequests > 0 ? (serverMetrics.totalErrors / serverMetrics.totalRequests) * 100 : 0,
      average_response_time: Math.round(avgResponseTime * 100) / 100,
      cache_hit_rate: 0, // TODO: Implement cache hit tracking
      active_connections: serverMetrics.activeConnections,
      memory_usage: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
        percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100 * 100) / 100
      }
    };
    
    const processingTime = performance.now() - startTime;
    res.json(createApiResponse(true, metricsResponse, undefined, processingTime));
  } catch (error) {
    const processingTime = performance.now() - startTime;
    res.status(500).json(createApiResponse(false, undefined, {
      code: 'METRICS_ERROR',
      message: 'Failed to retrieve metrics',
      details: (error as Error).message
    }, processingTime));
  }
});

// ==================== MCP Protocol Endpoint ====================

/**
 * POST /mcp - MCP-over-HTTP protocol endpoint for n8n-nodes-mcp compatibility
 */
app.post('/mcp', async (req: Request, res: Response): Promise<void> => {
  const startTime = performance.now();
  
  try {
    if (!isValidJsonRpcRequest(req.body)) {
      res.status(400).json(createJsonRpcResponse(req.body?.id, undefined, {
        code: -32600,
        message: "Invalid JSON-RPC request"
      }));
      return;
    }
    
    const { method, params, id } = req.body;
    
    if (method === 'tools/list') {
      const toolsList: McpToolsListResponse = { tools };
      res.json(createJsonRpcResponse(id, toolsList));
      
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params as McpToolCallParams;
      
      if (!name) {
        res.json(createJsonRpcResponse(id, undefined, {
          code: -32602,
          message: "Missing required parameter: name"
        }));
        return;
      }
      
      const result = await executeTool(name, args || {});
      res.json(createJsonRpcResponse(id, result));
      
    } else {
      res.json(createJsonRpcResponse(id, undefined, {
        code: -32601,
        message: `Method not found: ${method}`
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
 * GET / - API Documentation
 */
app.get('/', (req: Request, res: Response): void => {
  res.json({
    name: "Kaayaan Strategist AI MCP Server",
    version: "1.0.0",
    description: "Professional market analysis MCP server supporting STDIO MCP, HTTP REST API, and HTTP MCP protocols",
    protocols: {
      "stdio-mcp": {
        description: "Original MCP protocol via STDIO for Claude Desktop integration",
        usage: "Use with Claude Desktop or other MCP clients"
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
        ]
      },
      "http-mcp": {
        description: "MCP protocol over HTTP for n8n-nodes-mcp compatibility",
        endpoint: `${req.protocol}://${req.get('host')}/mcp`,
        methods: ["tools/list", "tools/call"]
      }
    },
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description
    })),
    system_endpoints: [
      "GET /health - Health check and service status",
      "GET /metrics - Server performance metrics",
      "GET / - This API documentation"
    ],
    educational_notice: "This is an educational analysis tool. NOT financial advice.",
    repository: "https://github.com/kaayaan/mcp-kaayaan-strategist",
    documentation: "https://github.com/kaayaan/mcp-kaayaan-strategist#readme"
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