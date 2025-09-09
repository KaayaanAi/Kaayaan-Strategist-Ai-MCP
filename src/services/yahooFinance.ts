import { appConfig } from "../config.js";

export interface MarketData {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: "yahoo" | "alpha_vantage" | "coingecko";
}

export interface QuoteData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
  source: "yahoo" | "alpha_vantage" | "coingecko";
}

export class YahooFinanceService {
  private rateLimitCount = 0;
  private rateLimitReset = Date.now();
  private readonly rateLimit = appConfig.dataSources.yahoo.rateLimit;

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
   * Get current quote for a symbol
   */
  async getQuote(symbol: string): Promise<QuoteData | null> {
    if (!this.checkRateLimit()) {
      throw new Error("Yahoo Finance rate limit exceeded");
    }

    try {
      // Yahoo Finance v8 API endpoint for quote
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.chart?.result?.[0]) {
        return null;
      }

      const result = data.chart.result[0];
      const meta = result.meta;
      const quotes = result.indicators.quote[0];
      
      if (!meta || !quotes) {
        return null;
      }

      const currentPrice = meta.regularMarketPrice || quotes.close?.slice(-1)[0];
      const previousClose = meta.previousClose;

      if (currentPrice === undefined || previousClose === undefined) {
        return null;
      }

      const change = currentPrice - previousClose;
      const changePercent = (change / previousClose) * 100;

      return {
        symbol: symbol.toUpperCase(),
        price: currentPrice,
        change,
        changePercent,
        timestamp: Date.now(),
        source: "yahoo",
      };

    } catch (error) {
      console.error(`Yahoo Finance quote error for ${symbol}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Get historical data for a symbol
   */
  async getHistoricalData(
    symbol: string,
    period: "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" = "1mo",
    interval: "1m" | "5m" | "15m" | "1h" | "1d" = "1d"
  ): Promise<MarketData[] | null> {
    if (!this.checkRateLimit()) {
      throw new Error("Yahoo Finance rate limit exceeded");
    }

    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${period}&interval=${interval}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.chart?.result?.[0]) {
        return null;
      }

      const result = data.chart.result[0];
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];

      if (!timestamps || !quotes) {
        return null;
      }

      const marketData: MarketData[] = [];

      for (let i = 0; i < timestamps.length; i++) {
        const open = quotes.open[i];
        const high = quotes.high[i];
        const low = quotes.low[i];
        const close = quotes.close[i];
        const volume = quotes.volume[i];

        // Skip incomplete data points
        if (open !== null && high !== null && low !== null && close !== null && volume !== null) {
          marketData.push({
            symbol: symbol.toUpperCase(),
            timestamp: timestamps[i] * 1000, // Convert to milliseconds
            open,
            high,
            low,
            close,
            volume,
            source: "yahoo",
          });
        }
      }

      return marketData.length > 0 ? marketData : null;

    } catch (error) {
      console.error(`Yahoo Finance historical data error for ${symbol}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Search for symbols
   */
  async searchSymbols(query: string): Promise<Array<{ symbol: string; name: string; type: string }> | null> {
    if (!this.checkRateLimit()) {
      throw new Error("Yahoo Finance rate limit exceeded");
    }

    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.quotes) {
        return null;
      }

      return data.quotes.slice(0, 10).map((quote: any) => ({
        symbol: quote.symbol,
        name: quote.longname || quote.shortname || quote.symbol,
        type: quote.typeDisp || "Unknown",
      }));

    } catch (error) {
      console.error(`Yahoo Finance search error for ${query}:`, (error as Error).message);
      return null;
    }
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