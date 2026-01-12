/**
 * ContextError - Enhanced error class with context preservation
 *
 * This class addresses section 20 of the security audit:
 * "Insufficient Error Context in Stack Traces"
 *
 * Provides structured error context and stack trace preservation
 * for better debugging and error handling throughout the application.
 *
 * Key Features:
 * - Preserves original error context (request_id, user_id, operation, etc.)
 * - Maintains cause chain with proper stack trace preservation
 * - JSON serialization for logging and debugging
 * - Type-safe context properties
 */

export class ContextError extends Error {
  public readonly context: Record<string, unknown>;
  public override readonly cause?: Error;

  constructor(
    message: string,
    context: Record<string, unknown>,
    cause?: Error,
  ) {
    super(message);
    this.name = "ContextError";
    this.context = { ...context }; // Defensive copy
    this.cause = cause;

    // Preserve original stack trace by chaining it
    if (cause && cause.stack) {
      // Use setTimeout to ensure stack is fully captured
      // This is a common pattern for preserving stack traces
      const originalStack = this.stack;
      this.stack = `${originalStack}\nCaused by: ${cause.stack}`;
    }
  }

  /**
   * JSON serialization for logging and debugging
   * Includes all error context while safely handling cause
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      stack: this.stack,
      cause: this.cause instanceof Error
        ? {
          name: this.cause.name,
          message: this.cause.message,
        }
        : undefined,
    };
  }
}
