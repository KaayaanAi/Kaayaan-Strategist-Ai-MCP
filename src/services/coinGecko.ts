import { appConfig } from "../config.js";
import { MarketData, QuoteData } from "./yahooFinance.js";

export interface CoinGeckoMarketData extends Omit<MarketData, 'source'> {
  source: "coingecko";
}

export interface CoinGeckoQuoteData extends Omit<QuoteData, 'source'> {
  source: "coingecko";
  marketCap?: number;
  volume24h?: number;
}

// Common cryptocurrency symbol mappings to CoinGecko IDs
const CRYPTO_SYMBOL_MAP: Record<string, string> = {
  // Major cryptocurrencies
  'BTC': 'bitcoin',
  'BTCUSDT': 'bitcoin',
  'BTCUSD': 'bitcoin',
  'ETH': 'ethereum',
  'ETHUSDT': 'ethereum',
  'ETHUSD': 'ethereum',
  'BNB': 'binancecoin',
  'BNBUSDT': 'binancecoin',
  'BNBUSD': 'binancecoin',
  'ADA': 'cardano',
  'ADAUSDT': 'cardano',
  'ADAUSD': 'cardano',
  'XRP': 'ripple',
  'XRPUSDT': 'ripple',
  'XRPUSD': 'ripple',
  'SOL': 'solana',
  'SOLUSDT': 'solana',
  'SOLUSD': 'solana',
  'DOGE': 'dogecoin',
  'DOGEUSDT': 'dogecoin',
  'DOGEUSD': 'dogecoin',
  'DOT': 'polkadot',
  'DOTUSDT': 'polkadot',
  'DOTUSD': 'polkadot',
  'MATIC': 'matic-network',
  'MATICUSDT': 'matic-network',
  'MATICUSD': 'matic-network',
  'SHIB': 'shiba-inu',
  'SHIBUSDT': 'shiba-inu',
  'SHIBUSD': 'shiba-inu',
  'AVAX': 'avalanche-2',
  'AVAXUSDT': 'avalanche-2',
  'AVAXUSD': 'avalanche-2',
  'UNI': 'uniswap',
  'UNIUSDT': 'uniswap',
  'UNIUSD': 'uniswap',
  'LINK': 'chainlink',
  'LINKUSDT': 'chainlink',
  'LINKUSD': 'chainlink',
  'LTC': 'litecoin',
  'LTCUSDT': 'litecoin',
  'LTCUSD': 'litecoin',
  'ATOM': 'cosmos',
  'ATOMUSDT': 'cosmos',
  'ATOMUSD': 'cosmos',
  'ETC': 'ethereum-classic',
  'ETCUSDT': 'ethereum-classic',
  'ETCUSD': 'ethereum-classic',
  'XLM': 'stellar',
  'XLMUSDT': 'stellar',
  'XLMUSD': 'stellar',
  'BCH': 'bitcoin-cash',
  'BCHUSDT': 'bitcoin-cash',
  'BCHUSD': 'bitcoin-cash',
  'NEAR': 'near',
  'NEARUSDT': 'near',
  'NEARUSD': 'near',
  'ALGO': 'algorand',
  'ALGOUSDT': 'algorand',
  'ALGOUSD': 'algorand',
  'ICP': 'internet-computer',
  'ICPUSDT': 'internet-computer',
  'ICPUSD': 'internet-computer',
  'VET': 'vechain',
  'VETUSDT': 'vechain',
  'VETUSD': 'vechain',
  'FTM': 'fantom',
  'FTMUSDT': 'fantom',
  'FTMUSD': 'fantom',
  'HBAR': 'hedera-hashgraph',
  'HBARUSDT': 'hedera-hashgraph',
  'HBARUSD': 'hedera-hashgraph',
  'FIL': 'filecoin',
  'FILUSDT': 'filecoin',
  'FILUSD': 'filecoin',
  'TRX': 'tron',
  'TRXUSDT': 'tron',
  'TRXUSD': 'tron',
  'EOS': 'eos',
  'EOSUSDT': 'eos',
  'EOSUSD': 'eos',
  'AAVE': 'aave',
  'AAVEUSDT': 'aave',
  'AAVEUSD': 'aave',
  'GRT': 'the-graph',
  'GRTUSDT': 'the-graph',
  'GRTUSD': 'the-graph',
  'THETA': 'theta-token',
  'THETAUSDT': 'theta-token',
  'THETAUSD': 'theta-token',
  'XTZ': 'tezos',
  'XTZUSDT': 'tezos',
  'XTZUSD': 'tezos',
  'EGLD': 'elrond-erd-2',
  'EGLDUSDT': 'elrond-erd-2',
  'EGLDUSD': 'elrond-erd-2',
  'KSM': 'kusama',
  'KSMUSDT': 'kusama',
  'KSMUSD': 'kusama',
  'CAKE': 'pancakeswap-token',
  'CAKEUSDT': 'pancakeswap-token',
  'CAKEUSD': 'pancakeswap-token',
  'RUNE': 'thorchain',
  'RUNEUSDT': 'thorchain',
  'RUNEUSD': 'thorchain',
  'MANA': 'decentraland',
  'MANAUSDT': 'decentraland',
  'MANAUSD': 'decentraland',
  'SAND': 'the-sandbox',
  'SANDUSDT': 'the-sandbox',
  'SANDUSD': 'the-sandbox',
  'CRV': 'curve-dao-token',
  'CRVUSDT': 'curve-dao-token',
  'CRVUSD': 'curve-dao-token',
  'AXS': 'axie-infinity',
  'AXSUSDT': 'axie-infinity',
  'AXSUSD': 'axie-infinity',
};

export class CoinGeckoService {
  private rateLimitCount = 0;
  private rateLimitReset = Date.now();
  private readonly rateLimit = 50; // 50 requests per minute for free tier
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';

  /**
   * Check if we're within rate limits
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    
    // Reset counter every minute
    if (now - this.rateLimitReset >= 60000) {
      this.rateLimitCount = 0;
      this.rateLimitReset = now;
    }

    if (this.rateLimitCount >= this.rateLimit) {
      return false;
    }

    this.rateLimitCount++;
    return true;
  }

  /**
   * Detect if a symbol is a cryptocurrency
   */
  static isCryptoSymbol(symbol: string): boolean {
    const upperSymbol = symbol.toUpperCase();
    
    // Check if it's in our mapping
    if (CRYPTO_SYMBOL_MAP[upperSymbol]) {
      return true;
    }

    // Check for common crypto patterns
    const cryptoPatterns = [
      /^.+USDT$/,    // Ends with USDT
      /^.+USD$/,     // Ends with USD (for crypto pairs)
      /^.+BTC$/,     // Ends with BTC
      /^.+ETH$/,     // Ends with ETH
    ];

    // Check common crypto symbols
    const commonCryptos = [
      'BTC', 'ETH', 'BNB', 'ADA', 'XRP', 'SOL', 'DOGE', 'DOT', 'MATIC', 'SHIB',
      'AVAX', 'UNI', 'LINK', 'LTC', 'ATOM', 'ETC', 'XLM', 'BCH', 'NEAR', 'ALGO',
      'ICP', 'VET', 'FTM', 'HBAR', 'FIL', 'TRX', 'EOS', 'AAVE', 'GRT', 'THETA',
      'XTZ', 'EGLD', 'KSM', 'CAKE', 'RUNE', 'MANA', 'SAND', 'CRV', 'AXS'
    ];

    return cryptoPatterns.some(pattern => pattern.test(upperSymbol)) || 
           commonCryptos.includes(upperSymbol);
  }

  /**
   * Convert a crypto symbol to CoinGecko ID
   */
  private getCoinGeckoId(symbol: string): string | null {
    const upperSymbol = symbol.toUpperCase();
    
    // Direct mapping
    if (CRYPTO_SYMBOL_MAP[upperSymbol]) {
      return CRYPTO_SYMBOL_MAP[upperSymbol];
    }

    // Try to extract base symbol from trading pairs
    const baseSymbols = upperSymbol.replace(/(USDT|USD|BTC|ETH)$/, '');
    if (baseSymbols !== upperSymbol && CRYPTO_SYMBOL_MAP[baseSymbols]) {
      return CRYPTO_SYMBOL_MAP[baseSymbols];
    }

    return null;
  }

  /**
   * Get current quote for a cryptocurrency
   */
  async getQuote(symbol: string): Promise<CoinGeckoQuoteData | null> {
    if (!this.checkRateLimit()) {
      throw new Error("CoinGecko rate limit exceeded");
    }

    const coinId = this.getCoinGeckoId(symbol);
    if (!coinId) {
      return null;
    }

    try {
      const url = `${this.baseUrl}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Kaayaan-Strategist-MCP/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      const coinData = data[coinId];
      
      if (!coinData) {
        return null;
      }

      const currentPrice = coinData.usd;
      const change24h = coinData.usd_24h_change || 0;
      const volume24h = coinData.usd_24h_vol || 0;
      const marketCap = coinData.usd_market_cap || 0;

      if (currentPrice === undefined) {
        return null;
      }

      const previousPrice = currentPrice / (1 + (change24h / 100));
      const absoluteChange = currentPrice - previousPrice;

      return {
        symbol: symbol.toUpperCase(),
        price: currentPrice,
        change: absoluteChange,
        changePercent: change24h,
        timestamp: Date.now(),
        source: "coingecko",
        marketCap: marketCap > 0 ? marketCap : undefined,
        volume24h: volume24h > 0 ? volume24h : undefined,
      };

    } catch (error) {
      console.error(`CoinGecko quote error for ${symbol}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Get historical data for a cryptocurrency
   * Note: CoinGecko free tier provides limited historical data
   */
  async getHistoricalData(
    symbol: string,
    days: number = 30
  ): Promise<CoinGeckoMarketData[] | null> {
    if (!this.checkRateLimit()) {
      throw new Error("CoinGecko rate limit exceeded");
    }

    const coinId = this.getCoinGeckoId(symbol);
    if (!coinId) {
      return null;
    }

    try {
      // CoinGecko historical data endpoint
      const url = `${this.baseUrl}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Kaayaan-Strategist-MCP/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.prices || !Array.isArray(data.prices)) {
        return null;
      }

      const marketData: CoinGeckoMarketData[] = [];

      // CoinGecko provides [timestamp, price] arrays
      for (let i = 0; i < data.prices.length; i++) {
        const [timestamp, price] = data.prices[i];
        const volume = data.total_volumes?.[i]?.[1] || 0;

        // For OHLC data, we use price as close and estimate others
        // This is a limitation of CoinGecko free tier
        const marketCap = data.market_caps?.[i]?.[1] || 0;

        marketData.push({
          symbol: symbol.toUpperCase(),
          timestamp,
          open: price, // Approximation - CoinGecko free tier doesn't provide OHLC
          high: price * 1.02, // Approximation
          low: price * 0.98, // Approximation
          close: price,
          volume,
          source: "coingecko",
        });
      }

      // Sort by timestamp (newest first for consistency with other services)
      marketData.sort((a, b) => b.timestamp - a.timestamp);

      return marketData.length > 0 ? marketData : null;

    } catch (error) {
      console.error(`CoinGecko historical data error for ${symbol}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Search for cryptocurrencies
   */
  async searchSymbols(query: string): Promise<Array<{ symbol: string; name: string; type: string }> | null> {
    if (!this.checkRateLimit()) {
      throw new Error("CoinGecko rate limit exceeded");
    }

    try {
      const url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Kaayaan-Strategist-MCP/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.coins || !Array.isArray(data.coins)) {
        return null;
      }

      return data.coins.slice(0, 10).map((coin: any) => ({
        symbol: coin.symbol?.toUpperCase() || coin.id?.toUpperCase(),
        name: coin.name || coin.id,
        type: "Cryptocurrency",
      }));

    } catch (error) {
      console.error(`CoinGecko search error for ${query}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Check if CoinGecko service is available
   */
  isAvailable(): boolean {
    return true; // CoinGecko doesn't require API key for basic tier
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { remaining: number; resetTime: number } {
    const now = Date.now();
    const remaining = Math.max(0, this.rateLimit - this.rateLimitCount);
    const resetTime = this.rateLimitReset + 60000;
    
    return { remaining, resetTime };
  }
}