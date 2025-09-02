import { YahooFinanceService, type MarketData, type QuoteData } from "./yahooFinance.js";
import { AlphaVantageService } from "./alphaVantage.js";
import { redisCache } from "./redis.js";
import { mongoDBService } from "./mongodb.js";

export class DataAggregator {
  private yahooService: YahooFinanceService;
  private alphaService: AlphaVantageService;

  constructor() {
    this.yahooService = new YahooFinanceService();
    this.alphaService = new AlphaVantageService();
  }

  /**
   * Get quote with fallback and caching
   */
  async getQuote(symbol: string): Promise<{
    data: QuoteData | null;
    source: "cached" | "yahoo" | "alpha_vantage";
    fromCache: boolean;
  }> {
    const cacheKey = `quote:${symbol.toUpperCase()}`;
    
    // Try cache first
    const cached = await redisCache.get<QuoteData>("quotes", symbol.toUpperCase());
    if (cached) {
      return { data: cached, source: "cached", fromCache: true };
    }

    // Try Yahoo Finance first
    try {
      const yahooData = await this.yahooService.getQuote(symbol);
      if (yahooData) {
        // Cache the result
        await redisCache.set("quotes", symbol.toUpperCase(), yahooData);
        
        // Track cost
        await mongoDBService.trackCost("yahoo", "quote", 1, 0, symbol);
        
        return { data: yahooData, source: "yahoo", fromCache: false };
      }
    } catch (error) {
      console.error(`Yahoo Finance quote failed for ${symbol}:`, (error as Error).message);
    }

    // Fallback to Alpha Vantage
    if (this.alphaService.isAvailable()) {
      try {
        const alphaData = await this.alphaService.getQuote(symbol);
        if (alphaData) {
          // Cache the result
          await redisCache.set("quotes", symbol.toUpperCase(), alphaData);
          
          // Track cost (Alpha Vantage has API limits)
          await mongoDBService.trackCost("alpha_vantage", "quote", 1, 0.01, symbol);
          
          return { data: alphaData, source: "alpha_vantage", fromCache: false };
        }
      } catch (error) {
        console.error(`Alpha Vantage quote failed for ${symbol}:`, (error as Error).message);
      }
    }

    return { data: null, source: "yahoo", fromCache: false };
  }

  /**
   * Get historical data with fallback and caching
   */
  async getHistoricalData(
    symbol: string, 
    period: "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" = "1mo",
    interval: "1m" | "5m" | "15m" | "1h" | "1d" = "1d"
  ): Promise<{
    data: MarketData[] | null;
    source: "cached" | "yahoo" | "alpha_vantage";
    fromCache: boolean;
  }> {
    const cacheKey = `historical:${symbol.toUpperCase()}:${period}:${interval}`;
    
    // Try cache first (longer TTL for historical data)
    const cached = await redisCache.get<MarketData[]>("historical", cacheKey);
    if (cached) {
      return { data: cached, source: "cached", fromCache: true };
    }

    // Try Yahoo Finance first
    try {
      const yahooData = await this.yahooService.getHistoricalData(symbol, period, interval);
      if (yahooData && yahooData.length > 0) {
        // Cache with longer TTL for historical data (1 hour)
        await redisCache.set("historical", cacheKey, yahooData, 3600);
        
        // Track cost
        await mongoDBService.trackCost("yahoo", "historical", 1, 0, symbol);
        
        return { data: yahooData, source: "yahoo", fromCache: false };
      }
    } catch (error) {
      console.error(`Yahoo Finance historical data failed for ${symbol}:`, (error as Error).message);
    }

    // Fallback to Alpha Vantage (daily data only)
    if (this.alphaService.isAvailable() && interval === "1d") {
      try {
        const outputSize = period === "1y" ? "full" : "compact";
        const alphaData = await this.alphaService.getHistoricalData(symbol, outputSize);
        if (alphaData && alphaData.length > 0) {
          // Cache with longer TTL
          await redisCache.set("historical", cacheKey, alphaData, 3600);
          
          // Track cost
          await mongoDBService.trackCost("alpha_vantage", "historical", 1, 0.02, symbol);
          
          return { data: alphaData, source: "alpha_vantage", fromCache: false };
        }
      } catch (error) {
        console.error(`Alpha Vantage historical data failed for ${symbol}:`, (error as Error).message);
      }
    }

    return { data: null, source: "yahoo", fromCache: false };
  }

  /**
   * Search for symbols with caching
   */
  async searchSymbols(query: string): Promise<{
    data: Array<{ symbol: string; name: string; type: string }> | null;
    source: "cached" | "yahoo" | "alpha_vantage";
    fromCache: boolean;
  }> {
    const cacheKey = `search:${query.toLowerCase()}`;
    
    // Try cache first
    const cached = await redisCache.get<Array<{ symbol: string; name: string; type: string }>>(
      "search", 
      query.toLowerCase()
    );
    if (cached) {
      return { data: cached, source: "cached", fromCache: true };
    }

    // Try Yahoo Finance first
    try {
      const yahooData = await this.yahooService.searchSymbols(query);
      if (yahooData && yahooData.length > 0) {
        // Cache search results for 1 hour
        await redisCache.set("search", query.toLowerCase(), yahooData, 3600);
        
        // Track cost
        await mongoDBService.trackCost("yahoo", "search", 1, 0, query);
        
        return { data: yahooData, source: "yahoo", fromCache: false };
      }
    } catch (error) {
      console.error(`Yahoo Finance search failed for ${query}:`, (error as Error).message);
    }

    // Fallback to Alpha Vantage
    if (this.alphaService.isAvailable()) {
      try {
        const alphaData = await this.alphaService.searchSymbols(query);
        if (alphaData && alphaData.length > 0) {
          // Cache search results
          await redisCache.set("search", query.toLowerCase(), alphaData, 3600);
          
          // Track cost
          await mongoDBService.trackCost("alpha_vantage", "search", 1, 0.01, query);
          
          return { data: alphaData, source: "alpha_vantage", fromCache: false };
        }
      } catch (error) {
        console.error(`Alpha Vantage search failed for ${query}:`, (error as Error).message);
      }
    }

    return { data: null, source: "yahoo", fromCache: false };
  }

  /**
   * Validate data quality across sources
   */
  async validateDataQuality(symbol: string): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
    dataAge?: number;
    source: string;
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Get current quote
      const quoteResult = await this.getQuote(symbol);
      
      if (!quoteResult.data) {
        issues.push("No current price data available");
        recommendations.push("Try a different symbol or check market hours");
        return { isValid: false, issues, recommendations, source: "none" };
      }

      const quote = quoteResult.data;
      const dataAge = Date.now() - quote.timestamp;
      const dataAgeMinutes = dataAge / (1000 * 60);

      // Check data freshness
      if (dataAgeMinutes > 60) {
        issues.push(`Data is ${Math.round(dataAgeMinutes)} minutes old`);
        if (dataAgeMinutes > 240) {
          recommendations.push("Data may be stale, consider using intraday data");
        }
      }

      // Check price validity
      if (quote.price <= 0) {
        issues.push("Invalid price data (price <= 0)");
      }

      // Check for extreme price changes
      if (Math.abs(quote.changePercent) > 20) {
        issues.push(`Extreme price change detected: ${quote.changePercent.toFixed(2)}%`);
        recommendations.push("Verify if this is a valid price movement or data error");
      }

      // Get historical data for additional validation
      const historicalResult = await this.getHistoricalData(symbol, "5d");
      
      if (historicalResult.data && historicalResult.data.length > 0) {
        const historical = historicalResult.data;
        
        // Check for data gaps
        if (historical.length < 3) {
          issues.push("Insufficient historical data for analysis");
          recommendations.push("Use a more actively traded symbol");
        }

        // Check for price consistency
        const latestHistorical = historical[0]; // Most recent
        const priceDifference = Math.abs(quote.price - latestHistorical.close) / latestHistorical.close;
        
        if (priceDifference > 0.1) { // 10% difference
          issues.push("Current price differs significantly from latest historical data");
          recommendations.push("Data sources may be inconsistent");
        }

        // Check for zero volume
        const recentVolumes = historical.slice(0, 3).map(h => h.volume);
        const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
        
        if (avgVolume === 0) {
          issues.push("No trading volume detected");
          recommendations.push("Symbol may not be actively traded");
        }
      } else {
        issues.push("No historical data available");
        recommendations.push("Analysis capabilities will be limited");
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations,
        dataAge: Math.round(dataAgeMinutes),
        source: quoteResult.source,
      };

    } catch (error) {
      issues.push(`Data validation failed: ${(error as Error).message}`);
      recommendations.push("Check network connection and try again");
      
      return { isValid: false, issues, recommendations, source: "error" };
    }
  }

  /**
   * Get service status and rate limits
   */
  async getServiceStatus(): Promise<{
    yahoo: {
      available: boolean;
      rateLimitStatus: ReturnType<YahooFinanceService['getRateLimitStatus']>;
    };
    alphaVantage: {
      available: boolean;
      rateLimitStatus: ReturnType<AlphaVantageService['getRateLimitStatus']>;
    };
    redis: {
      available: boolean;
      stats: Awaited<ReturnType<typeof redisCache.getStats>>;
    };
    mongodb: {
      available: boolean;
      stats: Awaited<ReturnType<typeof mongoDBService.getStats>>;
    };
  }> {
    return {
      yahoo: {
        available: true,
        rateLimitStatus: this.yahooService.getRateLimitStatus(),
      },
      alphaVantage: {
        available: this.alphaService.isAvailable(),
        rateLimitStatus: this.alphaService.getRateLimitStatus(),
      },
      redis: {
        available: redisCache.isAvailable(),
        stats: await redisCache.getStats(),
      },
      mongodb: {
        available: mongoDBService.isAvailable(),
        stats: await mongoDBService.getStats(),
      },
    };
  }
}

// Export singleton instance
export const dataAggregator = new DataAggregator();