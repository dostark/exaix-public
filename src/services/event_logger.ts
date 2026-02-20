/**
 * @module EventLogger
 * @path src/services/event_logger.ts
 * @description Unified logging service that writes to both console and Activity Journal.
 * Supports child loggers, structured payloads, and consistent log levels across the system.
 * @architectural-layer Services
 * @dependencies [DatabaseService, ActivityRepository, LogLevel, CommonTypes]
 * @related-files [src/services/db.ts, src/repositories/activity_repository.ts, src/services/common/types.ts]
 */

import type { IDatabaseService } from "./db.ts";
import type { ActivityRepository } from "../repositories/activity_repository.ts";
import { LogLevel } from "../enums.ts";
import { Actor, LogEvent } from "./common/types.ts";
import { TUI_DEFAULT_ICONS } from "../helpers/constants.ts";
import { JSONValue, LogMetadata, toSafeJson } from "../types.ts";

export type { Actor, LogEvent };

/**
 * Configuration for EventLogger
 */
export interface EventLoggerConfig {
  /** ActivityRepository instance (optional - allows console-only mode) */
  activityRepo?: ActivityRepository;

  /** DatabaseService instance (optional - allows console-only mode) - DEPRECATED: use activityRepo */
  db?: IDatabaseService;

  /** Prefix for console messages (e.g., "[ExoFrame]") */
  prefix?: string;

  /** Minimum log level to output */
  minLevel?: LogLevel;

  /** Whether to include timestamps in console output */
  showTimestamp?: boolean;

  /**
   * Default actor identity. For CLI commands, this should be the user identity
   * obtained from git config (user.email) or OS username.
   */
  defaultActor?: Actor;
}

// ============================================================================
// Implementation
// ============================================================================

/** Log level priority for filtering */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.FATAL]: 4,
};

/** Default icons for each log level */
const DEFAULT_ICONS: Record<LogLevel, string> = {
  [LogLevel.INFO]: TUI_DEFAULT_ICONS.info,
  [LogLevel.WARN]: TUI_DEFAULT_ICONS.warn,
  [LogLevel.ERROR]: TUI_DEFAULT_ICONS.error,
  [LogLevel.DEBUG]: TUI_DEFAULT_ICONS.debug,
  [LogLevel.FATAL]: TUI_DEFAULT_ICONS.fatal,
};

/** Cached user identity to avoid repeated git calls */
let cachedUserIdentity: string | null = null;

export interface IEventLogger {
  log(event: LogEvent): Promise<void>;
  info(action: string, target: string | null, payload?: LogMetadata, traceId?: string): Promise<void>;
  warn(action: string, target: string | null, payload?: LogMetadata, traceId?: string): Promise<void>;
  error(action: string, target: string | null, payload?: LogMetadata, traceId?: string): Promise<void>;
  fatal(action: string, target: string | null, payload?: LogMetadata, traceId?: string): Promise<void>;
  debug(action: string, target: string | null, payload?: LogMetadata, traceId?: string): Promise<void>;
  child(overrides: Partial<LogEvent>): IEventLogger;
}

/**
 * Unified logging service that writes to both console and Activity Journal.
 *
 * @example
 * ```typescript
 * const logger = new EventLogger({ db: dbService, prefix: "[ExoFrame]" });
 *
 * // Basic usage
 * logger.info("config.loaded", "exo.config.toml", { checksum: "abc123" });
 *
 * // Create child logger for a service
 * const serviceLogger = logger.child({ actor: "system", traceId });
 * serviceLogger.warn("context.truncated", "loader", { files_skipped: 3 });
 * ```
 */
export class EventLogger implements IEventLogger {
  private readonly activityRepo?: ActivityRepository;
  private readonly db?: IDatabaseService; // DEPRECATED
  private readonly prefix: string;
  private readonly minLevel: LogLevel;
  private readonly showTimestamp: boolean;
  private readonly defaultActor: Actor;
  private readonly defaults: Partial<LogEvent>;

  constructor(config: EventLoggerConfig, defaults: Partial<LogEvent> = {}) {
    this.activityRepo = config.activityRepo;
    this.db = config.db; // DEPRECATED
    this.prefix = config.prefix ?? "";
    this.minLevel = config.minLevel ?? LogLevel.INFO;
    this.showTimestamp = config.showTimestamp ?? false;
    this.defaultActor = config.defaultActor ?? "system";
    this.defaults = defaults;
  }

  /**
   * Log an event to both console and Activity Journal
   */
  async log(event: LogEvent): Promise<void>;
  async log(
    action: string,
    targetOrPayload: string | LogMetadata,
    payload?: LogMetadata,
  ): Promise<void>;
  async log(
    eventOrAction: LogEvent | string,
    targetOrPayload?: string | LogMetadata,
    payload?: LogMetadata,
  ): Promise<void> {
    let event: LogEvent;

    if (typeof eventOrAction === "string") {
      // Overloaded call: log(action, targetOrPayload, payload?)
      const action = eventOrAction;
      if (typeof targetOrPayload === "string") {
        // log(action, target, payload?)
        event = { action, target: targetOrPayload, payload };
      } else {
        // log(action, payload) - target defaults to empty string
        event = { action, target: "", payload: targetOrPayload };
      }
    } else {
      // Standard call: log(event)
      event = eventOrAction;
    }

    const level = event.level ?? LogLevel.INFO;

    // Check if this level should be logged
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    // Merge with defaults
    const mergedEvent: LogEvent = {
      ...this.defaults,
      ...event,
      actor: event.actor ?? this.defaults.actor ?? this.defaultActor,
      traceId: event.traceId ?? this.defaults.traceId ?? crypto.randomUUID(),
    };

    // Log to console
    this.logToConsole(mergedEvent, level);

    // Log to Activity Journal
    await this.logToDatabase(mergedEvent);
  }

  /**
   * Log an info-level event
   */
  async info(
    action: string,
    target: string,
    payload?: LogMetadata,
    traceId?: string,
  ): Promise<void> {
    await this.log({
      action,
      target,
      payload: payload ? (toSafeJson(payload) as LogMetadata) : undefined,
      level: LogLevel.INFO,
      traceId,
    });
  }

  /**
   * Log a warning-level event
   */
  async warn(
    action: string,
    target: string,
    payload?: LogMetadata,
    traceId?: string,
  ): Promise<void> {
    await this.log({
      action,
      target,
      payload: payload ? (toSafeJson(payload) as LogMetadata) : undefined,
      level: LogLevel.WARN,
      traceId,
    });
  }

  /**
   * Log an error-level event
   */
  async error(
    action: string,
    target: string,
    payload?: LogMetadata,
    traceId?: string,
  ): Promise<void> {
    await this.log({
      action,
      target,
      payload: payload ? (toSafeJson(payload) as Record<string, JSONValue>) : undefined,
      level: LogLevel.ERROR,
      traceId,
    });
  }

  /**
   * Log a debug-level event
   */
  async debug(
    action: string,
    target: string,
    payload?: LogMetadata,
    traceId?: string,
  ): Promise<void> {
    await this.log({
      action,
      target,
      payload: payload ? (toSafeJson(payload) as Record<string, JSONValue>) : undefined,
      level: LogLevel.DEBUG,
      traceId,
    });
  }

  /**
   * Log a fatal-level event
   */
  async fatal(
    action: string,
    target: string,
    payload?: LogMetadata,
    traceId?: string,
  ): Promise<void> {
    await this.log({
      action,
      target,
      payload: payload ? (toSafeJson(payload) as Record<string, JSONValue>) : undefined,
      level: LogLevel.FATAL,
      traceId,
    });
  }

  /**
   * Create a child logger with preset values (e.g., for a specific service)
   */
  child(defaults: Partial<LogEvent>): EventLogger {
    const mergedDefaults: Partial<LogEvent> = {
      ...this.defaults,
      ...defaults,
    };

    const childConfig: EventLoggerConfig = {
      db: this.db,
      prefix: this.prefix,
      minLevel: this.minLevel,
      showTimestamp: this.showTimestamp,
      defaultActor: this.defaultActor,
    };

    return new EventLogger(childConfig, mergedDefaults);
  }

  /**
   * Get user identity from git config or OS username.
   * Results are cached after first call.
   */
  static async getUserIdentity(): Promise<string> {
    if (cachedUserIdentity) {
      return cachedUserIdentity;
    }

    // Try git config user.email
    try {
      const command = new Deno.Command("git", {
        args: ["config", "user.email"],
        stdout: "piped",
        stderr: "null",
      });
      const { code, stdout } = await command.output();
      if (code === 0) {
        const email = new TextDecoder().decode(stdout).trim();
        if (email) {
          cachedUserIdentity = email;
          return email;
        }
      }
    } catch {
      // git not available, continue to fallbacks
    }

    // Try git config user.name
    try {
      const command = new Deno.Command("git", {
        args: ["config", "user.name"],
        stdout: "piped",
        stderr: "null",
      });
      const { code, stdout } = await command.output();
      if (code === 0) {
        const name = new TextDecoder().decode(stdout).trim();
        if (name) {
          cachedUserIdentity = name;
          return name;
        }
      }
    } catch {
      // git not available, continue to fallbacks
    }

    // Fallback to OS username
    const osUser = Deno.env.get("USER") ?? Deno.env.get("USERNAME") ?? "unknown";
    cachedUserIdentity = osUser;
    return osUser;
  }

  /**
   * Clear cached user identity (mainly for testing)
   */
  static clearIdentityCache(): void {
    cachedUserIdentity = null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Format and log event to console
   */
  private logToConsole(event: LogEvent, level: LogLevel): void {
    const icon = event.icon ?? DEFAULT_ICONS[level];
    const timestamp = this.showTimestamp ? this.formatTimestamp() + " " : "";
    const prefix = this.prefix ? this.prefix + " " : "";

    // Build main message line
    const mainLine = `${timestamp}${icon} ${event.action}: ${event.target}`;

    // Select appropriate console method
    const consoleFn = level === LogLevel.ERROR ? console.error : level === LogLevel.WARN ? console.warn : console.log;

    consoleFn(prefix + mainLine);

    // Log payload values indented
    if (event.payload && Object.keys(event.payload).length > 0) {
      for (const [key, value] of Object.entries(event.payload)) {
        const valueStr = typeof value === "object" ? JSON.stringify(value) : String(value);
        consoleFn(`   ${key}: ${valueStr}`);
      }
    }
  }

  /**
   * Log event to Activity Journal database
   */
  private async logToDatabase(event: LogEvent): Promise<void> {
    // Prefer ActivityRepository over direct DatabaseService
    if (this.activityRepo) {
      try {
        await this.activityRepo.logActivity({
          actor: event.actor ?? this.defaultActor,
          actionType: event.action,
          target: event.target,
          payload: event.payload ?? {},
          traceId: event.traceId,
          agentId: event.agentId ?? null,
        });
      } catch (error) {
        // Database write failed - log warning but don't crash
        console.warn(`[EventLogger] Failed to write to Activity Journal via repository:`, error);
      }
    } else if (this.db) {
      // Fallback to deprecated direct database access
      try {
        this.db.logActivity(
          event.actor ?? this.defaultActor,
          event.action,
          event.target,
          event.payload ?? {},
          event.traceId,
          event.agentId ?? null,
        );
      } catch (error) {
        // Database write failed - log warning but don't crash
        console.warn(`[EventLogger] Failed to write to Activity Journal:`, error);
      }
    }
  }

  /**
   * Format current timestamp for console output
   */
  private formatTimestamp(): string {
    const now = new Date();
    return now.toISOString().slice(11, 19); // HH:MM:SS
  }
}
