export type OutputFormat = "table" | "json" | "md";

export interface MemoryBankSummary {
  projects: string[];
  executions: number;
  lastActivity: string | null;
}
