import { appConfig } from "../config.js";

export class TimezoneUtils {
  private static readonly KUWAIT_TIMEZONE = appConfig.app.timezone;

  /**
   * Get current timestamp in Kuwait timezone
   */
  static getCurrentTimestamp(): string {
    return new Date().toLocaleString("en-US", {
      timeZone: this.KUWAIT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  /**
   * Get current date in Kuwait timezone (YYYY-MM-DD format)
   */
  static getCurrentDate(): string {
    return new Date().toLocaleDateString("en-CA", {
      timeZone: this.KUWAIT_TIMEZONE,
    });
  }

  /**
   * Get current time in Kuwait timezone (HH:MM:SS format)
   */
  static getCurrentTime(): string {
    return new Date().toLocaleTimeString("en-US", {
      timeZone: this.KUWAIT_TIMEZONE,
      hour12: false,
    });
  }

  /**
   * Convert any date to Kuwait timezone
   */
  static toKuwaitTime(date: Date): string {
    return date.toLocaleString("en-US", {
      timeZone: this.KUWAIT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  /**
   * Check if Kuwait markets are likely open (basic check)
   * Kuwait Stock Exchange: Sunday to Thursday, 9:30 AM - 1:00 PM (+03)
   */
  static isKuwaitMarketHours(): boolean {
    const now = new Date();
    const kuwaitTime = new Date(now.toLocaleString("en-US", { timeZone: this.KUWAIT_TIMEZONE }));
    
    const day = kuwaitTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = kuwaitTime.getHours();
    const minutes = kuwaitTime.getMinutes();
    const totalMinutes = hour * 60 + minutes;
    
    // Kuwait Stock Exchange operates Sunday (0) to Thursday (4)
    const isWorkingDay = day >= 0 && day <= 4;
    
    // Market hours: 9:30 AM to 1:00 PM (+03)
    const marketStart = 9 * 60 + 30; // 9:30 AM in minutes
    const marketEnd = 13 * 60; // 1:00 PM in minutes
    
    const isDuringMarketHours = totalMinutes >= marketStart && totalMinutes <= marketEnd;
    
    return isWorkingDay && isDuringMarketHours;
  }

  /**
   * Get ISO string with Kuwait timezone offset
   */
  static getISOWithTimezone(date?: Date): string {
    const targetDate = date || new Date();
    
    // Kuwait is UTC+3
    const kuwaitOffset = 3 * 60; // 180 minutes
    const utcTime = targetDate.getTime() + (targetDate.getTimezoneOffset() * 60000);
    const kuwaitTime = new Date(utcTime + (kuwaitOffset * 60000));
    
    return kuwaitTime.toISOString().replace('Z', '+03:00');
  }

  /**
   * Create analysis timestamp with metadata
   */
  static createAnalysisTimestamp(): {
    timestamp: string;
    date: string;
    time: string;
    timezone: string;
    isMarketHours: boolean;
    iso: string;
  } {
    return {
      timestamp: this.getCurrentTimestamp(),
      date: this.getCurrentDate(),
      time: this.getCurrentTime(),
      timezone: this.KUWAIT_TIMEZONE,
      isMarketHours: this.isKuwaitMarketHours(),
      iso: this.getISOWithTimezone(),
    };
  }
}