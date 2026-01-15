/**
 * CLI Configuration and Constants
 *
 * Contains user-tunable constants for the CLI commands, including:
 * - Default limits
 * - Formatting widths
 * - Output formatting options
 */

export const MEMORY_COMMAND_DEFAULTS = {
  LIMIT: 20,
  FORMAT: "table" as const,
  PROJECT_PADDING: 10,
  PORTAL_PADDING: 15,
  TITLE_LENGTH: 30,
  TRACE_ID_LENGTH: 8,
  STATUS_PADDING: 9,
  TIMESTAMP_LENGTH: 19,
  PROJECT_NAME_PADDING: 20,
  PATTERNS_PADDING: 8,
  DECISIONS_PADDING: 9,
};

export const PRIORITY_ICONS: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  normal: "🟢",
  low: "⚪",
  default: "🟢", // Fallback
};

export const CLI_DEFAULTS = {
  PRIORITY: "normal",
  AGENT: "default",
  LOG_LINES: 50,
  DAEMON_CHECK_INTERVAL_MS: 50,
};

export const CLI_OUTPUT_FORMATS = {
  TABLE: "table",
  JSON: "json",
  TEXT: "text",
};
