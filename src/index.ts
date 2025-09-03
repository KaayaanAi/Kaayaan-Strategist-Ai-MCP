#!/usr/bin/env node

/**
 * Kaayaan Strategist AI MCP Server
 * @fileoverview Dual-protocol MCP server supporting STDIO and HTTP modes
 * 
 * Protocols supported:
 * 1. STDIO MCP (default) - For Claude Desktop integration
 * 2. HTTP REST API + MCP-over-HTTP - For n8n and web integration
 * 
 * Usage:
 * - STDIO mode: node build/index.js
 * - HTTP mode: HTTP_MODE=true node build/index.js
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Import services
import { redisCache } from "./services/redis.js";
import { mongoDBService } from "./services/mongodb.js";
import { appConfig } from "./config.js";

// Import HTTP server for dual-protocol support
import { app as httpApp } from "./http-server.js";

// Import MCP tools
import { analyzeMarketStructure } from "./tools/marketAnalysis.js";
import { generateTradingSignal } from "./tools/signalGeneration.js";
import { calculateIndicators } from "./tools/indicators.js";
import { storeAnalysis } from "./tools/storage.js";
import { getAnalysisHistory } from "./tools/history.js";
import { validateDataQuality } from "./tools/validation.js";

// Import types
import type { MCPToolDefinition } from "./types/index.js";

// Server configuration
const server = new Server(
  {
    name: "kaayaan-strategist-mcp-server",
    version: "1.0.0"
  },
  {
    capabilities: { tools: {} }
  }
);

// Tool definitions
const tools: MCPToolDefinition[] = [
  {
    name: "analyze_market_structure",
    description: "Analyze market structure including support/resistance levels, trend analysis, price ranges, and market phases. Provides comprehensive technical analysis of market conditions.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock symbol (1-10 characters, e.g., 'AAPL', 'MSFT')"
        },
        period: {
          type: "string",
          enum: ["1d", "5d", "1mo", "3mo", "6mo", "1y"],
          description: "Analysis time period (default: '1mo')"
        },
        include_support_resistance: {
          type: "boolean",
          description: "Include support and resistance level analysis (default: true)"
        },
        include_volatility: {
          type: "boolean", 
          description: "Include volatility analysis (default: true)"
        },
        lookback_days: {
          type: "number",
          minimum: 5,
          maximum: 100,
          description: "Number of days to analyze (default: 20)"
        }
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
        symbol: {
          type: "string",
          description: "Stock symbol (1-10 characters)"
        },
        timeframe: {
          type: "string",
          enum: ["short", "medium", "long"],
          description: "Analysis timeframe: short (day trading), medium (swing), long (position) - default: 'medium'"
        },
        risk_tolerance: {
          type: "string",
          enum: ["conservative", "moderate", "aggressive"],
          description: "Risk tolerance level affecting signal sensitivity (default: 'moderate')"
        },
        include_stop_loss: {
          type: "boolean",
          description: "Include stop loss level suggestions (default: true)"
        },
        include_take_profit: {
          type: "boolean",
          description: "Include take profit level suggestions (default: true)"
        },
        min_confidence: {
          type: "number",
          minimum: 0,
          maximum: 100,
          description: "Minimum confidence threshold for signals (default: 60)"
        }
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
        symbol: {
          type: "string",
          description: "Stock symbol (1-10 characters)"
        },
        indicators: {
          type: "array",
          items: {
            type: "string",
            enum: ["rsi", "macd", "sma", "ema", "all"]
          },
          description: "Indicators to calculate (default: ['all'])"
        },
        period: {
          type: "string",
          enum: ["1d", "5d", "1mo", "3mo", "6mo", "1y"],
          description: "Data period for calculations (default: '1mo')"
        },
        rsi_period: {
          type: "number",
          minimum: 5,
          maximum: 50,
          description: "RSI calculation period (default: 14)"
        },
        macd_fast: {
          type: "number",
          minimum: 5,
          maximum: 30,
          description: "MACD fast EMA period (default: 12)"
        },
        macd_slow: {
          type: "number",
          minimum: 20,
          maximum: 50,
          description: "MACD slow EMA period (default: 26)"
        },
        macd_signal: {
          type: "number",
          minimum: 5,
          maximum: 20,
          description: "MACD signal line period (default: 9)"
        },
        sma_period: {
          type: "number",
          minimum: 5,
          maximum: 200,
          description: "Simple Moving Average period (default: 20)"
        },
        ema_period: {
          type: "number",
          minimum: 5,
          maximum: 200,
          description: "Exponential Moving Average period (default: 20)"
        },
        include_interpretation: {
          type: "boolean",
          description: "Include human-readable interpretations (default: true)"
        }
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
        symbol: {
          type: "string",
          description: "Stock symbol (1-10 characters)"
        },
        analysis_type: {
          type: "string",
          enum: ["market_structure", "trading_signal", "technical_indicators", "data_validation"],
          description: "Type of analysis being stored"
        },
        analysis_data: {
          type: "object",
          description: "Analysis results object (flexible structure)"
        },
        notes: {
          type: "string",
          description: "Optional notes about the analysis"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for categorizing the analysis"
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 100,
          description: "Confidence score for the analysis"
        },
        data_source: {
          type: "string",
          enum: ["yahoo", "alpha_vantage", "cached"],
          description: "Source of the underlying data (default: 'yahoo')"
        }
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
        symbol: {
          type: "string",
          description: "Filter by stock symbol (optional)"
        },
        analysis_type: {
          type: "string",
          enum: ["market_structure", "trading_signal", "technical_indicators", "data_validation"],
          description: "Filter by analysis type (optional)"
        },
        from_date: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Start date filter in YYYY-MM-DD format (optional)"
        },
        to_date: {
          type: "string", 
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "End date filter in YYYY-MM-DD format (optional)"
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 100,
          description: "Maximum number of results (default: 20)"
        },
        include_details: {
          type: "boolean",
          description: "Include detailed analysis results (default: true)"
        },
        sort_by: {
          type: "string",
          enum: ["newest", "oldest", "confidence", "symbol"],
          description: "Sort order for results (default: 'newest')"
        }
      }
    }
  },
  {
    name: "validate_data_quality",
    description: "Validate data quality and availability across sources. Performs comprehensive checks on data freshness, completeness, and accuracy for reliable analysis.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock symbol to validate (1-10 characters)"
        },
        validation_type: {
          type: "string",
          enum: ["basic", "comprehensive", "real_time"],
          description: "Validation depth: basic (essential checks), comprehensive (detailed analysis), real_time (current conditions) - default: 'basic'"
        },
        check_historical: {
          type: "boolean",
          description: "Include historical data validation (default: true)"
        },
        check_current: {
          type: "boolean",
          description: "Include current price data validation (default: true)"
        },
        max_age_minutes: {
          type: "number",
          minimum: 1,
          maximum: 1440,
          description: "Maximum acceptable data age in minutes (default: 60)"
        },
        store_results: {
          type: "boolean",
          description: "Store validation results in MongoDB (default: false)"
        }
      },
      required: ["symbol"]
    }
  }
];

// Register available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools
}));

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case "analyze_market_structure":
        return await analyzeMarketStructure(args);
        
      case "generate_trading_signal":
        return await generateTradingSignal(args);
        
      case "calculate_indicators":
        return await calculateIndicators(args);
        
      case "store_analysis":
        return await storeAnalysis(args);
        
      case "get_analysis_history":
        return await getAnalysisHistory(args);
        
      case "validate_data_quality":
        return await validateDataQuality(args);
        
      default:
        return {
          content: [{ 
            type: "text", 
            text: `❌ **Unknown Tool: ${name}**\n\nAvailable tools:\n${tools.map(t => `• **${t.name}**: ${t.description}`).join('\n')}\n\n*Kaayaan Strategist AI - Market Analysis MCP Server*`
          }],
          isError: true
        };
    }
  } catch (error) {
    console.error(`Tool execution error for ${name}:`, error);
    
    return {
      content: [{ 
        type: "text", 
        text: `❌ **Tool Execution Error**\n\nTool: ${name}\nError: ${(error as Error).message}\n\nPlease check your parameters and try again.\n\n*If the error persists, this may indicate a system issue.*`
      }],
      isError: true
    };
  }
});

// Initialize services and start server
async function initializeServices(): Promise<void> {
  try {
    console.error("🚀 Initializing Kaayaan Strategist AI MCP Server...");
    
    // Initialize Redis cache
    try {
      await redisCache.initialize();
    } catch (error) {
      console.error("⚠️ Redis initialization failed:", (error as Error).message);
      console.error("   Cache functionality will be disabled");
    }
    
    // Initialize MongoDB
    try {
      await mongoDBService.initialize();
    } catch (error) {
      console.error("⚠️ MongoDB initialization failed:", (error as Error).message);
      console.error("   Storage functionality will be disabled");
    }
    
    console.error("📊 Market Analysis Tools:");
    console.error("   • analyze_market_structure - Support/resistance, trends, volatility");
    console.error("   • generate_trading_signal - BUY/SELL/WAIT with confidence scoring");
    console.error("   • calculate_indicators - RSI, MACD, Moving Averages");
    console.error("   • store_analysis - Save results to MongoDB");
    console.error("   • get_analysis_history - Retrieve past analyses");
    console.error("   • validate_data_quality - Data integrity checks");
    
    console.error("🌍 Configuration:");
    console.error(`   • Timezone: ${appConfig.app.timezone}`);
    console.error(`   • Cache TTL: ${appConfig.redis.ttlMinutes} minutes`);
    console.error(`   • Environment: ${appConfig.app.nodeEnv}`);
    console.error(`   • Data Sources: Yahoo Finance${appConfig.dataSources.alphaVantage.apiKey ? ' + Alpha Vantage' : ' (Alpha Vantage disabled)'}`);
    
    console.error("✅ Kaayaan Strategist AI MCP Server initialized successfully");
    console.error("📚 Educational analysis tool - Not financial advice");
    
  } catch (error) {
    console.error("❌ Service initialization failed:", (error as Error).message);
    // Continue anyway - individual tools will handle service unavailability
  }
}

// Graceful shutdown
async function shutdownServices(): Promise<void> {
  try {
    console.error("🛑 Shutting down services...");
    
    await redisCache.close();
    await mongoDBService.close();
    
    console.error("✅ Services shut down gracefully");
  } catch (error) {
    console.error("⚠️ Shutdown error:", (error as Error).message);
  }
}

// Server startup
async function main(): Promise<void> {
  try {
    // Initialize services
    await initializeServices();
    
    // Determine server mode
    const isHttpMode = process.env.HTTP_MODE === 'true';
    
    // Set up graceful shutdown
    let httpServer: any = null;
    
    const gracefulShutdown = async (signal: string) => {
      console.error(`\n🛑 Received ${signal}, shutting down...`);
      
      if (httpServer) {
        console.error("🌐 Closing HTTP server...");
        httpServer.close(() => {
          console.error("✅ HTTP server closed");
        });
      }
      
      await shutdownServices();
      process.exit(0);
    };
    
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
    if (isHttpMode) {
      // Start HTTP server mode
      const port = parseInt(process.env.PORT || '3000', 10);
      const host = process.env.HOST || '0.0.0.0';
      
      httpServer = httpApp.listen(port, host, () => {
        console.error(`🌐 HTTP MCP Server running on http://${host}:${port}`);
        console.error("📚 Protocols available:");
        console.error("   • HTTP REST API: /api/*");
        console.error("   • HTTP MCP Protocol: /mcp");
        console.error("   • Health Check: /health");
        console.error("   • Metrics: /metrics");
        console.error("   • API Documentation: /");
      });
      
      httpServer.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ Port ${port} is already in use`);
          process.exit(1);
        } else {
          console.error("❌ HTTP server error:", error);
          process.exit(1);
        }
      });
      
    } else {
      // Start STDIO MCP server mode (default)
      const transport = new StdioServerTransport();
      await server.connect(transport);
      
      console.error("🎯 STDIO MCP Server running");
      console.error("📚 Protocol: Model Context Protocol via STDIO");
      console.error("💡 For HTTP mode, set HTTP_MODE=true environment variable");
    }
    
  } catch (error) {
    console.error("💥 Server startup failed:", (error as Error).message);
    await shutdownServices();
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error("🚨 Fatal server error:", error);
  process.exit(1);
});