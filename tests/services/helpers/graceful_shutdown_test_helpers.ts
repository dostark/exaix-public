import { spy } from "@std/testing/mock";
import type { IStructuredLogger } from "../../../src/services/structured_logger.ts";

/**
 * Helper functions for GracefulShutdown tests
 */

/**
 * Creates a mock logger with spy methods for testing
 */
export function createMockLogger(): IStructuredLogger {
  return {
    setContext: spy(() => {}),
    child: spy(() => ({} as IStructuredLogger)),
    debug: spy(() => {}),
    info: spy(() => {}),
    warn: spy(() => {}),
    error: spy(() => {}),
    fatal: spy(() => {}),
    time: spy((_op: string, fn: () => Promise<unknown>) => fn()),
  } as unknown as IStructuredLogger;
}
