/**
 * TUI Configuration and Constants
 *
 * Contains user-tunable constants for the TUI interface, including:
 * - Icons and colors for log entries
 * - Refresh intervals
 * - Display formatting options
 * - Key bindings
 */

import { KeyBinding } from "./utils/keyboard.ts";
import { TUI_LOG_ICONS } from "./utils/constants.ts";

export const LOG_ICONS: Record<string, string> = {
  "request_created": TUI_LOG_ICONS["request_created"],
  "request.created": TUI_LOG_ICONS["request.created"],
  "plan_approved": TUI_LOG_ICONS["plan_approved"],
  "plan.approved": TUI_LOG_ICONS["plan.approved"],
  "plan.rejected": TUI_LOG_ICONS["plan.rejected"],
  "execution_started": TUI_LOG_ICONS["execution_started"],
  "execution.started": TUI_LOG_ICONS["execution.started"],
  "execution_completed": TUI_LOG_ICONS["execution_completed"],
  "execution.completed": TUI_LOG_ICONS["execution.completed"],
  "execution_failed": TUI_LOG_ICONS["execution_failed"],
  "execution.failed": TUI_LOG_ICONS["execution.failed"],
  "error": TUI_LOG_ICONS["error"],
  "default": TUI_LOG_ICONS["default"],
};

export const LOG_COLORS: Record<string, string> = {
  "request_created": "green",
  "request.created": "green",
  "plan_approved": "blue",
  "plan.approved": "blue",
  "plan.rejected": "red",
  "execution_started": "yellow",
  "execution.started": "yellow",
  "execution_completed": "green",
  "execution.completed": "green",
  "execution_failed": "red",
  "execution.failed": "red",
  "error": "red",
  "default": "white",
};

export const MONITOR_REFRESH_INTERVAL_MS = 1000;
export const MONITOR_AUTO_REFRESH_INTERVAL_MS = 5000;
export const MEMORY_STALE_MS = 30000;

export const MONITOR_KEY_BINDINGS: KeyBinding[] = [
  { key: "up", action: "navigate-up", description: "Move up", category: "Navigation" },
  { key: "down", action: "navigate-down", description: "Move down", category: "Navigation" },
  { key: "home", action: "navigate-home", description: "Go to first", category: "Navigation" },
  { key: "end", action: "navigate-end", description: "Go to last", category: "Navigation" },
  { key: "left", action: "collapse", description: "Collapse group", category: "Navigation" },
  { key: "right", action: "expand", description: "Expand group", category: "Navigation" },
  { key: "enter", action: "view-details", description: "View log details", category: "Actions" },
  { key: "space", action: "toggle-pause", description: "Toggle pause", category: "Actions" },
  { key: "b", action: "bookmark", description: "Bookmark entry", category: "Actions" },
  { key: "e", action: "export", description: "Export logs", category: "Actions" },
  { key: "s", action: "search", description: "Search logs", category: "Actions" },
  { key: "f", action: "filter-agent", description: "Filter by agent", category: "Actions" },
  { key: "t", action: "filter-time", description: "Filter by time", category: "Actions" },
  { key: "T", action: "filter-trace", description: "Filter by Trace ID", category: "Actions" },
  { key: "A", action: "filter-action", description: "Filter by Action Type", category: "Actions" },
  { key: "g", action: "toggle-grouping", description: "Toggle grouping", category: "View" },
  { key: "R", action: "refresh", description: "Force refresh", category: "View" },
  { key: "a", action: "auto-refresh", description: "Toggle auto-refresh", category: "View" },
  { key: "c", action: "collapse-all", description: "Collapse all", category: "View" },
  { key: "E", action: "expand-all", description: "Expand all", category: "View" },
  { key: "?", action: "help", description: "Toggle help", category: "Help" },
  { key: "q", action: "quit", description: "Close/Back", category: "Help" },
  { key: "escape", action: "cancel", description: "Close dialog/view", category: "Help" },
];
