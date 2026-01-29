/**
 * Analytics Types
 */

export interface TimeRange {
  start: Date;
  end: Date;
  duration: number;
}

export interface CorrelationAnalysis {
  correlationId: string;
  traceIds: string[];
  agentIds: string[];
  operations: string[];
  timeSpan: TimeRange;
  entryCount: number;
  errorCount: number;
  performanceStats?: {
    totalDuration: number;
    avgDuration: number;
    maxDuration: number;
    minDuration: number;
  };
}

export interface TraceOperation {
  operation: string;
  timestamp: Date;
  duration?: number;
  agentId?: string;
  level: string;
  message: string;
}

export interface TraceAnalysis {
  traceId: string;
  correlationId?: string;
  operations: TraceOperation[];
  timeSpan: TimeRange;
  errorCount: number;
  success: boolean;
}

export interface PerformanceStats {
  totalOperations: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  p95Duration: number;
  errorRate: number;
}

export interface ErrorPattern {
  pattern: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  affectedOperations: string[];
}
