/**
 * TypeScript interfaces for HTTP API and MCP protocol support
 * @fileoverview Comprehensive type definitions for all HTTP endpoints and MCP protocol
 */

import { z } from "zod";

// ==================== HTTP API Types ====================

/**
 * Standard HTTP API Response wrapper
 */
export interface HttpApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  processingTime?: number;
}

/**
 * HTTP API Error Response
 */
export interface HttpApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

// ==================== Tool Parameter Types ====================

/**
 * Market Structure Analysis Parameters
 */
export interface MarketStructureParams {
  symbol: string;
  period?: "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y";
  include_support_resistance?: boolean;
  include_volatility?: boolean;
  lookback_days?: number;
}

/**
 * Trading Signal Parameters
 */
export interface TradingSignalParams {
  symbol: string;
  timeframe?: "short" | "medium" | "long";
  risk_tolerance?: "conservative" | "moderate" | "aggressive";
  include_stop_loss?: boolean;
  include_take_profit?: boolean;
  min_confidence?: number;
}

/**
 * Technical Indicators Parameters
 */
export interface TechnicalIndicatorsParams {
  symbol: string;
  indicators?: ("rsi" | "macd" | "sma" | "ema" | "all")[];
  period?: "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y";
  rsi_period?: number;
  macd_fast?: number;
  macd_slow?: number;
  macd_signal?: number;
  sma_period?: number;
  ema_period?: number;
  include_interpretation?: boolean;
}

/**
 * Store Analysis Parameters
 */
export interface StoreAnalysisParams {
  symbol: string;
  analysis_type: "market_structure" | "trading_signal" | "technical_indicators" | "data_validation";
  analysis_data: any;
  notes?: string;
  tags?: string[];
  confidence?: number;
  data_source?: "yahoo" | "alpha_vantage" | "cached";
}

/**
 * Analysis History Parameters
 */
export interface AnalysisHistoryParams {
  symbol?: string;
  analysis_type?: "market_structure" | "trading_signal" | "technical_indicators" | "data_validation";
  from_date?: string;
  to_date?: string;
  limit?: number;
  include_details?: boolean;
  sort_by?: "newest" | "oldest" | "confidence" | "symbol";
}

/**
 * Data Quality Validation Parameters
 */
export interface DataQualityParams {
  symbol: string;
  validation_type?: "basic" | "comprehensive" | "real_time";
  check_historical?: boolean;
  check_current?: boolean;
  max_age_minutes?: number;
  store_results?: boolean;
}

// ==================== MCP Protocol Types ====================

/**
 * JSON-RPC 2.0 Request
 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id?: string | number;
}

/**
 * JSON-RPC 2.0 Response
 */
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: JsonRpcError;
  id?: string | number;
}

/**
 * JSON-RPC 2.0 Error
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

/**
 * MCP Tool Definition for JSON-RPC responses
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP Tools List Response
 */
export interface McpToolsListResponse {
  tools: McpToolDefinition[];
}

/**
 * MCP Tool Call Parameters
 */
export interface McpToolCallParams {
  name: string;
  arguments: any;
}

/**
 * MCP Tool Call Response
 */
export interface McpToolCallResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

// ==================== Service Status Types ====================

/**
 * Health Check Response
 */
export interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  services: {
    mongodb: {
      status: "connected" | "disconnected";
      latency?: number;
    };
    redis: {
      status: "connected" | "disconnected";
      latency?: number;
    };
    yahoo_finance: {
      status: "available" | "unavailable";
      rate_limit_remaining?: number;
    };
    alpha_vantage: {
      status: "available" | "unavailable";
      rate_limit_remaining?: number;
    };
  };
  version: string;
  environment: string;
}

/**
 * Metrics Response
 */
export interface MetricsResponse {
  requests_total: number;
  requests_per_minute: number;
  error_rate: number;
  average_response_time: number;
  cache_hit_rate: number;
  active_connections: number;
  memory_usage: {
    used: number;
    total: number;
    percentage: number;
  };
}

// ==================== Request Validation Schemas ====================

export const marketStructureSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  period: z.enum(["1d", "5d", "1mo", "3mo", "6mo", "1y"]).default("1mo"),
  include_support_resistance: z.boolean().default(true),
  include_volatility: z.boolean().default(true),
  lookback_days: z.number().min(5).max(100).default(20)
});

export const tradingSignalSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  timeframe: z.enum(["short", "medium", "long"]).default("medium"),
  risk_tolerance: z.enum(["conservative", "moderate", "aggressive"]).default("moderate"),
  include_stop_loss: z.boolean().default(true),
  include_take_profit: z.boolean().default(true),
  min_confidence: z.number().min(0).max(100).default(60)
});

export const technicalIndicatorsSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  indicators: z.array(z.enum(["rsi", "macd", "sma", "ema", "all"])).default(["all"]),
  period: z.enum(["1d", "5d", "1mo", "3mo", "6mo", "1y"]).default("1mo"),
  rsi_period: z.number().min(5).max(50).default(14),
  macd_fast: z.number().min(5).max(30).default(12),
  macd_slow: z.number().min(20).max(50).default(26),
  macd_signal: z.number().min(5).max(20).default(9),
  sma_period: z.number().min(5).max(200).default(20),
  ema_period: z.number().min(5).max(200).default(20),
  include_interpretation: z.boolean().default(true)
});

export const storeAnalysisSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  analysis_type: z.enum(["market_structure", "trading_signal", "technical_indicators", "data_validation"]),
  analysis_data: z.any(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(100).optional(),
  data_source: z.enum(["yahoo", "alpha_vantage", "cached"]).default("yahoo")
});

export const analysisHistorySchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()).optional(),
  analysis_type: z.enum(["market_structure", "trading_signal", "technical_indicators", "data_validation"]).optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().min(1).max(100).default(20),
  include_details: z.boolean().default(true),
  sort_by: z.enum(["newest", "oldest", "confidence", "symbol"]).default("newest")
});

export const dataQualitySchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  validation_type: z.enum(["basic", "comprehensive", "real_time"]).default("basic"),
  check_historical: z.boolean().default(true),
  check_current: z.boolean().default(true),
  max_age_minutes: z.number().min(1).max(1440).default(60),
  store_results: z.boolean().default(false)
});

// ==================== Response Type Guards ====================

/**
 * Type guard to check if response is an error
 */
export function isHttpApiError(response: any): response is HttpApiError {
  return response && response.success === false && response.error;
}

/**
 * Type guard to check if response is successful
 */
export function isHttpApiSuccess<T>(response: any): response is HttpApiResponse<T> {
  return response && response.success === true;
}

/**
 * Type guard to check if request is valid JSON-RPC
 */
export function isValidJsonRpcRequest(request: any): request is JsonRpcRequest {
  return request && 
         request.jsonrpc === "2.0" && 
         typeof request.method === "string" &&
         (request.id === undefined || typeof request.id === "string" || typeof request.id === "number");
}