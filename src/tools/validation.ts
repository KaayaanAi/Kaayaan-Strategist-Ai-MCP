import { z } from "zod";
import { dataAggregator } from "../services/dataAggregator.js";
import { mongoDBService } from "../services/mongodb.js";
import { TimezoneUtils } from "../services/timezone.js";

const dataValidationSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  validation_type: z.enum(["basic", "comprehensive", "real_time"]).default("basic"),
  check_historical: z.boolean().default(true),
  check_current: z.boolean().default(true),
  max_age_minutes: z.number().min(1).max(1440).default(60), // Max 24 hours
  store_results: z.boolean().default(false),
});

export async function validateDataQuality(args: unknown) {
  const startTime = Date.now();
  
  try {
    // Validate input
    const { 
      symbol, 
      validation_type, 
      check_historical, 
      check_current, 
      max_age_minutes,
      store_results 
    } = dataValidationSchema.parse(args);

    // Initialize validation results
    const validationResults = {
      symbol,
      validation_type,
      timestamp: TimezoneUtils.createAnalysisTimestamp(),
      overall_status: "unknown" as "valid" | "warning" | "invalid" | "unknown",
      issues: [] as string[],
      warnings: [] as string[],
      recommendations: [] as string[],
      data_sources: {
        yahoo_status: "not_checked" as "available" | "unavailable" | "error" | "not_checked",
        alpha_vantage_status: "not_checked" as "available" | "unavailable" | "error" | "not_checked"
      },
      data_quality: {
        current_price_available: false,
        historical_data_available: false,
        data_freshness: "unknown" as "fresh" | "stale" | "very_old" | "unknown",
        data_completeness: 0,
        price_validity: "unknown" as "valid" | "suspicious" | "invalid" | "unknown",
        volume_check: "unknown" as "normal" | "low" | "zero" | "unknown"
      },
      service_status: {
        redis_available: false,
        mongodb_available: false,
        rate_limits: {
          yahoo_remaining: 0,
          alpha_vantage_remaining: 0
        }
      },
      processing_time_ms: 0
    };

    let issueCount = 0;
    let warningCount = 0;

    // Check service availability
    const serviceStatus = await dataAggregator.getServiceStatus();
    
    validationResults.service_status.redis_available = serviceStatus.redis.available;
    validationResults.service_status.mongodb_available = serviceStatus.mongodb.available;
    validationResults.service_status.rate_limits.yahoo_remaining = serviceStatus.yahoo.rateLimitStatus.remaining;
    validationResults.service_status.rate_limits.alpha_vantage_remaining = serviceStatus.alphaVantage.rateLimitStatus.remaining;

    // Service availability warnings
    if (!serviceStatus.redis.available) {
      validationResults.warnings.push("Redis cache is not available - performance may be impacted");
      warningCount++;
    }
    if (!serviceStatus.mongodb.available) {
      validationResults.warnings.push("MongoDB storage is not available - cannot store results");
      warningCount++;
    }

    // Check current price data
    if (check_current) {
      try {
        const quoteResult = await dataAggregator.getQuote(symbol);
        
        if (quoteResult.data) {
          validationResults.data_quality.current_price_available = true;
          validationResults.data_sources.yahoo_status = quoteResult.source === "yahoo" ? "available" : "not_checked";
          validationResults.data_sources.alpha_vantage_status = quoteResult.source === "alpha_vantage" ? "available" : "not_checked";
          
          const quote = quoteResult.data;
          const dataAge = Date.now() - quote.timestamp;
          const ageMinutes = dataAge / (1000 * 60);

          // Check data freshness
          if (ageMinutes <= max_age_minutes) {
            validationResults.data_quality.data_freshness = "fresh";
          } else if (ageMinutes <= max_age_minutes * 4) {
            validationResults.data_quality.data_freshness = "stale";
            validationResults.warnings.push(`Current price data is ${Math.round(ageMinutes)} minutes old`);
            warningCount++;
          } else {
            validationResults.data_quality.data_freshness = "very_old";
            validationResults.issues.push(`Current price data is very old (${Math.round(ageMinutes)} minutes)`);
            issueCount++;
          }

          // Validate price data
          if (quote.price <= 0) {
            validationResults.data_quality.price_validity = "invalid";
            validationResults.issues.push("Current price is zero or negative");
            issueCount++;
          } else if (Math.abs(quote.changePercent) > 50) {
            validationResults.data_quality.price_validity = "suspicious";
            validationResults.warnings.push(`Extreme price change detected: ${quote.changePercent.toFixed(2)}%`);
            warningCount++;
          } else {
            validationResults.data_quality.price_validity = "valid";
          }

        } else {
          validationResults.issues.push("No current price data available");
          validationResults.data_sources.yahoo_status = "unavailable";
          if (serviceStatus.alphaVantage.available) {
            validationResults.data_sources.alpha_vantage_status = "unavailable";
          }
          issueCount++;
        }
      } catch (error) {
        validationResults.issues.push(`Current price validation failed: ${(error as Error).message}`);
        validationResults.data_sources.yahoo_status = "error";
        issueCount++;
      }
    }

    // Check historical data
    if (check_historical) {
      try {
        const historicalResult = await dataAggregator.getHistoricalData(symbol, "1mo", "1d");
        
        if (historicalResult.data && historicalResult.data.length > 0) {
          validationResults.data_quality.historical_data_available = true;
          
          const historical = historicalResult.data;
          const expectedDataPoints = 22; // Approximate trading days in a month
          const completeness = (historical.length / expectedDataPoints) * 100;
          validationResults.data_quality.data_completeness = Math.min(100, completeness);

          if (completeness < 70) {
            validationResults.warnings.push(`Historical data incomplete: ${historical.length}/${expectedDataPoints} expected data points`);
            warningCount++;
          }

          // Check volume data
          const recentVolumes = historical.slice(0, 5).map(h => h.volume);
          const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
          
          if (avgVolume === 0) {
            validationResults.data_quality.volume_check = "zero";
            validationResults.issues.push("No trading volume detected in recent data");
            issueCount++;
          } else if (avgVolume < 1000) {
            validationResults.data_quality.volume_check = "low";
            validationResults.warnings.push("Very low trading volume detected");
            warningCount++;
          } else {
            validationResults.data_quality.volume_check = "normal";
          }

          // Comprehensive validation checks
          if (validation_type === "comprehensive") {
            // Check for data consistency
            for (let i = 0; i < Math.min(5, historical.length); i++) {
              const candle = historical[i];
              
              // OHLC validity
              if (candle.high < candle.low) {
                validationResults.issues.push(`Invalid OHLC data: High < Low on ${new Date(candle.timestamp).toDateString()}`);
                issueCount++;
              }
              
              if (candle.close < candle.low || candle.close > candle.high) {
                validationResults.issues.push(`Invalid close price outside high/low range on ${new Date(candle.timestamp).toDateString()}`);
                issueCount++;
              }

              if (candle.open < candle.low || candle.open > candle.high) {
                validationResults.warnings.push(`Open price outside high/low range on ${new Date(candle.timestamp).toDateString()}`);
                warningCount++;
              }
            }

            // Check for price gaps
            for (let i = 1; i < Math.min(10, historical.length); i++) {
              const current = historical[i - 1];
              const previous = historical[i];
              const gapPercent = Math.abs(current.open - previous.close) / previous.close * 100;
              
              if (gapPercent > 20) {
                validationResults.warnings.push(`Large price gap detected: ${gapPercent.toFixed(2)}% on ${new Date(current.timestamp).toDateString()}`);
                warningCount++;
              }
            }
          }

        } else {
          validationResults.issues.push("No historical data available");
          issueCount++;
        }
      } catch (error) {
        validationResults.issues.push(`Historical data validation failed: ${(error as Error).message}`);
        issueCount++;
      }
    }

    // Real-time validation checks
    if (validation_type === "real_time") {
      // Check if markets should be open
      const isMarketHours = TimezoneUtils.isKuwaitMarketHours();
      if (!isMarketHours) {
        validationResults.warnings.push("Markets may be closed - data updates may be delayed");
        warningCount++;
      }

      // Check rate limits
      if (validationResults.service_status.rate_limits.yahoo_remaining < 10) {
        validationResults.warnings.push("Yahoo Finance rate limit nearly exhausted");
        warningCount++;
      }

      if (serviceStatus.alphaVantage.available && validationResults.service_status.rate_limits.alpha_vantage_remaining < 2) {
        validationResults.warnings.push("Alpha Vantage rate limit nearly exhausted");
        warningCount++;
      }
    }

    // Generate recommendations
    if (issueCount > 0) {
      validationResults.recommendations.push("Address critical data issues before proceeding with analysis");
    }
    
    if (warningCount > 0) {
      validationResults.recommendations.push("Review warnings and consider their impact on analysis accuracy");
    }

    if (!validationResults.data_quality.current_price_available) {
      validationResults.recommendations.push("Verify symbol exists and is actively traded");
    }

    if (validationResults.data_quality.data_completeness < 80) {
      validationResults.recommendations.push("Consider using a different time period or more liquid symbol");
    }

    if (!serviceStatus.redis.available) {
      validationResults.recommendations.push("Enable Redis caching for better performance");
    }

    // Determine overall status
    if (issueCount === 0 && warningCount === 0) {
      validationResults.overall_status = "valid";
    } else if (issueCount === 0 && warningCount > 0) {
      validationResults.overall_status = "warning";
    } else {
      validationResults.overall_status = "invalid";
    }

    validationResults.processing_time_ms = Date.now() - startTime;

    // Store results if requested
    if (store_results && mongoDBService.isAvailable()) {
      await mongoDBService.storeAnalysis(
        symbol,
        "data_validation",
        { symbol, validation_type, check_historical, check_current, max_age_minutes },
        validationResults,
        issueCount === 0 ? (warningCount === 0 ? 100 : 80) : 40,
        "cached", // This is a validation, not real data
        validationResults.processing_time_ms
      );
    }

    // Format response
    const statusEmoji = validationResults.overall_status === "valid" ? "✅" : 
                       validationResults.overall_status === "warning" ? "⚠️" : "❌";
    
    let responseText = `${statusEmoji} **Data Quality Validation**\n\n`;
    responseText += `**${symbol}** • ${validation_type.toUpperCase()} CHECK\n`;
    responseText += `Status: **${validationResults.overall_status.toUpperCase()}**\n`;
    responseText += `Validation Time: ${validationResults.timestamp.timestamp} (${validationResults.timestamp.timezone})\n\n`;

    // Data quality summary
    responseText += `**📊 Data Quality Summary**\n`;
    responseText += `• Current Price: ${validationResults.data_quality.current_price_available ? "✅ Available" : "❌ Unavailable"}\n`;
    responseText += `• Historical Data: ${validationResults.data_quality.historical_data_available ? "✅ Available" : "❌ Unavailable"}\n`;
    responseText += `• Data Freshness: **${validationResults.data_quality.data_freshness.toUpperCase()}**\n`;
    responseText += `• Price Validity: **${validationResults.data_quality.price_validity.toUpperCase()}**\n`;
    if (validationResults.data_quality.data_completeness > 0) {
      responseText += `• Completeness: **${validationResults.data_quality.data_completeness.toFixed(1)}%**\n`;
    }
    if (validationResults.data_quality.volume_check !== "unknown") {
      responseText += `• Volume: **${validationResults.data_quality.volume_check.toUpperCase()}**\n`;
    }
    responseText += '\n';

    // Service status
    responseText += `**🔧 Service Status**\n`;
    responseText += `• Yahoo Finance: **${validationResults.data_sources.yahoo_status.toUpperCase()}**\n`;
    if (serviceStatus.alphaVantage.available) {
      responseText += `• Alpha Vantage: **${validationResults.data_sources.alpha_vantage_status.toUpperCase()}**\n`;
    }
    responseText += `• Redis Cache: ${validationResults.service_status.redis_available ? "✅" : "❌"}\n`;
    responseText += `• MongoDB: ${validationResults.service_status.mongodb_available ? "✅" : "❌"}\n`;
    responseText += `• Yahoo Rate Limit: ${validationResults.service_status.rate_limits.yahoo_remaining} remaining\n`;
    if (serviceStatus.alphaVantage.available) {
      responseText += `• Alpha Vantage Rate Limit: ${validationResults.service_status.rate_limits.alpha_vantage_remaining} remaining\n`;
    }
    responseText += '\n';

    // Issues
    if (validationResults.issues.length > 0) {
      responseText += `**❌ Critical Issues (${validationResults.issues.length})**\n`;
      validationResults.issues.forEach(issue => {
        responseText += `• ${issue}\n`;
      });
      responseText += '\n';
    }

    // Warnings
    if (validationResults.warnings.length > 0) {
      responseText += `**⚠️ Warnings (${validationResults.warnings.length})**\n`;
      validationResults.warnings.forEach(warning => {
        responseText += `• ${warning}\n`;
      });
      responseText += '\n';
    }

    // Recommendations
    if (validationResults.recommendations.length > 0) {
      responseText += `**💡 Recommendations**\n`;
      validationResults.recommendations.forEach(rec => {
        responseText += `• ${rec}\n`;
      });
      responseText += '\n';
    }

    // Processing info
    responseText += `**⚡ Validation Details**\n`;
    responseText += `• Processing Time: ${validationResults.processing_time_ms}ms\n`;
    responseText += `• Validation Type: **${validation_type.toUpperCase()}**\n`;
    responseText += `• Max Age Threshold: ${max_age_minutes} minutes\n`;
    if (store_results && mongoDBService.isAvailable()) {
      responseText += `• Results Stored: ✅ Saved to MongoDB\n`;
    }
    responseText += '\n';

    responseText += `*🔍 Data quality validation ensures reliable analysis. Address critical issues before proceeding with market analysis or trading signals.*`;

    return {
      content: [{ type: "text", text: responseText }]
    };

  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(e => {
        const field = e.path.join('.');
        return `• ${field}: ${e.message}`;
      }).join('\n');
      
      return {
        content: [{ 
          type: "text", 
          text: `❌ **Input Validation Error**\n\nInvalid parameters:\n${validationErrors}\n\n**Expected Parameters:**\n• **symbol**: 1-10 character stock symbol (required)\n• **validation_type**: "basic", "comprehensive", or "real_time" (default: "basic")\n• **check_historical**: Include historical data validation (default: true)\n• **check_current**: Include current price validation (default: true)\n• **max_age_minutes**: Maximum acceptable data age in minutes 1-1440 (default: 60)\n• **store_results**: Store validation results in MongoDB (default: false)\n\n**Validation Types:**\n• **basic**: Essential data availability and freshness checks\n• **comprehensive**: Detailed data consistency and quality analysis\n• **real_time**: Current market conditions and rate limit monitoring\n\n*Data quality validation tool for ensuring reliable analysis inputs.*`
        }],
        isError: true
      };
    }

    return {
      content: [{ 
        type: "text", 
        text: `❌ **Data Validation Error**\n\nValidation failed: ${(error as Error).message}\n\n**Troubleshooting:**\n• Verify symbol format and existence\n• Check network connectivity\n• Ensure services are running\n\n*If validation errors persist, check system status and connectivity.*`
      }],
      isError: true
    };
  }
}