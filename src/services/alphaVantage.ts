import { appConfig } from "../config.js";
import type { MarketData, QuoteData } from "./yahooFinance.js";

export class AlphaVantageService {
  private rateLimitCount = 0;
  private rateLimitReset = Date.now();
  private readonly apiKey = appConfig.dataSources.alphaVantage.apiKey;
  private readonly rateLimit = appConfig.dataSources.alphaVantage.rateLimit;

  constructor() {
    if (!this.apiKey) {
      console.warn("⚠️ Alpha Vantage API key not provided - backup data source disabled");
    }
  }

  /**
   * Check if service is available (has API key)
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

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
    if (!this.isAvailable()) {
      throw new Error("Alpha Vantage API key not configured");
    }

    if (!this.checkRateLimit()) {
      throw new Error("Alpha Vantage rate limit exceeded");
    }

    try {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`;
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data["Error Message"]) {
        throw new Error(data["Error Message"]);
      }

      if (data["Note"]) {
        throw new Error("Alpha Vantage API call frequency limit reached");
      }

      const quote = data["Global Quote"];
      if (!quote) {
        return null;
      }

      const price = parseFloat(quote["05. price"]);
      const change = parseFloat(quote["09. change"]);
      const changePercent = parseFloat(quote["10. change percent"].replace("%", ""));

      if (isNaN(price) || isNaN(change) || isNaN(changePercent)) {
        return null;
      }

      return {
        symbol: symbol.toUpperCase(),
        price,
        change,
        changePercent,
        timestamp: Date.now(),
        source: "alpha_vantage",
      };

    } catch (error) {
      console.error(`Alpha Vantage quote error for ${symbol}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Get historical daily data for a symbol
   */
  async getHistoricalData(symbol: string, outputSize: "compact" | "full" = "compact"): Promise<MarketData[] | null> {
    if (!this.isAvailable()) {
      throw new Error("Alpha Vantage API key not configured");
    }

    if (!this.checkRateLimit()) {
      throw new Error("Alpha Vantage rate limit exceeded");
    }

    try {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=${outputSize}&apikey=${this.apiKey}`;
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data["Error Message"]) {
        throw new Error(data["Error Message"]);
      }

      if (data["Note"]) {
        throw new Error("Alpha Vantage API call frequency limit reached");
      }

      const timeSeries = data["Time Series (Daily)"];
      if (!timeSeries) {
        return null;
      }

      const marketData: MarketData[] = [];

      for (const [date, values] of Object.entries(timeSeries)) {
        const open = parseFloat((values as any)["1. open"]);
        const high = parseFloat((values as any)["2. high"]);
        const low = parseFloat((values as any)["3. low"]);
        const close = parseFloat((values as any)["4. close"]);
        const volume = parseInt((values as any)["5. volume"]);

        if (!isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close) && !isNaN(volume)) {
          marketData.push({
            symbol: symbol.toUpperCase(),
            timestamp: new Date(date).getTime(),
            open,
            high,
            low,
            close,
            volume,
            source: "alpha_vantage",
          });
        }
      }

      // Sort by timestamp (newest first)
      return marketData.sort((a, b) => b.timestamp - a.timestamp);

    } catch (error) {
      console.error(`Alpha Vantage historical data error for ${symbol}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Get technical indicators from Alpha Vantage
   */
  async getTechnicalIndicator(
    symbol: string,
    function_name: "RSI" | "MACD" | "SMA" | "EMA",
    interval: "daily" | "weekly" | "monthly" = "daily",
    params: Record<string, any> = {}
  ): Promise<any | null> {
    if (!this.isAvailable()) {
      throw new Error("Alpha Vantage API key not configured");
    }

    if (!this.checkRateLimit()) {
      throw new Error("Alpha Vantage rate limit exceeded");
    }

    try {
      const baseUrl = `https://www.alphavantage.co/query?function=${function_name}&symbol=${symbol}&interval=${interval}&apikey=${this.apiKey}`;
      
      // Add additional parameters
      const paramString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join("&");
      
      const url = paramString ? `${baseUrl}&${paramString}` : baseUrl;
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data["Error Message"]) {
        throw new Error(data["Error Message"]);
      }

      if (data["Note"]) {
        throw new Error("Alpha Vantage API call frequency limit reached");
      }

      return data;

    } catch (error) {
      console.error(`Alpha Vantage ${function_name} error for ${symbol}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Search for symbols (Alpha Vantage symbol search)
   */
  async searchSymbols(keywords: string): Promise<Array<{ symbol: string; name: string; type: string }> | null> {
    if (!this.isAvailable()) {
      throw new Error("Alpha Vantage API key not configured");
    }

    if (!this.checkRateLimit()) {
      throw new Error("Alpha Vantage rate limit exceeded");
    }

    try {
      const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(keywords)}&apikey=${this.apiKey}`;
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data["Error Message"]) {
        throw new Error(data["Error Message"]);
      }

      if (data["Note"]) {
        throw new Error("Alpha Vantage API call frequency limit reached");
      }

      const bestMatches = data["bestMatches"];
      if (!bestMatches) {
        return null;
      }

      return bestMatches.slice(0, 10).map((match: any) => ({
        symbol: match["1. symbol"],
        name: match["2. name"],
        type: match["3. type"],
      }));

    } catch (error) {
      console.error(`Alpha Vantage search error for ${keywords}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { remaining: number; resetTime: number; available: boolean } {
    const now = Date.now();
    const remaining = Math.max(0, this.rateLimit - this.rateLimitCount);
    const resetTime = this.rateLimitReset + 60000;
    
    return { 
      remaining, 
      resetTime, 
      available: this.isAvailable() 
    };
  }
}