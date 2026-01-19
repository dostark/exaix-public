/**
 * StructuredLogger - Comprehensive Structured Logging & Observability Service
 * Implements security audit item 17: Lack of Structured Logging & Observability
 *
 * Responsibilities:
 * 1. Provide structured logging with consistent format across the application
 * 2. Support multiple output destinations (console, file, database)
 * 3. Include comprehensive context (trace_id, request_id, user_id, agent_id, etc.)
 * 4. Enable performance tracking and operation timing
 * 5. Support different log levels with filtering
 * 6. Allow child loggers with inherited context
 * 7. Evaluate each log call for audit vs notification needs
 *
 * Required Deno permissions:
 * - --allow-write: For file output destinations
 * - --allow-read: For reading existing log files (rotation)
 */

import { dirname, join } from "@std/path";
import { ensureDir } from "@std/fs";

// ============================================================================
// Types and Interfaces
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: {
    trace_id?: string;
    request_id?: string;
    user_id?: string;
    agent_id?: string;
    portal?: string;
    session_id?: string;
    operation?: string;
    correlation_id?: string;
  };
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration_ms?: number;
    memory_mb?: number;
    cpu_percent?: number;
  };
}

export interface LogOutput {
  write(entry: LogEntry): void | Promise<void>;
}

export interface StructuredLoggerConfig {
  minLevel: LogLevel;
  outputs: LogOutput[];
  enablePerformanceTracking: boolean;
  serviceName?: string;
  version?: string;
}

// ============================================================================
// Output Implementations
// ============================================================================

export class ConsoleOutput implements LogOutput {
  write(entry: LogEntry): void {
    const formatted = this.formatEntry(entry);
    const consoleMethod = this.getConsoleMethod(entry.level);
    consoleMethod(formatted);
  }

  private formatEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const context = this.formatContext(entry.context);
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : "";
    const error = entry.error ? ` ERROR: ${entry.error.name}: ${entry.error.message}` : "";
    const performance = entry.performance ? ` PERF: ${JSON.stringify(entry.performance)}` : "";

    return `${timestamp} ${level} ${entry.message}${context}${metadata}${error}${performance}`;
  }

  private formatContext(context: LogEntry["context"]): string {
    const parts: string[] = [];
    if (context.trace_id) parts.push(`trace=${context.trace_id.slice(0, 8)}`);
    if (context.request_id) parts.push(`req=${context.request_id.slice(0, 8)}`);
    if (context.user_id) parts.push(`user=${context.user_id}`);
    if (context.agent_id) parts.push(`agent=${context.agent_id}`);
    if (context.operation) parts.push(`op=${context.operation}`);

    return parts.length > 0 ? ` [${parts.join(" ")}]` : "";
  }

  private getConsoleMethod(level: LogLevel): (message: string) => void {
    switch (level) {
      case "error":
      case "fatal":
        return console.error;
      case "warn":
        return console.warn;
      default:
        return console.log;
    }
  }
}

export class FileOutput implements LogOutput {
  private currentFilePath: string;
  private currentFileSize = 0;
  private dirEnsured = false;

  constructor(
    private basePath: string,
    private options: {
      maxSizeMB?: number;
      maxFiles?: number;
      rotationInterval?: "daily" | "hourly";
    } = {},
  ) {
    // If basePath doesn't end with .jsonl, treat it as a directory
    if (!basePath.endsWith(".jsonl")) {
      this.currentFilePath = this.generateFilePath();
    } else {
      this.currentFilePath = basePath;
    }
  }

  async write(entry: LogEntry): Promise<void> {
    const line = JSON.stringify(entry) + "\n";
    const lineSize = new TextEncoder().encode(line).length;

    // Check if rotation is needed
    if (this.shouldRotate(lineSize)) {
      await this.rotate();
    }

    try {
      if (!this.dirEnsured) {
        await ensureDir(dirname(this.currentFilePath));
        this.dirEnsured = true;
      }
      await Deno.writeTextFile(this.currentFilePath, line, { append: true });
      this.currentFileSize += lineSize;
    } catch (error) {
      // Fallback to console if file write fails
      console.error(`[FileOutput] Failed to write to log file ${this.currentFilePath}:`, error);
    }
  }

  private shouldRotate(newLineSize: number): boolean {
    const maxSize = (this.options.maxSizeMB ?? 10) * 1024 * 1024;
    return this.currentFileSize + newLineSize > maxSize;
  }

  private async rotate(): Promise<void> {
    const maxFiles = this.options.maxFiles ?? 5;

    // Rename current file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rotatedPath = `${this.currentFilePath}.${timestamp}`;

    try {
      await Deno.rename(this.currentFilePath, rotatedPath);
    } catch {
      // File might not exist yet, continue
    }

    // Clean up old files if we exceed maxFiles
    await this.cleanupOldFiles(maxFiles);

    // Generate new file path
    this.currentFilePath = this.generateFilePath();
    this.currentFileSize = 0;
  }

  private async cleanupOldFiles(maxFiles: number): Promise<void> {
    try {
      const dir = join(this.basePath, "..");
      const files: Array<{ name: string; mtime: Date }> = [];

      for await (const entry of Deno.readDir(dir)) {
        if (entry.isFile && entry.name.startsWith("structured-log.") && entry.name.endsWith(".jsonl")) {
          const stat = await Deno.stat(join(dir, entry.name));
          files.push({ name: entry.name, mtime: stat.mtime! });
        }
      }

      // Sort by modification time (newest first)
      files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Remove files beyond maxFiles
      for (let i = maxFiles; i < files.length; i++) {
        await Deno.remove(join(dir, files[i].name));
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private generateFilePath(): string {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

    if (this.options.rotationInterval === "hourly") {
      const hourStr = now.getHours().toString().padStart(2, "0");
      return join(this.basePath, `structured-log-${dateStr}-${hourStr}.jsonl`);
    }

    return join(this.basePath, `structured-log-${dateStr}.jsonl`);
  }
}

// ============================================================================
// Core Logger Implementation
// ============================================================================

export class StructuredLogger {
  private context: Partial<LogEntry["context"]> = {};
  private readonly config: StructuredLoggerConfig;

  constructor(config: StructuredLoggerConfig) {
    this.config = config;
  }

  setContext(context: Partial<LogEntry["context"]>): void {
    this.context = { ...this.context, ...context };
  }

  child(additionalContext: Partial<LogEntry["context"]>): StructuredLogger {
    const child = new StructuredLogger(this.config);
    child.context = { ...this.context, ...additionalContext };
    return child;
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log("debug", message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log("warn", message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.log("error", message, metadata, error);
  }

  fatal(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.log("fatal", message, metadata, error);
  }

  async time<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    if (!this.config.enablePerformanceTracking) {
      return fn();
    }

    const startTime = performance.now();
    const startMemory = Deno.memoryUsage?.().heapUsed ?? 0;

    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      const memoryDelta = (Deno.memoryUsage?.().heapUsed ?? 0) - startMemory;

      this.info(`Operation completed: ${operation}`, {
        ...metadata,
        performance: {
          duration_ms: Math.round(duration),
          memory_delta_mb: Math.round(memoryDelta / 1024 / 1024 * 100) / 100,
        },
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.error(`Operation failed: ${operation}`, error as Error, {
        ...metadata,
        performance: {
          duration_ms: Math.round(duration),
          failed: true,
        },
      });
      throw error;
    }
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context },
      metadata,
      error: error
        ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
        }
        : undefined,
    };

    // Write to all configured outputs
    for (const output of this.config.outputs) {
      try {
        const result = output.write(entry);
        if (result instanceof Promise) {
          result.catch((err) => console.error("[StructuredLogger] Output write failed:", err));
        }
      } catch (err) {
        console.error("[StructuredLogger] Output write failed:", err);
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error", "fatal"];
    const minIndex = levels.indexOf(this.config.minLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }
}

// ============================================================================
// Global Logger Instance
// ============================================================================

let globalLogger: StructuredLogger | null = null;

export function getGlobalLogger(): StructuredLogger {
  if (!globalLogger) {
    throw new Error("Global logger not initialized. Call initializeGlobalLogger() first.");
  }
  return globalLogger;
}

export function initializeGlobalLogger(config: StructuredLoggerConfig): StructuredLogger {
  globalLogger = new StructuredLogger(config);
  return globalLogger;
}

// For testing purposes only
export function resetGlobalLogger(): void {
  globalLogger = null;
}

// Convenience functions for global logger
export function logDebug(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().debug(message, metadata);
}

export function logInfo(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().info(message, metadata);
}

export function logWarn(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().warn(message, metadata);
}

export function logError(message: string, error?: Error, metadata?: Record<string, unknown>): void {
  getGlobalLogger().error(message, error, metadata);
}

export function logFatal(message: string, error?: Error, metadata?: Record<string, unknown>): void {
  getGlobalLogger().fatal(message, error, metadata);
}
