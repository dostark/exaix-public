/**
 * @module CommonTypes
 * @path src/services/common/types.ts
 * @description Shared type definitions for services, including ILogEvent and IServiceContext.
 * @architectural-layer Services
 * @dependencies [LogLevel]
 * @related-files [src/services/event_logger.ts, src/services/structured_logger.ts]
 */
import { LogLevel } from "../../enums.ts";
import { JSONValue } from "../../types.ts";

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
export interface ILogEvent {
  /** Action type in domain.action format (e.g., "daemon.started") */
  action: string;

  /** Target entity (file path, service name, etc.) */
  target: string;

  /** Additional context as key-value pairs */
  payload?: Record<string, JSONValue>;

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
 * Common service context for middleware.
 * Subinterfaces (ToolContext, RequestProcessingContext, etc.) extend this
 * with their own typed properties — no index signature needed.
 */
export interface IServiceContext {
  traceId?: string;
  agentId?: string;
  actor?: Actor;
}
