/**
 * StructuredLogService - Service layer for StructuredLogger TUI integration
 *
 * Part of Phase 13.6: StructuredLogger TUI Integration
 *
 * This service provides the interface between the StructuredLogger and TUI components,
 * enabling real-time log streaming, querying, and correlation tracking.
 */

import type { LogEntry, StructuredLogger } from "../services/structured_logger.ts";
import type { LogQueryOptions, StructuredLogService } from "./structured_log_viewer.ts";

/**
 * Implementation of StructuredLogService using StructuredLogger
 */
export class StructuredLoggerService implements StructuredLogService {
  private logBuffer: LogEntry[] = [];
  private subscribers: Array<(entry: LogEntry) => void> = [];
  private maxBufferSize = 10000;

  constructor(private structuredLogger: StructuredLogger) {
    // Set up context for service logs
    this.structuredLogger = this.structuredLogger.child({
      operation: "log_service",
    });
  }

  getStructuredLogs(options: LogQueryOptions = {}): Promise<LogEntry[]> {
    try {
      // For now, return from buffer. In production, this would query a database
      // or read from log files based on the options
      let entries = [...this.logBuffer];

      // Apply filters
      if (options.level && options.level.length > 0) {
        entries = entries.filter((entry) => options.level!.includes(entry.level));
      }

      if (options.context) {
        entries = entries.filter((entry) => {
          for (const [key, value] of Object.entries(options.context!)) {
            if (entry.context[key as keyof typeof entry.context] !== value) {
              return false;
            }
          }
          return true;
        });
      }

      if (options.correlationId) {
        entries = entries.filter((entry) => entry.context.correlation_id === options.correlationId);
      }

      if (options.traceId) {
        entries = entries.filter((entry) => entry.context.trace_id === options.traceId);
      }

      if (options.agentId) {
        entries = entries.filter((entry) => entry.context.agent_id === options.agentId);
      }

      if (options.timeRange) {
        const startTime = options.timeRange.start.getTime();
        const endTime = options.timeRange.end.getTime();
        entries = entries.filter((entry) => {
          const entryTime = new Date(entry.timestamp).getTime();
          return entryTime >= startTime && entryTime <= endTime;
        });
      }

      // Apply limit
      if (options.limit) {
        entries = entries.slice(0, options.limit);
      }

      return Promise.resolve(entries);
    } catch (error) {
      const _err = error instanceof Error ? error : new Error(String(error));
      this.structuredLogger.error("Failed to get structured logs", undefined, { operation: "getStructuredLogs" });
      return Promise.resolve([]);
    }
  }

  subscribeToLogs(callback: (entry: LogEntry) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  async getLogsByCorrelationId(correlationId: string): Promise<LogEntry[]> {
    return await this.getStructuredLogs({ correlationId });
  }

  async getLogsByTraceId(traceId: string): Promise<LogEntry[]> {
    return await this.getStructuredLogs({ traceId });
  }

  async getLogsByAgentId(agentId: string): Promise<LogEntry[]> {
    return await this.getStructuredLogs({ agentId });
  }

  addLogEntry(entry: LogEntry): void {
    // Add to buffer
    this.logBuffer.push(entry);

    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }

    // Notify subscribers
    for (const subscriber of this.subscribers) {
      try {
        subscriber(entry);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.structuredLogger.error("Failed to notify log subscriber", err, { operation: "notifySubscribers" });
      }
    }
  }

  getLogBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  clearLogBuffer(): void {
    this.logBuffer = [];
  }

  getBufferSize(): number {
    return this.logBuffer.length;
  }

  setMaxBufferSize(size: number): void {
    this.maxBufferSize = size;
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }
}
