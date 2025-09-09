# Kaayaan Strategist AI - Universal MCP Server

**Professional market analysis with Universal MCP architecture supporting 4 simultaneous
protocols: STDIO MCP, HTTP REST, HTTP MCP, and WebSocket MCP for cryptocurrency and
traditional markets.**

[![NPM Version](https://img.shields.io/npm/v/mcp-kaayaan-strategist.svg)](https://www.npmjs.com/package/mcp-kaayaan-strategist)
[![NPM Downloads](https://img.shields.io/npm/dm/mcp-kaayaan-strategist.svg)](https://www.npmjs.com/package/mcp-kaayaan-strategist)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-orange.svg)](https://modelcontextprotocol.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://hub.docker.com)

## Table of Contents

- [Quick Installation](#quick-installation)
- [Universal MCP Architecture](#universal-mcp-architecture)
- [Features](#features)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Docker Deployment](#docker-integration)
- [Security and Configuration](#security-and-configuration)
- [Contributing](#contributing)
- [License](#license)

## Quick Installation

```bash
# NPM Installation (Global)
npm install -g mcp-kaayaan-strategist

# Or run directly with npx
npx mcp-kaayaan-strategist

# Docker
docker run -d \
  -p 4000:4000 \
  -p 4001:4001 \
  -e HTTP_MODE=true \
  -e ALPHA_VANTAGE_API_KEY=your_key \
  kaayaan/strategist-ai-mcp

# Clone from source
git clone https://github.com/kaayaan/mcp-kaayaan-strategist.git
cd mcp-kaayaan-strategist
npm install && npm run build
```

## Universal MCP Architecture

### NEW in v2.1.0: Complete Analysis Tool

This server supports **4 simultaneous protocols** for maximum compatibility:

### Protocol Support

1. **STDIO MCP Protocol** - Claude Desktop integration (original MCP)
2. **HTTP REST API** - RESTful endpoints for web applications
3. **HTTP MCP Protocol** - Compatible with n8n-nodes-mcp
4. **WebSocket MCP** - Real-time bidirectional communication

### Protocol Selection

```bash
# Default: STDIO MCP only
node build/index.js

# HTTP mode (REST API + HTTP MCP)
HTTP_MODE=true node build/index.js

# WebSocket mode
WEBSOCKET_MODE=true node build/index.js

# Universal mode (all protocols)
UNIVERSAL_MODE=true node build/index.js
```

## Features

### Core Analysis Tools

- **Complete Analysis Tool (NEW v2.1.0)** - Unified analysis with configurable depth
- **Market Structure Analysis** - Support/resistance levels and trend analysis
- **Trading Signal Generation** - Systematic BUY/SELL/WAIT signals
- **Technical Indicators** - RSI, MACD, Moving Averages with interpretations
- **Data Quality Validation** - Multi-source data verification
- **Historical Analysis Storage** - MongoDB-based analysis history

### Multi-Asset Support

- **Traditional Markets** - Stocks, ETFs, indices
- **Cryptocurrency** - Bitcoin, Ethereum, major altcoins
- **Multi-Exchange Data** - Aggregated from multiple sources

### Advanced Features

- **Graceful Degradation** - Partial results when components fail
- **Real-time Processing** - Sub-second analysis completion
- **Educational Framework** - Built-in disclaimers and guidance
- **Production Ready** - Docker, monitoring, security features

## Quick Start

### Claude Desktop Integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kaayaan-strategist": {
      "command": "npx",
      "args": ["mcp-kaayaan-strategist"],
      "env": {
        "ALPHA_VANTAGE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### HTTP REST API

```bash
# Start HTTP server
HTTP_MODE=true npx mcp-kaayaan-strategist

# Test endpoints
curl http://localhost:4000/health
curl http://localhost:4000/api/tools
```

### WebSocket Connection

```javascript
const ws = new WebSocket('ws://localhost:4001/mcp');
ws.on('message', (data) => {
  console.log('MCP Response:', JSON.parse(data));
});
```

## Available Tools

### NEW: complete_analysis (v2.1.0)

Unified comprehensive analysis combining all tools with configurable depth

#### Parameters

- `symbol` (string, required): Stock or crypto symbol (e.g., 'AAPL', 'BTC-USD')
- `analysis_depth` (string): Analysis depth level (default: 'standard')
  - `basic` - Fast essential analysis with conservative thresholds
  - `standard` - Balanced comprehensive analysis with core indicators
  - `comprehensive` - Full-spectrum deep analysis with all indicators
- `timeframe` (string): Analysis timeframe (default: 'medium')
  - `short` - Day trading focus
  - `medium` - Swing trading focus
  - `long` - Position trading focus
- `risk_tolerance` (string): Risk tolerance level (default: 'moderate')
  - `conservative` - Lower risk, higher confidence thresholds
  - `moderate` - Balanced risk/reward approach
  - `aggressive` - Higher risk, lower confidence thresholds
- `include_history` (boolean): Include historical context (default: false)
- `store_results` (boolean): Auto-store in MongoDB (default: true)

#### Example

```json
{
  "symbol": "AAPL",
  "analysis_depth": "comprehensive",
  "timeframe": "medium", 
  "risk_tolerance": "moderate",
  "store_results": true
}
```

#### Returns

Unified analysis containing:

- Data validation results
- Market structure analysis
- Trading signals with confidence scores
- Technical indicators
- Analysis metadata (timing, confidence, component status)
- Educational disclaimers

### analyze_market_structure

Comprehensive market structure analysis with support/resistance levels

#### Parameters

- `symbol` (string, required): Stock symbol (e.g., 'AAPL')
- `period` (string): Analysis period - '1d', '5d', '1mo', '3mo', '6mo', '1y' (default: '1mo')
- `include_support_resistance` (boolean): Include S/R analysis (default: true)
- `include_volatility` (boolean): Include volatility analysis (default: true)
- `lookback_days` (number): Analysis period in days, 5-100 (default: 20)

### generate_trading_signal

**Systematic BUY/SELL/WAIT signals with confidence scoring**

#### Parameters

- `symbol` (string, required): Stock symbol
- `timeframe` (string): 'short', 'medium', 'long' (default: 'medium')
- `risk_tolerance` (string): 'conservative', 'moderate', 'aggressive' (default: 'moderate')
- `include_stop_loss` (boolean): Include stop loss suggestions (default: true)
- `include_take_profit` (boolean): Include take profit suggestions (default: true)
- `min_confidence` (number): Minimum confidence threshold 0-100 (default: 60)

### calculate_indicators

**Technical indicators with human-readable interpretations**

#### Parameters

- `symbol` (string, required): Stock symbol
- `indicators` (array): ['rsi', 'macd', 'sma', 'ema', 'all'] (default: ['all'])
- `period` (string): Data period for calculations (default: '1mo')
- `rsi_period` (number): RSI period, 5-50 (default: 14)
- `include_interpretation` (boolean): Include explanations (default: true)

### store_analysis

**Store analysis results in MongoDB with metadata**

#### Parameters

- `symbol` (string, required): Stock symbol
- `analysis_type` (string, required): Type of analysis
- `analysis_data` (object, required): Analysis results
- `notes` (string): Optional notes
- `tags` (array): String tags for categorization
- `confidence` (number): Confidence score 0-100

### get_analysis_history

**Retrieve historical analysis records with flexible filtering**

#### Parameters

- `symbol` (string): Filter by symbol (optional)
- `analysis_type` (string): Filter by type (optional)
- `from_date` (string): Start date YYYY-MM-DD (optional)
- `to_date` (string): End date YYYY-MM-DD (optional)
- `limit` (number): Max results 1-100 (default: 20)
- `sort_by` (string): 'newest', 'oldest', 'confidence', 'symbol' (default: 'newest')

### validate_data_quality

**Data quality validation across sources**

#### Parameters

- `symbol` (string, required): Stock symbol to validate
- `validation_type` (string): 'basic', 'comprehensive', 'real_time' (default: 'basic')
- `check_historical` (boolean): Include historical data (default: true)
- `check_current` (boolean): Include current price data (default: true)
- `max_age_minutes` (number): Max acceptable data age 1-1440 (default: 60)

## Configuration

### Environment Variables

```bash
# Protocol Selection
HTTP_MODE=true              # Enable HTTP protocols
WEBSOCKET_MODE=true         # Enable WebSocket protocol  
UNIVERSAL_MODE=true         # Enable all protocols

# Server Configuration
PORT=4000                   # HTTP server port
WEBSOCKET_PORT=4001         # WebSocket server port
HOST=0.0.0.0               # Server host

# API Keys
ALPHA_VANTAGE_API_KEY=key   # Alpha Vantage API key
COINGECKO_API_KEY=key      # CoinGecko Pro API key (optional)

# Database Configuration  
MONGODB_URI=mongodb://...   # MongoDB connection string
REDIS_URL=redis://...       # Redis connection string

# Security
API_KEY=secret             # API key for authentication
ENABLE_AUTH=true           # Enable authentication
CORS_ORIGIN=*              # CORS origin policy
```

### Configuration File

Create `.env` file:

```bash
# Copy example configuration
cp .env.example .env

# Edit configuration
nano .env
```

## API Documentation

### REST API Endpoints

```bash
# Health check
GET /health

# List all tools
GET /api/tools

# Execute tool
POST /api/tools/{tool_name}
Content-Type: application/json
{
  "symbol": "AAPL",
  "analysis_depth": "standard"
}

# Get metrics
GET /metrics

# API documentation
GET /
```

### HTTP MCP Protocol

```bash
# MCP endpoint (n8n-nodes-mcp compatible)
POST /mcp
Content-Type: application/json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "complete_analysis",
    "arguments": {
      "symbol": "AAPL",
      "analysis_depth": "comprehensive"
    }
  }
}
```

## Docker Integration

### Quick Start

```bash
# Run with environment variables
docker run -d \
  --name kaayaan-strategist \
  -p 4000:4000 \
  -p 4001:4001 \
  -e HTTP_MODE=true \
  -e ALPHA_VANTAGE_API_KEY=your_key \
  -e MONGODB_URI=your_mongodb_uri \
  kaayaan/strategist-ai-mcp
```

### Docker Compose

```yaml
version: '3.8'
services:
  kaayaan-strategist:
    image: kaayaan/strategist-ai-mcp:latest
    ports:
      - "4000:4000"
      - "4001:4001"
    environment:
      - UNIVERSAL_MODE=true
      - ALPHA_VANTAGE_API_KEY=${ALPHA_VANTAGE_API_KEY}
      - MONGODB_URI=${MONGODB_URI}
      - REDIS_URL=${REDIS_URL}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

## Security and Configuration

### Authentication

```bash
# Enable API key authentication
API_KEY=your-secret-key
ENABLE_AUTH=true

# Use in requests
curl -H "Authorization: Bearer your-secret-key" \
  http://localhost:4000/api/tools
```

### Security Features

- **API Key Authentication** - Optional token-based authentication
- **Rate Limiting** - Configurable request rate limits
- **CORS Policy** - Cross-origin resource sharing control
- **Input Validation** - Comprehensive request validation
- **Security Headers** - Helmet.js security headers
- **Data Sanitization** - XSS and injection prevention

### Production Deployment

```bash
# Production environment
NODE_ENV=production
ENABLE_AUTH=true
API_KEY=secure-random-key
CORS_ORIGIN=https://yourdomain.com

# SSL/TLS (recommended)
HTTPS=true
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
```

## Performance and Reliability

### Performance Metrics

- **Complete Analysis**: 400-700ms execution time
- **Individual Tools**: 100-300ms execution time
- **Data Caching**: 15-minute TTL for market data
- **Concurrent Requests**: Up to 100 simultaneous connections

### Monitoring

```bash
# Health endpoint
curl http://localhost:4000/health

# Metrics endpoint (Prometheus compatible)
curl http://localhost:4000/metrics

# Performance monitoring
curl http://localhost:4000/api/performance
```

## Educational Notice

**IMPORTANT**: This is an educational analysis tool for learning about financial markets
and technical analysis. It is **NOT FINANCIAL ADVICE**. Always conduct your own research
and consult with qualified financial advisors before making investment decisions.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone and setup
git clone https://github.com/kaayaan/mcp-kaayaan-strategist.git
cd mcp-kaayaan-strategist
npm install

# Development
npm run dev              # Start development server
npm run build           # Build for production
npm test               # Run tests
npm run lint           # Check code quality
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/kaayaan/mcp-kaayaan-strategist/issues)
- **Discussions**: [GitHub Discussions](https://github.com/kaayaan/mcp-kaayaan-strategist/discussions)
- **Email**: admin@kaayaan.ai

---

**Kaayaan Strategist AI** - Professional market analysis with Universal MCP architecture.
Educational tool for systematic trading and technical analysis learning.