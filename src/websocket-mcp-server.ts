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
    
    // Close all connections
    for (const [ws] of this.connections) {
      ws.close(1000, 'Server shutting down');
    }
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    
    // Close HTTP server
    if (this.httpServer) {
      this.httpServer.close();
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
        
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error(`❌ WebSocket message parsing error from ${connectionId}:`, error);
          this.sendError(ws, undefined, -32700, "Parse error", (error as Error).message);
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

  private async handleMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const { method, params, id } = message;

    try {
      switch (method) {
        case 'tools/list':
          this.sendResponse(ws, id, {
            tools: this.tools
          });
          break;

        case 'tools/call':
          if (!params || !params.name) {
            this.sendError(ws, id, -32602, "Invalid params", "Missing required parameter: name");
            return;
          }
          
          const result = await this.executeTool(params.name, params.arguments || {});
          this.sendResponse(ws, id, result);
          break;

        case 'ping':
          this.sendResponse(ws, id, { pong: true, timestamp: Date.now() });
          break;

        case 'server/info':
          this.sendResponse(ws, id, {
            name: "kaayaan-strategist-universal-mcp",
            version: "2.0.0",
            protocol: "websocket-mcp",
            tools: this.tools.length,
            uptime: process.uptime(),
            connections: this.connections.size
          });
          break;

        default:
          this.sendError(ws, id, -32601, "Method not found", `Unknown method: ${method}`);
      }
    } catch (error) {
      console.error(`❌ Error handling WebSocket message '${method}':`, error);
      this.sendError(ws, id, -32000, "Internal error", (error as Error).message);
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
    setInterval(() => {
      const now = new Date();
      for (const [ws, info] of this.connections) {
        const inactiveTime = now.getTime() - info.lastActivity.getTime();
        
        // Ping if inactive for more than 30 seconds
        if (inactiveTime > 30000 && ws.readyState === WebSocket.OPEN) {
          try {
            ws.ping();
          } catch (error) {
            console.error('❌ Error pinging WebSocket connection:', error);
            this.connections.delete(ws);
          }
        }
        
        // Close if inactive for more than 5 minutes
        if (inactiveTime > 300000) {
          console.error(`🧹 Closing inactive WebSocket connection: ${info.id}`);
          ws.close(1000, 'Connection inactive');
          this.connections.delete(ws);
        }
      }
    }, 30000);

    // Log connection stats every 5 minutes
    setInterval(() => {
      if (this.connections.size > 0) {
        console.error(`📊 WebSocket Stats: ${this.connections.size} active connections`);
        
        let totalMessages = 0;
        for (const [, info] of this.connections) {
          totalMessages += info.messageCount;
        }
        
        console.error(`📈 Total messages processed: ${totalMessages}`);
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