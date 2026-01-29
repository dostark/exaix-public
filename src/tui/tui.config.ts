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
import { KeyBindingsBase } from "./base/key_bindings_base.ts";
import { TUI_LOG_ICONS } from "./utils/constants.ts";
import {
  KEY_A,
  KEY_B,
  KEY_C,
  KEY_CAPITAL_E,
  KEY_CAPITAL_R,
  KEY_DOWN,
  KEY_E,
  KEY_END,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_F,
  KEY_G,
  KEY_HOME,
  KEY_LEFT,
  KEY_Q,
  KEY_QUESTION,
  KEY_RIGHT,
  KEY_S,
  KEY_SPACE,
  KEY_T,
  KEY_UP,
} from "../config/constants.ts";

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
  { key: KEY_UP, action: "navigate-up", description: "Move up", category: "Navigation" },
  { key: KEY_DOWN, action: "navigate-down", description: "Move down", category: "Navigation" },
  { key: KEY_HOME, action: "navigate-home", description: "Go to first", category: "Navigation" },
  { key: KEY_END, action: "navigate-end", description: "Go to last", category: "Navigation" },
  { key: KEY_LEFT, action: "collapse", description: "Collapse group", category: "Navigation" },
  { key: KEY_RIGHT, action: "expand", description: "Expand group", category: "Navigation" },
  { key: KEY_ENTER, action: "view-details", description: "View log details", category: "Actions" },
  { key: KEY_SPACE, action: "toggle-pause", description: "Toggle pause", category: "Actions" },
  { key: KEY_B, action: "bookmark", description: "Bookmark entry", category: "Actions" },
  { key: KEY_E, action: "export", description: "Export logs", category: "Actions" },
  { key: KEY_S, action: "search", description: "Search logs", category: "Actions" },
  { key: KEY_F, action: "filter-agent", description: "Filter by agent", category: "Actions" },
  { key: KEY_T, action: "filter-time", description: "Filter by time", category: "Actions" },
  { key: "T", action: "filter-trace", description: "Filter by Trace ID", category: "Actions" },
  { key: "A", action: "filter-action", description: "Filter by Action Type", category: "Actions" },
  { key: KEY_G, action: "toggle-grouping", description: "Toggle grouping", category: "View" },
  { key: KEY_CAPITAL_R, action: "refresh", description: "Force refresh", category: "View" },
  { key: KEY_A, action: "auto-refresh", description: "Toggle auto-refresh", category: "View" },
  { key: KEY_C, action: "collapse-all", description: "Collapse all", category: "View" },
  { key: KEY_CAPITAL_E, action: "expand-all", description: "Expand all", category: "View" },
  { key: KEY_QUESTION, action: "help", description: "Toggle help", category: "Help" },
  { key: KEY_Q, action: "quit", description: "Close/Back", category: "Help" },
  { key: KEY_ESCAPE, action: "cancel", description: "Close dialog/view", category: "Help" },
];

export class MonitorKeyBindings extends KeyBindingsBase {
  readonly KEY_BINDINGS: readonly KeyBinding[] = MONITOR_KEY_BINDINGS;
}
