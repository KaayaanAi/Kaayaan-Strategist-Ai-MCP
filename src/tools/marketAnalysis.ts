import { z } from "zod";
import { dataAggregator } from "../services/dataAggregator.js";
import { TechnicalIndicators } from "../services/technicalIndicators.js";
import { mongoDBService } from "../services/mongodb.js";
import { TimezoneUtils } from "../services/timezone.js";

const marketAnalysisSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  period: z.enum(["1d", "5d", "1mo", "3mo", "6mo", "1y"]).default("1mo"),
  include_support_resistance: z.boolean().default(true),
  include_volatility: z.boolean().default(true),
  lookback_days: z.number().min(5).max(100).default(20),
});

export async function analyzeMarketStructure(args: unknown) {
  const startTime = Date.now();
  
  try {
    // Validate input
    const { symbol, period, include_support_resistance, include_volatility, lookback_days } = 
      marketAnalysisSchema.parse(args);

    // Get historical data
    const historicalResult = await dataAggregator.getHistoricalData(symbol, period, "1d");
    
    if (!historicalResult.data || historicalResult.data.length === 0) {
      const errorResult = {
        success: false,
        error: "No market data available for analysis",
        symbol,
        recommendations: [
          "Verify the symbol exists and is actively traded",
          "Check if markets are open",
          "Try a different time period"
        ]
      };

      // Store failed analysis
      await mongoDBService.storeAnalysis(
        symbol,
        "market_structure",
        { symbol, period, include_support_resistance, include_volatility, lookback_days },
        errorResult,
        0,
        historicalResult.source === "cached" ? "cached" : historicalResult.source,
        Date.now() - startTime
      );

      return {
        content: [{ 
          type: "text", 
          text: `❌ **Market Structure Analysis Failed**\n\n**Symbol:** ${symbol}\n**Error:** ${errorResult.error}\n\n**Recommendations:**\n${errorResult.recommendations.map(r => `• ${r}`).join('\n')}\n\n*This is an educational analysis tool. Not financial advice.*`
        }],
        isError: true
      };
    }

    const marketData = historicalResult.data;
    
    // Limit data to lookback period
    const analysisData = marketData.slice(0, lookback_days).reverse(); // Reverse to chronological order

    // Get current quote for context
    const quoteResult = await dataAggregator.getQuote(symbol);
    const currentPrice = quoteResult.data?.price || analysisData[analysisData.length - 1]?.close;

    if (!currentPrice) {
      const errorResult = {
        success: false,
        error: "Unable to determine current price",
        symbol
      };

      await mongoDBService.storeAnalysis(
        symbol,
        "market_structure",
        { symbol, period, include_support_resistance, include_volatility, lookback_days },
        errorResult,
        0,
        historicalResult.source,
        Date.now() - startTime
      );

      return {
        content: [{ 
          type: "text", 
          text: `❌ **Market Structure Analysis Failed**\n\n**Symbol:** ${symbol}\n**Error:** Unable to determine current price\n\n*This is an educational analysis tool. Not financial advice.*`
        }],
        isError: true
      };
    }

    // Calculate trend analysis
    const movingAverages = TechnicalIndicators.calculateMovingAverages(analysisData, 20, 50);
    
    // Calculate support and resistance if requested
    let supportResistance = null;
    if (include_support_resistance) {
      supportResistance = TechnicalIndicators.calculateSupportResistance(analysisData, Math.min(lookback_days, 20));
    }

    // Calculate volatility if requested
    let volatility = null;
    if (include_volatility) {
      volatility = TechnicalIndicators.calculateVolatility(analysisData, 14);
    }

    // Calculate price levels
    const priceData = analysisData.map(d => d.close);
    const highPrice = Math.max(...priceData);
    const lowPrice = Math.min(...priceData);
    const priceRange = highPrice - lowPrice;
    const currentPositionInRange = ((currentPrice - lowPrice) / priceRange) * 100;

    // Market structure analysis
    const analysis = {
      symbol,
      current_price: currentPrice,
      analysis_period: period,
      data_points: analysisData.length,
      lookback_days,
      price_levels: {
        current: currentPrice,
        high: highPrice,
        low: lowPrice,
        range: Number(priceRange.toFixed(4)),
        position_in_range_percent: Number(currentPositionInRange.toFixed(1))
      },
      trend_analysis: movingAverages ? {
        short_term_sma: movingAverages.sma,
        short_term_ema: movingAverages.ema,
        trend: movingAverages.trend,
        crossover: movingAverages.crossover,
        price_vs_sma: currentPrice > movingAverages.sma ? "above" : "below",
        price_vs_ema: currentPrice > movingAverages.ema ? "above" : "below"
      } : null,
      support_resistance: supportResistance ? {
        support_levels: supportResistance.support,
        resistance_levels: supportResistance.resistance,
        current_level: supportResistance.currentLevel,
        nearest_support: supportResistance.support.find(s => s < currentPrice),
        nearest_resistance: supportResistance.resistance.find(r => r > currentPrice)
      } : null,
      volatility_analysis: volatility ? {
        average_true_range: volatility,
        volatility_level: volatility > (priceRange * 0.02) ? "high" : volatility > (priceRange * 0.01) ? "moderate" : "low"
      } : null,
      market_structure: {
        phase: currentPositionInRange > 75 ? "distribution" : currentPositionInRange < 25 ? "accumulation" : "markup",
        strength: movingAverages?.trend === "uptrend" ? "bullish" : movingAverages?.trend === "downtrend" ? "bearish" : "neutral"
      },
      data_quality: {
        source: historicalResult.source,
        from_cache: historicalResult.fromCache,
        data_age_minutes: historicalResult.fromCache ? "cached" : "fresh",
        completeness: (analysisData.length / lookback_days) * 100
      },
      timestamp: TimezoneUtils.createAnalysisTimestamp()
    };

    // Calculate confidence score
    let confidence = 70; // Base confidence
    if (analysis.data_quality.completeness > 90) confidence += 10;
    if (analysisData.length >= 20) confidence += 10;
    if (volatility && volatility > 0) confidence += 5;
    if (supportResistance && (supportResistance.support.length > 0 || supportResistance.resistance.length > 0)) confidence += 5;

    // Store successful analysis
    await mongoDBService.storeAnalysis(
      symbol,
      "market_structure",
      { symbol, period, include_support_resistance, include_volatility, lookback_days },
      analysis,
      confidence,
      historicalResult.source,
      Date.now() - startTime
    );

    // Format response
    let responseText = `📊 **Market Structure Analysis**\n\n`;
    responseText += `**${symbol}** • ${analysis.timestamp.timestamp} (${analysis.timestamp.timezone})\n`;
    responseText += `Current Price: **$${currentPrice.toFixed(4)}**\n\n`;

    // Price levels
    responseText += `**📈 Price Levels**\n`;
    responseText += `• High: $${highPrice.toFixed(4)}\n`;
    responseText += `• Low: $${lowPrice.toFixed(4)}\n`;
    responseText += `• Range: $${priceRange.toFixed(4)}\n`;
    responseText += `• Position: ${currentPositionInRange.toFixed(1)}% of range\n\n`;

    // Trend analysis
    if (movingAverages) {
      responseText += `**📊 Trend Analysis**\n`;
      responseText += `• Trend: **${movingAverages.trend.toUpperCase()}**\n`;
      responseText += `• SMA (20): $${movingAverages.sma.toFixed(4)}\n`;
      responseText += `• EMA (20): $${movingAverages.ema.toFixed(4)}\n`;
      if (movingAverages.crossover && movingAverages.crossover !== "none") {
        responseText += `• Signal: **${movingAverages.crossover.toUpperCase().replace('_', ' ')}** ⚠️\n`;
      }
      responseText += '\n';
    }

    // Support and resistance
    if (supportResistance) {
      responseText += `**🎯 Support & Resistance**\n`;
      if (supportResistance.resistance.length > 0) {
        responseText += `• Resistance: ${supportResistance.resistance.slice(0, 3).map(r => `$${r.toFixed(4)}`).join(', ')}\n`;
      }
      if (supportResistance.support.length > 0) {
        responseText += `• Support: ${supportResistance.support.slice(0, 3).map(s => `$${s.toFixed(4)}`).join(', ')}\n`;
      }
      responseText += `• Position: **${supportResistance.currentLevel.replace('_', ' ').toUpperCase()}**\n\n`;
    }

    // Volatility
    if (volatility) {
      responseText += `**⚡ Volatility**\n`;
      responseText += `• ATR: $${volatility.toFixed(4)}\n`;
      responseText += `• Level: **${analysis.volatility_analysis?.volatility_level.toUpperCase()}**\n\n`;
    }

    // Market structure
    responseText += `**🏗️ Market Structure**\n`;
    responseText += `• Phase: **${analysis.market_structure.phase.toUpperCase()}**\n`;
    responseText += `• Strength: **${analysis.market_structure.strength.toUpperCase()}**\n\n`;

    // Data quality
    responseText += `**📋 Data Quality**\n`;
    responseText += `• Source: ${historicalResult.source} ${historicalResult.fromCache ? '(cached)' : '(fresh)'}\n`;
    responseText += `• Completeness: ${analysis.data_quality.completeness.toFixed(1)}%\n`;
    responseText += `• Confidence: **${confidence}%**\n\n`;

    responseText += `*📚 Educational analysis tool. Analysis period: ${period} (${analysisData.length} data points). Not financial advice.*`;

    return {
      content: [{ type: "text", text: responseText }]
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      
      return {
        content: [{ 
          type: "text", 
          text: `❌ **Input Validation Error**\n\nInvalid parameters: ${validationErrors}\n\n**Expected:**\n• symbol: 1-10 character stock symbol\n• period: "1d", "5d", "1mo", "3mo", "6mo", or "1y"\n• include_support_resistance: true/false\n• include_volatility: true/false\n• lookback_days: 5-100 days\n\n*This is an educational analysis tool. Not financial advice.*`
        }],
        isError: true
      };
    }

    return {
      content: [{ 
        type: "text", 
        text: `❌ **Market Structure Analysis Error**\n\nAnalysis failed: ${(error as Error).message}\n\nPlease verify the symbol and try again.\n\n*This is an educational analysis tool. Not financial advice.*`
      }],
      isError: true
    };
  }
}