import { z } from "zod";
import { mongoDBService } from "../services/mongodb.js";
import { TimezoneUtils } from "../services/timezone.js";

const storeAnalysisSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  analysis_type: z.enum(["market_structure", "trading_signal", "technical_indicators", "data_validation"]),
  analysis_data: z.record(z.any()), // Flexible object for analysis results
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(100).optional(),
  data_source: z.enum(["yahoo", "alpha_vantage", "cached"]).default("yahoo"),
});

export async function storeAnalysis(args: unknown) {
  const startTime = Date.now();
  
  try {
    // Validate input
    const { 
      symbol, 
      analysis_type, 
      analysis_data, 
      notes, 
      tags, 
      confidence, 
      data_source 
    } = storeAnalysisSchema.parse(args);

    // Check if MongoDB is available
    if (!mongoDBService.isAvailable()) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ **Storage Error**\n\nMongoDB database is not available. Analysis cannot be stored.\n\n**Troubleshooting:**\n• Check MongoDB connection settings\n• Verify database is running\n• Check network connectivity\n\n*Storage functionality requires MongoDB connection.*`
        }],
        isError: true
      };
    }

    // Prepare analysis record
    const processingTime = Date.now() - startTime;
    const timestamp = TimezoneUtils.createAnalysisTimestamp();

    // Create input record for storage
    const inputRecord = {
      symbol,
      analysis_type,
      notes,
      tags,
      user_provided_confidence: confidence,
      manual_storage: true
    };

    // Enhance analysis data with metadata
    const enhancedAnalysisData = {
      ...analysis_data,
      storage_metadata: {
        stored_manually: true,
        storage_timestamp: timestamp,
        notes: notes || null,
        tags: tags.length > 0 ? tags : null,
        processing_time_ms: processingTime
      }
    };

    // Store the analysis
    const analysisId = await mongoDBService.storeAnalysis(
      symbol,
      analysis_type,
      inputRecord,
      enhancedAnalysisData,
      confidence,
      data_source,
      processingTime
    );

    if (!analysisId) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ **Storage Failed**\n\nFailed to store analysis in database. Please try again.\n\n**Details:**\n• Symbol: ${symbol}\n• Type: ${analysis_type}\n• Data Source: ${data_source}\n\n*If the problem persists, check database connectivity.*`
        }],
        isError: true
      };
    }

    // Format success response
    let responseText = `✅ **Analysis Stored Successfully**\n\n`;
    responseText += `**Storage Details**\n`;
    responseText += `• Analysis ID: \`${analysisId}\`\n`;
    responseText += `• Symbol: **${symbol}**\n`;
    responseText += `• Type: **${analysis_type.replace('_', ' ').toUpperCase()}**\n`;
    responseText += `• Data Source: **${data_source.toUpperCase()}**\n`;
    responseText += `• Timestamp: ${timestamp.timestamp} (${timestamp.timezone})\n`;
    
    if (confidence !== undefined) {
      responseText += `• Confidence: **${confidence}%**\n`;
    }
    
    if (notes) {
      responseText += `• Notes: ${notes}\n`;
    }
    
    if (tags.length > 0) {
      responseText += `• Tags: ${tags.map(tag => `\`${tag}\``).join(', ')}\n`;
    }
    
    responseText += `• Processing Time: ${processingTime}ms\n\n`;

    // Show analysis data summary
    responseText += `**Analysis Data Summary**\n`;
    const dataKeys = Object.keys(analysis_data);
    if (dataKeys.length > 0) {
      responseText += `• Fields stored: ${dataKeys.length}\n`;
      responseText += `• Key fields: ${dataKeys.slice(0, 5).map(k => `\`${k}\``).join(', ')}`;
      if (dataKeys.length > 5) {
        responseText += ` (and ${dataKeys.length - 5} more)`;
      }
      responseText += '\n';
    } else {
      responseText += `• No analysis data provided\n`;
    }

    responseText += `• Data size: ~${JSON.stringify(analysis_data).length} characters\n\n`;

    responseText += `**🔍 Retrieval**\n`;
    responseText += `Use \`get_analysis_history\` with symbol "${symbol}" to retrieve this analysis later.\n\n`;

    responseText += `*📊 Analysis successfully stored in MongoDB. Use the analysis ID for specific record retrieval.*`;

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
          text: `❌ **Input Validation Error**\n\nInvalid parameters:\n${validationErrors}\n\n**Expected Parameters:**\n• **symbol**: 1-10 character stock symbol (required)\n• **analysis_type**: "market_structure", "trading_signal", "technical_indicators", or "data_validation" (required)\n• **analysis_data**: Object containing analysis results (required)\n• **notes**: Optional text notes\n• **tags**: Array of string tags (optional)\n• **confidence**: 0-100 confidence score (optional)\n• **data_source**: "yahoo", "alpha_vantage", or "cached" (default: "yahoo")\n\n**Example:**\n\`\`\`json\n{\n  "symbol": "AAPL",\n  "analysis_type": "technical_indicators",\n  "analysis_data": {\n    "rsi": 65.5,\n    "macd": 0.23,\n    "trend": "bullish"\n  },\n  "notes": "Strong momentum indicators",\n  "tags": ["momentum", "bullish"],\n  "confidence": 85\n}\n\`\`\`\n\n*Storage tool for preserving analysis results.*`
        }],
        isError: true
      };
    }

    return {
      content: [{ 
        type: "text", 
        text: `❌ **Storage Error**\n\nFailed to store analysis: ${(error as Error).message}\n\n**Troubleshooting:**\n• Verify MongoDB connection is active\n• Check that analysis_data is valid JSON\n• Ensure all required fields are provided\n\n*If the problem persists, contact system administrator.*`
      }],
      isError: true
    };
  }
}