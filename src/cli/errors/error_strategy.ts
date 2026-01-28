/**
 * Error Handling Strategies
 * Phase 33.3 Pattern: Strategy
 */

export interface ErrorContext {
  commandName: string;
  args?: unknown;
  error: Error | unknown;
}

/**
 * Strategy interface for handling command errors
 */
export interface ErrorStrategy {
  handle(context: ErrorContext): Promise<void>;
}

/**
 * Fail fast strategy: logs and throws immediately
 */
export class FailFastStrategy implements ErrorStrategy {
  handle(context: ErrorContext): Promise<void> {
    console.error(`Error executing ${context.commandName}:`);
    if (context.error instanceof Error) {
      console.error(context.error.message);
    } else {
      console.error(String(context.error));
    }
    throw context.error;
  }
}

/**
 * Silent strategy: suppresses errors (useful for optional operations)
 */
export class SilentStrategy implements ErrorStrategy {
  async handle(_context: ErrorContext): Promise<void> {
    // Intentionally do nothing
  }
}

/**
 * Default global strategy instance (FailFast)
 */
export const DefaultErrorStrategy = new FailFastStrategy();
