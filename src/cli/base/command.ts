/**
 * Base Command Interface and Abstract Class
 * Phase 33.3 Pattern: Command
 */

export interface HelperResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface CommandArgs {
  [key: string]: unknown;
}

/**
 * Standard interface for all CLI commands.
 */
export interface Command<T = void> {
  name: string;
  description: string;

  /**
   * Execute the command with the given arguments.
   * @param args Command arguments
   */
  execute(args: CommandArgs): Promise<T>;

  /**
   * Validate the command arguments.
   * @param args Command arguments
   */
  validate(args: CommandArgs): ValidationResult;
}

/**
 * Abstract base class for commands to inherit common functionality.
 */
export abstract class AbstractCommand<T = void> implements Command<T> {
  abstract name: string;
  abstract description: string;

  abstract execute(args: CommandArgs): Promise<T>;

  validate(_args: CommandArgs): ValidationResult {
    // Default valid, override to add check
    return { isValid: true, errors: [] };
  }
}
