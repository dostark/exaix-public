/**
 * @module CLIConfig
 * @path src/cli/cli.config.ts
 * @description Defines user-tunable constants and default settings for ExoFrame CLI commands, including limits, formatting, and priorities.
 * @architectural-layer CLI
 * @dependencies [constants]
 * @related-files [src/cli/main.ts]
 */

import { TUI_PRIORITY_ICONS } from "../helpers/constants.ts";

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
  critical: TUI_PRIORITY_ICONS.critical,
  high: TUI_PRIORITY_ICONS.high,
  normal: TUI_PRIORITY_ICONS.normal,
  low: TUI_PRIORITY_ICONS.low,
  default: TUI_PRIORITY_ICONS.default,
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
