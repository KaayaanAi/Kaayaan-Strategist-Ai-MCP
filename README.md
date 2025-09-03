# 🤖 Kaayaan Strategist AI - MCP Server

**Professional market structure analysis and trading signals for systematic trading analysis.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-orange.svg)](https://modelcontextprotocol.io/)

## 🔗 Universal Integration

- **📦 MCP (Model Context Protocol)** - Direct integration with Claude, Cursor, VS Code
- **🌐 REST API** - HTTP endpoints for web services and APIs  
- **⚡ n8n Native** - Compatible with HTTP and MCP nodes
- **🔧 JSON-RPC** - Standard protocol for external platforms

## 💰 Cost-Optimized Design

- **🧠 Intelligent Caching** - 15-minute TTL reduces API calls by 80%+
- **📊 Rate Limiting** - Prevents cost spikes with configurable limits
- **🆓 Free Primary Source** - Yahoo Finance (unlimited)  
- **💎 Premium Fallback** - Alpha Vantage (25 calls/day free)
- **📈 Cost Tracking** - Real-time monitoring and budget controls

## 🏗️ Production Architecture

- **🔒 Memory-First Design** - No blind failures, evidence-based analysis
- **🌍 Kuwait Timezone** - Asia/Kuwait (+03) timestamps  
- **⚖️ LLM-Agnostic** - Works with any AI system via MCP
- **🔄 Fallback Logic** - Yahoo Finance → Alpha Vantage → Graceful error
- **☁️ VPS-Ready** - Docker containerization included

## 📊 Analysis Capabilities

### 🎯 Market Structure Analysis
- **Support & Resistance** - Key price levels identification
- **Trend Analysis** - Moving averages and directional bias  
- **Market Phases** - Accumulation, Markup, Distribution, Markdown
- **Volatility Analysis** - Average True Range and risk assessment

### ⚡ Trading Signals  
- **BUY/SELL/WAIT** - Clear directional signals
- **Confidence Scoring** - 0-100% reliability metrics
- **Risk Management** - Stop loss and take profit levels
- **Multiple Timeframes** - Short, Medium, Long-term analysis

### 📈 Technical Indicators
- **RSI** - Relative Strength Index with overbought/oversold signals
- **MACD** - Moving Average Convergence Divergence with crossovers  
- **Moving Averages** - SMA/EMA with golden/death cross detection
- **Custom Parameters** - Configurable periods and thresholds

## 🚀 Quick Start

### Global Installation

```bash
npm install -g mcp-kaayaan-strategist
```

### 📋 **Three Integration Protocols**

This server supports **three different protocols** for maximum compatibility:

## 🔌 **Protocol 1: STDIO MCP (Original)**

**For:** Claude Desktop, Claude Code, MCP-compatible clients

### Claude Desktop Integration

Add to your Claude Desktop configuration file:

**macOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "kaayaan-strategist": {
      "command": "npx",
      "args": ["mcp-kaayaan-strategist"],
      "env": {
        "MONGODB_URI": "mongodb://localhost:27017/kaayaan_strategist",
        "REDIS_URL": "redis://localhost:6379", 
        "ALPHA_VANTAGE_API_KEY": "your_api_key_here",
        "TIMEZONE": "Asia/Kuwait"
      }
    }
  }
}
```

**Restart Claude Desktop** to activate the server.

### Claude Code Integration

```bash
claude mcp add kaayaan-strategist npx mcp-kaayaan-strategist
# Restart Claude Code: Ctrl+C twice, then: claude --continue
```

## 🌐 **Protocol 2: HTTP REST API**

**For:** General HTTP clients, custom integrations, web applications

### Start HTTP Server

```bash
# Production
HTTP_MODE=true npm start

# Development  
npm run dev:http

# Custom port
HTTP_MODE=true PORT=8080 npm start
```

### REST API Endpoints

**Base URL:** `http://localhost:3000/api`

#### Market Structure Analysis
```bash
curl -X POST http://localhost:3000/api/analyze-market-structure \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "period": "1mo",
    "include_support_resistance": true,
    "include_volatility": true
  }'
```

#### Trading Signal Generation
```bash
curl -X POST http://localhost:3000/api/generate-trading-signal \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "timeframe": "medium", 
    "risk_tolerance": "moderate",
    "min_confidence": 70
  }'
```

#### Technical Indicators
```bash
curl -X POST http://localhost:3000/api/calculate-indicators \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "indicators": ["rsi", "macd"],
    "include_interpretation": true
  }'
```

#### Store Analysis
```bash
curl -X POST http://localhost:3000/api/store-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "analysis_type": "trading_signal",
    "analysis_data": {"signal": "BUY", "confidence": 85},
    "notes": "Strong bullish signal"
  }'
```

#### Get Analysis History
```bash
curl "http://localhost:3000/api/analysis-history?symbol=AAPL&limit=10&sort_by=newest"
```

#### Data Quality Validation
```bash
curl -X POST http://localhost:3000/api/validate-data-quality \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "validation_type": "comprehensive"
  }'
```

### System Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Performance metrics  
curl http://localhost:3000/metrics

# API documentation
curl http://localhost:3000/
```

## ⚡ **Protocol 3: HTTP MCP Protocol**

**For:** n8n-nodes-mcp, MCP-over-HTTP clients

### n8n Integration with MCP Client Node

1. **Install n8n-nodes-mcp** in your n8n instance
2. **Add MCP Client node** to your workflow  
3. **Configure connection:**
   - **Transport:** HTTP Streamable
   - **URL:** `http://localhost:3000/mcp`
   - **Method:** POST

### Direct HTTP MCP Usage

#### List Available Tools
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list", 
    "id": 1
  }'
```

#### Call MCP Tool
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \  
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "generate_trading_signal",
      "arguments": {
        "symbol": "AAPL",
        "timeframe": "medium"
      }
    },
    "id": 2
  }'
```

## 🐳 **Docker Integration**

### HTTP Mode Docker Run
```bash
docker run -p 3000:3000 \
  -e HTTP_MODE=true \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/kaayaan_strategist \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e ALPHA_VANTAGE_API_KEY=your_key \
  mcp-kaayaan-strategist
```

### n8n Docker Compose Integration

```yaml
version: '3.8'
services:
  kaayaan-strategist:
    image: mcp-kaayaan-strategist
    environment:
      - HTTP_MODE=true
      - MONGODB_URI=mongodb://mongo:27017/kaayaan_strategist
      - REDIS_URL=redis://redis:6379
      - ALPHA_VANTAGE_API_KEY=your_key
    ports:
      - "3000:3000"
    depends_on:
      - mongo
      - redis
      
  n8n:
    image: n8nio/n8n
    environment:
      - N8N_MCP_KAAYAAN_STRATEGIST=http://kaayaan-strategist:3000/mcp
    depends_on:
      - kaayaan-strategist
```

### Environment Setup

Create `.env` file:

```bash
# MongoDB (Required for storage)
MONGODB_URI=mongodb://localhost:27017/kaayaan_strategist

# Redis (Optional - improves performance)  
REDIS_URL=redis://localhost:6379

# Alpha Vantage (Optional - backup data source)
ALPHA_VANTAGE_API_KEY=your_api_key_here

# Configuration
TIMEZONE=Asia/Kuwait
CACHE_TTL_MINUTES=15
```

### Basic Usage

```javascript
// Analyze market structure
await mcp.call('analyze_market_structure', {
  symbol: 'AAPL',
  period: '1mo',
  include_support_resistance: true
});

// Generate trading signal  
await mcp.call('generate_trading_signal', {
  symbol: 'AAPL',
  timeframe: 'medium',
  risk_tolerance: 'moderate'
});

// Calculate technical indicators
await mcp.call('calculate_indicators', {
  symbol: 'AAPL', 
  indicators: ['rsi', 'macd', 'sma']
});
```

## 🛠️ Available Tools

### 1. `analyze_market_structure`
**Comprehensive market structure analysis with support/resistance levels**

**Parameters:**
- `symbol` (string, required): Stock symbol (e.g., 'AAPL')
- `period` (string): Analysis period - '1d', '5d', '1mo', '3mo', '6mo', '1y' (default: '1mo')
- `include_support_resistance` (boolean): Include S/R analysis (default: true)
- `include_volatility` (boolean): Include volatility analysis (default: true)
- `lookback_days` (number): Analysis period in days, 5-100 (default: 20)

**Example:**
```javascript
{
  "symbol": "AAPL",
  "period": "1mo", 
  "include_support_resistance": true,
  "include_volatility": true,
  "lookback_days": 20
}
```

### 2. `generate_trading_signal` 
**Systematic BUY/SELL/WAIT signals with confidence scoring**

**Parameters:**
- `symbol` (string, required): Stock symbol
- `timeframe` (string): 'short', 'medium', 'long' (default: 'medium')
- `risk_tolerance` (string): 'conservative', 'moderate', 'aggressive' (default: 'moderate')
- `include_stop_loss` (boolean): Include stop loss suggestions (default: true)
- `include_take_profit` (boolean): Include take profit suggestions (default: true)
- `min_confidence` (number): Minimum confidence threshold 0-100 (default: 60)

**Example:**
```javascript
{
  "symbol": "MSFT",
  "timeframe": "medium",
  "risk_tolerance": "moderate", 
  "min_confidence": 70
}
```

### 3. `calculate_indicators`
**Technical indicators with human-readable interpretations**

**Parameters:**
- `symbol` (string, required): Stock symbol
- `indicators` (array): ['rsi', 'macd', 'sma', 'ema', 'all'] (default: ['all'])
- `period` (string): Data period for calculations (default: '1mo')
- `rsi_period` (number): RSI period, 5-50 (default: 14)
- `include_interpretation` (boolean): Include explanations (default: true)

**Example:**
```javascript
{
  "symbol": "GOOGL",
  "indicators": ["rsi", "macd"],
  "rsi_period": 14,
  "include_interpretation": true
}
```

### 4. `store_analysis`
**Store analysis results in MongoDB with metadata**

**Parameters:**
- `symbol` (string, required): Stock symbol  
- `analysis_type` (string, required): 'market_structure', 'trading_signal', 'technical_indicators', 'data_validation'
- `analysis_data` (object, required): Analysis results
- `notes` (string): Optional notes
- `tags` (array): String tags for categorization
- `confidence` (number): Confidence score 0-100

### 5. `get_analysis_history`
**Retrieve historical analysis records with flexible filtering**

**Parameters:**
- `symbol` (string): Filter by symbol (optional)
- `analysis_type` (string): Filter by type (optional) 
- `from_date` (string): Start date YYYY-MM-DD (optional)
- `to_date` (string): End date YYYY-MM-DD (optional)
- `limit` (number): Max results 1-100 (default: 20)
- `sort_by` (string): 'newest', 'oldest', 'confidence', 'symbol' (default: 'newest')

### 6. `validate_data_quality`
**Data quality validation across sources**

**Parameters:**
- `symbol` (string, required): Stock symbol to validate
- `validation_type` (string): 'basic', 'comprehensive', 'real_time' (default: 'basic')
- `check_historical` (boolean): Include historical data (default: true)
- `check_current` (boolean): Include current price data (default: true)
- `max_age_minutes` (number): Max acceptable data age 1-1440 (default: 60)

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/kaayaan_strategist` | Yes |  
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` | No |
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage API key | None | No |
| `TIMEZONE` | Application timezone | `Asia/Kuwait` | No |
| `CACHE_TTL_MINUTES` | Cache TTL in minutes | `15` | No |
| `YAHOO_RATE_LIMIT` | Yahoo requests/minute | `60` | No |
| `ALPHA_VANTAGE_RATE_LIMIT` | Alpha Vantage requests/minute | `5` | No |

### Data Sources Priority

1. **Yahoo Finance** (Primary) - Unlimited, reliable, free
2. **Alpha Vantage** (Backup) - 25 calls/day free tier, premium available
3. **Cache** - Redis 15-minute TTL reduces external calls
4. **Graceful Errors** - Clear messaging when data unavailable

## 🐳 Docker Deployment

### Basic Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY build ./build
COPY .env ./

EXPOSE 3000
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  kaayaan-strategist:
    image: mcp-kaayaan-strategist:latest
    environment:
      - MONGODB_URI=mongodb://mongo:27017/kaayaan_strategist
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
      
  mongo:
    image: mongo:6
    volumes:
      - mongodb_data:/data/db
      
  redis:
    image: redis:7-alpine
    
volumes:
  mongodb_data:
```

## 🔒 Security & Configuration

### 🚨 **CRITICAL: Before Public Deployment**

**⚠️ NEVER commit real API keys or credentials to version control!**

1. **Environment Variables Setup:**
```bash
# Copy the example file
cp .env.example .env

# Edit with your actual credentials (NEVER commit this file)
# .env is already in .gitignore
```

2. **Required API Keys:**
```bash
# Alpha Vantage - Get free key from https://www.alphavantage.co/support/#api-key
ALPHA_VANTAGE_API_KEY=your_actual_api_key_here

# MongoDB Connection
MONGODB_URI=mongodb://username:password@host:port/database

# Redis Connection  
REDIS_URL=redis://password@host:port
```

3. **Security Best Practices:**
- ✅ All secrets in environment variables
- ✅ `.env` files excluded from git
- ✅ Input validation with Zod schemas
- ✅ Rate limiting enabled
- ✅ No credentials in logs
- ✅ MongoDB parameterized queries

4. **Production Checklist:**
```bash
# Verify no secrets in code
grep -r "api.*key" --exclude-dir=node_modules src/
grep -r "password.*=" --exclude-dir=node_modules .

# Confirm .gitignore protection
git check-ignore .env .env.production .env.local
```

### 🛡️ **Data Protection**

- **Local Processing** - Analysis happens locally, not sent to third parties
- **Encrypted Storage** - MongoDB with authentication required
- **Memory Cache** - Redis with password protection  
- **API Security** - Rate limiting and input validation on all endpoints

### 🔑 **API Key Management**

- **Yahoo Finance** - No API key required (primary source)
- **Alpha Vantage** - Free tier: 25 requests/day, 5 requests/minute
- **MongoDB** - Use strong authentication for production
- **Redis** - Always use password protection

---

## ⚠️ Important Disclaimers

### 🚨 Educational Purpose Only
- **NOT FINANCIAL ADVICE** - This tool is for educational and research purposes
- **No Trading Recommendations** - Signals are systematic analysis, not investment advice  
- **Risk Warning** - Trading involves significant risk of loss
- **User Responsibility** - Always conduct your own research and risk assessment

### 📊 Data Accuracy
- **Best Effort Analysis** - Uses reliable data sources but accuracy not guaranteed
- **Market Data Delays** - Real-time data may have delays during market hours
- **System Dependencies** - Requires external data sources and may experience outages

## 🔧 Troubleshooting

### Common Issues

#### MCP Server Not Connecting
```bash
# Check if server starts correctly
npx mcp-kaayaan-strategist

# Verify environment variables are set
echo $MONGODB_URI $REDIS_URL
```

#### MongoDB Connection Issues
```bash
# Start MongoDB with Docker
docker run -d --name mongo -p 27017:27017 mongo:6

# Or install MongoDB locally
brew install mongodb/brew/mongodb-community
brew services start mongodb/brew/mongodb-community
```

#### Redis Connection Issues  
```bash
# Start Redis with Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Or install Redis locally
brew install redis
brew services start redis
```

#### Data Quality Issues
- Verify internet connection for Yahoo Finance API
- Check Alpha Vantage API key validity
- Use `validate_data_quality` tool to diagnose issues

### Performance Optimization

- **Redis Caching**: Reduces API calls by 80%+ with 15-minute TTL
- **Rate Limiting**: Prevents API quota exhaustion
- **Data Validation**: Ensures analysis accuracy before processing

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/kaayaan/mcp-kaayaan-strategist.git
cd mcp-kaayaan-strategist
npm install
cp .env.example .env
# Edit .env with your configuration
npm run build
npm run inspector  # Test with MCP Inspector
```

### Running Tests

```bash
npm test                    # Run test suite
npm run inspector          # Test MCP protocol
npm run build && npm start # Test server directly
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Full Documentation](docs/)
- **Issues**: [GitHub Issues](https://github.com/kaayaan/mcp-kaayaan-strategist/issues)
- **Discussions**: [GitHub Discussions](https://github.com/kaayaan/mcp-kaayaan-strategist/discussions)

---

**🔬 Kaayaan Strategist AI - Systematic Market Analysis**  
*Transforming market data into actionable insights through evidence-based technical analysis*