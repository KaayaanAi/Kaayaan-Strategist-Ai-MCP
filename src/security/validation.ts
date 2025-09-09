/**
 * Enhanced Input Validation & Sanitization Module
 * @fileoverview Comprehensive input validation with security focus for financial data
 */

import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { z } from 'zod';

// ==================== Security Patterns ====================

const SecurityPatterns = {
  // SQL Injection patterns
  SQL_INJECTION: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
  
  // XSS patterns
  XSS_SCRIPT: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  XSS_ON_EVENT: /on\w+\s*=/gi,
  XSS_JAVASCRIPT: /javascript:/gi,
  
  // Path traversal
  PATH_TRAVERSAL: /(\.\.[\/\\])|(\.\.[\\\/])/,
  
  // Command injection
  COMMAND_INJECTION: /[;&|`$(){}[\]]/,
  
  // NoSQL injection
  NOSQL_INJECTION: /(\$where|\$regex|\$ne|\$gt|\$lt|\$in|\$nin)/i,
};

// ==================== Financial Data Validation Schemas ====================

export const FinancialSymbolSchema = z.string()
  .min(1)
  .max(20)
  .regex(/^[A-Z0-9\.\-=]+$/, 'Invalid symbol format')
  .transform(s => s.toUpperCase());

export const CryptoPairSchema = z.string()
  .min(3)
  .max(20)
  .regex(/^[A-Z0-9]+-[A-Z0-9]+$/, 'Invalid crypto pair format (e.g., BTC-USD)')
  .transform(s => s.toUpperCase());

export const PeriodSchema = z.enum(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max']);

export const TimeframeSchema = z.enum(['short', 'medium', 'long']);

export const RiskToleranceSchema = z.enum(['conservative', 'moderate', 'aggressive']);

export const AnalysisTypeSchema = z.enum([
  'market_structure', 
  'trading_signal', 
  'technical_indicators', 
  'data_validation',
  'complete_analysis'
]);

// ==================== Joi Validation Schemas ====================

export const JoiSchemas = {
  symbol: Joi.string()
    .alphanum()
    .uppercase()
    .min(1)
    .max(20)
    .pattern(/^[A-Z0-9\.\-=]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Symbol must contain only alphanumeric characters, dots, hyphens, and equals signs',
      'string.max': 'Symbol must not exceed 20 characters',
      'string.min': 'Symbol must be at least 1 character'
    }),

  cryptoPair: Joi.string()
    .pattern(/^[A-Z0-9]+-[A-Z0-9]+$/)
    .min(3)
    .max(20)
    .required()
    .messages({
      'string.pattern.base': 'Crypto pair must be in format XXX-YYY (e.g., BTC-USD)'
    }),

  period: Joi.string()
    .valid('1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max')
    .default('1mo'),

  timeframe: Joi.string()
    .valid('short', 'medium', 'long')
    .default('medium'),

  riskTolerance: Joi.string()
    .valid('conservative', 'moderate', 'aggressive')
    .default('moderate'),

  confidence: Joi.number()
    .min(0)
    .max(100)
    .default(60),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(20),

  lookbackDays: Joi.number()
    .integer()
    .min(5)
    .max(365)
    .default(20),

  maxAge: Joi.number()
    .integer()
    .min(1)
    .max(10080) // 1 week in minutes
    .default(60),

  tags: Joi.array()
    .items(Joi.string().max(50).pattern(/^[a-zA-Z0-9_-]+$/))
    .max(10)
    .default([]),

  notes: Joi.string()
    .max(2000)
    .allow('')
    .default(''),

  dateString: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .messages({
      'string.pattern.base': 'Date must be in YYYY-MM-DD format'
    })
};

// ==================== Express Validator Chains ====================

export const ValidationChains = {
  symbol: body('symbol')
    .isString()
    .trim()
    .isLength({ min: 1, max: 20 })
    .matches(/^[A-Z0-9\.\-=]+$/)
    .toUpperCase()
    .withMessage('Invalid symbol format'),

  cryptoPair: body('symbol')
    .isString()
    .trim()
    .matches(/^[A-Z0-9]+-[A-Z0-9]+$/)
    .toUpperCase()
    .withMessage('Crypto pair must be in format XXX-YYY'),

  period: body('period')
    .optional()
    .isIn(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max'])
    .withMessage('Invalid period'),

  timeframe: body('timeframe')
    .optional()
    .isIn(['short', 'medium', 'long'])
    .withMessage('Invalid timeframe'),

  riskTolerance: body('risk_tolerance')
    .optional()
    .isIn(['conservative', 'moderate', 'aggressive'])
    .withMessage('Invalid risk tolerance'),

  confidence: body('min_confidence')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Confidence must be between 0 and 100'),

  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),

  boolean: (field: string) => body(field)
    .optional()
    .isBoolean()
    .withMessage(`${field} must be a boolean`),

  dateRange: [
    query('from_date')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('from_date must be in YYYY-MM-DD format'),
    query('to_date')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('to_date must be in YYYY-MM-DD format')
  ]
};

// ==================== Security Validation Functions ====================

export class SecurityValidator {
  /**
   * Check for malicious patterns in input
   */
  static containsMaliciousPatterns(input: string): { isMalicious: boolean; patterns: string[] } {
    const foundPatterns: string[] = [];
    
    for (const [patternName, regex] of Object.entries(SecurityPatterns)) {
      if (regex.test(input)) {
        foundPatterns.push(patternName);
      }
    }
    
    return {
      isMalicious: foundPatterns.length > 0,
      patterns: foundPatterns
    };
  }

  /**
   * Sanitize string input to prevent attacks
   */
  static sanitizeString(input: string): string {
    return input
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove potential XSS
      .replace(SecurityPatterns.XSS_SCRIPT, '')
      .replace(SecurityPatterns.XSS_ON_EVENT, '')
      .replace(SecurityPatterns.XSS_JAVASCRIPT, 'javascript-blocked:')
      // Trim whitespace and limit length
      .trim()
      .substring(0, 10000);
  }

  /**
   * Validate financial symbol format
   */
  static isValidFinancialSymbol(symbol: string): boolean {
    // Must be 1-20 characters, alphanumeric plus dots, hyphens, equals
    if (!/^[A-Z0-9\.\-=]{1,20}$/.test(symbol)) {
      return false;
    }

    // Check for known malicious patterns
    const { isMalicious } = this.containsMaliciousPatterns(symbol);
    return !isMalicious;
  }

  /**
   * Validate cryptocurrency pair format
   */
  static isValidCryptoPair(pair: string): boolean {
    return /^[A-Z0-9]{1,10}-[A-Z0-9]{1,10}$/.test(pair);
  }

  /**
   * Validate JSON structure for analysis data
   */
  static validateAnalysisData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof data !== 'object' || data === null) {
      errors.push('Analysis data must be an object');
      return { isValid: false, errors };
    }

    // Check for excessively nested objects (potential DoS)
    const maxDepth = 10;
    if (this.getObjectDepth(data) > maxDepth) {
      errors.push(`Analysis data exceeds maximum nesting depth of ${maxDepth}`);
    }

    // Check for excessively large objects
    const maxSize = 1000000; // 1MB in characters
    const jsonSize = JSON.stringify(data).length;
    if (jsonSize > maxSize) {
      errors.push(`Analysis data exceeds maximum size of ${maxSize} characters`);
    }

    // Check for potential NoSQL injection in keys
    for (const key of Object.keys(data)) {
      if (SecurityPatterns.NOSQL_INJECTION.test(key)) {
        errors.push(`Potentially malicious key detected: ${key}`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Calculate object nesting depth
   */
  private static getObjectDepth(obj: any, depth: number = 0): number {
    if (typeof obj !== 'object' || obj === null || depth > 20) {
      return depth;
    }

    let maxDepth = depth;
    for (const value of Object.values(obj)) {
      const currentDepth = this.getObjectDepth(value, depth + 1);
      maxDepth = Math.max(maxDepth, currentDepth);
    }

    return maxDepth;
  }
}

// ==================== Validation Middleware ====================

export function validateRequest(validationRules: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run validation rules
    await Promise.all(validationRules.map(rule => rule.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors.array()
        },
        timestamp: new Date().toISOString()
      });
    }

    // Additional security checks
    const requestBody = JSON.stringify(req.body);
    const requestQuery = JSON.stringify(req.query);
    const requestParams = JSON.stringify(req.params);

    const allInput = `${requestBody}${requestQuery}${requestParams}`;
    const { isMalicious, patterns } = SecurityValidator.containsMaliciousPatterns(allInput);

    if (isMalicious) {
      console.warn(`Malicious patterns detected in request: ${patterns.join(', ')}`);
      return res.status(400).json({
        success: false,
        error: {
          code: 'SECURITY_VIOLATION',
          message: 'Request contains potentially malicious content',
          details: 'Security filters triggered'
        },
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

// ==================== Joi Validation Middleware ====================

export function validateWithJoi(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.details.map((detail: any) => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        },
        timestamp: new Date().toISOString()
      });
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
}

// ==================== Common Validation Schemas ====================

export const CommonValidationSchemas = {
  marketStructure: Joi.object({
    symbol: JoiSchemas.symbol,
    period: JoiSchemas.period,
    include_support_resistance: Joi.boolean().default(true),
    include_volatility: Joi.boolean().default(true),
    lookback_days: JoiSchemas.lookbackDays
  }),

  tradingSignal: Joi.object({
    symbol: JoiSchemas.symbol,
    timeframe: JoiSchemas.timeframe,
    risk_tolerance: JoiSchemas.riskTolerance,
    include_stop_loss: Joi.boolean().default(true),
    include_take_profit: Joi.boolean().default(true),
    min_confidence: JoiSchemas.confidence
  }),

  technicalIndicators: Joi.object({
    symbol: JoiSchemas.symbol,
    indicators: Joi.array()
      .items(Joi.string().valid('rsi', 'macd', 'sma', 'ema', 'all'))
      .default(['all']),
    period: JoiSchemas.period,
    rsi_period: Joi.number().integer().min(5).max(50).default(14),
    macd_fast: Joi.number().integer().min(5).max(30).default(12),
    macd_slow: Joi.number().integer().min(20).max(50).default(26),
    macd_signal: Joi.number().integer().min(5).max(20).default(9),
    sma_period: Joi.number().integer().min(5).max(200).default(20),
    ema_period: Joi.number().integer().min(5).max(200).default(20),
    include_interpretation: Joi.boolean().default(true)
  }),

  storeAnalysis: Joi.object({
    symbol: JoiSchemas.symbol,
    analysis_type: Joi.string()
      .valid('market_structure', 'trading_signal', 'technical_indicators', 'data_validation')
      .required(),
    analysis_data: Joi.object().required(),
    notes: JoiSchemas.notes,
    tags: JoiSchemas.tags,
    confidence: JoiSchemas.confidence,
    data_source: Joi.string()
      .valid('yahoo', 'alpha_vantage', 'cached')
      .default('yahoo')
  }),

  analysisHistory: Joi.object({
    symbol: JoiSchemas.symbol.optional(),
    analysis_type: Joi.string()
      .valid('market_structure', 'trading_signal', 'technical_indicators', 'data_validation')
      .optional(),
    from_date: JoiSchemas.dateString.optional(),
    to_date: JoiSchemas.dateString.optional(),
    limit: JoiSchemas.limit,
    include_details: Joi.boolean().default(true),
    sort_by: Joi.string()
      .valid('newest', 'oldest', 'confidence', 'symbol')
      .default('newest')
  }),

  dataQuality: Joi.object({
    symbol: JoiSchemas.symbol,
    validation_type: Joi.string()
      .valid('basic', 'comprehensive', 'real_time')
      .default('basic'),
    check_historical: Joi.boolean().default(true),
    check_current: Joi.boolean().default(true),
    max_age_minutes: JoiSchemas.maxAge,
    store_results: Joi.boolean().default(false)
  })
};

export default {
  SecurityValidator,
  validateRequest,
  validateWithJoi,
  ValidationChains,
  CommonValidationSchemas,
  FinancialSymbolSchema,
  CryptoPairSchema,
  PeriodSchema
};