/**
 * WebSocket MCP Protocol Handler
 * @fileoverview WebSocket implementation of Model Context Protocol for real-time clients
 * 
 * Supports:
 * - Real-time MCP communication over WebSocket
 * - JSON-RPC 2.0 message format
 * - Connection management and cleanup
 * - Error handling and reconnection support
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createHttpServer, Server as HttpServer } from 'http';
import { appConfig } from './config.js';

// Import types
import type { MCPToolDefinition } from "./types/index.js";

// ==================== Types ====================

interface WebSocketMessage {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id?: string | number;
}

interface WebSocketResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id?: string | number;
}

interface ConnectionInfo {
  id: string;
  connected: Date;
  lastActivity: Date;
  messageCount: number;
}

// ==================== WebSocket MCP Server ====================

export class WebSocketMcpServer {
  private wss: WebSocketServer | null = null;
  private httpServer: HttpServer | null = null;
  private connections = new Map<WebSocket, ConnectionInfo>();
  private tools: MCPToolDefinition[] = [];
  private executeTool: (name: string, args: any) => Promise<any>;
  private connectionIdCounter = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(tools: MCPToolDefinition[], executeToolFn: (name: string, args: any) => Promise<any>) {
    this.tools = tools;
    this.executeTool = executeToolFn;
  }

  // ==================== Server Lifecycle ====================

  public async start(port?: number): Promise<void> {
    const wsPort = port || appConfig.server.websocketPort;
    
    // Create HTTP server for WebSocket upgrade
    this.httpServer = createHttpServer();
    
    // Create WebSocket server
    this.wss = new WebSocketServer({ 
      server: this.httpServer,
      path: '/mcp',
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 8,
        },
        threshold: 1024,
        concurrencyLimit: 10,
      }
    });

    // Set up WebSocket handlers
    this.setupWebSocketHandlers();
    
    // Set up cleanup intervals
    this.setupCleanupIntervals();

    // Start HTTP server
    return new Promise((resolve, reject) => {
      this.httpServer!.listen(wsPort, appConfig.server.host, () => {
        console.error(`🔌 WebSocket MCP Server running on ws://${appConfig.server.host}:${wsPort}/mcp`);
        resolve();
      });

      this.httpServer!.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ WebSocket port ${wsPort} is already in use`);
          reject(new Error(`WebSocket port ${wsPort} is already in use`));
        } else {
          console.error("❌ WebSocket server error:", error);
          reject(error);
        }
      });
    });
  }

  public async stop(): Promise<void> {
    console.error("🛑 Shutting down WebSocket MCP Server...");
    this.isShuttingDown = true;
    
    // Clear cleanup intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    
    // Close all connections gracefully
    const closePromises: Promise<void>[] = [];
    for (const [ws, info] of this.connections) {
      closePromises.push(new Promise((resolve) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Server shutting down');
          ws.once('close', () => resolve());
          // Force close after 5 seconds
          setTimeout(() => {
            if (ws.readyState !== WebSocket.CLOSED) {
              ws.terminate();
            }
            resolve();
          }, 5000);
        } else {
          ws.terminate();
          resolve();
        }
      }));
    }
    
    // Wait for all connections to close
    await Promise.allSettled(closePromises);
    
    // Close WebSocket server
    if (this.wss) {
      await new Promise<void>((resolve, reject) => {
        this.wss!.close((error) => {
          if (error) {
            console.error('❌ Error closing WebSocket server:', error);
            reject(error);
          } else {
            resolve();
          }
        });
      });
      this.wss = null;
    }
    
    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((error) => {
          if (error) {
            console.error('❌ Error closing HTTP server:', error);
            reject(error);
          } else {
            resolve();
          }
        });
      });
      this.httpServer = null;
    }
    
    this.connections.clear();
    console.error("✅ WebSocket MCP Server shutdown complete");
  }

  // ==================== WebSocket Handlers ====================

  private setupWebSocketHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket, request) => {
      const connectionId = `ws-${++this.connectionIdCounter}-${Date.now()}`;
      const clientIp = request.socket.remoteAddress || 'unknown';
      
      // Initialize connection info
      const connectionInfo: ConnectionInfo = {
        id: connectionId,
        connected: new Date(),
        lastActivity: new Date(),
        messageCount: 0
      };
      
      this.connections.set(ws, connectionInfo);
      
      console.error(`🔌 WebSocket connection established: ${connectionId} from ${clientIp}`);
      console.error(`📊 Active connections: ${this.connections.size}`);

      // Send welcome message
      this.sendMessage(ws, {
        jsonrpc: "2.0",
        method: "server/initialized",
        params: {
          serverInfo: {
            name: "kaayaan-strategist-universal-mcp",
            version: "2.0.0",
            protocol: "websocket-mcp"
          },
          capabilities: {
            tools: true,
            realtime: true
          }
        }
      });

      // Handle incoming messages
      ws.on('message', async (data: Buffer) => {
        connectionInfo.lastActivity = new Date();
        connectionInfo.messageCount++;
        
        const correlationId = `${connectionId}-${connectionInfo.messageCount}`;
        
        try {
          // Validate message size (prevent memory exhaustion)
          if (data.length > 1024 * 1024) { // 1MB limit
            console.error(`❌ WebSocket message too large from ${connectionId}: ${data.length} bytes`);
            this.sendError(ws, undefined, -32600, "Message too large", { correlationId, maxSize: "1MB" });
            return;
          }
          
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          
          // Add correlation ID for tracing
          console.error(`📨 WebSocket message received [${correlationId}]: ${message.method || 'unknown'}`);
          
          await this.handleMessage(ws, message, correlationId);
        } catch (error) {
          console.error(`❌ WebSocket message parsing error from ${connectionId} [${correlationId}]:`, error);
          this.sendError(ws, undefined, -32700, "Parse error", { 
            error: (error as Error).message, 
            correlationId 
          });
        }
      });

      // Handle connection close
      ws.on('close', (code, reason) => {
        this.connections.delete(ws);
        console.error(`🔌 WebSocket connection closed: ${connectionId} (code: ${code}, reason: ${reason})`);
        console.error(`📊 Active connections: ${this.connections.size}`);
      });

      // Handle connection errors
      ws.on('error', (error) => {
        console.error(`❌ WebSocket connection error for ${connectionId}:`, error);
        this.connections.delete(ws);
      });

      // Set up ping/pong for connection health
      ws.on('pong', () => {
        connectionInfo.lastActivity = new Date();
      });
    });

    this.wss.on('error', (error) => {
      console.error('❌ WebSocket server error:', error);
    });
  }

  // ==================== Message Handling ====================

  private async handleMessage(ws: WebSocket, message: WebSocketMessage, correlationId?: string): Promise<void> {
    const { method, params, id } = message;

    try {
      // Rate limiting per connection (100 messages per minute)
      const connectionInfo = this.connections.get(ws);
      if (connectionInfo) {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        // Simple rate limiting check
        if (connectionInfo.messageCount > 100 && 
            (now - connectionInfo.connected.getTime()) < 60000) {
          this.sendError(ws, id, -32429, "Rate limit exceeded", { 
            correlationId,
            limit: "100 requests per minute" 
          });
          return;
        }
      }

      switch (method) {
        case 'tools/list':
          console.error(`📋 Listing tools [${correlationId}]`);
          this.sendResponse(ws, id, {
            tools: this.tools
          });
          break;

        case 'tools/call':
          if (!params || !params.name) {
            console.error(`❌ Invalid tool call parameters [${correlationId}]`);
            this.sendError(ws, id, -32602, "Invalid params", { 
              error: "Missing required parameter: name",
              correlationId 
            });
            return;
          }
          
          console.error(`🔧 Executing tool: ${params.name} [${correlationId}]`);
          const startTime = Date.now();
          
          try {
            const result = await this.executeTool(params.name, params.arguments || {});
            const executionTime = Date.now() - startTime;
            
            console.error(`✅ Tool execution completed: ${params.name} in ${executionTime}ms [${correlationId}]`);
            this.sendResponse(ws, id, result);
          } catch (toolError) {
            const executionTime = Date.now() - startTime;
            console.error(`❌ Tool execution failed: ${params.name} in ${executionTime}ms [${correlationId}]:`, toolError);
            this.sendError(ws, id, -32000, "Tool execution failed", {
              tool: params.name,
              error: (toolError as Error).message,
              correlationId,
              executionTimeMs: executionTime
            });
          }
          break;

        case 'ping':
          this.sendResponse(ws, id, { 
            pong: true, 
            timestamp: Date.now(),
            correlationId 
          });
          break;

        case 'server/info':
          this.sendResponse(ws, id, {
            name: "kaayaan-strategist-universal-mcp",
            version: "2.0.0",
            protocol: "websocket-mcp",
            tools: this.tools.length,
            uptime: process.uptime(),
            connections: this.connections.size,
            correlationId
          });
          break;

        default:
          console.error(`❌ Unknown method: ${method} [${correlationId}]`);
          this.sendError(ws, id, -32601, "Method not found", { 
            method,
            correlationId,
            availableMethods: ['tools/list', 'tools/call', 'ping', 'server/info']
          });
      }
    } catch (error) {
      console.error(`❌ Error handling WebSocket message '${method}' [${correlationId}]:`, error);
      this.sendError(ws, id, -32000, "Internal error", {
        method,
        error: (error as Error).message,
        correlationId
      });
    }
  }

  // ==================== Message Sending ====================

  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('❌ Error sending WebSocket message:', error);
      }
    }
  }

  private sendResponse(ws: WebSocket, id: string | number | undefined, result: any): void {
    const response: WebSocketResponse = {
      jsonrpc: "2.0",
      result,
      id
    };
    this.sendMessage(ws, response);
  }

  private sendError(ws: WebSocket, id: string | number | undefined, code: number, message: string, data?: any): void {
    const response: WebSocketResponse = {
      jsonrpc: "2.0",
      error: { code, message, data },
      id
    };
    this.sendMessage(ws, response);
  }

  // ==================== Connection Management ====================

  private setupCleanupIntervals(): void {
    // Ping inactive connections every 30 seconds
    this.cleanupInterval = setInterval(() => {
      if (this.isShuttingDown) return;
      
      const now = new Date();
      const connectionsToClose: WebSocket[] = [];
      
      for (const [ws, info] of this.connections) {
        const inactiveTime = now.getTime() - info.lastActivity.getTime();
        
        // Ping if inactive for more than 30 seconds
        if (inactiveTime > 30000 && ws.readyState === WebSocket.OPEN) {
          try {
            ws.ping();
          } catch (error) {
            console.error(`❌ Error pinging WebSocket connection ${info.id}:`, error);
            connectionsToClose.push(ws);
          }
        }
        
        // Mark for closure if inactive for more than 5 minutes
        if (inactiveTime > 300000) {
          console.error(`🧹 Marking inactive WebSocket connection for closure: ${info.id}`);
          connectionsToClose.push(ws);
        }
      }
      
      // Close connections outside of the iteration
      for (const ws of connectionsToClose) {
        try {
          const info = this.connections.get(ws);
          ws.close(1000, 'Connection inactive');
          this.connections.delete(ws);
          if (info) {
            console.error(`🧹 Closed inactive connection: ${info.id}`);
          }
        } catch (error) {
          console.error('❌ Error closing inactive connection:', error);
        }
      }
    }, 30000);

    // Log connection stats every 5 minutes
    this.statsInterval = setInterval(() => {
      if (this.isShuttingDown) return;
      
      if (this.connections.size > 0) {
        console.error(`📊 WebSocket Stats: ${this.connections.size} active connections`);
        
        let totalMessages = 0;
        let oldestConnection: Date | null = null;
        
        for (const [, info] of this.connections) {
          totalMessages += info.messageCount;
          if (!oldestConnection || info.connected < oldestConnection) {
            oldestConnection = info.connected;
          }
        }
        
        console.error(`📈 Total messages processed: ${totalMessages}`);
        if (oldestConnection) {
          const uptimeMinutes = Math.floor((Date.now() - oldestConnection.getTime()) / (1000 * 60));
          console.error(`⏱️ Oldest connection: ${uptimeMinutes} minutes`);
        }
      }
    }, 300000);
  }

  // ==================== Public Methods ====================

  public getConnectionCount(): number {
    return this.connections.size;
  }

  public getConnectionStats(): Array<{id: string, connected: Date, lastActivity: Date, messageCount: number}> {
    return Array.from(this.connections.values());
  }

  public broadcastToAll(message: any): void {
    for (const [ws] of this.connections) {
      this.sendMessage(ws, message);
    }
  }

  public isRunning(): boolean {
    return this.wss !== null && this.httpServer !== null;
  }
}