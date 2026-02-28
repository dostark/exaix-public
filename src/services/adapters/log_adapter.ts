/**
 * @module LogAdapter
 * @path src/services/adapters/log_adapter.ts
 * @description Adapter implementing ILogService for TUI by wrapping StructuredLogger.
 * @architectural-layer Services
 * @dependencies [ILogService, StructuredLogger]
 */

import { ILogService } from "../../shared/interfaces/i_log_service.ts";
import { FileOutput, ObservableOutput, StructuredLogger } from "../structured_logger.ts";
import type { IStructuredLogEntry, LogQueryOptions } from "../../shared/types/logging.ts";
import { join } from "@std/path";

/**
 * Adapter that provides log querying and subscription capabilities for the TUI,
 * delegating to the core StructuredLogger service.
 */
export class LogServiceAdapter implements ILogService {
  constructor(private logger: StructuredLogger) {}

  /**
   * Get logs based on query options by reading from log files.
   */
  async getStructuredLogs(options: LogQueryOptions): Promise<IStructuredLogEntry[]> {
    const fileOutput = this.logger.getOutputs().find((o) => o instanceof FileOutput) as FileOutput;
    if (!fileOutput) {
      return [];
    }

    const logPath = fileOutput.getBasePath();
    const logs: IStructuredLogEntry[] = [];
    const limit = options.limit || 100;

    try {
      // If logPath is a directory, find .jsonl files
      const stat = await Deno.stat(logPath);
      const filesToRead: string[] = [];

      if (stat.isDirectory) {
        for await (const entry of Deno.readDir(logPath)) {
          if (entry.isFile && entry.name.endsWith(".jsonl")) {
            filesToRead.push(join(logPath, entry.name));
          }
        }
      } else {
        filesToRead.push(logPath);
      }

      // Sort files by name (usually contains timestamp) descending to get newest first
      filesToRead.sort().reverse();

      for (const file of filesToRead) {
        if (logs.length >= limit) break;

        const content = await Deno.readTextFile(file);
        const lines = content.trim().split("\n").reverse(); // Newest first

        for (const line of lines) {
          if (!line) continue;
          try {
            const entry = JSON.parse(line) as IStructuredLogEntry;

            // Apply filters
            if (options.level && !options.level.includes(entry.level)) continue;
            if (options.traceId && entry.context.trace_id !== options.traceId) continue;
            if (
              options.correlationId && entry.context.correlation_id !== options.correlationId
            ) continue;
            if (options.agentId && entry.context.agent_id !== options.agentId) continue;

            logs.push(entry);
            if (logs.length >= limit) break;
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error) {
      console.error("Error reading structured logs:", error);
    }

    return logs;
  }

  /**
   * Subscribe to new log entries.
   */
  subscribeToLogs(callback: (entry: IStructuredLogEntry) => void): () => void {
    const observable = this.logger.getOutputs().find((o) => o instanceof ObservableOutput) as
      | ObservableOutput
      | undefined;

    if (!observable) {
      console.warn("ObservableOutput not found in logger, log subscription will not work.");
      return () => {};
    }

    return observable.subscribe(callback);
  }

  /**
   * Get logs by correlation ID.
   */
  async getLogsByCorrelationId(correlationId: string): Promise<IStructuredLogEntry[]> {
    return await this.getStructuredLogs({ correlationId });
  }

  /**
   * Get logs by trace ID (context.trace_id).
   */
  async getLogsByTraceId(traceId: string): Promise<IStructuredLogEntry[]> {
    return await this.getStructuredLogs({ traceId });
  }

  /**
   * Get logs by agent ID.
   */
  async getLogsByAgentId(agentId: string): Promise<IStructuredLogEntry[]> {
    return await this.getStructuredLogs({ agentId });
  }

  /**
   * Export logs to a JSONL file.
   */
  async exportLogs(filename: string, entries: IStructuredLogEntry[]): Promise<void> {
    const content = entries.map((e) => JSON.stringify(e)).join("\n");
    await Deno.writeTextFile(filename, content);
  }
}
