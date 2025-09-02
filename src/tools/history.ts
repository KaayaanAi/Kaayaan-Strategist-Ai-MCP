import { z } from "zod";
import { mongoDBService } from "../services/mongodb.js";
import { TimezoneUtils } from "../services/timezone.js";

const analysisHistorySchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()).optional(),
  analysis_type: z.enum(["market_structure", "trading_signal", "technical_indicators", "data_validation"]).optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD format
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().min(1).max(100).default(20),
  include_details: z.boolean().default(true),
  sort_by: z.enum(["newest", "oldest", "confidence", "symbol"]).default("newest"),
});

export async function getAnalysisHistory(args: unknown) {
  try {
    // Validate input
    const { 
      symbol, 
      analysis_type, 
      from_date, 
      to_date, 
      limit, 
      include_details,
      sort_by 
    } = analysisHistorySchema.parse(args);

    // Check if MongoDB is available
    if (!mongoDBService.isAvailable()) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ **Database Error**\n\nMongoDB database is not available. Cannot retrieve analysis history.\n\n**Troubleshooting:**\n• Check MongoDB connection settings\n• Verify database is running\n• Check network connectivity\n\n*History retrieval requires MongoDB connection.*`
        }],
        isError: true
      };
    }

    // Validate date range
    if (from_date && to_date && from_date > to_date) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ **Invalid Date Range**\n\nFrom date (${from_date}) cannot be after to date (${to_date}).\n\n**Date Format:** YYYY-MM-DD\n**Example:** "2024-01-01" to "2024-01-31"`
        }],
        isError: true
      };
    }

    // Retrieve analysis history
    const analyses = await mongoDBService.getAnalysisHistory(
      symbol,
      analysis_type,
      limit,
      from_date,
      to_date
    );

    if (analyses.length === 0) {
      let noResultsText = `📊 **No Analysis History Found**\n\n`;
      noResultsText += `**Search Criteria:**\n`;
      if (symbol) noResultsText += `• Symbol: **${symbol}**\n`;
      if (analysis_type) noResultsText += `• Type: **${analysis_type.replace('_', ' ').toUpperCase()}**\n`;
      if (from_date || to_date) {
        noResultsText += `• Date Range: ${from_date || 'earliest'} to ${to_date || 'latest'}\n`;
      }
      noResultsText += `• Limit: ${limit} records\n\n`;
      
      noResultsText += `**Suggestions:**\n`;
      noResultsText += `• Try broader search criteria\n`;
      noResultsText += `• Check if analyses exist for this symbol\n`;
      noResultsText += `• Verify date range includes analysis periods\n`;
      noResultsText += `• Use \`store_analysis\` to save new analyses\n\n`;
      
      noResultsText += `*Use analysis tools to generate new data, then retrieve with this tool.*`;

      return {
        content: [{ type: "text", text: noResultsText }]
      };
    }

    // Sort results based on sort_by parameter
    if (sort_by === "confidence") {
      analyses.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    } else if (sort_by === "symbol") {
      analyses.sort((a, b) => a.symbol.localeCompare(b.symbol));
    } else if (sort_by === "oldest") {
      analyses.sort((a, b) => new Date(a.timestamp.iso).getTime() - new Date(b.timestamp.iso).getTime());
    }
    // Default "newest" is already sorted by MongoDB query

    // Format response
    let responseText = `📊 **Analysis History**\n\n`;
    
    // Show search criteria
    responseText += `**Search Results** (${analyses.length} of max ${limit})\n`;
    if (symbol) responseText += `• Symbol: **${symbol}**\n`;
    if (analysis_type) responseText += `• Type: **${analysis_type.replace('_', ' ').toUpperCase()}**\n`;
    if (from_date || to_date) {
      responseText += `• Period: ${from_date || 'earliest'} to ${to_date || 'latest'}\n`;
    }
    responseText += `• Sorted by: **${sort_by.toUpperCase()}**\n\n`;

    // Display analyses
    for (let i = 0; i < analyses.length; i++) {
      const analysis = analyses[i];
      const date = new Date(analysis.timestamp.iso);
      const timeAgo = Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)); // Days ago

      responseText += `**${i + 1}. ${analysis.symbol}** - ${analysis.analysisType.replace('_', ' ').toUpperCase()}\n`;
      responseText += `• Date: ${analysis.timestamp.date} (${timeAgo} days ago)\n`;
      responseText += `• Time: ${analysis.timestamp.time} ${analysis.timestamp.timezone}\n`;
      
      if (analysis.confidence !== undefined) {
        responseText += `• Confidence: **${analysis.confidence}%**\n`;
      }
      
      responseText += `• Source: ${analysis.dataSource}\n`;
      responseText += `• Processing: ${analysis.processingTime}ms\n`;

      // Show analysis details if requested
      if (include_details && analysis.output) {
        responseText += `• Details: `;
        
        // Extract key information based on analysis type
        if (analysis.analysisType === "trading_signal" && analysis.output.signal) {
          const signal = analysis.output.signal;
          const strength = analysis.output.strength || 'unknown';
          responseText += `**${signal}** (${strength})`;
          
          if (analysis.output.current_price) {
            responseText += ` @ $${analysis.output.current_price}`;
          }
        } else if (analysis.analysisType === "market_structure" && analysis.output.market_structure) {
          const phase = analysis.output.market_structure.phase || 'unknown';
          const strength = analysis.output.market_structure.strength || 'neutral';
          responseText += `${phase} phase, ${strength} strength`;
        } else if (analysis.analysisType === "technical_indicators" && analysis.output.calculated_indicators) {
          const indicators = Object.keys(analysis.output.calculated_indicators);
          responseText += indicators.slice(0, 3).map(i => i.toUpperCase()).join(', ');
          if (indicators.length > 3) responseText += ` (+${indicators.length - 3} more)`;
        } else if (analysis.analysisType === "data_validation") {
          const isValid = analysis.output.isValid ? "✅ Valid" : "❌ Invalid";
          responseText += isValid;
          if (analysis.output.issues && analysis.output.issues.length > 0) {
            responseText += ` (${analysis.output.issues.length} issues)`;
          }
        } else {
          // Generic details
          const keys = Object.keys(analysis.output).slice(0, 3);
          responseText += keys.join(', ');
        }
        
        responseText += '\n';
      }

      responseText += '\n';
    }

    // Add summary statistics
    if (analyses.length > 1) {
      const symbolCount = new Set(analyses.map(a => a.symbol)).size;
      const typeCount = new Set(analyses.map(a => a.analysisType)).size;
      const avgConfidence = analyses.filter(a => a.confidence !== undefined)
        .reduce((sum, a) => sum + (a.confidence || 0), 0) / analyses.filter(a => a.confidence !== undefined).length;

      responseText += `**📈 Summary Statistics**\n`;
      responseText += `• Unique Symbols: ${symbolCount}\n`;
      responseText += `• Analysis Types: ${typeCount}\n`;
      if (!isNaN(avgConfidence)) {
        responseText += `• Average Confidence: ${avgConfidence.toFixed(1)}%\n`;
      }
      responseText += `• Date Range: ${analyses[analyses.length - 1].timestamp.date} to ${analyses[0].timestamp.date}\n\n`;
    }

    // Add retrieval information
    responseText += `**🔍 Search Options**\n`;
    responseText += `• Use specific symbols to filter results\n`;
    responseText += `• Filter by analysis_type for focused results\n`;
    responseText += `• Set date ranges for time-based analysis\n`;
    responseText += `• Adjust limit (1-100) for more/fewer results\n`;
    responseText += `• Toggle include_details for summary/detailed view\n\n`;

    responseText += `*📚 Historical analysis data retrieved from MongoDB. Use specific analysis IDs for detailed individual records.*`;

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
          text: `❌ **Input Validation Error**\n\nInvalid parameters:\n${validationErrors}\n\n**Expected Parameters:**\n• **symbol**: 1-10 character stock symbol (optional)\n• **analysis_type**: "market_structure", "trading_signal", "technical_indicators", or "data_validation" (optional)\n• **from_date**: Start date in YYYY-MM-DD format (optional)\n• **to_date**: End date in YYYY-MM-DD format (optional)\n• **limit**: Number of results 1-100 (default: 20)\n• **include_details**: Show analysis details (default: true)\n• **sort_by**: "newest", "oldest", "confidence", or "symbol" (default: "newest")\n\n**Examples:**\n• All AAPL analyses: \`{"symbol": "AAPL"}\`\n• Recent signals: \`{"analysis_type": "trading_signal", "limit": 10}\`\n• Date range: \`{"from_date": "2024-01-01", "to_date": "2024-01-31"}\`\n• Top confidence: \`{"sort_by": "confidence", "limit": 5}\`\n\n*Flexible history retrieval with multiple filter options.*`
        }],
        isError: true
      };
    }

    return {
      content: [{ 
        type: "text", 
        text: `❌ **History Retrieval Error**\n\nFailed to retrieve analysis history: ${(error as Error).message}\n\n**Troubleshooting:**\n• Verify MongoDB connection is active\n• Check date format (YYYY-MM-DD)\n• Ensure parameters are within valid ranges\n\n*If the problem persists, contact system administrator.*`
      }],
      isError: true
    };
  }
}