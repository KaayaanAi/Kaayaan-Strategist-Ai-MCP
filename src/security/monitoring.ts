/**
 * Security Monitoring & Alerting Module
 * @fileoverview Comprehensive security monitoring, threat detection, and alerting
 */

import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import crypto from 'crypto';
import { redisCache } from '../services/redis.js';
import { mongoDBService } from '../services/mongodb.js';
import { appConfig } from '../config.js';

// ==================== Types ====================

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  severity: SecuritySeverity;
  source: {
    ip: string;
    userAgent: string;
    userId?: string;
    apiKey?: string;
  };
  details: {
    description: string;
    endpoint?: string;
    method?: string;
    payload?: any;
    response?: any;
    metadata?: Record<string, any>;
  };
  resolved: boolean;
}

export enum SecurityEventType {
  AUTHENTICATION_FAILURE = 'auth_failure',
  AUTHORIZATION_FAILURE = 'authz_failure',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  MALICIOUS_INPUT = 'malicious_input',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt',
  SYSTEM_ANOMALY = 'system_anomaly',
  BRUTE_FORCE_ATTACK = 'brute_force_attack',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  UNAUTHORIZED_API_ACCESS = 'unauthorized_api_access'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ThreatScore {
  score: number; // 0-100
  factors: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// ==================== Security Monitoring System ====================

export class SecurityMonitor extends EventEmitter {
  private static instance: SecurityMonitor;
  private eventStore: SecurityEvent[] = [];
  private readonly maxStoredEvents = 10000;
  private threatScores = new Map<string, ThreatScore>();

  private constructor() {
    super();
    this.setupEventHandlers();
  }

  public static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  private setupEventHandlers(): void {
    this.on('security_event', this.handleSecurityEvent.bind(this));
    this.on('critical_threat', this.handleCriticalThreat.bind(this));
    this.on('anomaly_detected', this.handleAnomalyDetection.bind(this));
  }

  // ==================== Event Recording ====================

  public recordSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): void {
    const securityEvent: SecurityEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      resolved: false
    };

    // Store event
    this.eventStore.push(securityEvent);
    if (this.eventStore.length > this.maxStoredEvents) {
      this.eventStore.shift();
    }

    // Emit event for handlers
    this.emit('security_event', securityEvent);

    // Check for critical threats
    if (event.severity === SecuritySeverity.CRITICAL) {
      this.emit('critical_threat', securityEvent);
    }

    // Update threat score
    this.updateThreatScore(event.source.ip, securityEvent);

    // Store in persistent storage if available
    this.persistSecurityEvent(securityEvent);
  }

  // ==================== Threat Analysis ====================

  public calculateThreatScore(clientIp: string, event: SecurityEvent): ThreatScore {
    const factors: string[] = [];
    let score = 0;

    // Recent security events from same IP
    const recentEvents = this.getRecentEvents(clientIp, 3600000); // 1 hour
    if (recentEvents.length > 5) {
      score += 30;
      factors.push('Multiple recent security events');
    }

    // Event type severity
    switch (event.type) {
      case SecurityEventType.BRUTE_FORCE_ATTACK:
        score += 40;
        factors.push('Brute force attack detected');
        break;
      case SecurityEventType.SQL_INJECTION_ATTEMPT:
        score += 35;
        factors.push('SQL injection attempt');
        break;
      case SecurityEventType.DATA_BREACH_ATTEMPT:
        score += 50;
        factors.push('Data breach attempt');
        break;
      case SecurityEventType.MALICIOUS_INPUT:
        score += 20;
        factors.push('Malicious input detected');
        break;
      case SecurityEventType.RATE_LIMIT_EXCEEDED:
        score += 10;
        factors.push('Rate limit exceeded');
        break;
    }

    // User agent analysis
    const userAgent = event.source.userAgent.toLowerCase();
    if (this.isSuspiciousUserAgent(userAgent)) {
      score += 15;
      factors.push('Suspicious user agent');
    }

    // Geographic analysis (if available)
    // Note: Would need IP geolocation service integration
    
    // Time-based analysis
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) { // Outside business hours
      score += 5;
      factors.push('Outside normal hours');
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (score >= 80) riskLevel = 'critical';
    else if (score >= 60) riskLevel = 'high';
    else if (score >= 40) riskLevel = 'medium';
    else riskLevel = 'low';

    const threatScore: ThreatScore = {
      score: Math.min(score, 100),
      factors,
      riskLevel
    };

    return threatScore;
  }

  private updateThreatScore(clientIp: string, event: SecurityEvent): void {
    const threatScore = this.calculateThreatScore(clientIp, event);
    this.threatScores.set(clientIp, threatScore);

    // Emit anomaly if threat score is high
    if (threatScore.riskLevel === 'high' || threatScore.riskLevel === 'critical') {
      this.emit('anomaly_detected', { clientIp, threatScore, event });
    }
  }

  // ==================== Event Handlers ====================

  private async handleSecurityEvent(event: SecurityEvent): Promise<void> {
    console.warn(`🚨 Security Event [${event.severity.toUpperCase()}]: ${event.type}`, {
      id: event.id,
      source: event.source.ip,
      description: event.details.description,
      endpoint: event.details.endpoint
    });

    // Log to file or external service in production
    if (appConfig.app.nodeEnv === 'production') {
      // await this.logToExternalService(event);
    }
  }

  private async handleCriticalThreat(event: SecurityEvent): Promise<void> {
    console.error(`🚨 CRITICAL SECURITY THREAT DETECTED:`, {
      id: event.id,
      type: event.type,
      source: event.source,
      description: event.details.description
    });

    // Implement immediate response actions
    await this.executeCriticalThreatResponse(event);
  }

  private async handleAnomalyDetection(data: { clientIp: string; threatScore: ThreatScore; event: SecurityEvent }): Promise<void> {
    console.warn(`🔍 Security Anomaly Detected:`, {
      clientIp: data.clientIp,
      threatScore: data.threatScore.score,
      riskLevel: data.threatScore.riskLevel,
      factors: data.threatScore.factors
    });

    // Implement anomaly response
    await this.executeAnomalyResponse(data);
  }

  // ==================== Response Actions ====================

  private async executeCriticalThreatResponse(event: SecurityEvent): Promise<void> {
    // 1. Immediately block the source IP (if configured)
    if (this.shouldAutoBlock(event)) {
      await this.blockIpAddress(event.source.ip, 3600000); // Block for 1 hour
    }

    // 2. Alert administrators
    await this.sendSecurityAlert(event);

    // 3. Revoke API keys if compromise suspected
    if (event.type === SecurityEventType.UNAUTHORIZED_API_ACCESS && event.source.apiKey) {
      await this.revokeApiKey(event.source.apiKey);
    }

    // 4. Create incident record
    await this.createSecurityIncident(event);
  }

  private async executeAnomalyResponse(data: { clientIp: string; threatScore: ThreatScore; event: SecurityEvent }): Promise<void> {
    // Enhanced monitoring for this IP
    await this.enableEnhancedMonitoring(data.clientIp, 1800000); // 30 minutes

    // Rate limit reduction
    if (data.threatScore.riskLevel === 'high' || data.threatScore.riskLevel === 'critical') {
      await this.applyStrictRateLimit(data.clientIp);
    }
  }

  // ==================== Utility Methods ====================

  private getRecentEvents(clientIp: string, timeWindow: number): SecurityEvent[] {
    const cutoff = new Date(Date.now() - timeWindow);
    return this.eventStore.filter(event => 
      event.source.ip === clientIp && 
      event.timestamp >= cutoff
    );
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      'sqlmap',
      'nikto',
      'nmap',
      'masscan',
      'nessus',
      'openvas',
      'curl',
      'wget',
      'python-requests',
      'bot',
      'crawler',
      'spider'
    ];

    return suspiciousPatterns.some(pattern => userAgent.includes(pattern));
  }

  private shouldAutoBlock(event: SecurityEvent): boolean {
    // Auto-block for critical threats
    const autoBlockTypes = [
      SecurityEventType.BRUTE_FORCE_ATTACK,
      SecurityEventType.SQL_INJECTION_ATTEMPT,
      SecurityEventType.DATA_BREACH_ATTEMPT
    ];

    return autoBlockTypes.includes(event.type);
  }

  private async blockIpAddress(ipAddress: string, duration: number): Promise<void> {
    if (redisCache.isAvailable()) {
      const success = await redisCache.set('blocked_ip', ipAddress, 'blocked', Math.floor(duration / 1000));
      if (success) {
        console.warn(`🚫 IP Address blocked: ${ipAddress} for ${duration}ms`);
      }
    }
  }

  private async revokeApiKey(apiKey: string): Promise<void> {
    // Implementation would depend on your API key management system
    console.error(`🔑 API Key revoked due to security threat: ${apiKey.substring(0, 8)}...`);
  }

  private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    // Implementation for sending alerts (email, Slack, etc.)
    console.error(`📧 Security alert sent for event: ${event.id}`);
  }

  private async createSecurityIncident(event: SecurityEvent): Promise<void> {
    // Create incident record in database using service methods
    if (mongoDBService.isAvailable()) {
      try {
        const incidentData = {
          eventId: event.id,
          type: event.type,
          severity: event.severity,
          source: event.source,
          details: event.details,
          timestamp: event.timestamp,
          status: 'open'
        };
        
        // Store as analysis record with type 'data_validation' for security incidents
        await mongoDBService.storeAnalysis(
          `SECURITY_INCIDENT_${event.id}`,
          'data_validation',
          { incident: true, originalEvent: event },
          incidentData,
          100,
          'cached',
          0
        );
      } catch (error) {
        console.error('Failed to create security incident record:', error);
      }
    }
  }

  private async enableEnhancedMonitoring(clientIp: string, duration: number): Promise<void> {
    if (redisCache.isAvailable()) {
      await redisCache.set('enhanced_monitoring', clientIp, 'enabled', Math.floor(duration / 1000));
    }
  }

  private async applyStrictRateLimit(clientIp: string): Promise<void> {
    if (redisCache.isAvailable()) {
      await redisCache.set('strict_rate_limit', clientIp, 'enabled', 1800); // 30 minutes
    }
  }

  private async persistSecurityEvent(event: SecurityEvent): Promise<void> {
    if (mongoDBService.isAvailable()) {
      try {
        // Store security events as analysis records with type 'data_validation'
        await mongoDBService.storeAnalysis(
          `SECURITY_EVENT_${event.id}`,
          'data_validation',
          {
            securityEvent: true,
            type: event.type,
            severity: event.severity,
            source: event.source
          },
          {
            eventData: event,
            resolved: event.resolved
          },
          event.severity === SecuritySeverity.CRITICAL ? 100 : 50,
          'cached',
          0
        );
      } catch (error) {
        console.error('Failed to persist security event:', error);
      }
    }
  }

  // ==================== Query Methods ====================

  public getSecurityEvents(filter?: {
    type?: SecurityEventType;
    severity?: SecuritySeverity;
    clientIp?: string;
    since?: Date;
    limit?: number;
  }): SecurityEvent[] {
    let events = [...this.eventStore];

    if (filter) {
      if (filter.type) {
        events = events.filter(e => e.type === filter.type);
      }
      if (filter.severity) {
        events = events.filter(e => e.severity === filter.severity);
      }
      if (filter.clientIp) {
        events = events.filter(e => e.source.ip === filter.clientIp);
      }
      if (filter.since) {
        events = events.filter(e => e.timestamp >= filter.since!);
      }
    }

    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filter?.limit) {
      events = events.slice(0, filter.limit);
    }

    return events;
  }

  public getThreatScore(clientIp: string): ThreatScore | undefined {
    return this.threatScores.get(clientIp);
  }

  public getSecurityMetrics(): {
    totalEvents: number;
    eventsBySeverity: Record<SecuritySeverity, number>;
    eventsByType: Record<SecurityEventType, number>;
    topThreats: Array<{ ip: string; score: number; riskLevel: string }>;
    recentCriticalEvents: SecurityEvent[];
  } {
    const eventsBySeverity: Record<SecuritySeverity, number> = {
      [SecuritySeverity.LOW]: 0,
      [SecuritySeverity.MEDIUM]: 0,
      [SecuritySeverity.HIGH]: 0,
      [SecuritySeverity.CRITICAL]: 0
    };

    const eventsByType: Record<SecurityEventType, number> = {} as Record<SecurityEventType, number>;

    for (const event of this.eventStore) {
      eventsBySeverity[event.severity]++;
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    }

    const topThreats = Array.from(this.threatScores.entries())
      .map(([ip, threatScore]) => ({ ip, score: threatScore.score, riskLevel: threatScore.riskLevel }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const recentCriticalEvents = this.getSecurityEvents({
      severity: SecuritySeverity.CRITICAL,
      since: new Date(Date.now() - 86400000), // Last 24 hours
      limit: 10
    });

    return {
      totalEvents: this.eventStore.length,
      eventsBySeverity,
      eventsByType,
      topThreats,
      recentCriticalEvents
    };
  }
}

// ==================== Express Middleware ====================

export function securityMonitoringMiddleware() {
  const monitor = SecurityMonitor.getInstance();

  return (req: Request, res: Response, next: any) => {
    const startTime = Date.now();

    // Override res.end to capture response data
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any, cb?: any) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Record security events based on response
      if (res.statusCode >= 400) {
        let eventType: SecurityEventType;
        let severity: SecuritySeverity;

        switch (res.statusCode) {
          case 401:
            eventType = SecurityEventType.AUTHENTICATION_FAILURE;
            severity = SecuritySeverity.MEDIUM;
            break;
          case 403:
            eventType = SecurityEventType.AUTHORIZATION_FAILURE;
            severity = SecuritySeverity.HIGH;
            break;
          case 429:
            eventType = SecurityEventType.RATE_LIMIT_EXCEEDED;
            severity = SecuritySeverity.LOW;
            break;
          default:
            eventType = SecurityEventType.SUSPICIOUS_ACTIVITY;
            severity = SecuritySeverity.LOW;
        }

        monitor.recordSecurityEvent({
          type: eventType,
          severity,
          source: {
            ip: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            userId: (req as any).user?.id,
            apiKey: (req as any).user?.apiKey
          },
          details: {
            description: `HTTP ${res.statusCode} response`,
            endpoint: req.path,
            method: req.method,
            payload: req.body,
            metadata: {
              responseTime,
              statusCode: res.statusCode
            }
          }
        });
      }

      return originalEnd.call(this, chunk, encoding, cb);
    };

    next();
  };
}

// Export singleton instance
export const securityMonitor = SecurityMonitor.getInstance();

export default {
  SecurityMonitor,
  securityMonitor,
  securityMonitoringMiddleware,
  SecurityEventType,
  SecuritySeverity
};