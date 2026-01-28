/**
 * Shared Command Utilities
 * Helper functions for CLI commands
 */

import { ValidationResult } from "../base/command.ts";

export const CommandUtils = {
  /**
   * Format validation errors into a single string
   */
  formatValidationErrors(result: ValidationResult): string {
    if (result.isValid) return "";
    return `Validation failed:\n- ${result.errors.join("\n- ")}`;
  },

  /**
   * Simple confirmation prompt
   */
  async confirm(message: string): Promise<boolean> {
    console.log(`${message} (y/N)`);
    const buffer = new Uint8Array(1);
    await Deno.stdin.read(buffer);
    const char = new TextDecoder().decode(buffer).trim().toLowerCase();
    return char === "y";
  },

  /**
   * Print a table-like structure for metadata
   */
  printMetadata(title: string, data: Record<string, unknown>): void {
    console.log(`\n${title}`);
    console.log("=".repeat(title.length));
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        console.log(`${key.padEnd(20)}: ${value}`);
      }
    }
    console.log("");
  },
};
