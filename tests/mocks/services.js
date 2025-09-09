/**
 * Mock services for testing
 */

import { sampleMarketData, sampleCryptoData, bullishTrendData, bearishTrendData } from '../fixtures/market-data.js';

// Mock Yahoo Finance Service
export const mockYahooFinanceService = {
  getHistoricalData: async (symbol, period, interval) => {
    if (symbol === 'INVALID') {
      return { success: false, data: [], source: 'yahoo_finance', fromCache: false };
    }
    
    if (symbol === 'BTC-USD') {
      return { success: true, data: sampleCryptoData, source: 'yahoo_finance', fromCache: false };
    }
    
    if (symbol === 'BULL') {
      return { success: true, data: bullishTrendData, source: 'yahoo_finance', fromCache: false };
    }
    
    if (symbol === 'BEAR') {
      return { success: true, data: bearishTrendData, source: 'yahoo_finance', fromCache: false };
    }
    
    return { success: true, data: sampleMarketData, source: 'yahoo_finance', fromCache: false };
  },
  
  getCurrentPrice: async (symbol) => {
    if (symbol === 'INVALID') return null;
    return { price: 186.85, timestamp: Date.now(), source: 'yahoo_finance' };
  }
};

// Mock CoinGecko Service
export const mockCoinGeckoService = {
  getCryptoData: async (symbol) => {
    if (symbol === 'bitcoin') {
      return {
        success: true,
        data: {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          current_price: 42654.89,
          market_cap: 836543210987,
          market_cap_rank: 1,
          price_change_24h: 1234.56,
          price_change_percentage_24h: 2.98,
          volume_24h: 21345678901,
          circulating_supply: 19654321,
          total_supply: 21000000,
          max_supply: 21000000
        },
        source: 'coingecko',
        fromCache: false
      };
    }
    
    if (symbol === 'ethereum') {
      return {
        success: true,
        data: {
          id: 'ethereum',
          symbol: 'eth',
          name: 'Ethereum',
          current_price: 2654.78,
          market_cap: 319876543210,
          market_cap_rank: 2,
          price_change_24h: -45.67,
          price_change_percentage_24h: -1.69,
          volume_24h: 12345678901,
          circulating_supply: 120543210,
          total_supply: 120543210,
          max_supply: null
        },
        source: 'coingecko',
        fromCache: false
      };
    }
    
    return { success: false, data: null, source: 'coingecko', fromCache: false };
  }
};

// Mock Alpha Vantage Service
export const mockAlphaVantageService = {
  getStockData: async (symbol) => {
    if (symbol === 'AAPL') {
      return {
        success: true,
        data: sampleMarketData,
        metadata: {
          symbol: 'AAPL',
          lastRefreshed: new Date().toISOString(),
          timeZone: 'US/Eastern'
        },
        source: 'alpha_vantage',
        fromCache: false
      };
    }
    
    return { success: false, data: [], source: 'alpha_vantage', fromCache: false };
  },
  
  getTechnicalIndicators: async (symbol, indicator, params) => {
    return {
      success: true,
      data: {
        indicator,
        symbol,
        values: [
          { time: '2024-01-01', value: 65.43 },
          { time: '2024-01-02', value: 67.21 },
          { time: '2024-01-03', value: 69.85 }
        ]
      },
      source: 'alpha_vantage',
      fromCache: false
    };
  }
};

// Mock MongoDB Service
export const mockMongoDBService = {
  isConnected: () => true,
  
  storeAnalysis: async (symbol, analysisType, query, result, confidence, source, processingTime) => {
    return {
      insertedId: 'mock_analysis_id_' + Date.now(),
      acknowledged: true
    };
  },
  
  getStoredAnalysis: async (symbol, analysisType, maxAge = 3600000) => {
    return null; // No cached analysis for testing
  },
  
  storeMarketData: async (symbol, data, source) => {
    return {
      insertedCount: data.length,
      acknowledged: true
    };
  },
  
  getMarketData: async (symbol, period, limit) => {
    return sampleMarketData;
  },
  
  cleanup: async () => {
    return { deletedCount: 0 };
  }
};

// Mock Redis Service
export const mockRedisService = {
  isConnected: () => true,
  
  get: async (key) => {
    if (key.includes('CACHED')) {
      return JSON.stringify({
        data: sampleMarketData,
        timestamp: Date.now() - 30000, // 30 seconds old
        source: 'cache'
      });
    }
    return null;
  },
  
  set: async (key, value, ttl) => {
    return 'OK';
  },
  
  del: async (key) => {
    return 1;
  },
  
  flushall: async () => {
    return 'OK';
  }
};

// Mock Data Aggregator
export const mockDataAggregator = {
  getHistoricalData: async (symbol, period, interval) => {
    if (symbol === 'INVALID') {
      return { success: false, data: [], source: 'aggregator', fromCache: false };
    }
    
    return { success: true, data: sampleMarketData, source: 'aggregator', fromCache: false };
  },
  
  getCurrentPrice: async (symbol) => {
    if (symbol === 'INVALID') return null;
    return { price: 186.85, timestamp: Date.now(), source: 'aggregator' };
  },
  
  getCryptoData: async (symbol) => {
    return mockCoinGeckoService.getCryptoData(symbol);
  }
};

// Mock HTTP Response Helper
export const createMockResponse = () => {
  const res = {
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.data = data; return this; },
    send: function(data) { this.data = data; return this; },
    set: function(header, value) { this.headers = this.headers || {}; this.headers[header] = value; return this; },
    statusCode: 200,
    data: null,
    headers: {}
  };
  return res;
};

export const createMockRequest = (body = {}, params = {}, query = {}) => ({
  body,
  params,
  query,
  headers: {},
  method: 'POST'
});

// Mock WebSocket
export const createMockWebSocket = () => ({
  readyState: 1, // OPEN
  send: function(data) { this.sentData = data; },
  close: function() { this.readyState = 3; }, // CLOSED
  sentData: null,
  on: function(event, handler) { this.handlers = this.handlers || {}; this.handlers[event] = handler; },
  handlers: {}
});

// Mock MCP Server
export const createMockMCPServer = () => ({
  tools: new Map(),
  
  addTool: function(toolInfo, handler) {
    this.tools.set(toolInfo.name, { info: toolInfo, handler });
  },
  
  callTool: async function(name, args) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return await tool.handler(args);
  },
  
  start: async function() {
    this.running = true;
  },
  
  shutdown: async function() {
    this.running = false;
  },
  
  running: false
});