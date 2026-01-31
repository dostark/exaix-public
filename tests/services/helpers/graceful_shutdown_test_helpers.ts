import { spy } from "@std/testing/mock";

/**
 * Helper functions for GracefulShutdown tests
 */

/**
 * Creates a mock logger with spy methods for testing
 */
export function createMockLogger() {
  return {
    info: spy(() => {}),
    warn: spy(() => {}),
    error: spy(() => {}),
    fatal: spy(() => {}),
  } as any;
}
