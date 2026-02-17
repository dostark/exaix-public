/**
 * @module ContextError
 * @path src/errors/context_error.ts
 * @description Enhanced error class with structured context preservation and cause chaining, addressing security audit requirements for traceable errors.
 * @architectural-layer Errors
 * @dependencies []
 * @related-files [src/services/event_logger.ts]
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
