/**
 * Universal MCP Server - Quad Protocol Architecture
 * @fileoverview Universal MCP server supporting all 4 protocols:
 * 1. STDIO MCP (Claude Desktop)
 * 2. HTTP REST API (General web clients)
 * 3. HTTP MCP (n8n-nodes-mcp compatibility)
 * 4. WebSocket MCP (Real-time clients)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Application } from 'express';
import { createServer as createHttpServer, Server as HttpServer } from 'http';
import { appConfig } from './config.js';
import { WebSocketMcpServer } from './websocket-mcp-server.js';

// Import services and tools
import { redisCache } from "./services/redis.js";
import { mongoDBService } from "./services/mongodb.js";
import { analyzeMarketStructure } from "./tools/marketAnalysis.js";
import { generateTradingSignal } from "./tools/signalGeneration.js";
import { calculateIndicators } from "./tools/indicators.js";
import { storeAnalysis } from "./tools/storage.js";
import { getAnalysisHistory } from "./tools/history.js";
import { validateDataQuality } from "./tools/validation.js";
import { completeAnalysis } from "./tools/completeAnalysis.js";

// Import types
import type { MCPToolDefinition } from "./types/index.js";

// ==================== Protocol Interfaces ====================

export interface ProtocolHandlers {
  stdio?: {
    server: Server;
    transport: StdioServerTransport;
  };
  http?: {
    app: Application;
    server: HttpServer;
  };
  websocket?: {
    server: WebSocketMcpServer;
  };
}

export interface UniversalMcpServerOptions {
  name?: string;
  version?: string;
  protocols?: {
    stdio?: boolean;
    httpRest?: boolean;
    httpMcp?: boolean;
    websocket?: boolean;
  };
}

// ==================== Universal MCP Server Class ====================

export class UniversalMcpServer {
  private readonly tools: MCPToolDefinition[];
  private readonly handlers: ProtocolHandlers = {};
  private isInitialized = false;
  private readonly options: Required<UniversalMcpServerOptions>;

  constructor(options: UniversalMcpServerOptions = {}) {
    this.options = {
      name: options.name || "kaayaan-strategist-universal-mcp",
      version: options.version || "2.0.0",
      protocols: {
        stdio: options.protocols?.stdio ?? appConfig.protocols.stdio,
        httpRest: options.protocols?.httpRest ?? appConfig.protocols.httpRest,
        httpMcp: options.protocols?.httpMcp ?? appConfig.protocols.httpMcp,
        websocket: options.protocols?.websocket ?? appConfig.protocols.websocket,
      }
    };

    this.tools = this.initializeTools();
  }

  // ==================== Tool Definitions ====================

  private initializeTools(): MCPToolDefinition[] {
    return [
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
      },
      {
        name: "complete_analysis",
        description: "Complete financial analysis including market structure, trading signals, and technical indicators in one unified response. Orchestrates all analysis tools with configurable depth and parameters.",
        inputSchema: {
          type: "object",
          properties: {
            symbol: { type: "string", description: "Stock or cryptocurrency symbol (1-10 characters, e.g., 'AAPL', 'BTC-USD')" },
            analysis_depth: { type: "string", enum: ["basic", "standard", "comprehensive"], description: "Analysis depth: basic (essential checks), standard (balanced analysis), comprehensive (full analysis) - default: 'standard'" },
            timeframe: { type: "string", enum: ["short", "medium", "long"], description: "Analysis timeframe: short (day trading), medium (swing), long (position) - default: 'medium'" },
            risk_tolerance: { type: "string", enum: ["conservative", "moderate", "aggressive"], description: "Risk tolerance level affecting signal sensitivity and recommendations - default: 'moderate'" },
            include_history: { type: "boolean", description: "Include historical analysis context and trends - default: false" },
            store_results: { type: "boolean", description: "Automatically store complete analysis results in MongoDB - default: true" }
          },
          required: ["symbol"]
        }
      }
    ];
  }

  // ==================== Tool Execution ====================

  private async executeTool(toolName: string, args: any): Promise<any> {
    try {
      switch (toolName) {
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
        case "complete_analysis":
          return await completeAnalysis(args);
        default: {
          const toolList = this.tools.map(t => `• **${t.name}**: ${t.description}`).join('\n');
          return {
            content: [{ 
              type: "text", 
              text: `❌ **Unknown Tool: ${toolName}**\n\nAvailable tools:\n${toolList}\n\n*Kaayaan Strategist AI - Universal MCP Server*`
            }],
            isError: true
          };
        }
      }
    } catch (error) {
      console.error(`Tool execution error for ${toolName}:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `❌ **Tool Execution Error**\n\nTool: ${toolName}\nError: ${(error as Error).message}\n\nPlease check your parameters and try again.\n\n*If the error persists, this may indicate a system issue.*`
        }],
        isError: true
      };
    }
  }

  // ==================== Service Initialization ====================

  private async initializeServices(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.error("🚀 Initializing Kaayaan Strategist AI Universal MCP Server...");
      
      // Initialize Redis cache
      try {
        await redisCache.initialize();
        console.error("✅ Redis cache initialized");
      } catch (error) {
        console.error("⚠️ Redis initialization failed:", (error as Error).message);
        console.error("   Cache functionality will be disabled");
      }
      
      // Initialize MongoDB
      try {
        await mongoDBService.initialize();
        console.error("✅ MongoDB initialized");
      } catch (error) {
        console.error("⚠️ MongoDB initialization failed:", (error as Error).message);
        console.error("   Storage functionality will be disabled");
      }

      this.isInitialized = true;
      console.error("✅ Universal MCP Server services initialized");
    } catch (error) {
      console.error("❌ Service initialization failed:", (error as Error).message);
      // Continue anyway - individual tools will handle service unavailability
    }
  }

  // ==================== Protocol Handlers ====================

  private async initializeStdioProtocol(): Promise<void> {
    if (!this.options.protocols.stdio) return;

    const server = new Server(
      {
        name: this.options.name,
        version: this.options.version
      },
      {
        capabilities: { tools: {} }
      }
    );

    // Register tools
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.tools
    }));

    // Handle tool execution
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return await this.executeTool(name, args || {});
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);

    this.handlers.stdio = { server, transport };
    console.error("🎯 STDIO MCP Protocol initialized");
  }

  private async initializeHttpProtocol(): Promise<void> {
    if (!this.options.protocols.httpRest && !this.options.protocols.httpMcp) return;

    // Import HTTP server components
    const { app: httpApp } = await import('./http-server.js');
    const httpServer = createHttpServer(httpApp);

    this.handlers.http = { app: httpApp, server: httpServer };
    console.error("🌐 HTTP Protocols initialized (REST + MCP)");
  }

  private async initializeWebSocketProtocol(): Promise<void> {
    if (!this.options.protocols.websocket) return;

    const wsServer = new WebSocketMcpServer(this.tools, this.executeTool.bind(this));
    this.handlers.websocket = { server: wsServer };
    console.error("🔌 WebSocket MCP Protocol initialized");
  }

  // ==================== Public Methods ====================

  public async start(): Promise<void> {
    await this.initializeServices();

    const protocols: string[] = [];

    // Initialize protocols based on configuration
    if (this.options.protocols.stdio) {
      await this.initializeStdioProtocol();
      protocols.push("STDIO MCP");
    }

    if (this.options.protocols.httpRest || this.options.protocols.httpMcp) {
      await this.initializeHttpProtocol();
      if (this.options.protocols.httpRest) protocols.push("HTTP REST");
      if (this.options.protocols.httpMcp) protocols.push("HTTP MCP");
    }

    if (this.options.protocols.websocket) {
      await this.initializeWebSocketProtocol();
      protocols.push("WebSocket MCP");
    }

    console.error(`📚 Active Protocols: ${protocols.join(', ')}`);
    console.error("📊 Market Analysis Tools:");
    this.tools.forEach(tool => {
      console.error(`   • ${tool.name} - ${tool.description.split('.')[0]}`);
    });
    console.error("🌍 Configuration:");
    console.error(`   • Environment: ${appConfig.app.nodeEnv}`);
    console.error(`   • Timezone: ${appConfig.app.timezone}`);
    console.error("📚 Educational analysis tool - Not financial advice");
  }

  public async startHttpServer(): Promise<void> {
    if (!this.handlers.http) {
      throw new Error("HTTP protocol not initialized");
    }

    const { server } = this.handlers.http;
    const port = appConfig.server.port;
    const host = appConfig.server.host;

    return new Promise((resolve, reject) => {
      server.listen(port, host, () => {
        console.error(`🌐 Universal MCP HTTP Server running on http://${host}:${port}`);
        console.error("📚 Available endpoints:");
        console.error("   • HTTP REST API: /api/*");
        console.error("   • HTTP MCP Protocol: /mcp");
        console.error("   • Health Check: /health");
        console.error("   • Metrics: /metrics");
        console.error("   • API Documentation: /");
        resolve();
      });

      server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ Port ${port} is already in use`);
          reject(new Error(`Port ${port} is already in use`));
        } else {
          console.error("❌ HTTP server error:", error);
          reject(new Error(`HTTP server error: ${error.message || error}`));
        }
      });
    });
  }

  public async startWebSocketServer(): Promise<void> {
    if (!this.handlers.websocket) {
      throw new Error("WebSocket protocol not initialized");
    }

    await this.handlers.websocket.server.start();
  }

  public async shutdown(): Promise<void> {
    try {
      console.error("🛑 Shutting down Universal MCP Server...");
      
      // Close HTTP server
      if (this.handlers.http) {
        this.handlers.http.server.close();
        console.error("✅ HTTP server closed");
      }

      // Close WebSocket server
      if (this.handlers.websocket) {
        await this.handlers.websocket.server.stop();
        console.error("✅ WebSocket server closed");
      }

      // STDIO connections close automatically when process ends

      // Close services
      await redisCache.close();
      await mongoDBService.close();
      
      console.error("✅ Universal MCP Server shutdown complete");
    } catch (error) {
      console.error("⚠️ Shutdown error:", (error as Error).message);
    }
  }

  public getTools(): MCPToolDefinition[] {
    return this.tools;
  }

  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}