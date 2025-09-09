import { z } from "zod";
import "dotenv/config";

const configSchema = z.object({
  // MongoDB Configuration
  MONGODB_URI: z.string().default("mongodb://localhost:27017/kaayaan_strategist"),
  
  // Redis Configuration
  REDIS_URL: z.string().default("redis://localhost:6379"),
  
  // Alpha Vantage API Key (backup data source)
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  
  // Application Configuration
  TIMEZONE: z.string().default("Asia/Kuwait"),
  CACHE_TTL_MINUTES: z.string().transform(Number).pipe(z.number().positive()).default("15"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  
  // Rate Limiting (per minute)
  YAHOO_RATE_LIMIT: z.string().transform(Number).pipe(z.number().positive()).default("60"),
  ALPHA_VANTAGE_RATE_LIMIT: z.string().transform(Number).pipe(z.number().positive()).default("5"),
  COINGECKO_RATE_LIMIT: z.string().transform(Number).pipe(z.number().positive()).default("50"),
  
  // Universal MCP Server Configuration
  HTTP_MODE: z.string().transform((val) => val === 'true').default("false"),
  PORT: z.string().transform(Number).pipe(z.number().positive()).default("3000"),
  HOST: z.string().default("0.0.0.0"),
  WEBSOCKET_PORT: z.string().transform(Number).pipe(z.number().positive()).default("3001"),
  
  // Security Configuration
  API_KEY: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  ENABLE_AUTH: z.string().transform((val) => val === 'true').default("false"),
  
  // Protocol Configuration
  ENABLE_STDIO: z.string().transform((val) => val !== 'false').default("true"),
  ENABLE_HTTP_REST: z.string().transform((val) => val !== 'false').default("true"),
  ENABLE_HTTP_MCP: z.string().transform((val) => val !== 'false').default("true"),
  ENABLE_WEBSOCKET: z.string().transform((val) => val !== 'false').default("true"),
  
  // Environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

type Config = z.infer<typeof configSchema>;

let config: Config;

try {
  config = configSchema.parse(process.env);
} catch (error) {
  console.error("❌ Environment configuration validation failed:", (error as Error).message);
  process.exit(1);
}

export const appConfig = {
  // Database
  mongodb: {
    uri: config.MONGODB_URI,
  },
  
  // Cache
  redis: {
    url: config.REDIS_URL,
    ttlMinutes: config.CACHE_TTL_MINUTES,
  },
  
  // Data Sources
  dataSources: {
    alphaVantage: {
      apiKey: config.ALPHA_VANTAGE_API_KEY,
      rateLimit: config.ALPHA_VANTAGE_RATE_LIMIT,
    },
    yahoo: {
      rateLimit: config.YAHOO_RATE_LIMIT,
    },
    coinGecko: {
      rateLimit: config.COINGECKO_RATE_LIMIT,
    },
  },
  
  // Universal MCP Server
  server: {
    httpMode: config.HTTP_MODE,
    port: config.PORT,
    host: config.HOST,
    websocketPort: config.WEBSOCKET_PORT,
  },
  
  // Security
  security: {
    apiKey: config.API_KEY,
    allowedOrigins: config.ALLOWED_ORIGINS?.split(',') || [],
    enableAuth: config.ENABLE_AUTH,
  },
  
  // Protocols
  protocols: {
    stdio: config.ENABLE_STDIO,
    httpRest: config.ENABLE_HTTP_REST,
    httpMcp: config.ENABLE_HTTP_MCP,
    websocket: config.ENABLE_WEBSOCKET,
  },
  
  // Application
  app: {
    timezone: config.TIMEZONE,
    logLevel: config.LOG_LEVEL,
    nodeEnv: config.NODE_ENV,
  },
};

export type AppConfig = typeof appConfig;