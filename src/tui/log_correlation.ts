/**
 * Log Correlation Utilities - Helper functions for log correlation and tracing
 *
 * Part of Phase 13.6: StructuredLogger TUI Integration
 *
 * This module provides utilities for correlating logs across different operations,
 * tracing requests through the system, and analyzing log patterns.
 */

import type { LogEntry } from "../services/structured_logger.ts";

/**
 * Correlation analysis result
 */
export interface CorrelationAnalysis {
  correlationId: string;
  traceIds: string[];
  agentIds: string[];
  operations: string[];
  timeSpan: {
    start: Date;
    end: Date;
    duration: number;
  };
  entryCount: number;
  errorCount: number;
  performanceStats?: {
    totalDuration: number;
    avgDuration: number;
    maxDuration: number;
    minDuration: number;
  };
}

/**
 * Trace analysis result
 */
export interface TraceAnalysis {
  traceId: string;
  correlationId?: string;
  operations: Array<{
    operation: string;
    timestamp: Date;
    duration?: number;
    agentId?: string;
    level: string;
    message: string;
  }>;
  timeSpan: {
    start: Date;
    end: Date;
    duration: number;
  };
  errorCount: number;
  success: boolean;
}

/**
 * Analyze correlation across multiple log entries
 */
export function analyzeCorrelation(entries: LogEntry[]): CorrelationAnalysis | null {
  if (entries.length === 0) return null;

  // Find common correlation ID
  const correlationIds = new Set(entries.map((e) => e.context.correlation_id).filter(Boolean));
  if (correlationIds.size !== 1) return null;

  const correlationId = Array.from(correlationIds)[0]!;

  // Extract metadata
  const traceIds = new Set(entries.map((e) => e.context.trace_id).filter(Boolean));
  const agentIds = new Set(entries.map((e) => e.context.agent_id).filter(Boolean));
  const operations = new Set(entries.map((e) => e.context.operation).filter(Boolean));

  // Time analysis
  const timestamps = entries.map((e) => new Date(e.timestamp));
  const start = new Date(Math.min(...timestamps.map((t) => t.getTime())));
  const end = new Date(Math.max(...timestamps.map((t) => t.getTime())));
  const duration = end.getTime() - start.getTime();

  // Error analysis
  const errorCount = entries.filter((e) => e.level === "error" || e.level === "fatal").length;

  // Performance analysis
  const performanceEntries = entries.filter((e) => e.performance?.duration_ms);
  let performanceStats;
  if (performanceEntries.length > 0) {
    const durations = performanceEntries.map((e) => e.performance!.duration_ms!);
    performanceStats = {
      totalDuration: durations.reduce((sum, d) => sum + d, 0),
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
    };
  }

  return {
    correlationId,
    traceIds: Array.from(traceIds).filter(Boolean) as string[],
    agentIds: Array.from(agentIds).filter(Boolean) as string[],
    operations: Array.from(operations).filter(Boolean) as string[],
    timeSpan: { start, end, duration },
    entryCount: entries.length,
    errorCount,
    performanceStats,
  };
}

/**
 * Analyze a trace through the system
 */
export function analyzeTrace(entries: LogEntry[]): TraceAnalysis | null {
  if (entries.length === 0) return null;

  // Find common trace ID
  const traceIds = new Set(entries.map((e) => e.context.trace_id).filter(Boolean));
  if (traceIds.size !== 1) return null;

  const traceId = Array.from(traceIds)[0]!;

  // Find correlation ID (may be null)
  const correlationIds = new Set(entries.map((e) => e.context.correlation_id).filter(Boolean));
  const correlationId = correlationIds.size === 1 ? Array.from(correlationIds)[0] : undefined;

  // Sort entries by timestamp
  const sortedEntries = entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const operations = sortedEntries.map((entry) => ({
    operation: entry.context.operation || "unknown",
    timestamp: new Date(entry.timestamp),
    duration: entry.performance?.duration_ms,
    agentId: entry.context.agent_id,
    level: entry.level,
    message: entry.message,
  }));

  // Time analysis
  const start = operations[0].timestamp;
  const end = operations[operations.length - 1].timestamp;
  const duration = end.getTime() - start.getTime();

  // Error analysis
  const errorCount = operations.filter((op) => op.level === "error" || op.level === "fatal").length;
  const success = errorCount === 0;

  return {
    traceId,
    correlationId,
    operations,
    timeSpan: { start, end, duration },
    errorCount,
    success,
  };
}

/**
 * Find related logs by correlation ID
 */
export function findRelatedLogs(entries: LogEntry[], correlationId: string): LogEntry[] {
  return entries.filter((entry) => entry.context.correlation_id === correlationId);
}

/**
 * Find related logs by trace ID
 */
export function findTraceLogs(entries: LogEntry[], traceId: string): LogEntry[] {
  return entries.filter((entry) => entry.context.trace_id === traceId);
}

/**
 * Find logs by agent ID
 */
export function findAgentLogs(entries: LogEntry[], agentId: string): LogEntry[] {
  return entries.filter((entry) => entry.context.agent_id === agentId);
}

/**
 * Group logs by correlation ID
 */
export function groupByCorrelation(entries: LogEntry[]): Record<string, LogEntry[]> {
  const groups: Record<string, LogEntry[]> = {};
  for (const entry of entries) {
    const correlationId = entry.context.correlation_id || "no-correlation";
    if (!groups[correlationId]) {
      groups[correlationId] = [];
    }
    groups[correlationId].push(entry);
  }
  return groups;
}

/**
 * Group logs by trace ID
 */
export function groupByTrace(entries: LogEntry[]): Record<string, LogEntry[]> {
  const groups: Record<string, LogEntry[]> = {};
  for (const entry of entries) {
    const traceId = entry.context.trace_id || "no-trace";
    if (!groups[traceId]) {
      groups[traceId] = [];
    }
    groups[traceId].push(entry);
  }
  return groups;
}

/**
 * Calculate performance statistics for a set of logs
 */
export function calculatePerformanceStats(entries: LogEntry[]): {
  totalOperations: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  p95Duration: number;
  errorRate: number;
} | null {
  const performanceEntries = entries.filter((e) => e.performance?.duration_ms);
  if (performanceEntries.length === 0) return null;

  const durations = performanceEntries.map((e) => e.performance!.duration_ms!);
  const sortedDurations = durations.sort((a, b) => a - b);

  const totalOperations = entries.length;
  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const maxDuration = Math.max(...durations);
  const minDuration = Math.min(...durations);
  const p95Duration = sortedDurations[Math.floor(sortedDurations.length * 0.95)];

  const errorCount = entries.filter((e) => e.level === "error" || e.level === "fatal").length;
  const errorRate = errorCount / totalOperations;

  return {
    totalOperations,
    avgDuration,
    maxDuration,
    minDuration,
    p95Duration,
    errorRate,
  };
}

/**
 * Detect error patterns in logs
 */
export function detectErrorPatterns(entries: LogEntry[]): Array<{
  pattern: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  affectedOperations: string[];
}> {
  const errorEntries = entries.filter((e) => e.level === "error" || e.level === "fatal");

  // Group by error message pattern (simplified)
  const patterns: Record<string, {
    count: number;
    firstSeen: Date;
    lastSeen: Date;
    operations: Set<string>;
  }> = {};

  for (const entry of errorEntries) {
    const pattern = entry.error?.message || entry.message;
    const operation = entry.context.operation || "unknown";
    const timestamp = new Date(entry.timestamp);

    if (!patterns[pattern]) {
      patterns[pattern] = {
        count: 0,
        firstSeen: timestamp,
        lastSeen: timestamp,
        operations: new Set(),
      };
    }

    patterns[pattern].count++;
    patterns[pattern].operations.add(operation);

    if (timestamp < patterns[pattern].firstSeen) {
      patterns[pattern].firstSeen = timestamp;
    }
    if (timestamp > patterns[pattern].lastSeen) {
      patterns[pattern].lastSeen = timestamp;
    }
  }

  return Object.entries(patterns).map(([pattern, data]) => ({
    pattern,
    count: data.count,
    firstSeen: data.firstSeen,
    lastSeen: data.lastSeen,
    affectedOperations: Array.from(data.operations),
  })).sort((a, b) => b.count - a.count);
}
