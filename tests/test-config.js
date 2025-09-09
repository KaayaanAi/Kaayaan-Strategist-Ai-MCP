/**
 * Test Configuration for Node.js Test Runner
 */

import { setTimeout } from 'node:timers/promises';

// Test configuration
export const testConfig = {
  // Global test timeout (30 seconds)
  timeout: 30000,
  
  // Concurrency settings
  concurrency: 4,
  
  // Test environment
  environment: {
    NODE_ENV: 'test',
    SUPPRESS_NO_CONFIG_WARNING: 'true'
  },
  
  // Mock settings
  mocks: {
    enableNetworkMocks: true,
    enableDatabaseMocks: true,
    enableFilesystemMocks: false
  },
  
  // Coverage settings (for future integration)
  coverage: {
    enabled: false, // Would require additional tooling
    threshold: 85,
    include: ['src/**/*.js', 'src/**/*.ts'],
    exclude: ['tests/**/*', 'build/**/*', 'node_modules/**/*']
  }
};

// Global test setup
export async function globalSetup() {
  console.log('🧪 Setting up test environment...');
  
  // Set test environment variables
  Object.entries(testConfig.environment).forEach(([key, value]) => {
    process.env[key] = value;
  });
  
  // Initialize test databases (if needed)
  if (testConfig.mocks.enableDatabaseMocks) {
    console.log('📊 Initializing mock databases...');
    // Database initialization would go here
  }
  
  // Setup test fixtures
  console.log('🔧 Loading test fixtures...');
  
  console.log('✅ Test environment ready');
}

// Global test teardown
export async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');
  
  // Clean up test environment variables
  Object.keys(testConfig.environment).forEach(key => {
    delete process.env[key];
  });
  
  // Cleanup test databases
  if (testConfig.mocks.enableDatabaseMocks) {
    console.log('🗄️  Cleaning up mock databases...');
  }
  
  console.log('✅ Test cleanup complete');
}

// Test utilities
export const testUtils = {
  // Wait for async operations
  wait: async (ms = 100) => await setTimeout(ms),
  
  // Create test timeout
  timeout: (ms = testConfig.timeout) => new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(`Test timeout after ${ms}ms`)), ms);
    return timer;
  }),
  
  // Assert with timeout
  assertWithTimeout: async (assertion, timeout = 5000) => {
    const timeoutPromise = testUtils.timeout(timeout);
    const assertionPromise = Promise.resolve().then(assertion);
    
    return Promise.race([assertionPromise, timeoutPromise]);
  },
  
  // Generate test data
  generateTestSymbol: () => `TEST_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
  
  // Mock timers
  mockDate: (date) => {
    const originalNow = Date.now;
    Date.now = () => new Date(date).getTime();
    return () => { Date.now = originalNow; };
  },
  
  // Performance measurement
  measurePerformance: async (fn) => {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
    
    return { result, duration };
  },
  
  // Memory usage tracking
  getMemoryUsage: () => {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100,
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100
    };
  }
};

// Test reporters
export const testReporters = {
  // Simple console reporter
  console: {
    onTestStart: (testName) => {
      console.log(`🏃 Running: ${testName}`);
    },
    
    onTestComplete: (testName, result) => {
      const status = result.passed ? '✅' : '❌';
      const duration = result.duration ? `(${result.duration}ms)` : '';
      console.log(`${status} ${testName} ${duration}`);
      
      if (!result.passed && result.error) {
        console.error(`   Error: ${result.error.message}`);
      }
    },
    
    onSuiteComplete: (suiteName, stats) => {
      console.log(`\n📊 Suite: ${suiteName}`);
      console.log(`   Total: ${stats.total}, Passed: ${stats.passed}, Failed: ${stats.failed}`);
      if (stats.skipped > 0) {
        console.log(`   Skipped: ${stats.skipped}`);
      }
      console.log(`   Duration: ${stats.duration}ms\n`);
    }
  },
  
  // JSON reporter for CI/CD
  json: {
    results: [],
    
    onTestComplete: function(testName, result) {
      this.results.push({
        name: testName,
        passed: result.passed,
        duration: result.duration,
        error: result.error ? {
          message: result.error.message,
          stack: result.error.stack
        } : null,
        timestamp: new Date().toISOString()
      });
    },
    
    getReport: function() {
      return {
        summary: {
          total: this.results.length,
          passed: this.results.filter(r => r.passed).length,
          failed: this.results.filter(r => !r.passed).length,
          duration: this.results.reduce((sum, r) => sum + (r.duration || 0), 0)
        },
        tests: this.results
      };
    }
  }
};

// Test matchers for enhanced assertions
export const testMatchers = {
  // Financial data matchers
  toBeValidPrice: (received) => ({
    pass: typeof received === 'number' && received > 0 && isFinite(received),
    message: () => `Expected ${received} to be a valid price (positive finite number)`
  }),
  
  toBeValidPercentage: (received) => ({
    pass: typeof received === 'number' && received >= -100 && received <= 100,
    message: () => `Expected ${received} to be a valid percentage (-100 to 100)`
  }),
  
  toBeValidRSI: (received) => ({
    pass: typeof received === 'number' && received >= 0 && received <= 100,
    message: () => `Expected ${received} to be a valid RSI value (0-100)`
  }),
  
  toBeValidTimestamp: (received) => ({
    pass: typeof received === 'number' && received > 0 && new Date(received).getTime() === received,
    message: () => `Expected ${received} to be a valid timestamp`
  }),
  
  toBeValidSymbol: (received) => ({
    pass: typeof received === 'string' && received.length > 0 && received.length <= 10 && /^[A-Z0-9-]+$/.test(received),
    message: () => `Expected ${received} to be a valid trading symbol`
  }),
  
  // MCP response matchers
  toBeValidMCPResponse: (received) => ({
    pass: received && 
          Array.isArray(received.content) && 
          received.content.length > 0 &&
          received.content.every(item => item.type && item.text),
    message: () => `Expected ${JSON.stringify(received)} to be a valid MCP response`
  }),
  
  // Performance matchers
  toCompleteWithinTime: (received, expected) => ({
    pass: typeof received === 'number' && received <= expected,
    message: () => `Expected operation to complete within ${expected}ms, but took ${received}ms`
  }),
  
  // Data quality matchers
  toHaveMinimumDataPoints: (received, minimum) => ({
    pass: Array.isArray(received) && received.length >= minimum,
    message: () => `Expected array to have at least ${minimum} items, but had ${received?.length || 0}`
  })
};

// Error handling for tests
export const testErrorHandler = {
  handleAsyncError: (error, testName) => {
    console.error(`💥 Async error in test: ${testName}`);
    console.error(error);
    
    return {
      passed: false,
      error: error,
      testName: testName,
      timestamp: new Date().toISOString()
    };
  },
  
  wrapAsyncTest: (testFn) => {
    return async (...args) => {
      try {
        return await testFn(...args);
      } catch (error) {
        return testErrorHandler.handleAsyncError(error, testFn.name);
      }
    };
  }
};

// Test fixtures helpers
export const fixtureHelpers = {
  loadFixture: (fixtureName) => {
    try {
      return import(`./fixtures/${fixtureName}.js`);
    } catch (error) {
      throw new Error(`Failed to load fixture: ${fixtureName}`);
    }
  },
  
  createMockMarketData: (count = 30, basePrice = 100) => {
    return Array.from({ length: count }, (_, i) => ({
      symbol: "MOCK",
      timestamp: Date.now() - (count - i) * 86400000,
      open: basePrice + (Math.random() - 0.5) * 10,
      high: basePrice + Math.random() * 15,
      low: basePrice - Math.random() * 10,
      close: basePrice + (Math.random() - 0.5) * 8,
      volume: Math.floor(Math.random() * 1000000) + 100000,
      source: "mock"
    }));
  }
};

// Export default configuration
export default testConfig;