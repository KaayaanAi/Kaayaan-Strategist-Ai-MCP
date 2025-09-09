import { z } from "zod";
import { dataAggregator } from "../services/dataAggregator.js";
import { TechnicalIndicators } from "../services/technicalIndicators.js";
import { mongoDBService } from "../services/mongodb.js";
import { TimezoneUtils } from "../services/timezone.js";

const indicatorsSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  indicators: z.array(z.enum(["rsi", "macd", "sma", "ema", "all"])).default(["all"]),
  period: z.enum(["1d", "5d", "1mo", "3mo", "6mo", "1y"]).default("1mo"),
  rsi_period: z.number().min(5).max(50).default(14),
  macd_fast: z.number().min(5).max(30).default(12),
  macd_slow: z.number().min(20).max(50).default(26),
  macd_signal: z.number().min(5).max(20).default(9),
  sma_period: z.number().min(5).max(200).default(20),
  ema_period: z.number().min(5).max(200).default(20),
  include_interpretation: z.boolean().default(true),
});

export async function calculateIndicators(args: unknown) {
  const startTime = Date.now();
  
  try {
    // Validate input
    const { 
      symbol, 
      indicators, 
      period, 
      rsi_period, 
      macd_fast, 
      macd_slow, 
      macd_signal,
      sma_period,
      ema_period,
      include_interpretation 
    } = indicatorsSchema.parse(args);

    // Handle "all" indicators
    const requestedIndicators = indicators.includes("all") 
      ? ["rsi", "macd", "sma", "ema"] 
      : indicators.filter(i => i !== "all");

    // Get historical data
    const historicalResult = await dataAggregator.getHistoricalData(symbol, period, "1d");
    
    if (!historicalResult.data || historicalResult.data.length === 0) {
      const errorResult = {
        success: false,
        error: "No market data available for indicator calculations",
        symbol,
        requested_indicators: requestedIndicators
      };

      await mongoDBService.storeAnalysis(
        symbol,
        "technical_indicators",
        { symbol, indicators: requestedIndicators, period },
        errorResult,
        0,
        historicalResult.source,
        Date.now() - startTime
      );

      return {
        content: [{ 
          type: "text", 
          text: `❌ **Technical Indicators Calculation Failed**\n\n**Symbol:** ${symbol}\n**Error:** No market data available\n\n**Requested Indicators:** ${requestedIndicators.join(', ').toUpperCase()}\n\n**Recommendations:**\n• Verify the symbol exists and is actively traded\n• Try a different time period\n• Check if markets are open\n\n*📚 Educational analysis tool. Not financial advice.*`
        }],
        isError: true
      };
    }

    const marketData = historicalResult.data.reverse(); // Convert to chronological order
    const currentPrice = marketData[marketData.length - 1].close;

    // Calculate requested indicators
    const results: any = {
      symbol,
      current_price: currentPrice,
      period,
      data_points: marketData.length,
      calculated_indicators: {},
      interpretations: {},
    };

    let confidence = 80; // Base confidence
    const calculationErrors: string[] = [];

    // RSI Calculation
    if (requestedIndicators.includes("rsi")) {
      const rsi = TechnicalIndicators.calculateRSI(marketData, rsi_period);
      if (rsi) {
        results.calculated_indicators.rsi = {
          value: rsi.rsi,
          period: rsi_period,
          signal: rsi.signal,
          strength: rsi.strength,
          raw_data: {
            current: rsi.rsi,
            overbought_threshold: 70,
            oversold_threshold: 30,
          }
        };

        if (include_interpretation) {
          let interpretation = `RSI (${rsi_period}-period) is currently ${rsi.rsi.toFixed(2)}, indicating `;
          if (rsi.signal === "overbought") {
            interpretation += `**overbought conditions**. The asset may be due for a pullback or consolidation. `;
            interpretation += rsi.strength === "strong" ? "Strong overbought signal." : "Moderate overbought conditions.";
          } else if (rsi.signal === "oversold") {
            interpretation += `**oversold conditions**. The asset may be due for a bounce or reversal. `;
            interpretation += rsi.strength === "strong" ? "Strong oversold signal." : "Moderate oversold conditions.";
          } else {
            interpretation += `**neutral momentum**. No clear overbought or oversold conditions.`;
          }
          
          results.interpretations.rsi = interpretation;
        }
      } else {
        calculationErrors.push("RSI calculation failed - insufficient data");
        confidence -= 10;
      }
    }

    // MACD Calculation
    if (requestedIndicators.includes("macd")) {
      const macd = TechnicalIndicators.calculateMACD(marketData, macd_fast, macd_slow, macd_signal);
      if (macd) {
        results.calculated_indicators.macd = {
          macd_line: macd.macd,
          signal_line: macd.signal,
          histogram: macd.histogram,
          parameters: {
            fast_period: macd_fast,
            slow_period: macd_slow,
            signal_period: macd_signal
          },
          crossover: macd.crossover,
          trend: macd.trend,
          raw_data: {
            above_signal: macd.macd > macd.signal,
            histogram_positive: macd.histogram > 0,
            macd_above_zero: macd.macd > 0
          }
        };

        if (include_interpretation) {
          let interpretation = `MACD (${macd_fast},${macd_slow},${macd_signal}) shows `;
          
          if (macd.crossover === "bullish") {
            interpretation += `**bullish crossover** - MACD line has crossed above the signal line, suggesting upward momentum.`;
          } else if (macd.crossover === "bearish") {
            interpretation += `**bearish crossover** - MACD line has crossed below the signal line, suggesting downward momentum.`;
          } else {
            interpretation += `**${macd.trend} trend** with histogram ${macd.histogram > 0 ? 'positive' : 'negative'}. `;
            interpretation += macd.macd > macd.signal ? "MACD above signal line." : "MACD below signal line.";
          }

          results.interpretations.macd = interpretation;
        }
      } else {
        calculationErrors.push("MACD calculation failed - insufficient data");
        confidence -= 10;
      }
    }

    // SMA Calculation
    if (requestedIndicators.includes("sma")) {
      const sma = TechnicalIndicators.calculateSMA(marketData, sma_period);
      if (sma.length > 0) {
        const latestSMA = sma[sma.length - 1].value;
        const priceVsSMA = currentPrice > latestSMA ? "above" : "below";
        const percentage = ((currentPrice - latestSMA) / latestSMA * 100);

        results.calculated_indicators.sma = {
          value: Number(latestSMA.toFixed(4)),
          period: sma_period,
          price_position: priceVsSMA,
          percentage_difference: Number(percentage.toFixed(2)),
          raw_data: {
            current_price: currentPrice,
            sma_value: latestSMA,
            price_above_sma: currentPrice > latestSMA
          }
        };

        if (include_interpretation) {
          let interpretation = `Simple Moving Average (${sma_period}-period) is ${latestSMA.toFixed(4)}. `;
          interpretation += `Current price is **${Math.abs(percentage).toFixed(2)}% ${priceVsSMA}** the SMA. `;
          
          if (priceVsSMA === "above") {
            interpretation += percentage > 5 ? "Strong bullish position." : "Mild bullish position.";
          } else {
            interpretation += Math.abs(percentage) > 5 ? "Strong bearish position." : "Mild bearish position.";
          }

          results.interpretations.sma = interpretation;
        }
      } else {
        calculationErrors.push("SMA calculation failed - insufficient data");
        confidence -= 10;
      }
    }

    // EMA Calculation
    if (requestedIndicators.includes("ema")) {
      const ema = TechnicalIndicators.calculateEMA(marketData, ema_period);
      if (ema.length > 0) {
        const latestEMA = ema[ema.length - 1].value;
        const priceVsEMA = currentPrice > latestEMA ? "above" : "below";
        const percentage = ((currentPrice - latestEMA) / latestEMA * 100);

        results.calculated_indicators.ema = {
          value: Number(latestEMA.toFixed(4)),
          period: ema_period,
          price_position: priceVsEMA,
          percentage_difference: Number(percentage.toFixed(2)),
          raw_data: {
            current_price: currentPrice,
            ema_value: latestEMA,
            price_above_ema: currentPrice > latestEMA,
            more_responsive: "EMA is more responsive to recent price changes than SMA"
          }
        };

        if (include_interpretation) {
          let interpretation = `Exponential Moving Average (${ema_period}-period) is ${latestEMA.toFixed(4)}. `;
          interpretation += `Current price is **${Math.abs(percentage).toFixed(2)}% ${priceVsEMA}** the EMA. `;
          interpretation += "EMA gives more weight to recent prices, making it more responsive to recent price movements. ";
          
          if (priceVsEMA === "above") {
            interpretation += percentage > 3 ? "Strong recent bullish momentum." : "Mild recent bullish momentum.";
          } else {
            interpretation += Math.abs(percentage) > 3 ? "Strong recent bearish momentum." : "Mild recent bearish momentum.";
          }

          results.interpretations.ema = interpretation;
        }
      } else {
        calculationErrors.push("EMA calculation failed - insufficient data");
        confidence -= 10;
      }
    }

    // Add metadata
    results.metadata = {
      calculation_errors: calculationErrors,
      confidence: Math.max(0, confidence),
      data_quality: {
        source: historicalResult.source,
        from_cache: historicalResult.fromCache,
        completeness: (marketData.length / 50) * 100, // Assuming 50 is ideal
      },
      processing_time_ms: Date.now() - startTime,
      timestamp: TimezoneUtils.createAnalysisTimestamp()
    };

    // Store analysis
    await mongoDBService.storeAnalysis(
      symbol,
      "technical_indicators",
      { symbol, indicators: requestedIndicators, period },
      results,
      confidence,
      historicalResult.source,
      Date.now() - startTime
    );

    // Format response
    let responseText = `📊 **Technical Indicators Analysis**\n\n`;
    responseText += `**${symbol}** • ${results.metadata.timestamp.timestamp} (${results.metadata.timestamp.timezone})\n`;
    responseText += `Current Price: **$${currentPrice.toFixed(4)}** • Period: ${period.toUpperCase()}\n\n`;

    // Show calculated indicators
    const indicatorOrder = ["rsi", "macd", "sma", "ema"];
    for (const indicator of indicatorOrder) {
      if (results.calculated_indicators[indicator]) {
        const data = results.calculated_indicators[indicator];
        
        responseText += `**${indicator.toUpperCase()}**\n`;
        
        if (indicator === "rsi") {
          responseText += `• Value: **${data.value}** (${data.period}-period)\n`;
          responseText += `• Signal: **${data.signal.toUpperCase()}** (${data.strength})\n`;
          responseText += `• Range: Oversold (<30) | Neutral (30-70) | Overbought (>70)\n`;
        } else if (indicator === "macd") {
          responseText += `• MACD: **${data.macd_line}** | Signal: **${data.signal_line}**\n`;
          responseText += `• Histogram: **${data.histogram}** (${data.histogram > 0 ? 'Positive' : 'Negative'})\n`;
          responseText += `• Trend: **${data.trend.toUpperCase()}**`;
          if (data.crossover !== "none") {
            responseText += ` | **${data.crossover.toUpperCase()} CROSSOVER** ⚠️`;
          }
          responseText += '\n';
        } else if (indicator === "sma" || indicator === "ema") {
          const type = indicator.toUpperCase();
          responseText += `• ${type}: **$${data.value}** (${data.period}-period)\n`;
          responseText += `• Price vs ${type}: **${data.percentage_difference}% ${data.price_position.toUpperCase()}**\n`;
          responseText += `• Position: ${data.price_position === "above" ? "🟢 Bullish" : "🔴 Bearish"}\n`;
        }
        
        responseText += '\n';
      }
    }

    // Show interpretations if requested
    if (include_interpretation && Object.keys(results.interpretations).length > 0) {
      responseText += `**💡 Interpretations**\n\n`;
      for (const [indicator, interpretation] of Object.entries(results.interpretations)) {
        responseText += `**${indicator.toUpperCase()}:** ${interpretation}\n\n`;
      }
    }

    // Show any calculation errors
    if (calculationErrors.length > 0) {
      responseText += `**⚠️ Calculation Issues**\n`;
      calculationErrors.forEach(error => {
        responseText += `• ${error}\n`;
      });
      responseText += '\n';
    }

    // Metadata
    responseText += `**📋 Analysis Quality**\n`;
    responseText += `• Data Source: ${historicalResult.source} ${historicalResult.fromCache ? '(cached)' : '(fresh)'}\n`;
    responseText += `• Data Points: ${marketData.length}\n`;
    responseText += `• Confidence: **${confidence}%**\n`;
    responseText += `• Processing Time: ${results.metadata.processing_time_ms}ms\n\n`;

    responseText += `*📚 Educational technical analysis tool. These indicators help identify trends and momentum but should be used in combination with other analysis methods. Not financial advice.*`;

    return {
      content: [{ type: "text", text: responseText }]
    };

  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      
      return {
        content: [{ 
          type: "text", 
          text: `❌ **Input Validation Error**\n\nInvalid parameters: ${validationErrors}\n\n**Expected:**\n• symbol: 1-10 character stock symbol\n• indicators: Array of "rsi", "macd", "sma", "ema", or "all"\n• period: "1d", "5d", "1mo", "3mo", "6mo", or "1y"\n• rsi_period: 5-50 (default: 14)\n• macd_fast/slow/signal: Custom MACD parameters\n• sma_period/ema_period: 5-200 (default: 20)\n• include_interpretation: true/false\n\n*📚 Educational analysis tool. Not financial advice.*`
        }],
        isError: true
      };
    }

    return {
      content: [{ 
        type: "text", 
        text: `❌ **Technical Indicators Calculation Error**\n\nCalculation failed: ${(error as Error).message}\n\nPlease verify the symbol and parameters, then try again.\n\n*📚 Educational analysis tool. Not financial advice.*`
      }],
      isError: true
    };
  }
}