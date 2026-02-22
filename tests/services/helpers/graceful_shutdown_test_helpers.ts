import { Spy, spy } from "@std/testing/mock";
import type { IStructuredLogger } from "../../../src/services/structured_logger.ts";

/**
 * Interface that combines IStructuredLogger with Spies for testing
 */
export interface MockStructuredLogger extends IStructuredLogger {
  setContext: Spy;
  child: Spy;
  debug: Spy;
  info: Spy;
  warn: Spy;
  error: Spy;
  fatal: Spy;
  time: Spy;
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
  } as MockStructuredLogger;
}
