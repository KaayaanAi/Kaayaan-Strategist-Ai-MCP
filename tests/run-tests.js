#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Kaayaan Strategist MCP Server
 * 
 * This script provides a unified test runner with enhanced reporting,
 * performance metrics, and flexible test execution options.
 */

import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { testConfig, globalSetup, globalTeardown, testUtils } from './test-config.js';

const __dirname = new URL('.', import.meta.url).pathname;

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Test runner configuration
const runnerConfig = {
  timeout: 30000,
  retries: 0,
  parallel: true,
  bail: false,
  verbose: false,
  coverage: false,
  reporter: 'default'
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...runnerConfig };
  const testPatterns = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--timeout':
        config.timeout = parseInt(args[++i]) || config.timeout;
        break;
      case '--retries':
        config.retries = parseInt(args[++i]) || config.retries;
        break;
      case '--no-parallel':
        config.parallel = false;
        break;
      case '--bail':
        config.bail = true;
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--coverage':
        config.coverage = true;
        break;
      case '--reporter':
        config.reporter = args[++i] || config.reporter;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('--')) {
          testPatterns.push(arg);
        }
        break;
    }
  }

  return { config, testPatterns };
}

// Show help information
function showHelp() {
  console.log(`
${colors.cyan}Kaayaan Strategist MCP Server Test Runner${colors.reset}

${colors.bright}USAGE:${colors.reset}
  node tests/run-tests.js [options] [patterns...]

${colors.bright}OPTIONS:${colors.reset}
  --timeout <ms>     Set test timeout (default: 30000)
  --retries <n>      Number of retries for failed tests (default: 0)
  --no-parallel     Run tests sequentially instead of parallel
  --bail            Stop on first test failure
  --verbose, -v     Enable verbose output
  --coverage        Enable coverage reporting (requires additional setup)
  --reporter <type>  Set reporter type (default, json, tap)
  --help, -h        Show this help message

${colors.bright}EXAMPLES:${colors.reset}
  node tests/run-tests.js                    # Run all tests
  node tests/run-tests.js unit              # Run unit tests only
  node tests/run-tests.js integration       # Run integration tests only
  node tests/run-tests.js indicators        # Run indicator-related tests
  node tests/run-tests.js --verbose --bail  # Verbose output, stop on failure

${colors.bright}TEST CATEGORIES:${colors.reset}
  unit               - Unit tests for core functionality
  integration        - Integration tests for protocols and APIs
  indicators         - Technical indicator calculation tests
  analysis           - Market analysis tool tests
  mcp               - MCP protocol compliance tests
  api               - HTTP API endpoint tests
  database          - Database connection tests

${colors.bright}AVAILABLE REPORTERS:${colors.reset}
  default           - Enhanced console output with colors and timing
  json              - JSON output for CI/CD integration
  tap               - TAP (Test Anything Protocol) format
  spec              - Detailed specification-style output
`);
}

// Find test files based on patterns
async function findTestFiles(patterns) {
  const testsDir = resolve(__dirname);
  const allFiles = [];

  async function scanDirectory(dir, prefix = '') {
    const entries = await readdir(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory() && entry !== 'node_modules') {
        await scanDirectory(fullPath, prefix ? `${prefix}/${entry}` : entry);
      } else if (entry.endsWith('.test.js')) {
        allFiles.push({
          path: fullPath,
          name: prefix ? `${prefix}/${entry}` : entry,
          category: prefix || 'root'
        });
      }
    }
  }

  await scanDirectory(testsDir);

  if (patterns.length === 0) {
    return allFiles;
  }

  return allFiles.filter(file => 
    patterns.some(pattern => 
      file.path.includes(pattern) || 
      file.name.includes(pattern) ||
      file.category.includes(pattern)
    )
  );
}

// Run a single test file
async function runTestFile(testFile, config) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const args = ['--test'];
    
    if (config.reporter === 'json') {
      args.push('--reporter=tap'); // Node.js doesn't have built-in JSON reporter
    } else if (config.reporter === 'tap') {
      args.push('--reporter=tap');
    } else if (config.reporter === 'spec') {
      args.push('--reporter=spec');
    }
    
    args.push(testFile.path);

    const child = spawn('node', args, {
      stdio: config.verbose ? 'inherit' : ['pipe', 'pipe', 'pipe'],
      timeout: config.timeout
    });

    let stdout = '';
    let stderr = '';

    if (!config.verbose) {
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      const result = {
        file: testFile,
        passed: code === 0,
        code,
        duration,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      };
      
      resolve(result);
    });

    child.on('error', (error) => {
      resolve({
        file: testFile,
        passed: false,
        code: -1,
        duration: Date.now() - startTime,
        error: error.message,
        stdout: '',
        stderr: ''
      });
    });
  });
}

// Run multiple test files
async function runTests(testFiles, config) {
  const results = [];
  const startTime = Date.now();

  console.log(`${colors.cyan}🚀 Starting test execution...${colors.reset}`);
  console.log(`${colors.blue}📁 Found ${testFiles.length} test file(s)${colors.reset}`);
  
  if (config.parallel && testFiles.length > 1) {
    console.log(`${colors.blue}⚡ Running tests in parallel${colors.reset}\n`);
    
    const promises = testFiles.map(file => runTestFile(file, config));
    const allResults = await Promise.all(promises);
    results.push(...allResults);
  } else {
    console.log(`${colors.blue}📝 Running tests sequentially${colors.reset}\n`);
    
    for (const testFile of testFiles) {
      console.log(`${colors.yellow}🏃 Running: ${testFile.name}${colors.reset}`);
      
      const result = await runTestFile(testFile, config);
      results.push(result);
      
      // Show immediate result
      const status = result.passed ? `${colors.green}✅` : `${colors.red}❌`;
      console.log(`${status} ${testFile.name} ${colors.cyan}(${result.duration}ms)${colors.reset}`);
      
      if (!result.passed && config.verbose && result.stderr) {
        console.log(`${colors.red}   Error: ${result.stderr}${colors.reset}`);
      }
      
      if (config.bail && !result.passed) {
        console.log(`${colors.red}🛑 Stopping due to --bail flag${colors.reset}`);
        break;
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  return { results, totalDuration };
}

// Generate test report
function generateReport(results, totalDuration, config) {
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);
  
  const stats = {
    total: results.length,
    passed: passed.length,
    failed: failed.length,
    duration: totalDuration,
    avgDuration: Math.round(totalDuration / results.length)
  };

  if (config.reporter === 'json') {
    const jsonReport = {
      summary: stats,
      tests: results.map(r => ({
        file: r.file.name,
        passed: r.passed,
        duration: r.duration,
        error: r.error || (r.stderr ? r.stderr.split('\n')[0] : null)
      }))
    };
    
    console.log(JSON.stringify(jsonReport, null, 2));
    return stats;
  }

  // Default console report
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.cyan}📊 TEST EXECUTION SUMMARY${colors.reset}`);
  console.log('='.repeat(60));
  
  console.log(`${colors.bright}Total Tests:${colors.reset} ${stats.total}`);
  console.log(`${colors.green}✅ Passed:${colors.reset} ${stats.passed}`);
  console.log(`${colors.red}❌ Failed:${colors.reset} ${stats.failed}`);
  console.log(`${colors.blue}⏱️  Total Time:${colors.reset} ${totalDuration}ms`);
  console.log(`${colors.blue}📊 Avg Time:${colors.reset} ${stats.avgDuration}ms per test`);

  if (failed.length > 0) {
    console.log(`\n${colors.red}❌ FAILED TESTS:${colors.reset}`);
    failed.forEach(result => {
      console.log(`   ${colors.red}•${colors.reset} ${result.file.name} ${colors.cyan}(${result.duration}ms)${colors.reset}`);
      if (result.error) {
        console.log(`     ${colors.yellow}Error:${colors.reset} ${result.error}`);
      } else if (result.stderr) {
        const errorLine = result.stderr.split('\n')[0];
        console.log(`     ${colors.yellow}Error:${colors.reset} ${errorLine}`);
      }
    });
  }

  if (passed.length > 0) {
    console.log(`\n${colors.green}✅ PASSED TESTS:${colors.reset}`);
    passed.forEach(result => {
      console.log(`   ${colors.green}•${colors.reset} ${result.file.name} ${colors.cyan}(${result.duration}ms)${colors.reset}`);
    });
  }

  // Performance insights
  if (results.length > 0) {
    const slowTests = results
      .filter(r => r.duration > 5000)
      .sort((a, b) => b.duration - a.duration);
    
    if (slowTests.length > 0) {
      console.log(`\n${colors.yellow}⚠️  SLOW TESTS (>5s):${colors.reset}`);
      slowTests.forEach(result => {
        console.log(`   ${colors.yellow}•${colors.reset} ${result.file.name} ${colors.red}(${result.duration}ms)${colors.reset}`);
      });
    }
  }

  console.log('='.repeat(60));
  
  const success = failed.length === 0;
  if (success) {
    console.log(`${colors.green}🎉 All tests passed!${colors.reset}`);
  } else {
    console.log(`${colors.red}💥 ${failed.length} test(s) failed${colors.reset}`);
  }
  
  console.log('='.repeat(60));
  
  return stats;
}

// Main execution function
async function main() {
  const { config, testPatterns } = parseArgs();
  
  console.log(`${colors.cyan}🧪 Kaayaan Strategist MCP Server Test Runner${colors.reset}\n`);

  try {
    // Global setup
    await globalSetup();
    
    // Find test files
    const testFiles = await findTestFiles(testPatterns);
    
    if (testFiles.length === 0) {
      console.log(`${colors.yellow}⚠️  No test files found matching patterns: ${testPatterns.join(', ')}${colors.reset}`);
      process.exit(0);
    }

    // Run tests
    const { results, totalDuration } = await runTests(testFiles, config);
    
    // Generate report
    const stats = generateReport(results, totalDuration, config);
    
    // Global teardown
    await globalTeardown();
    
    // Exit with appropriate code
    process.exit(stats.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error(`${colors.red}💥 Test runner error: ${error.message}${colors.reset}`);
    
    try {
      await globalTeardown();
    } catch (teardownError) {
      console.error(`${colors.red}💥 Teardown error: ${teardownError.message}${colors.reset}`);
    }
    
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  console.log(`\n${colors.yellow}🛑 Test execution interrupted${colors.reset}`);
  await globalTeardown();
  process.exit(130);
});

process.on('SIGTERM', async () => {
  console.log(`\n${colors.yellow}🛑 Test execution terminated${colors.reset}`);
  await globalTeardown();
  process.exit(143);
});

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}