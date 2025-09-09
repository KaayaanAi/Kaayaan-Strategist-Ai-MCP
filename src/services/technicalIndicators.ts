import type { MarketData } from "./yahooFinance.js";

export interface IndicatorResult {
  value: number;
  timestamp: number;
}

export interface RSIResult {
  rsi: number;
  signal: "oversold" | "overbought" | "neutral";
  strength: "strong" | "moderate" | "weak";
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  crossover: "bullish" | "bearish" | "none";
  trend: "bullish" | "bearish" | "sideways";
}

export interface MovingAverageResult {
  sma: number;
  ema: number;
  trend: "uptrend" | "downtrend" | "sideways";
  crossover?: "golden_cross" | "death_cross" | "none";
}

export class TechnicalIndicators {
  
  /**
   * Calculate Simple Moving Average (SMA) with input validation
   */
  static calculateSMA(data: MarketData[], period: number): IndicatorResult[] {
    // Input validation
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }
    
    if (!Number.isInteger(period) || period <= 0 || period > data.length) {
      return [];
    }
    
    // Validate data integrity
    const validData = data.filter(d => 
      d && 
      typeof d.close === 'number' && 
      isFinite(d.close) && 
      d.close > 0 &&
      typeof d.timestamp === 'number' &&
      isFinite(d.timestamp)
    );
    
    if (validData.length < period) {
      return [];
    }

    const results: IndicatorResult[] = [];
    
    for (let i = period - 1; i < validData.length; i++) {
      let sum = 0;
      let validPrices = 0;
      
      for (let j = i - period + 1; j <= i; j++) {
        const price = validData[j].close;
        if (isFinite(price) && price > 0) {
          sum += price;
          validPrices++;
        }
      }
      
      // Only calculate if we have enough valid prices
      if (validPrices >= Math.floor(period * 0.8)) { // Allow 20% missing data
        const smaValue = sum / validPrices;
        if (isFinite(smaValue) && smaValue > 0) {
          results.push({
            value: smaValue,
            timestamp: validData[i].timestamp,
          });
        }
      }
    }

    return results;
  }

  /**
   * Calculate Exponential Moving Average (EMA)
   */
  static calculateEMA(data: MarketData[], period: number): IndicatorResult[] {
    if (data.length < period) {
      return [];
    }

    const results: IndicatorResult[] = [];
    const multiplier = 2 / (period + 1);
    
    // First EMA is SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i].close;
    }
    let ema = sum / period;
    
    results.push({
      value: ema,
      timestamp: data[period - 1].timestamp,
    });

    // Calculate subsequent EMAs
    for (let i = period; i < data.length; i++) {
      ema = (data[i].close - ema) * multiplier + ema;
      results.push({
        value: ema,
        timestamp: data[i].timestamp,
      });
    }

    return results;
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  static calculateRSI(data: MarketData[], period: number = 14): RSIResult | null {
    if (data.length < period + 1) {
      return null;
    }

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain and loss
    for (let i = 1; i <= period; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Calculate RSI for subsequent periods using smoothed averages
    for (let i = period + 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) {
      return { rsi: 100, signal: "overbought", strength: "strong" };
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    // Determine signal
    let signal: RSIResult['signal'] = "neutral";
    let strength: RSIResult['strength'] = "weak";

    if (rsi > 70) {
      signal = "overbought";
      strength = rsi > 80 ? "strong" : "moderate";
    } else if (rsi < 30) {
      signal = "oversold";
      strength = rsi < 20 ? "strong" : "moderate";
    } else if (rsi > 60 || rsi < 40) {
      strength = "moderate";
    }

    return { rsi: Number(rsi.toFixed(2)), signal, strength };
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  static calculateMACD(data: MarketData[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): MACDResult | null {
    if (data.length < slowPeriod) {
      return null;
    }

    const fastEMA = this.calculateEMA(data, fastPeriod);
    const slowEMA = this.calculateEMA(data, slowPeriod);

    if (fastEMA.length === 0 || slowEMA.length === 0) {
      return null;
    }

    // Calculate MACD line
    const macdData: MarketData[] = [];
    const minLength = Math.min(fastEMA.length, slowEMA.length);
    
    for (let i = 0; i < minLength; i++) {
      const macdValue = fastEMA[fastEMA.length - minLength + i].value - slowEMA[slowEMA.length - minLength + i].value;
      macdData.push({
        symbol: data[0].symbol,
        timestamp: fastEMA[fastEMA.length - minLength + i].timestamp,
        open: 0, high: 0, low: 0,
        close: macdValue,
        volume: 0,
        source: data[0].source,
      });
    }

    if (macdData.length < signalPeriod) {
      return null;
    }

    // Calculate signal line (EMA of MACD)
    const signalEMA = this.calculateEMA(macdData, signalPeriod);
    
    if (signalEMA.length === 0) {
      return null;
    }

    const latestMacd = macdData[macdData.length - 1].close;
    const latestSignal = signalEMA[signalEMA.length - 1].value;
    const histogram = latestMacd - latestSignal;

    // Determine crossover
    let crossover: MACDResult['crossover'] = "none";
    if (macdData.length >= 2 && signalEMA.length >= 2) {
      const prevMacd = macdData[macdData.length - 2].close;
      const prevSignal = signalEMA[signalEMA.length - 2].value;
      
      if (prevMacd <= prevSignal && latestMacd > latestSignal) {
        crossover = "bullish";
      } else if (prevMacd >= prevSignal && latestMacd < latestSignal) {
        crossover = "bearish";
      }
    }

    // Determine trend
    let trend: MACDResult['trend'] = "sideways";
    if (latestMacd > 0 && histogram > 0) {
      trend = "bullish";
    } else if (latestMacd < 0 && histogram < 0) {
      trend = "bearish";
    }

    return {
      macd: Number(latestMacd.toFixed(4)),
      signal: Number(latestSignal.toFixed(4)),
      histogram: Number(histogram.toFixed(4)),
      crossover,
      trend,
    };
  }

  /**
   * Calculate Moving Average analysis with trend and crossovers
   */
  static calculateMovingAverages(data: MarketData[], shortPeriod: number = 20, longPeriod: number = 50): MovingAverageResult | null {
    if (data.length < longPeriod) {
      return null;
    }

    const shortSMA = this.calculateSMA(data, shortPeriod);
    const shortEMA = this.calculateEMA(data, shortPeriod);
    const longSMA = this.calculateSMA(data, longPeriod);

    if (shortSMA.length === 0 || shortEMA.length === 0 || longSMA.length === 0) {
      return null;
    }

    const latestShortSMA = shortSMA[shortSMA.length - 1].value;
    const latestShortEMA = shortEMA[shortEMA.length - 1].value;
    const latestLongSMA = longSMA[longSMA.length - 1].value;
    const currentPrice = data[data.length - 1].close;

    // Determine trend
    let trend: MovingAverageResult['trend'] = "sideways";
    if (currentPrice > latestShortSMA && latestShortSMA > latestLongSMA) {
      trend = "uptrend";
    } else if (currentPrice < latestShortSMA && latestShortSMA < latestLongSMA) {
      trend = "downtrend";
    }

    // Check for crossovers
    let crossover: MovingAverageResult['crossover'] = "none";
    if (shortSMA.length >= 2 && longSMA.length >= 2) {
      const prevShortSMA = shortSMA[shortSMA.length - 2].value;
      const prevLongSMA = longSMA[longSMA.length - 2].value;
      
      if (prevShortSMA <= prevLongSMA && latestShortSMA > latestLongSMA) {
        crossover = "golden_cross";
      } else if (prevShortSMA >= prevLongSMA && latestShortSMA < latestLongSMA) {
        crossover = "death_cross";
      }
    }

    return {
      sma: Number(latestShortSMA.toFixed(4)),
      ema: Number(latestShortEMA.toFixed(4)),
      trend,
      crossover,
    };
  }

  /**
   * Calculate support and resistance levels
   */
  static calculateSupportResistance(data: MarketData[], lookbackPeriod: number = 20): {
    support: number[];
    resistance: number[];
    currentLevel: "above_resistance" | "below_support" | "between_levels";
  } | null {
    if (data.length < lookbackPeriod) {
      return null;
    }

    const recentData = data.slice(-lookbackPeriod);
    const highs = recentData.map(d => d.high).sort((a, b) => b - a);
    const lows = recentData.map(d => d.low).sort((a, b) => a - b);
    
    // Find resistance levels (significant highs)
    const resistance: number[] = [];
    const resistanceThreshold = 0.002; // 0.2% threshold
    
    for (const high of highs.slice(0, 5)) { // Top 5 highs
      const isDuplicate = resistance.some(r => Math.abs(r - high) / high < resistanceThreshold);
      if (!isDuplicate) {
        resistance.push(high);
      }
    }

    // Find support levels (significant lows)
    const support: number[] = [];
    
    for (const low of lows.slice(0, 5)) { // Bottom 5 lows
      const isDuplicate = support.some(s => Math.abs(s - low) / low < resistanceThreshold);
      if (!isDuplicate) {
        support.push(low);
      }
    }

    const currentPrice = data[data.length - 1].close;
    const nearestResistance = resistance.find((r: number) => r > currentPrice);
    const nearestSupport = support.find((s: number) => s < currentPrice);

    let currentLevel: "above_resistance" | "below_support" | "between_levels" = "between_levels";
    
    if (nearestResistance && !nearestSupport) {
      currentLevel = "below_support";
    } else if (!nearestResistance && nearestSupport) {
      currentLevel = "above_resistance";
    }

    return {
      support: support.slice(0, 3), // Top 3 support levels
      resistance: resistance.slice(0, 3), // Top 3 resistance levels
      currentLevel,
    };
  }

  /**
   * Calculate volatility (Average True Range)
   */
  static calculateVolatility(data: MarketData[], period: number = 14): number | null {
    if (data.length < period + 1) {
      return null;
    }

    const trueRanges: number[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];
      
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    if (trueRanges.length < period) {
      return null;
    }

    // Calculate Average True Range
    const recentTrueRanges = trueRanges.slice(-period);
    const atr = recentTrueRanges.reduce((sum, tr) => sum + tr, 0) / period;
    
    return Number(atr.toFixed(4));
  }

  /**
   * Calculate comprehensive technical analysis
   */
  static calculateComprehensiveAnalysis(data: MarketData[]): {
    rsi: RSIResult | null;
    macd: MACDResult | null;
    movingAverages: MovingAverageResult | null;
    supportResistance: ReturnType<typeof TechnicalIndicators.calculateSupportResistance>;
    volatility: number | null;
    overallTrend: "bullish" | "bearish" | "neutral";
    confidence: number;
  } {
    const rsi = this.calculateRSI(data);
    const macd = this.calculateMACD(data);
    const movingAverages = this.calculateMovingAverages(data);
    const supportResistance = this.calculateSupportResistance(data);
    const volatility = this.calculateVolatility(data);

    // Calculate overall trend and confidence
    let bullishSignals = 0;
    let bearishSignals = 0;
    let totalSignals = 0;

    // RSI signals
    if (rsi) {
      totalSignals++;
      if (rsi.signal === "oversold") bullishSignals++;
      if (rsi.signal === "overbought") bearishSignals++;
    }

    // MACD signals
    if (macd) {
      totalSignals++;
      if (macd.trend === "bullish" || macd.crossover === "bullish") bullishSignals++;
      if (macd.trend === "bearish" || macd.crossover === "bearish") bearishSignals++;
    }

    // Moving average signals
    if (movingAverages) {
      totalSignals++;
      if (movingAverages.trend === "uptrend" || movingAverages.crossover === "golden_cross") bullishSignals++;
      if (movingAverages.trend === "downtrend" || movingAverages.crossover === "death_cross") bearishSignals++;
    }

    let overallTrend: "bullish" | "bearish" | "neutral" = "neutral";
    let confidence = 0;

    if (totalSignals > 0) {
      const bullishRatio = bullishSignals / totalSignals;
      const bearishRatio = bearishSignals / totalSignals;
      
      if (bullishRatio > 0.6) {
        overallTrend = "bullish";
        confidence = bullishRatio;
      } else if (bearishRatio > 0.6) {
        overallTrend = "bearish";
        confidence = bearishRatio;
      } else {
        confidence = Math.abs(bullishRatio - bearishRatio);
      }
    }

    return {
      rsi,
      macd,
      movingAverages,
      supportResistance,
      volatility,
      overallTrend,
      confidence: Number((confidence * 100).toFixed(1)),
    };
  }
}