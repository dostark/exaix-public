/**
 * @module StructuredLogServiceModule
 * @path src/tui/structured_log_service.ts
 * @description Service layer for StructuredLogger TUI integration, enabling real-time log streaming, querying, and correlation tracking.
 * @architectural-layer TUI
 * @dependencies [structured_logger, structured_log_viewer]
 * @related-files [src/services/structured_logger.ts, src/tui/structured_log_viewer.ts]
 */

import type { IStructuredLogEntry } from "../shared/types/logging.ts";
import type { StructuredLogger } from "../services/structured_logger.ts";
import type { IStructuredLogService, LogQueryOptions } from "./structured_log_viewer.ts";

/**
 * Implementation of IStructuredLogService using StructuredLogger
 */
export class StructuredLoggerService implements IStructuredLogService {
  private logBuffer: IStructuredLogEntry[] = [];
  private subscribers: Array<(entry: IStructuredLogEntry) => void> = [];
  private maxBufferSize = 10000;

  constructor(private structuredLogger: StructuredLogger) {
    // Set up context for service logs
    this.structuredLogger = this.structuredLogger.child({
      operation: "log_service",
    });
  }

  getStructuredLogs(options: LogQueryOptions = {}): Promise<IStructuredLogEntry[]> {
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

  subscribeToLogs(callback: (entry: IStructuredLogEntry) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  async getLogsByCorrelationId(correlationId: string): Promise<IStructuredLogEntry[]> {
    return await this.getStructuredLogs({ correlationId });
  }

  async getLogsByTraceId(traceId: string): Promise<IStructuredLogEntry[]> {
    return await this.getStructuredLogs({ traceId });
  }

  async getLogsByAgentId(agentId: string): Promise<IStructuredLogEntry[]> {
    return await this.getStructuredLogs({ agentId });
  }

  async exportLogs(filename: string, entries: IStructuredLogEntry[]): Promise<void> {
    try {
      const jsonContent = JSON.stringify(entries, null, 2);
      await Deno.writeTextFile(filename, jsonContent);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.structuredLogger.error("Failed to export logs", err, { filename, entryCount: entries.length });
      throw err;
    }
  }

  addLogEntry(entry: IStructuredLogEntry): void {
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

  getLogBuffer(): IStructuredLogEntry[] {
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
