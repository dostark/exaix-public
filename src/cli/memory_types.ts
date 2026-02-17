/**
 * @module CLIMemoryTypes
 * @path src/cli/memory_types.ts
 * @description Defines TypeScript types and interfaces used by CLI memory commands and formatters.
 * @architectural-layer CLI
 * @dependencies []
 * @related-files [src/cli/memory_commands.ts, src/cli/formatters/memory_formatter.ts]
 */

export type OutputFormat = "table" | "json" | "md";

export interface MemoryBankSummary {
  projects: string[];
  executions: number;
  lastActivity: string | null;
}
