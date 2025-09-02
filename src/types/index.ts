// Export all types used across the application

export interface ServerInfo {
  name: string;
  version: string;
  description: string;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

// Re-export service types for convenience
export type { MarketData, QuoteData } from "../services/yahooFinance.js";
export type { AnalysisRecord, CostTrackingRecord } from "../services/mongodb.js";
export type { RSIResult, MACDResult, MovingAverageResult } from "../services/technicalIndicators.js";
export type { AppConfig } from "../config.js";