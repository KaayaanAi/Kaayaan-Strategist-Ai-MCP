import { z } from "zod";
import { TimezoneUtils } from "../services/timezone.js";

// Import existing tool functions
import { validateDataQuality } from "./validation.js";
import { analyzeMarketStructure } from "./marketAnalysis.js";
import { generateTradingSignal } from "./signalGeneration.js";
import { calculateIndicators } from "./indicators.js";
import { storeAnalysis } from "./storage.js";

type AnalysisDepth = "basic" | "standard" | "comprehensive";
type Timeframe = "short" | "medium" | "long"; 
type RiskTolerance = "conservative" | "moderate" | "aggressive";

const completeAnalysisSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  analysis_depth: z.enum(["basic", "standard", "comprehensive"]).default("standard"),
  timeframe: z.enum(["short", "medium", "long"]).default("medium"),
  risk_tolerance: z.enum(["conservative", "moderate", "aggressive"]).default("moderate"),
  include_history: z.boolean().default(false),
  store_results: z.boolean().default(true)
});

interface CompleteAnalysisResult {
  data_validation: any;
  market_structure: any;
  trading_signal: any;
  technical_indicators: any;
  analysis_metadata: {
    timestamp: ReturnType<typeof TimezoneUtils.createAnalysisTimestamp>;
    confidence_score: number;
    analysis_id: string;
    processing_time_ms: number;
    analysis_depth: string;
    components_completed: string[];
    components_failed: string[];
  };
  educational_disclaimer: string;
}

export async function completeAnalysis(args: unknown) {
  const startTime = Date.now();
  const analysisId = `complete_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  try {
    // Validate input
    const { 
      symbol, 
      analysis_depth, 
      timeframe, 
      risk_tolerance, 
      store_results 
    } = completeAnalysisSchema.parse(args);

    console.error(`🔄 Starting complete analysis for ${symbol} (${analysis_depth} depth)`);

    const result = await executeCompleteAnalysis(
      symbol, 
      analysis_depth, 
      timeframe, 
      risk_tolerance, 
      store_results,
      analysisId,
      startTime
    );

    const responseText = formatCompleteAnalysisResponse(result, symbol, analysis_depth);

    console.error(`✅ Complete analysis finished for ${symbol} in ${result.analysis_metadata.processing_time_ms}ms`);

    return {
      content: [{ type: "text", text: responseText }]
    };

  } catch (error) {
    return handleCompleteAnalysisError(error);
  }
}

async function executeCompleteAnalysis(
  symbol: string,
  analysis_depth: AnalysisDepth,
  timeframe: Timeframe,
  risk_tolerance: RiskTolerance,
  store_results: boolean,
  analysisId: string,
  startTime: number
): Promise<CompleteAnalysisResult> {
  // Initialize result structure
  const result: CompleteAnalysisResult = {
    data_validation: null,
    market_structure: null,
    trading_signal: null,
    technical_indicators: null,
    analysis_metadata: {
      timestamp: TimezoneUtils.createAnalysisTimestamp(),
      confidence_score: 0,
      analysis_id: analysisId,
      processing_time_ms: 0,
      analysis_depth,
      components_completed: [],
      components_failed: []
    },
    educational_disclaimer: "This is an educational analysis tool providing comprehensive financial analysis based on technical indicators. NOT FINANCIAL ADVICE. Always conduct your own research and consider your risk tolerance before making any investment decisions. Past performance does not guarantee future results."
  };

  // Map analysis depth to parameters
  const depthConfig = getAnalysisDepthConfig(analysis_depth);
  const timeframeConfig = getTimeframeConfig(timeframe);

  // Execute analysis components
  await executeDataValidation(result, symbol, depthConfig);
  await executeMarketStructureAnalysis(result, symbol, depthConfig, timeframeConfig);
  await executeTradingSignalGeneration(result, symbol, timeframe, risk_tolerance, depthConfig);
  await executeTechnicalIndicators(result, symbol, depthConfig, timeframeConfig);

  // Calculate overall confidence score if not set from trading signal
  if (result.analysis_metadata.confidence_score === 0) {
    result.analysis_metadata.confidence_score = calculateOverallConfidence(result);
  }

  // Store results if requested
  if (store_results) {
    await storeCompleteAnalysisResults(result, symbol, analysis_depth, timeframe, risk_tolerance);
  }

  // Finalize metadata
  result.analysis_metadata.processing_time_ms = Date.now() - startTime;

  return result;
}

async function executeDataValidation(
  result: CompleteAnalysisResult, 
  symbol: string, 
  depthConfig: ReturnType<typeof getAnalysisDepthConfig>
): Promise<void> {
  try {
    console.error(`📊 Running data validation (${depthConfig.validation_type})`);
    const validationResult = await validateDataQuality({
      symbol,
      validation_type: depthConfig.validation_type,
      check_historical: true,
      check_current: true,
      max_age_minutes: depthConfig.max_data_age_minutes,
      store_results: false
    });

    // Extract the actual result data from the MCP response
    if (validationResult.content?.[0]) {
      result.data_validation = {
        status: validationResult.isError ? "failed" : "completed",
        summary: validationResult.content[0].text.split('\n')[0],
        details: validationResult.content[0].text
      };
      result.analysis_metadata.components_completed.push("data_validation");
    }
  } catch (error) {
    console.error(`❌ Data validation failed: ${(error as Error).message}`);
    result.data_validation = {
      status: "failed",
      error: (error as Error).message,
      summary: "Data validation encountered an error"
    };
    result.analysis_metadata.components_failed.push("data_validation");
  }
}

async function executeMarketStructureAnalysis(
  result: CompleteAnalysisResult,
  symbol: string,
  depthConfig: ReturnType<typeof getAnalysisDepthConfig>,
  timeframeConfig: ReturnType<typeof getTimeframeConfig>
): Promise<void> {
  try {
    console.error(`📈 Running market structure analysis`);
    const marketResult = await analyzeMarketStructure({
      symbol,
      period: timeframeConfig.period,
      include_support_resistance: depthConfig.include_support_resistance,
      include_volatility: depthConfig.include_volatility,
      lookback_days: depthConfig.lookback_days
    });

    if (marketResult.content?.[0]) {
      result.market_structure = {
        status: marketResult.isError ? "failed" : "completed",
        summary: extractSummaryFromResponse(marketResult.content[0].text, "Market Structure"),
        details: marketResult.content[0].text
      };
      result.analysis_metadata.components_completed.push("market_structure");
    }
  } catch (error) {
    console.error(`❌ Market structure analysis failed: ${(error as Error).message}`);
    result.market_structure = {
      status: "failed",
      error: (error as Error).message,
      summary: "Market structure analysis encountered an error"
    };
    result.analysis_metadata.components_failed.push("market_structure");
  }
}

async function executeTradingSignalGeneration(
  result: CompleteAnalysisResult,
  symbol: string,
  timeframe: "short" | "medium" | "long",
  risk_tolerance: "conservative" | "moderate" | "aggressive",
  depthConfig: ReturnType<typeof getAnalysisDepthConfig>
): Promise<void> {
  try {
    console.error(`🎯 Generating trading signals`);
    const signalResult = await generateTradingSignal({
      symbol,
      timeframe,
      risk_tolerance,
      include_stop_loss: depthConfig.include_stop_loss,
      include_take_profit: depthConfig.include_take_profit,
      min_confidence: depthConfig.min_confidence
    });

    if (signalResult.content?.[0]) {
      result.trading_signal = {
        status: signalResult.isError ? "failed" : "completed",
        summary: extractSummaryFromResponse(signalResult.content[0].text, "Trading Signal"),
        details: signalResult.content[0].text
      };
      result.analysis_metadata.components_completed.push("trading_signal");
      
      // Extract confidence score for overall metadata
      const confidenceRegex = /Confidence:\s*\*\*(\d+\.?\d*)%\*\*/;
      const confidenceMatch = confidenceRegex.exec(signalResult.content[0].text);
      if (confidenceMatch) {
        result.analysis_metadata.confidence_score = parseFloat(confidenceMatch[1]);
      }
    }
  } catch (error) {
    console.error(`❌ Trading signal generation failed: ${(error as Error).message}`);
    result.trading_signal = {
      status: "failed",
      error: (error as Error).message,
      summary: "Trading signal generation encountered an error"
    };
    result.analysis_metadata.components_failed.push("trading_signal");
  }
}

async function executeTechnicalIndicators(
  result: CompleteAnalysisResult,
  symbol: string,
  depthConfig: ReturnType<typeof getAnalysisDepthConfig>,
  timeframeConfig: ReturnType<typeof getTimeframeConfig>
): Promise<void> {
  try {
    console.error(`🔧 Calculating technical indicators`);
    const indicatorResult = await calculateIndicators({
      symbol,
      indicators: depthConfig.indicators,
      period: timeframeConfig.period,
      rsi_period: depthConfig.rsi_period,
      macd_fast: depthConfig.macd_fast,
      macd_slow: depthConfig.macd_slow,
      macd_signal: depthConfig.macd_signal,
      sma_period: depthConfig.sma_period,
      ema_period: depthConfig.ema_period,
      include_interpretation: true
    });

    if (indicatorResult.content?.[0]) {
      result.technical_indicators = {
        status: indicatorResult.isError ? "failed" : "completed",
        summary: extractSummaryFromResponse(indicatorResult.content[0].text, "Technical Indicators"),
        details: indicatorResult.content[0].text
      };
      result.analysis_metadata.components_completed.push("technical_indicators");
    }
  } catch (error) {
    console.error(`❌ Technical indicators calculation failed: ${(error as Error).message}`);
    result.technical_indicators = {
      status: "failed",
      error: (error as Error).message,
      summary: "Technical indicators calculation encountered an error"
    };
    result.analysis_metadata.components_failed.push("technical_indicators");
  }
}

async function storeCompleteAnalysisResults(
  result: CompleteAnalysisResult,
  symbol: string,
  analysis_depth: string,
  timeframe: string,
  risk_tolerance: string
): Promise<void> {
  try {
    console.error(`💾 Storing complete analysis results`);
    await storeAnalysis({
      symbol,
      analysis_type: "complete_analysis",
      analysis_data: result,
      notes: `Complete ${analysis_depth} analysis - ${result.analysis_metadata.components_completed.length} components completed`,
      tags: [`complete_analysis`, analysis_depth, timeframe, risk_tolerance],
      confidence: result.analysis_metadata.confidence_score,
      data_source: "unified"
    });
    console.error(`✅ Analysis results stored successfully`);
  } catch (error) {
    console.error(`⚠️ Failed to store analysis results: ${(error as Error).message}`);
  }
}

function handleCompleteAnalysisError(error: unknown): any {
  if (error instanceof z.ZodError) {
    const validationErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    
    return {
      content: [{ 
        type: "text", 
        text: `❌ **Complete Analysis Input Error**\n\nInvalid parameters: ${validationErrors}\n\n**Expected Parameters:**\n• **symbol**: 1-10 character stock/crypto symbol\n• **analysis_depth**: "basic", "standard", or "comprehensive"\n• **timeframe**: "short", "medium", or "long"\n• **risk_tolerance**: "conservative", "moderate", or "aggressive"\n• **include_history**: true/false (default: false)\n• **store_results**: true/false (default: true)\n\n🚨 **EDUCATIONAL PURPOSE ONLY - NOT FINANCIAL ADVICE**`
      }],
      isError: true
    };
  }

  return {
    content: [{ 
      type: "text", 
      text: `❌ **Complete Analysis System Error**\n\nComplete analysis failed: ${(error as Error).message}\n\nThis indicates a system issue. Please verify the symbol and try again.\n\n🚨 **EDUCATIONAL PURPOSE ONLY - NOT FINANCIAL ADVICE**`
    }],
    isError: true
  };
}

// Helper functions
function getAnalysisDepthConfig(depth: "basic" | "standard" | "comprehensive") {
  switch (depth) {
    case "basic":
      return {
        validation_type: "basic" as const,
        max_data_age_minutes: 120,
        include_support_resistance: false,
        include_volatility: false,
        lookback_days: 10,
        include_stop_loss: false,
        include_take_profit: false,
        min_confidence: 70,
        indicators: ["rsi", "sma"],
        rsi_period: 14,
        macd_fast: 12,
        macd_slow: 26,
        macd_signal: 9,
        sma_period: 20,
        ema_period: 20
      };
    case "comprehensive":
      return {
        validation_type: "comprehensive" as const,
        max_data_age_minutes: 30,
        include_support_resistance: true,
        include_volatility: true,
        lookback_days: 50,
        include_stop_loss: true,
        include_take_profit: true,
        min_confidence: 50,
        indicators: ["all"],
        rsi_period: 14,
        macd_fast: 12,
        macd_slow: 26,
        macd_signal: 9,
        sma_period: 20,
        ema_period: 20
      };
    default: // standard
      return {
        validation_type: "basic" as const,
        max_data_age_minutes: 60,
        include_support_resistance: true,
        include_volatility: true,
        lookback_days: 20,
        include_stop_loss: true,
        include_take_profit: true,
        min_confidence: 60,
        indicators: ["rsi", "macd", "sma", "ema"],
        rsi_period: 14,
        macd_fast: 12,
        macd_slow: 26,
        macd_signal: 9,
        sma_period: 20,
        ema_period: 20
      };
  }
}

function getTimeframeConfig(timeframe: "short" | "medium" | "long") {
  switch (timeframe) {
    case "short":
      return { period: "5d" as const };
    case "long":
      return { period: "6mo" as const };
    default: // medium
      return { period: "1mo" as const };
  }
}

function extractSummaryFromResponse(text: string, componentName: string): string {
  const lines = text.split('\n');
  
  // Try to find a summary line or use the first meaningful line
  for (const line of lines) {
    if (line.includes('**') && !line.includes('ERROR') && !line.includes('DISCLAIMER')) {
      return line.replace(/\*\*/g, '').trim();
    }
  }
  
  return `${componentName} analysis completed`;
}

function calculateOverallConfidence(result: CompleteAnalysisResult): number {
  const completed = result.analysis_metadata.components_completed.length;
  const total = completed + result.analysis_metadata.components_failed.length;
  
  if (total === 0) return 0;
  
  // Base confidence on completion rate
  const completionRate = completed / total;
  return Math.round(completionRate * 85); // Max 85% for automated analysis
}

function formatCompleteAnalysisResponse(result: CompleteAnalysisResult, symbol: string, depth: string): string {
  let response = `# 📊 Complete Analysis Report\n\n`;
  response += `**Symbol**: ${symbol}  \n`;
  response += `**Analysis Depth**: ${depth.toUpperCase()}  \n`;
  response += `**Timestamp**: ${result.analysis_metadata.timestamp}  \n`;
  response += `**Analysis ID**: ${result.analysis_metadata.analysis_id}  \n`;
  response += `**Processing Time**: ${result.analysis_metadata.processing_time_ms}ms  \n`;
  response += `**Overall Confidence**: ${result.analysis_metadata.confidence_score}%\n\n`;

  // Summary section
  response += `## 🎯 Executive Summary\n\n`;
  response += `✅ **Completed Components**: ${result.analysis_metadata.components_completed.join(', ')}\n`;
  if (result.analysis_metadata.components_failed.length > 0) {
    response += `❌ **Failed Components**: ${result.analysis_metadata.components_failed.join(', ')}\n`;
  }
  response += '\n';

  // Component results
  const components = [
    { key: 'data_validation', title: '📊 Data Validation', data: result.data_validation },
    { key: 'market_structure', title: '📈 Market Structure', data: result.market_structure },
    { key: 'trading_signal', title: '🎯 Trading Signal', data: result.trading_signal },
    { key: 'technical_indicators', title: '🔧 Technical Indicators', data: result.technical_indicators }
  ];

  for (const component of components) {
    response += `## ${component.title}\n\n`;
    if (component.data) {
      if (component.data.status === "completed") {
        response += `**Status**: ✅ Completed\n`;
        response += `**Summary**: ${component.data.summary}\n\n`;
        if (component.data.details) {
          response += `<details>\n<summary>View Detailed Analysis</summary>\n\n${component.data.details}\n\n</details>\n\n`;
        }
      } else {
        response += `**Status**: ❌ Failed\n`;
        response += `**Error**: ${component.data.error || 'Unknown error'}\n\n`;
      }
    } else {
      response += `**Status**: ⏸️ Not executed\n\n`;
    }
  }

  // Educational disclaimer
  response += `---\n\n`;
  response += `🚨 **${result.educational_disclaimer}**`;

  return response;
}