/**
 * @module CommonTypes
 * @path src/services/common/types.ts
 * @description Shared type definitions for services, including LogEvent and ServiceContext.
 * @architectural-layer Services
 * @dependencies [LogLevel]
 * @related-files [src/services/event_logger.ts, src/services/structured_logger.ts]
 */
import { LogLevel } from "../../enums.ts";

/**
 * Actor types:
 * - "system" - Daemon, watcher, internal services
 * - "agent:<id>" - AI agent (e.g., "agent:senior-coder")
 * - "<user>" - Human user identity from git config or OS
 */
export type Actor = string;

/**
 * Structured log event
 */
export interface LogEvent {
  /** Action type in domain.action format (e.g., "daemon.started") */
  action: string;

  /** Target entity (file path, service name, etc.) */
  target: string;

  /** Additional context as key-value pairs */
  payload?: Record<string, unknown>;

  /** Actor performing the action */
  actor?: Actor;

  /** Trace ID for correlation */
  traceId?: string;

  /** Agent ID for agent-specific events */
  agentId?: string;

  /** Log level for console output */
  level?: LogLevel;

  /** Custom emoji/icon for console output */
  icon?: string;
}

/**
 * Common service context for middleware
 */
export interface ServiceContext {
  traceId?: string;
  agentId?: string;
  actor?: Actor;
  [key: string]: any;
}
