#!/usr/bin/env node

/**
 * Kaayaan Strategist AI Universal MCP Server
 * @fileoverview Universal MCP server with quad-protocol support and auto-detection
 * 
 * Universal Architecture - All Protocols Supported:
 * 1. STDIO MCP (Claude Desktop integration)
 * 2. HTTP REST API (General web clients)  
 * 3. HTTP MCP (n8n-nodes-mcp compatibility)
 * 4. WebSocket MCP (Real-time clients)
 * 
 * Auto-detection modes:
 * - STDIO mode: Default when no HTTP_MODE or WEBSOCKET_MODE
 * - HTTP mode: HTTP_MODE=true
 * - WebSocket mode: WEBSOCKET_MODE=true  
 * - Universal mode: UNIVERSAL_MODE=true (all protocols)
 */

import { UniversalMcpServer } from './universal-mcp-server.js';
import { appConfig } from './config.js';

// ==================== Protocol Detection ====================

interface StartupMode {
  stdio: boolean;
  http: boolean;
  websocket: boolean;
  mode: 'stdio' | 'http' | 'websocket' | 'universal';
}

function detectStartupMode(): StartupMode {
  const httpMode = process.env.HTTP_MODE === 'true' || appConfig.server.httpMode;
  const websocketMode = process.env.WEBSOCKET_MODE === 'true';
  const universalMode = process.env.UNIVERSAL_MODE === 'true';
  
  // Universal mode - all protocols enabled
  if (universalMode) {
    return {
      stdio: appConfig.protocols.stdio,
      http: appConfig.protocols.httpRest || appConfig.protocols.httpMcp,
      websocket: appConfig.protocols.websocket,
      mode: 'universal'
    };
  }
  
  // HTTP-only mode
  if (httpMode && !websocketMode) {
    return {
      stdio: false,
      http: true,
      websocket: false,
      mode: 'http'
    };
  }
  
  // WebSocket-only mode
  if (websocketMode && !httpMode) {
    return {
      stdio: false,
      http: false,
      websocket: true,
      mode: 'websocket'
    };
  }
  
  // Both HTTP and WebSocket
  if (httpMode && websocketMode) {
    return {
      stdio: false,
      http: true,
      websocket: true,
      mode: 'universal'
    };
  }
  
  // Default: STDIO mode (original behavior)
  return {
    stdio: true,
    http: false,
    websocket: false,
    mode: 'stdio'
  };
}

// ==================== Universal Server Startup ====================

async function startUniversalServer(): Promise<void> {
  const startupMode = detectStartupMode();
  
  console.error("🚀 Starting Kaayaan Strategist AI Universal MCP Server...");
  console.error(`🎯 Startup Mode: ${startupMode.mode.toUpperCase()}`);
  
  // Create Universal MCP Server instance
  const server = new UniversalMcpServer({
    name: "kaayaan-strategist-universal-mcp",
    version: "2.0.0",
    protocols: {
      stdio: startupMode.stdio,
      httpRest: startupMode.http && appConfig.protocols.httpRest,
      httpMcp: startupMode.http && appConfig.protocols.httpMcp,
      websocket: startupMode.websocket
    }
  });

  // Initialize all configured protocols
  await server.start();
  
  // Start server instances based on mode
  const startupPromises: Promise<void>[] = [];
  
  if (startupMode.http) {
    startupPromises.push(server.startHttpServer());
  }
  
  if (startupMode.websocket) {
    startupPromises.push(server.startWebSocketServer());
  }
  
  // Wait for all servers to start
  if (startupPromises.length > 0) {
    await Promise.all(startupPromises);
  }
  
  // Setup graceful shutdown for all modes
  setupGracefulShutdown(server, startupMode);
  
  // Log startup success
  console.error("✅ Universal MCP Server startup complete");
  logServerEndpoints(startupMode);
}

// ==================== Graceful Shutdown ====================

function setupGracefulShutdown(server: UniversalMcpServer, mode: StartupMode): void {
  const gracefulShutdown = async (signal: string) => {
    console.error(`\n🛑 Received ${signal}, shutting down Universal MCP Server...`);
    
    try {
      await server.shutdown();
      console.error("✅ Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      console.error("❌ Shutdown error:", (error as Error).message);
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  
  // Handle uncaught exceptions
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Promise Rejection:', reason);
    gracefulShutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });
}

// ==================== Endpoint Logging ====================

function logServerEndpoints(mode: StartupMode): void {
  console.error("\n🌐 Universal MCP Server Endpoints:");
  
  if (mode.stdio) {
    console.error("📡 STDIO MCP:");
    console.error("   • Protocol: Model Context Protocol via STDIO");
    console.error("   • Usage: Claude Desktop integration");
  }
  
  if (mode.http) {
    const host = appConfig.server.host;
    const port = appConfig.server.port;
    
    console.error("🌐 HTTP Protocols:");
    if (appConfig.protocols.httpRest) {
      console.error(`   • REST API: http://${host}:${port}/api/*`);
    }
    if (appConfig.protocols.httpMcp) {
      console.error(`   • HTTP MCP: http://${host}:${port}/mcp`);
      console.error("   • n8n-nodes-mcp: Fully compatible");
    }
    console.error(`   • Health Check: http://${host}:${port}/health`);
    console.error(`   • Metrics: http://${host}:${port}/metrics`);
    console.error(`   • Documentation: http://${host}:${port}/`);
  }
  
  if (mode.websocket) {
    const host = appConfig.server.host;
    const wsPort = appConfig.server.websocketPort;
    
    console.error("🔌 WebSocket MCP:");
    console.error(`   • WebSocket: ws://${host}:${wsPort}/mcp`);
    console.error("   • Real-time MCP communication");
    console.error("   • Auto-reconnection support");
  }
  
  console.error("\n🛡️ Security Features:");
  console.error(`   • Authentication: ${appConfig.security.enableAuth ? 'enabled' : 'disabled'}`);
  console.error(`   • CORS Policy: ${appConfig.app.nodeEnv === 'production' ? 'restricted' : 'permissive'}`);
  console.error("   • Rate Limiting: enabled");
  
  console.error("\n📊 Data Sources:");
  console.error("   • Yahoo Finance: enabled");
  console.error(`   • Alpha Vantage: ${appConfig.dataSources.alphaVantage.apiKey ? 'enabled' : 'disabled'}`);
  console.error("   • CoinGecko: enabled");
  
  console.error("\n📚 Educational Notice:");
  console.error("   This is an educational analysis tool. NOT financial advice.");
}

// ==================== Usage Information ====================

function showUsageHelp(): void {
  console.error(`
🤖 Kaayaan Strategist AI Universal MCP Server v2.0.0

USAGE:
  node build/index.js [options]

STARTUP MODES:
  Default (STDIO)     : node build/index.js
  HTTP Only          : HTTP_MODE=true node build/index.js  
  WebSocket Only     : WEBSOCKET_MODE=true node build/index.js
  HTTP + WebSocket   : HTTP_MODE=true WEBSOCKET_MODE=true node build/index.js
  Universal (All)    : UNIVERSAL_MODE=true node build/index.js

ENVIRONMENT VARIABLES:
  HTTP_MODE=true     : Enable HTTP REST API and HTTP MCP protocols
  WEBSOCKET_MODE=true: Enable WebSocket MCP protocol  
  UNIVERSAL_MODE=true: Enable all protocols simultaneously
  PORT=3000         : HTTP server port (default: 3000)
  WEBSOCKET_PORT=3001: WebSocket server port (default: 3001)
  API_KEY=<key>     : Enable authentication with API key
  ENABLE_AUTH=true  : Enable authentication middleware

PROTOCOLS SUPPORTED:
  1. STDIO MCP      : Original MCP via STDIO (Claude Desktop)
  2. HTTP REST API  : RESTful endpoints for web clients
  3. HTTP MCP       : MCP over HTTP (n8n-nodes-mcp compatible) 
  4. WebSocket MCP  : Real-time MCP over WebSocket

For more information: https://github.com/kaayaan/mcp-kaayaan-strategist
`);
}

// ==================== Main Entry Point ====================

async function main(): Promise<void> {
  // Check for help flag
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsageHelp();
    process.exit(0);
  }

  try {
    await startUniversalServer();
  } catch (error) {
    console.error("💥 Universal MCP Server startup failed:", (error as Error).message);
    
    // Show troubleshooting info
    console.error("\n🔧 Troubleshooting:");
    console.error("   • Check that ports are not already in use");
    console.error("   • Verify environment configuration");
    console.error("   • Ensure database connections are available");
    console.error("   • Run with --help for usage information");
    
    process.exit(1);
  }
}

// Start the Universal MCP Server
main().catch((error) => {
  console.error("🚨 Fatal Universal MCP Server error:", error);
  process.exit(1);
});