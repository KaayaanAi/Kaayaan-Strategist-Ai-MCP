import { MongoClient, Db, Collection, MongoClientOptions } from "mongodb";
import { appConfig } from "../config.js";
import { TimezoneUtils } from "./timezone.js";

export interface AnalysisRecord {
  _id?: string;
  symbol: string;
  analysisType: "market_structure" | "trading_signal" | "technical_indicators" | "data_validation";
  timestamp: {
    timestamp: string;
    date: string;
    time: string;
    timezone: string;
    isMarketHours: boolean;
    iso: string;
  };
  input: Record<string, any>;
  output: Record<string, any>;
  confidence?: number;
  dataSource: "yahoo" | "alpha_vantage" | "coingecko" | "cached";
  processingTime: number;
  version: string;
}

export interface CostTrackingRecord {
  _id?: string;
  date: string;
  source: "yahoo" | "alpha_vantage" | "coingecko";
  endpoint: string;
  requestCount: number;
  estimatedCost: number;
  symbol?: string;
  timestamp: {
    timestamp: string;
    iso: string;
  };
}

export class MongoDBService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnected = false;
  
  // Collections
  private analysisCollection: Collection<AnalysisRecord> | null = null;
  private costTrackingCollection: Collection<CostTrackingRecord> | null = null;

  /**
   * Initialize MongoDB connection
   */
  async initialize(): Promise<void> {
    try {
      const options: MongoClientOptions = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      };

      this.client = new MongoClient(appConfig.mongodb.uri, options);
      
      await this.client.connect();
      this.db = this.client.db();
      
      // Initialize collections
      this.analysisCollection = this.db.collection<AnalysisRecord>('analyses');
      this.costTrackingCollection = this.db.collection<CostTrackingRecord>('cost_tracking');
      
      // Create indexes for better performance
      await this.createIndexes();
      
      this.isConnected = true;
      console.error('📊 MongoDB connected successfully');
      
    } catch (error) {
      console.error('❌ MongoDB connection failed:', (error as Error).message);
      this.client = null;
      this.db = null;
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Create database indexes for optimal performance
   */
  private async createIndexes(): Promise<void> {
    try {
      if (!this.analysisCollection || !this.costTrackingCollection) {
        return;
      }

      // Analyses collection indexes
      await this.analysisCollection.createIndex({ symbol: 1, "timestamp.iso": -1 });
      await this.analysisCollection.createIndex({ analysisType: 1, "timestamp.iso": -1 });
      await this.analysisCollection.createIndex({ "timestamp.date": 1 });
      await this.analysisCollection.createIndex({ dataSource: 1 });
      
      // Cost tracking collection indexes  
      await this.costTrackingCollection.createIndex({ date: 1, source: 1 });
      await this.costTrackingCollection.createIndex({ "timestamp.iso": -1 });
      
      console.error('🔍 MongoDB indexes created successfully');
      
    } catch (error) {
      console.error('⚠️ MongoDB index creation failed:', (error as Error).message);
    }
  }

  /**
   * Check if MongoDB is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null && this.db !== null;
  }

  /**
   * Store analysis result
   */
  async storeAnalysis(
    symbol: string,
    analysisType: AnalysisRecord['analysisType'],
    input: Record<string, any>,
    output: Record<string, any>,
    confidence?: number,
    dataSource: AnalysisRecord['dataSource'] = "yahoo",
    processingTime: number = 0
  ): Promise<string | null> {
    if (!this.isAvailable() || !this.analysisCollection) {
      return null;
    }

    try {
      const record: AnalysisRecord = {
        symbol: symbol.toUpperCase(),
        analysisType,
        timestamp: TimezoneUtils.createAnalysisTimestamp(),
        input,
        output,
        confidence,
        dataSource,
        processingTime,
        version: "1.0.0",
      };

      const result = await this.analysisCollection.insertOne(record);
      return result.insertedId.toString();
      
    } catch (error) {
      console.error('MongoDB storeAnalysis error:', (error as Error).message);
      return null;
    }
  }

  /**
   * Get analysis history with filtering
   */
  async getAnalysisHistory(
    symbol?: string,
    analysisType?: AnalysisRecord['analysisType'],
    limit: number = 50,
    fromDate?: string,
    toDate?: string
  ): Promise<AnalysisRecord[]> {
    if (!this.isAvailable() || !this.analysisCollection) {
      return [];
    }

    try {
      const filter: any = {};
      
      if (symbol) {
        filter.symbol = symbol.toUpperCase();
      }
      
      if (analysisType) {
        filter.analysisType = analysisType;
      }
      
      if (fromDate || toDate) {
        filter["timestamp.date"] = {};
        if (fromDate) filter["timestamp.date"].$gte = fromDate;
        if (toDate) filter["timestamp.date"].$lte = toDate;
      }

      const results = await this.analysisCollection
        .find(filter)
        .sort({ "timestamp.iso": -1 })
        .limit(limit)
        .toArray();

      return results;
      
    } catch (error) {
      console.error('MongoDB getAnalysisHistory error:', (error as Error).message);
      return [];
    }
  }

  /**
   * Get latest analysis for a symbol
   */
  async getLatestAnalysis(
    symbol: string,
    analysisType?: AnalysisRecord['analysisType']
  ): Promise<AnalysisRecord | null> {
    if (!this.isAvailable() || !this.analysisCollection) {
      return null;
    }

    try {
      const filter: any = { symbol: symbol.toUpperCase() };
      if (analysisType) {
        filter.analysisType = analysisType;
      }

      const result = await this.analysisCollection
        .findOne(filter, { sort: { "timestamp.iso": -1 } });

      return result;
      
    } catch (error) {
      console.error('MongoDB getLatestAnalysis error:', (error as Error).message);
      return null;
    }
  }

  /**
   * Track API usage costs
   */
  async trackCost(
    source: CostTrackingRecord['source'],
    endpoint: string,
    requestCount: number = 1,
    estimatedCost: number = 0,
    symbol?: string
  ): Promise<boolean> {
    if (!this.isAvailable() || !this.costTrackingCollection) {
      return false;
    }

    try {
      const today = TimezoneUtils.getCurrentDate();
      const timestamp = TimezoneUtils.createAnalysisTimestamp();

      // Try to update existing record for today
      const filter = { date: today, source, endpoint, symbol };
      const update = {
        $inc: { requestCount, estimatedCost },
        $set: { timestamp: { timestamp: timestamp.timestamp, iso: timestamp.iso } }
      };

      const result = await this.costTrackingCollection.updateOne(
        filter,
        update,
        { upsert: true }
      );

      return true;
      
    } catch (error) {
      console.error('MongoDB trackCost error:', (error as Error).message);
      return false;
    }
  }

  /**
   * Get cost tracking statistics
   */
  async getCostStats(
    fromDate?: string,
    toDate?: string,
    source?: CostTrackingRecord['source']
  ): Promise<{
    totalRequests: number;
    totalCost: number;
    requestsBySource: Record<string, number>;
    costBySource: Record<string, number>;
    dailyStats: Array<{ date: string; requests: number; cost: number }>;
  }> {
    if (!this.isAvailable() || !this.costTrackingCollection) {
      return {
        totalRequests: 0,
        totalCost: 0,
        requestsBySource: {},
        costBySource: {},
        dailyStats: [],
      };
    }

    try {
      const matchFilter: any = {};
      
      if (fromDate || toDate) {
        matchFilter.date = {};
        if (fromDate) matchFilter.date.$gte = fromDate;
        if (toDate) matchFilter.date.$lte = toDate;
      }
      
      if (source) {
        matchFilter.source = source;
      }

      const pipeline = [
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: "$requestCount" },
            totalCost: { $sum: "$estimatedCost" },
            bySource: {
              $push: {
                source: "$source",
                requests: "$requestCount",
                cost: "$estimatedCost"
              }
            },
            dailyStats: {
              $push: {
                date: "$date",
                requests: "$requestCount",
                cost: "$estimatedCost"
              }
            }
          }
        }
      ];

      const result = await this.costTrackingCollection.aggregate(pipeline).toArray();
      
      if (result.length === 0) {
        return {
          totalRequests: 0,
          totalCost: 0,
          requestsBySource: {},
          costBySource: {},
          dailyStats: [],
        };
      }

      const stats = result[0];
      
      // Group by source
      const requestsBySource: Record<string, number> = {};
      const costBySource: Record<string, number> = {};
      
      for (const item of stats.bySource) {
        requestsBySource[item.source] = (requestsBySource[item.source] || 0) + item.requests;
        costBySource[item.source] = (costBySource[item.source] || 0) + item.cost;
      }

      // Group daily stats
      const dailyStatsMap: Record<string, { requests: number; cost: number }> = {};
      for (const item of stats.dailyStats) {
        if (!dailyStatsMap[item.date]) {
          dailyStatsMap[item.date] = { requests: 0, cost: 0 };
        }
        dailyStatsMap[item.date].requests += item.requests;
        dailyStatsMap[item.date].cost += item.cost;
      }

      const dailyStats = Object.entries(dailyStatsMap).map(([date, data]) => ({
        date,
        requests: data.requests,
        cost: data.cost,
      }));

      return {
        totalRequests: stats.totalRequests,
        totalCost: stats.totalCost,
        requestsBySource,
        costBySource,
        dailyStats,
      };
      
    } catch (error) {
      console.error('MongoDB getCostStats error:', (error as Error).message);
      return {
        totalRequests: 0,
        totalCost: 0,
        requestsBySource: {},
        costBySource: {},
        dailyStats: [],
      };
    }
  }

  /**
   * Clean up old records (data retention)
   */
  async cleanupOldRecords(daysToKeep: number = 90): Promise<{ analysisDeleted: number; costDeleted: number }> {
    if (!this.isAvailable() || !this.analysisCollection || !this.costTrackingCollection) {
      return { analysisDeleted: 0, costDeleted: 0 };
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffISO = cutoffDate.toISOString();

      const analysisResult = await this.analysisCollection.deleteMany({
        "timestamp.iso": { $lt: cutoffISO }
      });

      const costResult = await this.costTrackingCollection.deleteMany({
        "timestamp.iso": { $lt: cutoffISO }
      });

      return {
        analysisDeleted: analysisResult.deletedCount || 0,
        costDeleted: costResult.deletedCount || 0,
      };
      
    } catch (error) {
      console.error('MongoDB cleanupOldRecords error:', (error as Error).message);
      return { analysisDeleted: 0, costDeleted: 0 };
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    totalAnalyses: number;
    totalCostRecords: number;
    oldestRecord?: string;
    newestRecord?: string;
  }> {
    const stats: {
      connected: boolean;
      totalAnalyses: number;
      totalCostRecords: number;
      oldestRecord?: string;
      newestRecord?: string;
    } = {
      connected: this.isAvailable(),
      totalAnalyses: 0,
      totalCostRecords: 0,
    };

    if (!this.isAvailable() || !this.analysisCollection || !this.costTrackingCollection) {
      return stats;
    }

    try {
      stats.totalAnalyses = await this.analysisCollection.countDocuments();
      stats.totalCostRecords = await this.costTrackingCollection.countDocuments();

      const oldest = await this.analysisCollection.findOne({}, { sort: { "timestamp.iso": 1 } });
      const newest = await this.analysisCollection.findOne({}, { sort: { "timestamp.iso": -1 } });

      if (oldest) stats.oldestRecord = oldest.timestamp.timestamp;
      if (newest) stats.newestRecord = newest.timestamp.timestamp;

    } catch (error) {
      console.error('MongoDB getStats error:', (error as Error).message);
    }

    return stats;
  }

  /**
   * Close MongoDB connection
   */
  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        this.isConnected = false;
        this.client = null;
        this.db = null;
        this.analysisCollection = null;
        this.costTrackingCollection = null;
      } catch (error) {
        console.error('MongoDB close error:', (error as Error).message);
      }
    }
  }
}

// Export singleton instance
export const mongoDBService = new MongoDBService();