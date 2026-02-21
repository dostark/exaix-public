import { Spy, spy } from "@std/testing/mock";
import type { IStructuredLogger, LogEntry } from "../../../src/services/structured_logger.ts";
import { LogMetadata } from "../../../src/types.ts";

/**
 * Interface that combines IStructuredLogger with Spies for testing
 */
export interface MockStructuredLogger extends IStructuredLogger {
  setContext: Spy<void, [context: Partial<LogEntry["context"]>], void>;
  child: Spy<void, [additionalContext: Partial<LogEntry["context"]>], IStructuredLogger>;
  debug: Spy<void, [message: string, metadata?: LogMetadata | undefined], void>;
  info: Spy<void, [message: string, metadata?: LogMetadata | undefined], void>;
  warn: Spy<void, [message: string, metadata?: LogMetadata | undefined], void>;
  error: Spy<void, [message: string, error?: Error | undefined, metadata?: LogMetadata | undefined], void>;
  fatal: Spy<void, [message: string, error?: Error | undefined, metadata?: LogMetadata | undefined], void>;
  time: Spy<void, [operation: string, fn: () => Promise<any>, metadata?: LogMetadata | undefined], Promise<any>>;
}

/**
 * Helper functions for GracefulShutdown tests
 */

/**
 * Creates a mock logger with spy methods for testing
 */
export function createMockLogger(): MockStructuredLogger {
  return {
    setContext: spy(() => {}),
    child: spy(() => ({} as IStructuredLogger)),
    debug: spy(() => {}),
    info: spy(() => {}),
    warn: spy(() => {}),
    error: spy(() => {}),
    fatal: spy(() => {}),
    time: spy((_op: string, fn: () => Promise<unknown>) => fn()),
  } as unknown as MockStructuredLogger;
}
