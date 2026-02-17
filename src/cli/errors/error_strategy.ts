/**
 * @module CLIErrorStrategy
 * @path src/cli/errors/error_strategy.ts
 * @description Defines the default error handling strategy for CLI commands, ensuring consistent error reporting and exit codes.
 * @architectural-layer CLI
 * @dependencies [colors]
 * @related-files [src/cli/exoctl.ts]
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
