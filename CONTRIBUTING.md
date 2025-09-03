# Contributing to Kaayaan Strategist AI MCP Server

Thank you for your interest in contributing to Kaayaan Strategist AI! This project provides systematic market analysis through the Model Context Protocol (MCP).

## 🚨 Important Disclaimer

**This project is for educational purposes only.** All contributors must understand and agree that:

- This software is NOT financial advice
- Trading involves significant risk of loss
- Users are solely responsible for their investment decisions
- All analysis is for research and educational purposes

## 🤝 How to Contribute

### Types of Contributions Welcome

1. **Bug Fixes** - Fix issues with data analysis or calculations
2. **Documentation** - Improve README, API docs, or code comments  
3. **Testing** - Add unit tests or integration tests
4. **Performance** - Optimize data processing or caching
5. **Security** - Identify and fix security vulnerabilities

### What We DON'T Accept

❌ **Financial Advice Features** - No investment recommendations  
❌ **Guaranteed Returns** - No promises of trading success  
❌ **Proprietary Algorithms** - Keep educational and transparent  
❌ **Credential Harvesting** - No access to user accounts or keys  

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ 
- MongoDB (optional but recommended)
- Redis (optional but recommended)
- Alpha Vantage API key (optional)

### Local Setup

```bash
git clone https://github.com/kaayaan/mcp-kaayaan-strategist.git
cd mcp-kaayaan-strategist
npm install
cp .env.example .env
# Edit .env with your configuration
npm run build
npm run inspector  # Test with MCP Inspector
```

### Environment Variables

```bash
# Required for full functionality
MONGODB_URI=mongodb://localhost:27017/kaayaan_strategist
REDIS_URL=redis://localhost:6379
ALPHA_VANTAGE_API_KEY=your_api_key_here

# Optional configuration
TIMEZONE=Asia/Kuwait
CACHE_TTL_MINUTES=15
```

## 📝 Code Guidelines

### Security Requirements

- **Never commit API keys** or sensitive credentials
- **Validate all inputs** using Zod schemas
- **Sanitize user data** before database operations
- **Use parameterized queries** for MongoDB operations
- **Log security events** but never log sensitive data

### Code Standards

- **TypeScript** for type safety
- **ESM modules** (import/export)
- **Async/await** patterns
- **Error handling** with try/catch
- **Educational disclaimers** on all financial outputs

### Testing Requirements

All PRs must include:

- Unit tests for new functions
- Integration tests for API changes
- Error handling tests
- Documentation updates

## 🔄 Contribution Process

### 1. Fork & Branch

```bash
git fork https://github.com/kaayaan/mcp-kaayaan-strategist.git
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Follow existing code patterns
- Add tests for new functionality
- Update documentation as needed
- Ensure educational disclaimers are preserved

### 3. Test Your Changes

```bash
npm run build
npm run inspector
# Test all 6 MCP tools manually
```

### 4. Submit PR

- Clear description of changes
- Reference any related issues
- Include test results
- Add screenshots for UI changes

## 📊 Technical Architecture

### Core Services

- **Data Aggregator** - Yahoo Finance + Alpha Vantage integration
- **Technical Indicators** - RSI, MACD, Moving Averages, Support/Resistance
- **MongoDB Service** - Analysis storage and retrieval
- **Redis Cache** - 15-minute TTL for API optimization
- **Timezone Utils** - Kuwait timezone handling

### MCP Tools

1. `analyze_market_structure` - Market phase and volatility analysis
2. `generate_trading_signal` - BUY/SELL/WAIT with confidence scoring
3. `calculate_indicators` - Technical indicator calculations
4. `store_analysis` - Save analysis results
5. `get_analysis_history` - Retrieve historical analyses
6. `validate_data_quality` - Data source validation

## 🐛 Bug Reports

When reporting bugs, include:

- Node.js version
- Operating system
- Environment configuration (without sensitive data)
- Steps to reproduce
- Expected vs actual behavior
- Error messages (sanitized)

## 💡 Feature Requests

For new features, please:

- Open an issue first for discussion
- Explain the educational value
- Consider security implications
- Maintain the "educational only" principle

## ⚠️ Security Issues

**Do NOT open public issues for security vulnerabilities.**

Instead:
- Email security@example.com (if available)
- Use GitHub's private vulnerability reporting
- Include detailed reproduction steps
- Suggest potential fixes if known

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License with educational disclaimers.

## 🙋 Questions?

- Check existing issues and discussions
- Read the full README.md
- Test with the MCP Inspector tool
- Join discussions in GitHub Discussions

---

**Remember: This is an educational project. All contributions must maintain the educational nature and include appropriate disclaimers about trading risks.**