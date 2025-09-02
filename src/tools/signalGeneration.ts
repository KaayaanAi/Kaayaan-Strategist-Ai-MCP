import { z } from "zod";
import { dataAggregator } from "../services/dataAggregator.js";
import { TechnicalIndicators } from "../services/technicalIndicators.js";
import { mongoDBService } from "../services/mongodb.js";
import { TimezoneUtils } from "../services/timezone.js";

const tradingSignalSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  timeframe: z.enum(["short", "medium", "long"]).default("medium"),
  risk_tolerance: z.enum(["conservative", "moderate", "aggressive"]).default("moderate"),
  include_stop_loss: z.boolean().default(true),
  include_take_profit: z.boolean().default(true),
  min_confidence: z.number().min(0).max(100).default(60),
});

type SignalType = "BUY" | "SELL" | "WAIT";
type SignalStrength = "strong" | "moderate" | "weak";
type TimeHorizon = "scalp" | "day" | "swing" | "position";

export async function generateTradingSignal(args: unknown) {
  const startTime = Date.now();
  
  try {
    // Validate input
    const { symbol, timeframe, risk_tolerance, include_stop_loss, include_take_profit, min_confidence } = 
      tradingSignalSchema.parse(args);

    // Determine analysis period based on timeframe
    const analysisConfig = {
      short: { period: "5d" as const, lookback: 10, horizon: "day" as TimeHorizon },
      medium: { period: "1mo" as const, lookback: 20, horizon: "swing" as TimeHorizon },
      long: { period: "3mo" as const, lookback: 50, horizon: "position" as TimeHorizon }
    };

    const config = analysisConfig[timeframe];

    // Get market data
    const historicalResult = await dataAggregator.getHistoricalData(symbol, config.period, "1d");
    
    if (!historicalResult.data || historicalResult.data.length < 10) {
      const errorResult = {
        success: false,
        error: "Insufficient market data for signal generation",
        symbol,
        recommendations: [
          "Verify the symbol exists and is actively traded",
          "Try a different timeframe",
          "Check if the symbol has sufficient trading history"
        ]
      };

      await mongoDBService.storeAnalysis(
        symbol,
        "trading_signal",
        { symbol, timeframe, risk_tolerance, min_confidence },
        errorResult,
        0,
        historicalResult.source,
        Date.now() - startTime
      );

      return {
        content: [{ 
          type: "text", 
          text: `❌ **Trading Signal Generation Failed**\n\n**Symbol:** ${symbol}\n**Error:** ${errorResult.error}\n\n**Recommendations:**\n${errorResult.recommendations.map(r => `• ${r}`).join('\n')}\n\n⚠️ **EDUCATIONAL PURPOSE ONLY - NOT FINANCIAL ADVICE**`
        }],
        isError: true
      };
    }

    const marketData = historicalResult.data.slice(0, config.lookback).reverse();
    
    // Get current price
    const quoteResult = await dataAggregator.getQuote(symbol);
    const currentPrice = quoteResult.data?.price || marketData[marketData.length - 1]?.close;
    const priceChange = quoteResult.data?.change || 0;
    const priceChangePercent = quoteResult.data?.changePercent || 0;

    if (!currentPrice) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ **Signal Generation Failed**\n\n**Symbol:** ${symbol}\n**Error:** Unable to determine current price\n\n⚠️ **EDUCATIONAL PURPOSE ONLY - NOT FINANCIAL ADVICE**`
        }],
        isError: true
      };
    }

    // Calculate comprehensive technical analysis
    const analysis = TechnicalIndicators.calculateComprehensiveAnalysis(marketData);
    
    // Generate signal based on multiple indicators
    let signal: SignalType = "WAIT";
    let signalStrength: SignalStrength = "weak";
    let bullishPoints = 0;
    let bearishPoints = 0;
    let totalIndicators = 0;

    const signalReasons: string[] = [];
    const warnings: string[] = [];

    // RSI Analysis
    if (analysis.rsi) {
      totalIndicators++;
      if (analysis.rsi.signal === "oversold" && analysis.rsi.strength !== "weak") {
        bullishPoints++;
        signalReasons.push(`RSI oversold (${analysis.rsi.rsi}) suggests potential buying opportunity`);
      } else if (analysis.rsi.signal === "overbought" && analysis.rsi.strength !== "weak") {
        bearishPoints++;
        signalReasons.push(`RSI overbought (${analysis.rsi.rsi}) suggests potential selling pressure`);
      }
      
      if (analysis.rsi.rsi > 80 || analysis.rsi.rsi < 20) {
        warnings.push("Extreme RSI levels detected - exercise caution");
      }
    }

    // MACD Analysis
    if (analysis.macd) {
      totalIndicators++;
      if (analysis.macd.crossover === "bullish" || (analysis.macd.trend === "bullish" && analysis.macd.histogram > 0)) {
        bullishPoints++;
        signalReasons.push("MACD showing bullish momentum");
      } else if (analysis.macd.crossover === "bearish" || (analysis.macd.trend === "bearish" && analysis.macd.histogram < 0)) {
        bearishPoints++;
        signalReasons.push("MACD showing bearish momentum");
      }
    }

    // Moving Average Analysis
    if (analysis.movingAverages) {
      totalIndicators++;
      if (analysis.movingAverages.trend === "uptrend" || analysis.movingAverages.crossover === "golden_cross") {
        bullishPoints++;
        signalReasons.push("Moving averages confirm upward trend");
      } else if (analysis.movingAverages.trend === "downtrend" || analysis.movingAverages.crossover === "death_cross") {
        bearishPoints++;
        signalReasons.push("Moving averages confirm downward trend");
      }
    }

    // Support/Resistance Analysis
    if (analysis.supportResistance) {
      const { currentLevel, support, resistance } = analysis.supportResistance;
      
      if (currentLevel === "above_resistance") {
        bullishPoints += 0.5;
        signalReasons.push("Price above key resistance levels");
      } else if (currentLevel === "below_support") {
        bearishPoints += 0.5;
        signalReasons.push("Price below key support levels");
        warnings.push("Price has broken below support - potential further decline");
      }

      // Check proximity to levels
      const nearestSupport = support.find((s: number) => s < currentPrice);
      const nearestResistance = resistance.find((r: number) => r > currentPrice);
      
      if (nearestSupport && ((currentPrice - nearestSupport) / currentPrice) < 0.02) {
        signalReasons.push("Price near strong support level");
      }
      
      if (nearestResistance && ((nearestResistance - currentPrice) / currentPrice) < 0.02) {
        warnings.push("Price approaching resistance - potential reversal zone");
      }
    }

    // Volatility Analysis
    if (analysis.volatility) {
      const priceRangePercent = (analysis.volatility / currentPrice) * 100;
      if (priceRangePercent > 5) {
        warnings.push("High volatility detected - increased risk");
      } else if (priceRangePercent < 1) {
        warnings.push("Low volatility - potential breakout ahead");
      }
    }

    // Determine signal
    const bullishRatio = totalIndicators > 0 ? bullishPoints / totalIndicators : 0;
    const bearishRatio = totalIndicators > 0 ? bearishPoints / totalIndicators : 0;

    let baseConfidence = analysis.confidence;

    // Adjust confidence based on risk tolerance
    const riskMultiplier = {
      conservative: 0.8,
      moderate: 1.0,
      aggressive: 1.2
    };
    
    const adjustedConfidence = Math.min(100, baseConfidence * riskMultiplier[risk_tolerance]);

    if (adjustedConfidence < min_confidence) {
      signal = "WAIT";
      signalStrength = "weak";
      signalReasons.push(`Confidence (${adjustedConfidence.toFixed(1)}%) below minimum threshold (${min_confidence}%)`);
    } else if (bullishRatio > 0.6) {
      signal = "BUY";
      signalStrength = bullishRatio > 0.8 ? "strong" : "moderate";
    } else if (bearishRatio > 0.6) {
      signal = "SELL";
      signalStrength = bearishRatio > 0.8 ? "strong" : "moderate";
    } else {
      signal = "WAIT";
      signalStrength = "weak";
      signalReasons.push("Mixed signals - no clear directional bias");
    }

    // Calculate stop loss and take profit levels
    let stopLoss: number | null = null;
    let takeProfit: number | null = null;
    let riskRewardRatio: number | null = null;

    if (signal !== "WAIT" && analysis.volatility) {
      const volatilityMultiplier = risk_tolerance === "conservative" ? 1.5 : risk_tolerance === "moderate" ? 2.0 : 2.5;
      const stopDistance = analysis.volatility * volatilityMultiplier;

      if (include_stop_loss) {
        stopLoss = signal === "BUY" 
          ? Number((currentPrice - stopDistance).toFixed(4))
          : Number((currentPrice + stopDistance).toFixed(4));
      }

      if (include_take_profit) {
        const profitMultiplier = risk_tolerance === "conservative" ? 1.5 : risk_tolerance === "moderate" ? 2.0 : 3.0;
        takeProfit = signal === "BUY" 
          ? Number((currentPrice + (stopDistance * profitMultiplier)).toFixed(4))
          : Number((currentPrice - (stopDistance * profitMultiplier)).toFixed(4));
      }

      if (stopLoss && takeProfit) {
        const riskAmount = Math.abs(currentPrice - stopLoss);
        const rewardAmount = Math.abs(takeProfit - currentPrice);
        riskRewardRatio = Number((rewardAmount / riskAmount).toFixed(2));
      }
    }

    // Create signal result
    const signalResult = {
      symbol,
      signal,
      strength: signalStrength,
      confidence: Number(adjustedConfidence.toFixed(1)),
      current_price: currentPrice,
      price_change: priceChange,
      price_change_percent: priceChangePercent,
      timeframe,
      time_horizon: config.horizon,
      risk_tolerance,
      analysis_summary: {
        bullish_indicators: bullishPoints,
        bearish_indicators: bearishPoints,
        total_indicators: totalIndicators,
        overall_trend: analysis.overallTrend
      },
      levels: {
        stop_loss: stopLoss,
        take_profit: takeProfit,
        risk_reward_ratio: riskRewardRatio,
        support_levels: analysis.supportResistance?.support.slice(0, 2) || [],
        resistance_levels: analysis.supportResistance?.resistance.slice(0, 2) || []
      },
      technical_indicators: {
        rsi: analysis.rsi,
        macd: analysis.macd,
        moving_averages: analysis.movingAverages,
        volatility: analysis.volatility
      },
      reasons: signalReasons,
      warnings: warnings,
      data_quality: {
        source: historicalResult.source,
        from_cache: historicalResult.fromCache,
        data_points: marketData.length
      },
      timestamp: TimezoneUtils.createAnalysisTimestamp()
    };

    // Store analysis
    await mongoDBService.storeAnalysis(
      symbol,
      "trading_signal",
      { symbol, timeframe, risk_tolerance, min_confidence },
      signalResult,
      adjustedConfidence,
      historicalResult.source,
      Date.now() - startTime
    );

    // Format response
    const signalEmoji = signal === "BUY" ? "🟢" : signal === "SELL" ? "🔴" : "🟡";
    const strengthEmoji = signalStrength === "strong" ? "💪" : signalStrength === "moderate" ? "👍" : "🤏";
    
    let responseText = `${signalEmoji} **TRADING SIGNAL: ${signal}** ${strengthEmoji}\n\n`;
    responseText += `**${symbol}** • ${signalResult.timestamp.timestamp} (${signalResult.timestamp.timezone})\n`;
    responseText += `Current: **$${currentPrice.toFixed(4)}** (${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)\n\n`;

    responseText += `**📊 Signal Details**\n`;
    responseText += `• Action: **${signal}**\n`;
    responseText += `• Strength: **${signalStrength.toUpperCase()}**\n`;
    responseText += `• Confidence: **${adjustedConfidence.toFixed(1)}%**\n`;
    responseText += `• Timeframe: **${timeframe.toUpperCase()}** (${config.horizon})\n`;
    responseText += `• Risk Profile: **${risk_tolerance.toUpperCase()}**\n\n`;

    // Signal levels
    if (stopLoss || takeProfit) {
      responseText += `**🎯 Suggested Levels**\n`;
      if (stopLoss) responseText += `• Stop Loss: **$${stopLoss.toFixed(4)}**\n`;
      if (takeProfit) responseText += `• Take Profit: **$${takeProfit.toFixed(4)}**\n`;
      if (riskRewardRatio) responseText += `• Risk/Reward: **1:${riskRewardRatio}**\n`;
      responseText += '\n';
    }

    // Key levels
    if (signalResult.levels.support_levels.length > 0 || signalResult.levels.resistance_levels.length > 0) {
      responseText += `**📍 Key Levels**\n`;
      if (signalResult.levels.resistance_levels.length > 0) {
        responseText += `• Resistance: ${signalResult.levels.resistance_levels.map((r: number) => `$${r.toFixed(4)}`).join(', ')}\n`;
      }
      if (signalResult.levels.support_levels.length > 0) {
        responseText += `• Support: ${signalResult.levels.support_levels.map((s: number) => `$${s.toFixed(4)}`).join(', ')}\n`;
      }
      responseText += '\n';
    }

    // Analysis reasons
    if (signalReasons.length > 0) {
      responseText += `**📈 Analysis**\n`;
      signalReasons.slice(0, 4).forEach(reason => {
        responseText += `• ${reason}\n`;
      });
      responseText += '\n';
    }

    // Warnings
    if (warnings.length > 0) {
      responseText += `**⚠️ Risk Factors**\n`;
      warnings.forEach(warning => {
        responseText += `• ${warning}\n`;
      });
      responseText += '\n';
    }

    // Data quality
    responseText += `**📋 Analysis Data**\n`;
    responseText += `• Source: ${historicalResult.source} ${historicalResult.fromCache ? '(cached)' : '(fresh)'}\n`;
    responseText += `• Indicators: ${signalResult.analysis_summary.bullish_indicators} bullish, ${signalResult.analysis_summary.bearish_indicators} bearish\n`;
    responseText += `• Data Points: ${marketData.length}\n\n`;

    responseText += `🚨 **IMPORTANT DISCLAIMER**\n`;
    responseText += `This is an educational analysis tool providing systematic signal generation based on technical indicators. `;
    responseText += `**NOT FINANCIAL ADVICE.** Always conduct your own research and consider your risk tolerance before making any investment decisions. `;
    responseText += `Past performance does not guarantee future results.`;

    return {
      content: [{ type: "text", text: responseText }]
    };

  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      
      return {
        content: [{ 
          type: "text", 
          text: `❌ **Input Validation Error**\n\nInvalid parameters: ${validationErrors}\n\n**Expected:**\n• symbol: 1-10 character stock symbol\n• timeframe: "short", "medium", or "long"\n• risk_tolerance: "conservative", "moderate", or "aggressive"\n• include_stop_loss: true/false\n• include_take_profit: true/false\n• min_confidence: 0-100\n\n⚠️ **EDUCATIONAL PURPOSE ONLY - NOT FINANCIAL ADVICE**`
        }],
        isError: true
      };
    }

    return {
      content: [{ 
        type: "text", 
        text: `❌ **Trading Signal Generation Error**\n\nSignal generation failed: ${(error as Error).message}\n\nPlease verify the symbol and try again.\n\n⚠️ **EDUCATIONAL PURPOSE ONLY - NOT FINANCIAL ADVICE**`
      }],
      isError: true
    };
  }
}