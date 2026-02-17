/**
 * @module AnalyticsQueries
 * @path src/tui/analytics/queries.ts
 * @description Collection of query functions for filtering and grouping logs by correlation, trace, and agent IDs.
 * @architectural-layer TUI
 * @dependencies [structured_logger]
 * @related-files [src/tui/structured_log_viewer.ts]
 */

import type { LogEntry } from "../../services/structured_logger.ts";

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
