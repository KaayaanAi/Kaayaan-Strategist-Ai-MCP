# Test Suite Documentation

## Overview

This test suite provides comprehensive testing for the Kaayaan Strategist MCP Server, covering all core functionality including financial calculations, protocol compliance, API endpoints, and database integrations.

## Test Architecture

```
tests/
├── unit/                           # Unit tests for individual components
│   ├── technical-indicators.test.js    # Financial calculation tests
│   ├── indicators-tool.test.js         # MCP indicators tool tests
│   └── market-analysis-tool.test.js    # Market analysis tool tests
├── integration/                    # Integration tests for system components
│   ├── mcp-protocol.test.js           # MCP protocol compliance tests
│   ├── api-endpoints.test.js          # HTTP API endpoint tests
│   └── database-connections.test.js   # MongoDB and Redis integration tests
├── fixtures/                       # Test data and mock fixtures
│   └── market-data.js                 # Sample financial market data
├── mocks/                          # Mock services and utilities
│   └── services.js                    # Mock implementations of services
├── test-config.js                  # Test configuration and utilities
├── run-tests.js                   # Enhanced test runner script
└── README.md                      # This documentation
```

## Test Categories

### 1. Unit Tests

#### Technical Indicators (`technical-indicators.test.js`)
- **SMA (Simple Moving Average)** - Tests calculation accuracy and edge cases
- **EMA (Exponential Moving Average)** - Tests responsiveness and calculation logic
- **RSI (Relative Strength Index)** - Tests overbought/oversold detection
- **MACD (Moving Average Convergence Divergence)** - Tests crossover detection
- **Support & Resistance** - Tests level identification algorithms
- **Volatility (ATR)** - Tests Average True Range calculations
- **Comprehensive Analysis** - Tests combined indicator analysis

#### MCP Tools (`indicators-tool.test.js`, `market-analysis-tool.test.js`)
- **Input Validation** - Parameter validation and error handling
- **Data Processing** - Market data retrieval and processing
- **Response Formatting** - MCP-compliant response structure
- **Error Handling** - Graceful failure scenarios
- **Performance** - Response time and efficiency testing

### 2. Integration Tests

#### MCP Protocol Compliance (`mcp-protocol.test.js`)
- **STDIO MCP** - Standard MCP via STDIO transport
- **HTTP MCP** - MCP over HTTP (n8n-nodes-mcp compatible)
- **WebSocket MCP** - Real-time MCP over WebSocket
- **HTTP REST API** - RESTful endpoints for web clients
- **Multi-Protocol** - Simultaneous protocol support
- **Authentication & Security** - API key validation and rate limiting

#### API Endpoints (`api-endpoints.test.js`)
- **Health Check** - Service status and monitoring
- **Technical Indicators API** - REST endpoints for indicators
- **Market Analysis API** - Comprehensive analysis endpoints
- **Signal Generation API** - Trading signal endpoints
- **Error Handling** - HTTP error responses and status codes
- **CORS & Security** - Cross-origin and security headers

#### Database Integration (`database-connections.test.js`)
- **MongoDB Operations** - Analysis storage and retrieval
- **Redis Caching** - Cache management and TTL handling
- **Data Coordination** - Cross-database consistency
- **Performance** - Concurrent operations and optimization
- **Failover** - Database failure scenarios

## Test Data & Fixtures

### Market Data Fixtures (`fixtures/market-data.js`)
- **Sample Stock Data** - 30-day AAPL-like OHLCV data
- **Cryptocurrency Data** - BTC and ETH sample data
- **Trend Data** - Bullish and bearish trend patterns
- **RSI Test Data** - Overbought and oversold conditions
- **Edge Cases** - Insufficient data and extreme values

### Mock Services (`mocks/services.js`)
- **Data Aggregator** - Mock financial data sources
- **Database Services** - MongoDB and Redis mocks
- **HTTP Utilities** - Request/response mocks
- **MCP Server** - Protocol handler mocks

## Running Tests

### Quick Start

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:indicators    # Technical indicator tests
npm run test:analysis      # Market analysis tests
npm run test:mcp          # MCP protocol tests
npm run test:api          # API endpoint tests
npm run test:db           # Database tests
```

### Advanced Test Execution

```bash
# Using the enhanced test runner
node tests/run-tests.js                    # Run all tests
node tests/run-tests.js unit              # Run unit tests only
node tests/run-tests.js indicators        # Run indicator-related tests
node tests/run-tests.js --verbose --bail  # Verbose output, stop on failure

# Test runner options
node tests/run-tests.js --help            # Show all options
```

### Test Runner Options

| Option | Description | Example |
|--------|-------------|---------|
| `--timeout <ms>` | Set test timeout | `--timeout 60000` |
| `--retries <n>` | Retry failed tests | `--retries 2` |
| `--no-parallel` | Run sequentially | `--no-parallel` |
| `--bail` | Stop on first failure | `--bail` |
| `--verbose` | Detailed output | `--verbose` |
| `--reporter <type>` | Output format | `--reporter json` |

### Available Reporters

- **default** - Enhanced console output with colors and timing
- **json** - JSON output for CI/CD integration
- **tap** - TAP (Test Anything Protocol) format
- **spec** - Detailed specification-style output

## Test Configuration

### Environment Variables

```bash
# Test environment
NODE_ENV=test

# Database connections (for integration tests)
MONGODB_URI=mongodb://localhost:27017/kaayaan_strategist_test
REDIS_URL=redis://localhost:6379/1

# API testing
HTTP_MODE=true
PORT=0  # Use random available port
WEBSOCKET_PORT=0
```

### Test Utilities (`test-config.js`)

The test configuration provides utilities for:
- **Async Operations** - Timeout and promise handling
- **Performance Measurement** - Execution time tracking
- **Memory Monitoring** - Memory usage analysis
- **Mock Data Generation** - Dynamic test data creation
- **Custom Matchers** - Financial data validation

## Writing New Tests

### Test Structure

```javascript
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('Specific Functionality', () => {
    test('should perform expected behavior', async () => {
      // Arrange
      const input = { /* test data */ };
      
      // Act
      const result = await functionUnderTest(input);
      
      // Assert
      assert.strictEqual(result.success, true);
      assert.strictEqual(typeof result.data, 'object');
    });

    test('should handle error conditions', async () => {
      const invalidInput = { /* invalid data */ };
      
      const result = await functionUnderTest(invalidInput);
      
      assert.strictEqual(result.isError, true);
      assert.strictEqual(result.content[0].text.includes('Error'), true);
    });
  });
});
```

### Best Practices

1. **Test Isolation** - Each test should be independent
2. **Descriptive Names** - Clear test and describe block names
3. **Arrange-Act-Assert** - Structure tests clearly
4. **Edge Cases** - Test boundary conditions and error scenarios
5. **Performance** - Include timing assertions for critical paths
6. **Documentation** - Comment complex test logic

### Custom Assertions

```javascript
import { testMatchers } from './test-config.js';

// Financial data validation
assert.strictEqual(testMatchers.toBeValidPrice(150.25).pass, true);
assert.strictEqual(testMatchers.toBeValidRSI(65.4).pass, true);
assert.strictEqual(testMatchers.toBeValidSymbol('AAPL').pass, true);

// MCP response validation
assert.strictEqual(testMatchers.toBeValidMCPResponse(response).pass, true);

// Performance validation
assert.strictEqual(testMatchers.toCompleteWithinTime(duration, 1000).pass, true);
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
    
    - run: npm ci
    - run: npm run build
    - run: npm run test:ci
```

### Test Reports

The test runner generates comprehensive reports including:
- **Execution Summary** - Pass/fail counts and timing
- **Failed Test Details** - Error messages and stack traces
- **Performance Insights** - Slow test identification
- **JSON Output** - Machine-readable results for CI/CD

## Coverage Analysis

While built-in coverage is not yet implemented, you can analyze test coverage by:

1. **Manual Review** - Check that all functions have corresponding tests
2. **Test Categories** - Ensure each module has unit and integration tests
3. **Edge Cases** - Verify error conditions are tested
4. **Performance** - Include timing and load testing

### Current Test Coverage

| Component | Unit Tests | Integration Tests | Coverage Estimate |
|-----------|------------|-------------------|-------------------|
| Technical Indicators | ✅ | ✅ | ~95% |
| MCP Tools | ✅ | ✅ | ~90% |
| API Endpoints | ❌ | ✅ | ~75% |
| Database Layer | ❌ | ✅ | ~80% |
| Protocol Handlers | ❌ | ✅ | ~70% |

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   Error: EADDRINUSE: address already in use
   # Solution: Use PORT=0 for random port assignment
   ```

2. **Timeout Errors**
   ```bash
   # Increase timeout for slow operations
   node tests/run-tests.js --timeout 60000
   ```

3. **Memory Issues**
   ```bash
   # Monitor memory usage
   node --max-old-space-size=4096 tests/run-tests.js
   ```

4. **Database Connections**
   ```bash
   # Ensure test databases are available
   # Use mocks for CI environments
   ```

### Debug Mode

```bash
# Enable verbose output
npm run test:verbose

# Run single test file
node --test tests/unit/technical-indicators.test.js

# Debug with Node.js inspector
node --inspect-brk --test tests/unit/technical-indicators.test.js
```

## Contributing

When contributing new tests:

1. Follow the existing test structure and naming conventions
2. Include both positive and negative test cases
3. Add performance assertions for critical functionality
4. Update this README with new test categories
5. Ensure all tests pass before submitting PRs

## Future Enhancements

- [ ] Built-in code coverage reporting
- [ ] Load testing for high-concurrency scenarios  
- [ ] End-to-end testing with real market data
- [ ] Automated test generation for API endpoints
- [ ] Visual test reports with charts and graphs
- [ ] Integration with external monitoring tools