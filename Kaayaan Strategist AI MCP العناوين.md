Kaayaan Strategist AI MCP Server - API Reference
Base URL

```
https://strategist.domain.ai

```

System Endpoints
Health Check
* **Method**: GET
* **URL**: `/health`
* **Description**: Check service status and connected services
* **Response**: Service health, database status, API limits
Performance Metrics
* **Method**: GET
* **URL**: `/metrics`
* **Description**: Get performance statistics
* **Response**: Request counts, response times, memory usage
Analysis Tools (All POST Methods)
1. Market Structure Analysis
* **Method**: POST
* **URL**: `/api/analyze-market-structure`
* **Description**: Analyze support/resistance levels, trends, volatility
* **Body**:

```json
{
  "symbol": "AAPL",
  "period": "1mo",
  "include_support_resistance": true,
  "include_volatility": true,
  "lookback_days": 20
}

```

2. Trading Signal Generation
* **Method**: POST
* **URL**: `/api/generate-trading-signal`
* **Description**: Generate BUY/SELL/WAIT signals with confidence scores
* **Body**:

```json
{
  "symbol": "AAPL",
  "timeframe": "medium",
  "risk_tolerance": "moderate",
  "include_volume_analysis": true
}

```

3. Technical Indicators
* **Method**: POST
* **URL**: `/api/calculate-indicators`
* **Description**: Calculate RSI, MACD, SMA, EMA indicators
* **Body**:

```json
{
  "symbol": "AAPL",
  "indicators": ["rsi", "macd", "sma", "ema"],
  "period": "1mo"
}

```

4. Store Analysis
* **Method**: POST
* **URL**: `/api/store-analysis`
* **Description**: Save analysis results to database
* **Body**:

```json
{
  "analysis_data": {},
  "tags": ["technical", "fundamental"],
  "metadata": {}
}

```

5. Analysis History
* **Method**: POST
* **URL**: `/api/get-analysis-history`
* **Description**: Retrieve past analysis results
* **Body**:

```json
{
  "symbol": "AAPL",
  "limit": 50,
  "start_date": "2024-01-01",
  "analysis_type": "all"
}

```

6. Data Quality Validation
* **Method**: POST
* **URL**: `/api/validate-data-quality`
* **Description**: Check data completeness and accuracy
* **Body**:

```json
{
  "symbol": "AAPL",
  "period": "1mo",
  "check_completeness": true,
  "detailed_report": true
}

```

MCP Protocol Endpoint
MCP JSON-RPC Interface
* **Method**: POST
* **URL**: `/mcp`
* **Description**: Access all tools via MCP protocol
* **Body**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "analyze_market_structure",
    "arguments": {
      "symbol": "AAPL",
      "period": "1mo"
    }
  }
}

```

All endpoints return structured JSON responses with comprehensive market analysis data.


