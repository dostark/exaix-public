/**
 * StructuredLogViewer - Enhanced TUI component for StructuredLogger visualization
 *
 * Part of Phase 13.6: StructuredLogger TUI Integration
 *
 * This component provides rich visualization of StructuredLogger entries with:
 * - Real-time log streaming from StructuredLogger outputs
 * - Advanced filtering by context fields (trace_id, agent_id, operation, etc.)
 * - Performance metrics visualization (duration, memory usage)
 * - Error stack trace expansion
 * - Correlation ID tracking for request tracing
 * - Log level filtering with visual indicators
 */

import { TuiSessionBase } from "./tui_common.ts";
import { type TreeNode } from "./utils/tree_view.ts";
import { collapseAll, createGroupNode, createNode, expandAll, renderTree, toggleNode } from "./utils/tree_view.ts";
import { type HelpSection, renderHelpScreen } from "./utils/help_renderer.ts";
import { ConfirmDialog, InputDialog } from "./utils/dialog_base.ts";
import type { KeyBinding } from "./utils/keyboard.ts";
import type { LogEntry, LogLevel, StructuredLogger } from "../services/structured_logger.ts";

// ===== Service Interfaces =====

/**
 * Service interface for structured log access.
 */
export interface StructuredLogService {
  getStructuredLogs(options: LogQueryOptions): Promise<LogEntry[]>;
  subscribeToLogs(callback: (entry: LogEntry) => void): () => void;
  getLogsByCorrelationId(correlationId: string): Promise<LogEntry[]>;
  getLogsByTraceId(traceId: string): Promise<LogEntry[]>;
  getLogsByAgentId(agentId: string): Promise<LogEntry[]>;
}

export interface LogQueryOptions {
  level?: LogLevel[];
  context?: Partial<LogEntry["context"]>;
  timeRange?: { start: Date; end: Date };
  limit?: number;
  includePerformance?: boolean;
  correlationId?: string;
  traceId?: string;
  agentId?: string;
}

// ===== View State =====

/**
 * State interface for StructuredLogViewer
 */
export interface StructuredLogViewerState {
  /** Currently selected log ID */
  selectedLogId: string | null;
  /** Log tree structure */
  logTree: TreeNode[];
  /** Whether help is visible */
  showHelp: boolean;
  /** Whether detail view is shown */
  showDetail: boolean;
  /** Detail content for expanded log */
  detailContent: string;
  /** Active dialog */
  activeDialog: ConfirmDialog | InputDialog | null;
  /** Current search query */
  searchQuery: string;
  /** Bookmarked log IDs */
  bookmarkedIds: Set<string>;
  /** Current grouping mode */
  groupBy: "correlation" | "trace" | "agent" | "level" | "time" | "none";
  /** Whether auto-refresh is enabled */
  autoRefresh: boolean;
  /** Log level filter */
  logLevelFilter: LogLevel[];
  /** Whether performance metrics are shown */
  showPerformanceMetrics: boolean;
  /** Correlation mode active */
  correlationMode: boolean;
  /** Active correlation ID for tracing */
  activeCorrelationId: string | null;
  /** Active trace ID for tracing */
  activeTraceId: string | null;
  /** Real-time streaming enabled */
  realTimeEnabled: boolean;
  /** Current log entries */
  logEntries: LogEntry[];
  /** Filtered log entries */
  filteredEntries: LogEntry[];
}

// ===== Icons and Visual Constants =====

export const STRUCTURED_LOG_ICONS: Record<string, string> = {
  "debug": "🔍",
  "info": "ℹ️",
  "warn": "⚠️",
  "error": "❌",
  "fatal": "💥",
  "trace": "🔗",
  "correlation": "🔗",
  "performance": "⚡",
  "agent": "🤖",
  "operation": "⚙️",
  "request": "📨",
  "response": "📤",
  "default": "📋",
};

export const STRUCTURED_LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  "debug": "gray",
  "info": "blue",
  "warn": "yellow",
  "error": "red",
  "fatal": "magenta",
};

// ===== Key Bindings =====

export const STRUCTURED_LOG_VIEWER_KEY_BINDINGS: KeyBinding[] = [
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
  { key: "f", action: "filter-level", description: "Filter by log level", category: "Actions" },
  { key: "c", action: "correlation-mode", description: "Toggle correlation mode", category: "Actions" },
  { key: "t", action: "trace-mode", description: "Toggle trace mode", category: "Actions" },
  { key: "p", action: "performance-toggle", description: "Toggle performance metrics", category: "View" },
  { key: "g", action: "toggle-grouping", description: "Toggle grouping", category: "View" },
  { key: "R", action: "refresh", description: "Force refresh", category: "View" },
  { key: "a", action: "auto-refresh", description: "Toggle auto-refresh", category: "View" },
  { key: "C", action: "collapse-all", description: "Collapse all", category: "View" },
  { key: "E", action: "expand-all", description: "Expand all", category: "View" },
  { key: "?", action: "help", description: "Toggle help", category: "Help" },
  { key: "q", action: "quit", description: "Close/Back", category: "Help" },
  { key: "escape", action: "cancel", description: "Close dialog/view", category: "Help" },
];

// ===== StructuredLogViewer Class =====

/**
 * View/controller for structured log monitoring with real-time streaming.
 */
export class StructuredLogViewer extends TuiSessionBase {
  private state: StructuredLogViewerState;
  private logService: StructuredLogService;
  private structuredLogger: StructuredLogger;
  private unsubscribeRealTime?: () => void;
  private refreshInterval?: number;

  constructor(
    logService: StructuredLogService,
    structuredLogger: StructuredLogger,
    options: { testMode?: boolean } = {},
  ) {
    super();
    this.logService = logService;
    this.structuredLogger = structuredLogger;
    this.state = this.createInitialState(options.testMode);

    // Setup real-time streaming if enabled
    if (this.state.realTimeEnabled) {
      this.setupRealTimeStreaming();
    }

    // Setup auto-refresh if enabled
    if (this.state.autoRefresh) {
      this.setupAutoRefresh();
    }

    this.refreshLogs();
  }

  private createInitialState(testMode = false): StructuredLogViewerState {
    return {
      selectedLogId: null,
      logTree: [],
      showHelp: false,
      showDetail: false,
      detailContent: "",
      activeDialog: null,
      searchQuery: "",
      bookmarkedIds: new Set(),
      groupBy: "correlation",
      autoRefresh: testMode ? false : true,
      logLevelFilter: ["debug", "info", "warn", "error", "fatal"],
      showPerformanceMetrics: true,
      correlationMode: false,
      activeCorrelationId: null,
      activeTraceId: null,
      realTimeEnabled: testMode ? false : true,
      logEntries: [],
      filteredEntries: [],
    };
  }

  private setupRealTimeStreaming(): void {
    this.unsubscribeRealTime = this.logService.subscribeToLogs((entry) => {
      this.handleNewLogEntry(entry);
    });
  }

  private setupAutoRefresh(): void {
    this.refreshInterval = setInterval(() => {
      if (this.state.autoRefresh) {
        this.refreshLogs();
      }
    }, 5000); // 5 second refresh
  }

  private handleNewLogEntry(entry: LogEntry): void {
    // Add to entries and update filtered view
    this.state.logEntries.unshift(entry); // Newest first
    this.applyFilters();
    this.rebuildTree();

    // Limit entries to prevent memory issues
    if (this.state.logEntries.length > 1000) {
      this.state.logEntries = this.state.logEntries.slice(0, 1000);
    }
  }

  /** Refresh logs from the service. */
  async refreshLogs(): Promise<void> {
    try {
      const options: LogQueryOptions = {
        level: this.state.logLevelFilter,
        limit: 500,
        includePerformance: this.state.showPerformanceMetrics,
      };

      if (this.state.correlationMode && this.state.activeCorrelationId) {
        options.correlationId = this.state.activeCorrelationId;
      }

      if (this.state.activeTraceId) {
        options.traceId = this.state.activeTraceId;
      }

      this.state.logEntries = await this.logService.getStructuredLogs(options);
      this.applyFilters();
      this.rebuildTree();
    } catch (error) {
      console.error("[StructuredLogViewer] Failed to refresh logs:", error);
    }
  }

  private applyFilters(): void {
    let filtered = [...this.state.logEntries];

    // Apply search filter
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      filtered = filtered.filter((entry) =>
        entry.message.toLowerCase().includes(query) ||
        JSON.stringify(entry.context).toLowerCase().includes(query) ||
        JSON.stringify(entry.metadata).toLowerCase().includes(query)
      );
    }

    // Apply log level filter
    filtered = filtered.filter((entry) => this.state.logLevelFilter.includes(entry.level));

    this.state.filteredEntries = filtered;
  }

  private rebuildTree(): void {
    const nodes: TreeNode[] = [];

    if (this.state.groupBy === "none") {
      // Flat list
      for (const entry of this.state.filteredEntries) {
        const node = createNode(
          entry.timestamp,
          this.formatLogEntry(entry),
          "log",
          { expanded: false },
        );
        nodes.push(node);
      }
    } else {
      // Grouped view
      const groups = this.groupEntries(this.state.filteredEntries, this.state.groupBy);

      for (const [groupKey, entries] of Object.entries(groups)) {
        const childNodes: TreeNode[] = [];
        for (const entry of entries) {
          const node = createNode(
            entry.timestamp,
            this.formatLogEntry(entry),
            "log",
            { expanded: false },
          );
          childNodes.push(node);
        }

        const groupNode = createGroupNode(
          groupKey,
          `${this.getGroupIcon(this.state.groupBy)} ${groupKey} (${entries.length})`,
          "group",
          childNodes,
          { expanded: true },
        );

        nodes.push(groupNode);
      }
    }

    this.state.logTree = nodes;
  }

  private groupEntries(entries: LogEntry[], groupBy: string): Record<string, LogEntry[]> {
    const groups: Record<string, LogEntry[]> = {};

    for (const entry of entries) {
      let key: string;

      switch (groupBy) {
        case "correlation":
          key = entry.context.correlation_id || "no-correlation";
          break;
        case "trace":
          key = entry.context.trace_id || "no-trace";
          break;
        case "agent":
          key = entry.context.agent_id || "no-agent";
          break;
        case "level":
          key = entry.level;
          break;
        case "time": {
          const date = new Date(entry.timestamp);
          key = date.toISOString().split("T")[0]; // YYYY-MM-DD
          break;
        }
        default:
          key = "all";
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(entry);
    }

    return groups;
  }

  private getGroupIcon(groupBy: string): string {
    switch (groupBy) {
      case "correlation":
        return STRUCTURED_LOG_ICONS.correlation;
      case "trace":
        return STRUCTURED_LOG_ICONS.trace;
      case "agent":
        return STRUCTURED_LOG_ICONS.agent;
      case "level":
        return STRUCTURED_LOG_ICONS[STRUCTURED_LOG_LEVEL_COLORS.debug] || "📊";
      case "time":
        return "🕐";
      default:
        return "📁";
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const level = entry.level.toUpperCase().padEnd(5);
    const icon = STRUCTURED_LOG_ICONS[entry.level] || STRUCTURED_LOG_ICONS.default;

    let contextStr = "";
    if (entry.context.trace_id) {
      contextStr += ` trace=${entry.context.trace_id.slice(0, 8)}`;
    }
    if (entry.context.agent_id) {
      contextStr += ` agent=${entry.context.agent_id}`;
    }
    if (entry.context.operation) {
      contextStr += ` op=${entry.context.operation}`;
    }

    let perfStr = "";
    if (this.state.showPerformanceMetrics && entry.performance) {
      if (entry.performance.duration_ms) {
        perfStr += ` ${entry.performance.duration_ms}ms`;
      }
      if (entry.performance.memory_mb) {
        perfStr += ` ${entry.performance.memory_mb}MB`;
      }
    }

    return `${timestamp} ${icon} ${level} ${entry.message}${contextStr}${perfStr}`;
  }

  // ... rest of the implementation will be added in subsequent steps

  /** Get all current logs. */
  async getLogs(): Promise<LogEntry[]> {
    await this.refreshLogs();
    return [...this.state.logEntries];
  }

  /** Set the filter for logs. */
  setLogLevelFilter(levels: LogLevel[]): void {
    this.state.logLevelFilter = [...levels];
    this.applyFilters();
    this.rebuildTree();
  }

  /** Toggle correlation mode for a specific correlation ID. */
  async setCorrelationMode(correlationId: string | null): Promise<void> {
    this.state.correlationMode = correlationId !== null;
    this.state.activeCorrelationId = correlationId;

    if (correlationId) {
      this.state.logEntries = await this.logService.getLogsByCorrelationId(correlationId);
    } else {
      await this.refreshLogs();
    }

    this.applyFilters();
    this.rebuildTree();
  }

  /** Toggle trace mode for a specific trace ID. */
  async setTraceMode(traceId: string | null): Promise<void> {
    this.state.activeTraceId = traceId;

    if (traceId) {
      this.state.logEntries = await this.logService.getLogsByTraceId(traceId);
    } else {
      await this.refreshLogs();
    }

    this.applyFilters();
    this.rebuildTree();
  }

  /** Toggle performance metrics display. */
  togglePerformanceMetrics(): void {
    this.state.showPerformanceMetrics = !this.state.showPerformanceMetrics;
    this.rebuildTree();
  }

  /** Toggle real-time streaming. */
  toggleRealTime(): void {
    this.state.realTimeEnabled = !this.state.realTimeEnabled;

    if (this.state.realTimeEnabled) {
      this.setupRealTimeStreaming();
    } else {
      if (this.unsubscribeRealTime) {
        this.unsubscribeRealTime();
        this.unsubscribeRealTime = undefined;
      }
    }
  }

  /** Toggle auto-refresh. */
  toggleAutoRefresh(): void {
    this.state.autoRefresh = !this.state.autoRefresh;

    if (this.state.autoRefresh) {
      this.setupAutoRefresh();
    } else {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = undefined;
      }
    }
  }

  /** Set search query. */
  setSearchQuery(query: string): void {
    this.state.searchQuery = query;
    this.applyFilters();
    this.rebuildTree();
  }

  /** Toggle grouping mode. */
  toggleGrouping(): void {
    const modes: Array<StructuredLogViewerState["groupBy"]> = [
      "correlation",
      "trace",
      "agent",
      "level",
      "time",
      "none",
    ];
    const currentIndex = modes.indexOf(this.state.groupBy);
    this.state.groupBy = modes[(currentIndex + 1) % modes.length];
    this.rebuildTree();
  }

  /** Bookmark/unbookmark a log entry. */
  toggleBookmark(logId: string): void {
    if (this.state.bookmarkedIds.has(logId)) {
      this.state.bookmarkedIds.delete(logId);
    } else {
      this.state.bookmarkedIds.add(logId);
    }
  }

  /** Export logs to file. */
  async exportLogs(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `structured-logs-${timestamp}.jsonl`;

      let content = "";
      for (const entry of this.state.filteredEntries) {
        content += JSON.stringify(entry) + "\n";
      }

      await Deno.writeTextFile(filename, content);
      console.log(`Logs exported to ${filename}`);
    } catch (error) {
      console.error("Failed to export logs:", error);
    }
  }

  /** Get detailed view content for a log entry. */
  getLogDetail(logId: string): string {
    const entry = this.state.logEntries.find((e) => e.timestamp === logId);
    if (!entry) return "Log entry not found";

    let detail = `Timestamp: ${entry.timestamp}\n`;
    detail += `Level: ${entry.level.toUpperCase()}\n`;
    detail += `Message: ${entry.message}\n\n`;

    detail += `Context:\n`;
    for (const [key, value] of Object.entries(entry.context)) {
      if (value) {
        detail += `  ${key}: ${value}\n`;
      }
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      detail += `\nMetadata:\n`;
      detail += JSON.stringify(entry.metadata, null, 2);
    }

    if (entry.performance) {
      detail += `\nPerformance:\n`;
      detail += JSON.stringify(entry.performance, null, 2);
    }

    if (entry.error) {
      detail += `\nError:\n`;
      detail += `  Name: ${entry.error.name}\n`;
      detail += `  Message: ${entry.error.message}\n`;
      if (entry.error.stack) {
        detail += `  Stack:\n${entry.error.stack}\n`;
      }
    }

    return detail;
  }

  /** Clean up resources. */
  destroy(): void {
    if (this.unsubscribeRealTime) {
      this.unsubscribeRealTime();
    }
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  // ===== TUI Session Base Implementation =====

  async handleKey(key: string): Promise<void> {
    // Handle dialogs first
    if (this.state.activeDialog) {
      this.state.activeDialog.handleKey(key);

      // Check if dialog completed
      if (!this.state.activeDialog.isActive()) {
        const dialog = this.state.activeDialog;
        this.state.activeDialog = null;

        // Handle dialog result
        if (dialog instanceof InputDialog && dialog.getState() === "confirmed") {
          const result = dialog.getResult();
          if (result.type === "confirmed") {
            this.setSearchQuery(result.value);
          }
        }
      }
      return;
    }

    // Handle help overlay
    if (this.state.showHelp) {
      if (key === "?" || key === "escape") {
        this.state.showHelp = false;
      }
      return;
    }

    // Handle detail view
    if (this.state.showDetail) {
      if (key === "escape" || key === "q") {
        this.state.showDetail = false;
        this.state.detailContent = "";
      }
      return;
    }

    // Main navigation and actions
    switch (key) {
      case "up":
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        break;
      case "down":
        this.selectedIndex = Math.min(this.state.logTree.length - 1, this.selectedIndex + 1);
        break;
      case "home":
        this.selectedIndex = 0;
        break;
      case "end":
        this.selectedIndex = this.state.logTree.length - 1;
        break;
      case "left":
        if (this.selectedIndex >= 0 && this.selectedIndex < this.state.logTree.length) {
          this.state.logTree = toggleNode(this.state.logTree, this.state.logTree[this.selectedIndex].id);
        }
        break;
      case "right":
        if (this.selectedIndex >= 0 && this.selectedIndex < this.state.logTree.length) {
          this.state.logTree = toggleNode(this.state.logTree, this.state.logTree[this.selectedIndex].id);
        }
        break;
      case "enter":
        if (this.selectedIndex >= 0 && this.selectedIndex < this.state.logTree.length) {
          const node = this.state.logTree[this.selectedIndex];
          if (
            node.id && !node.id.startsWith("correlation-") && !node.id.startsWith("trace-") &&
            !node.id.startsWith("agent-") && !node.id.startsWith("level-")
          ) {
            this.state.selectedLogId = node.id;
            this.state.detailContent = this.getLogDetail(node.id);
            this.state.showDetail = true;
          } else {
            // Toggle group node
            this.state.logTree = toggleNode(this.state.logTree, node.id);
          }
        }
        break;
      case "b":
        if (this.state.selectedLogId) {
          this.toggleBookmark(this.state.selectedLogId);
        }
        break;
      case "e":
        await this.exportLogs();
        break;
      case "s":
        this.state.activeDialog = new InputDialog({
          title: "Search Logs",
          label: "Enter search query:",
          defaultValue: this.state.searchQuery,
        });
        break;
      case "f":
        // Toggle log level filter dialog would go here
        break;
      case "c":
        if (this.state.correlationMode) {
          await this.setCorrelationMode(null);
        } else {
          // Would need to get correlation ID from selected log
          const selectedNode = this.state.logTree[this.selectedIndex];
          if (selectedNode && selectedNode.id) {
            const entry = this.state.logEntries.find((e) => e.timestamp === selectedNode.id);
            if (entry?.context.correlation_id) {
              await this.setCorrelationMode(entry.context.correlation_id);
            }
          }
        }
        break;
      case "t":
        if (this.state.activeTraceId) {
          await this.setTraceMode(null);
        } else {
          const selectedNode = this.state.logTree[this.selectedIndex];
          if (selectedNode && selectedNode.id) {
            const entry = this.state.logEntries.find((e) => e.timestamp === selectedNode.id);
            if (entry?.context.trace_id) {
              await this.setTraceMode(entry.context.trace_id);
            }
          }
        }
        break;
      case "p":
        this.togglePerformanceMetrics();
        break;
      case "g":
        this.toggleGrouping();
        break;
      case "R":
        await this.refreshLogs();
        break;
      case "a":
        this.toggleAutoRefresh();
        break;
      case "C":
        this.state.logTree = collapseAll(this.state.logTree);
        break;
      case "E":
        this.state.logTree = expandAll(this.state.logTree);
        break;
      case "?":
        this.state.showHelp = !this.state.showHelp;
        break;
      case "q":
      case "escape":
        // Exit handled by parent
        break;
      default:
        // No action
        break;
    }
  }

  async render(width: number, height: number): Promise<string[]> {
    const lines: string[] = [];

    // Help overlay
    if (this.state.showHelp) {
      return await renderHelpScreen({
        title: "Structured Log Viewer Help",
        sections: this.getHelpSections(),
        width: width,
      });
    }

    // Detail view
    if (this.state.showDetail) {
      const detailLines = this.state.detailContent.split("\n");
      const startY = Math.max(0, Math.floor((height - detailLines.length) / 2));
      const startX = Math.max(0, Math.floor((width - 80) / 2));

      for (let i = 0; i < height; i++) {
        if (i >= startY && i < startY + detailLines.length) {
          const line = detailLines[i - startY];
          const paddedLine = line.padEnd(80);
          lines.push(" ".repeat(startX) + paddedLine);
        } else {
          lines.push("");
        }
      }
      return lines;
    }

    // Main log view
    const header = this.renderHeader();
    lines.push(header);

    const treeLines = renderTree(this.state.logTree, {
      selectedId: this.state.logTree[this.selectedIndex]?.id,
    });
    lines.push(...treeLines);

    // Status bar
    const statusBar = this.renderStatusBar(width);
    lines.push(statusBar);

    return lines;
  }

  private renderHeader(): string {
    let header = "Structured Log Viewer";

    if (this.state.correlationMode && this.state.activeCorrelationId) {
      header += ` | Correlation: ${this.state.activeCorrelationId.slice(0, 8)}`;
    }

    if (this.state.activeTraceId) {
      header += ` | Trace: ${this.state.activeTraceId.slice(0, 8)}`;
    }

    if (this.state.searchQuery) {
      header += ` | Search: "${this.state.searchQuery}"`;
    }

    header += ` | Group: ${this.state.groupBy}`;
    header += ` | Levels: ${this.state.logLevelFilter.join(",")}`;

    return header;
  }

  private renderStatusBar(width: number): string {
    const statusParts: string[] = [];

    statusParts.push(`${this.state.filteredEntries.length} logs`);

    if (this.state.realTimeEnabled) {
      statusParts.push("LIVE");
    }

    if (this.state.autoRefresh) {
      statusParts.push("AUTO");
    }

    if (this.state.showPerformanceMetrics) {
      statusParts.push("PERF");
    }

    if (this.state.bookmarkedIds.size > 0) {
      statusParts.push(`${this.state.bookmarkedIds.size} bookmarks`);
    }

    const statusText = statusParts.join(" | ");
    return statusText.padEnd(width);
  }

  private getHelpSections(): HelpSection[] {
    return [
      {
        title: "Navigation",
        items: [
          { key: "↑/↓", description: "Navigate logs" },
          { key: "Home/End", description: "First/Last log" },
          { key: "←/→", description: "Collapse/Expand groups" },
          { key: "Enter", description: "View log details" },
        ],
      },
      {
        title: "Actions",
        items: [
          { key: "b", description: "Bookmark log" },
          { key: "e", description: "Export logs" },
          { key: "s", description: "Search logs" },
          { key: "f", description: "Filter by level" },
          { key: "c", description: "Toggle correlation mode" },
          { key: "t", description: "Toggle trace mode" },
        ],
      },
      {
        title: "View",
        items: [
          { key: "p", description: "Toggle performance metrics" },
          { key: "g", description: "Change grouping" },
          { key: "R", description: "Refresh logs" },
          { key: "a", description: "Toggle auto-refresh" },
          { key: "C/E", description: "Collapse/Expand all" },
        ],
      },
      {
        title: "General",
        items: [
          { key: "?", description: "Toggle help" },
          { key: "q/Esc", description: "Close/Back" },
        ],
      },
    ];
  }
}
