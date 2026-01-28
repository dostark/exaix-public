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

import { createGroupNode, createNode, getFirstNodeId, type TreeNode } from "./utils/tree_view.ts";
import { type HelpSection, renderHelpScreen } from "./utils/help_renderer.ts";
import { DialogBase } from "./utils/dialog_base.ts";
import type { KeyBinding } from "./utils/keyboard.ts";
import type { LogEntry, LogLevel, StructuredLogger } from "../services/structured_logger.ts";
import { BaseTreeView } from "./base/base_tree_view.ts";

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
  exportLogs(filename: string, entries: LogEntry[]): Promise<void>;
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
 * View-specific extensions for StructuredLogViewer
 */
export interface LogViewExtensions {
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
  /** Whether detail view is shown */
  showDetail: boolean;
  /** Detail content for expanded log */
  detailContent: string;
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
export class StructuredLogViewer extends BaseTreeView<LogEntry> {
  protected logViewExtensions: LogViewExtensions;
  private logService: StructuredLogService;
  private structuredLogger: StructuredLogger;
  private unsubscribeRealTime?: () => void;
  private refreshInterval?: number;
  private pendingDialogType: "search" | "filter-level" | "export" | null = null;

  constructor(
    logService: StructuredLogService,
    structuredLogger: StructuredLogger,
    options: { testMode?: boolean } = {},
  ) {
    super(options.testMode ? false : true);

    this.logService = logService;
    this.structuredLogger = structuredLogger;
    this.logViewExtensions = this.createInitialExtensions(options.testMode);

    // Setup real-time streaming if enabled
    if (this.logViewExtensions.realTimeEnabled) {
      this.setupRealTimeStreaming();
    }

    // Setup auto-refresh if enabled
    if (this.logViewExtensions.autoRefresh) {
      this.setupAutoRefresh();
    }

    this.initialize();
  }

  async initialize(): Promise<void> {
    await this.refreshLogs();
    const firstId = getFirstNodeId(this.state.tree);
    if (firstId) {
      this.state.selectedId = firstId;
    }
  }

  private createInitialExtensions(testMode = false): LogViewExtensions {
    return {
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
      showDetail: false,
      detailContent: "",
    };
  }

  private setupRealTimeStreaming(): void {
    this.unsubscribeRealTime = this.logService.subscribeToLogs((entry) => {
      this.handleNewLogEntry(entry);
    });
  }

  private setupAutoRefresh(): void {
    this.refreshInterval = setInterval(() => {
      if (this.logViewExtensions.autoRefresh) {
        this.refreshLogs();
      }
    }, 5000); // 5 second refresh
  }

  private handleNewLogEntry(entry: LogEntry): void {
    // Add to entries and update filtered view
    this.logViewExtensions.logEntries.unshift(entry); // Newest first
    this.applyFilters();
    this.buildTree();

    // Limit entries to prevent memory issues
    if (this.logViewExtensions.logEntries.length > 1000) {
      this.logViewExtensions.logEntries = this.logViewExtensions.logEntries.slice(0, 1000);
    }
  }

  /** Refresh logs from the service. */
  async refreshLogs(): Promise<void> {
    try {
      this.setLoading(true, "Refreshing logs...");
      const options: LogQueryOptions = {
        level: this.logViewExtensions.logLevelFilter,
        limit: 500,
        includePerformance: this.logViewExtensions.showPerformanceMetrics,
      };

      if (this.logViewExtensions.correlationMode && this.logViewExtensions.activeCorrelationId) {
        options.correlationId = this.logViewExtensions.activeCorrelationId;
      }

      if (this.logViewExtensions.activeTraceId) {
        options.traceId = this.logViewExtensions.activeTraceId;
      }

      this.logViewExtensions.logEntries = await this.logService.getStructuredLogs(options);
      this.applyFilters();
      this.buildTree();
    } catch (error) {
      this.setStatus(`Refresh failed: ${error instanceof Error ? error.message : String(error)}`, "error");
    } finally {
      this.setLoading(false);
    }
  }

  private applyFilters(): void {
    let filtered = [...this.logViewExtensions.logEntries];

    // Apply search filter
    if (this.state.filterText) {
      const query = this.state.filterText.toLowerCase();
      filtered = filtered.filter((entry) =>
        entry.message.toLowerCase().includes(query) ||
        JSON.stringify(entry.context).toLowerCase().includes(query) ||
        JSON.stringify(entry.metadata).toLowerCase().includes(query)
      );
    }

    // Apply log level filter
    filtered = filtered.filter((entry) => this.logViewExtensions.logLevelFilter.includes(entry.level));

    this.logViewExtensions.filteredEntries = filtered;
  }

  protected override buildTree(): void {
    const nodes: TreeNode<LogEntry>[] = [];

    if (this.logViewExtensions.groupBy === "none") {
      // Flat list
      for (const entry of this.logViewExtensions.filteredEntries) {
        const node = createNode<LogEntry>(
          entry.timestamp,
          this.formatLogEntry(entry),
          "log",
          { expanded: false, data: entry },
        );
        nodes.push(node);
      }
    } else {
      // Grouped view
      const groups = this.groupEntries(this.logViewExtensions.filteredEntries, this.logViewExtensions.groupBy);

      for (const [groupKey, entries] of Object.entries(groups)) {
        const childNodes: TreeNode<LogEntry>[] = [];
        for (const entry of entries) {
          const node = createNode<LogEntry>(
            entry.timestamp,
            this.formatLogEntry(entry),
            "log",
            { expanded: false, data: entry },
          );
          childNodes.push(node);
        }

        const groupNode = createGroupNode<LogEntry>(
          groupKey,
          `${this.getGroupIcon(this.logViewExtensions.groupBy)} ${groupKey} (${entries.length})`,
          "group",
          childNodes,
          { expanded: true },
        );

        nodes.push(groupNode);
      }
    }

    this.state.tree = nodes;
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
    if (this.logViewExtensions.showPerformanceMetrics && entry.performance) {
      if (entry.performance.duration_ms) {
        perfStr += ` ${entry.performance.duration_ms}ms`;
      }
      if (entry.performance.memory_mb) {
        perfStr += ` ${entry.performance.memory_mb}MB`;
      }
    }

    return `${timestamp} ${icon} ${level} ${entry.message}${contextStr}${perfStr}`;
  }

  override getViewName(): string {
    return "Structured Log Viewer";
  }

  override getKeyBindings(): KeyBinding<string>[] {
    return STRUCTURED_LOG_VIEWER_KEY_BINDINGS.map((b) => ({ ...b, action: b.action as string }));
  }

  /** Get all current logs. */
  async getLogs(): Promise<LogEntry[]> {
    await this.refreshLogs();
    return [...this.logViewExtensions.logEntries];
  }

  /** Set the filter for logs. */
  setLogLevelFilter(levels: LogLevel[]): void {
    this.logViewExtensions.logLevelFilter = [...levels];
    this.applyFilters();
    this.buildTree();
  }

  /** Toggle correlation mode for a specific correlation ID. */
  async setCorrelationMode(correlationId: string | null): Promise<void> {
    this.logViewExtensions.correlationMode = correlationId !== null;
    this.logViewExtensions.activeCorrelationId = correlationId;

    if (correlationId) {
      this.logViewExtensions.logEntries = await this.logService.getLogsByCorrelationId(correlationId);
    } else {
      await this.refreshLogs();
    }

    this.applyFilters();
    this.buildTree();
  }

  /** Toggle trace mode for a specific trace ID. */
  async setTraceMode(traceId: string | null): Promise<void> {
    this.logViewExtensions.activeTraceId = traceId;

    if (traceId) {
      this.logViewExtensions.logEntries = await this.logService.getLogsByTraceId(traceId);
    } else {
      await this.refreshLogs();
    }

    this.applyFilters();
    this.buildTree();
  }

  /** Toggle performance metrics display. */
  togglePerformanceMetrics(): void {
    this.logViewExtensions.showPerformanceMetrics = !this.logViewExtensions.showPerformanceMetrics;
    this.buildTree();
  }

  /** Toggle real-time streaming. */
  toggleRealTime(): void {
    this.logViewExtensions.realTimeEnabled = !this.logViewExtensions.realTimeEnabled;

    if (this.logViewExtensions.realTimeEnabled) {
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
    this.logViewExtensions.autoRefresh = !this.logViewExtensions.autoRefresh;

    if (this.logViewExtensions.autoRefresh) {
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
    this.state.filterText = query;
    this.applyFilters();
    this.buildTree();
  }

  /** Toggle grouping mode. */
  toggleGrouping(): void {
    const modes: Array<LogViewExtensions["groupBy"]> = [
      "correlation",
      "trace",
      "agent",
      "level",
      "time",
      "none",
    ];
    const currentIndex = modes.indexOf(this.logViewExtensions.groupBy);
    this.logViewExtensions.groupBy = modes[(currentIndex + 1) % modes.length];
    this.buildTree();
  }

  /** Bookmark/unbookmark a log entry. */
  toggleBookmark(logId: string): void {
    if (this.logViewExtensions.bookmarkedIds.has(logId)) {
      this.logViewExtensions.bookmarkedIds.delete(logId);
    } else {
      this.logViewExtensions.bookmarkedIds.add(logId);
    }
  }

  /** Export logs to file. */
  async exportLogs(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `structured-logs-${timestamp}.jsonl`;

      await this.logService.exportLogs(filename, this.logViewExtensions.filteredEntries);
      this.setStatus(`Logs exported to ${filename}`, "info");
    } catch (error) {
      this.setStatus(`Export failed: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }

  /** Get detailed view content for a log entry. */
  getLogDetail(logId: string): string {
    const entry = this.logViewExtensions.logEntries.find((e: LogEntry) => e.timestamp === logId);
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

  // ===== Dialog Handlers =====

  protected override onDialogClosed(dialog: DialogBase): void {
    const result = dialog.getResult();
    if (result.type !== "confirmed") {
      this.pendingDialogType = null;
      return;
    }

    const value = result.value as string;
    switch (this.pendingDialogType) {
      case "search":
        this.setSearchQuery(value);
        break;
      case "filter-level":
        // Handle filter level if implemented
        break;
      case "export":
        // Handle export if implemented via dialog
        break;
    }
    this.pendingDialogType = null;
  }

  // ===== Input Handling =====

  override async handleKey(key: string): Promise<boolean> {
    // 1. Handle dialogs (delegated to base)
    if (this.handleDialogKeys(key)) return true;

    // 2. Handle help overlay (delegated to base)
    if (this.handleHelpKeys(key)) return true;

    // 3. Handle detail view
    if (this.logViewExtensions.showDetail) {
      if (key === "escape" || key === "q") {
        this.logViewExtensions.showDetail = false;
        this.logViewExtensions.detailContent = "";
      }
      return true;
    }

    // 5. Main actions
    switch (key) {
      case "enter":
        if (this.state.selectedId) {
          if (this.isGroupNode(this.state.selectedId)) {
            this.toggleCurrentNode();
          } else {
            this.logViewExtensions.showDetail = true;
            this.logViewExtensions.detailContent = this.getLogDetail(this.state.selectedId);
          }
        }
        break;
      case "space":
        this.toggleRealTime();
        break;
      case "b":
        if (this.state.selectedId && !this.isGroupNode(this.state.selectedId)) {
          this.toggleBookmark(this.state.selectedId);
        }
        break;
      case "e":
        await this.exportLogs();
        break;
      case "s":
        this.showInputDialog({
          title: "Search Logs",
          label: "Enter search query:",
          defaultValue: this.state.filterText,
        });
        this.pendingDialogType = "search";
        break;
      case "f":
        // Toggle log level filter dialog would go here
        break;
      case "c":
        await this.handleCorrelationMode();
        break;
      case "t":
        await this.handleTraceMode();
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
        this.collapseAllNodes();
        break;
      case "E":
        this.expandAllNodes();
        break;
      default:
        // Handle navigation and other default keys
        if (this.handleNavigationKeys(key)) return true;
        return super.handleKey(key);
    }
    return true;
  }

  private isGroupNode(id: string): boolean {
    return id.includes("-") && (
      id.startsWith("correlation-") ||
      id.startsWith("trace-") ||
      id.startsWith("agent-") ||
      id.startsWith("level-") ||
      id.startsWith("time-") ||
      id.startsWith("group-")
    );
  }

  private async handleCorrelationMode(): Promise<void> {
    if (this.logViewExtensions.correlationMode) {
      await this.setCorrelationMode(null);
    } else {
      const selectedNode = this.getSelectedNode();
      if (selectedNode && selectedNode.data) {
        const entry = selectedNode.data as LogEntry;
        if (entry.context.correlation_id) {
          await this.setCorrelationMode(entry.context.correlation_id);
        }
      }
    }
  }

  private async handleTraceMode(): Promise<void> {
    if (this.logViewExtensions.activeTraceId) {
      await this.setTraceMode(null);
    } else {
      const selectedNode = this.getSelectedNode();
      if (selectedNode && selectedNode.data) {
        const entry = selectedNode.data as LogEntry;
        if (entry.context.trace_id) {
          await this.setTraceMode(entry.context.trace_id);
        }
      }
    }
  }

  render(width: number, height: number): Promise<string[]> {
    const lines: string[] = [];

    // Help overlay
    if (this.state.showHelp) {
      return Promise.resolve(this.renderHelp());
    }

    // Detail view
    if (this.logViewExtensions.showDetail) {
      const detailLines = this.logViewExtensions.detailContent.split("\n");
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
      return Promise.resolve(lines);
    }

    // Main log view
    const header = this.renderHeader();
    lines.push(header);

    const treeLines = this.renderTreeView();
    lines.push(...treeLines);

    // Status bar
    const statusBar = this.renderStatusBar();
    lines.push(statusBar.padEnd(width));

    return Promise.resolve(lines);
  }

  renderHelp(): string[] {
    return renderHelpScreen({
      title: "Structured Log Viewer Help",
      sections: this.getHelpSections(),
    });
  }

  private renderHeader(): string {
    let header = "Structured Log Viewer";

    if (this.logViewExtensions.correlationMode && this.logViewExtensions.activeCorrelationId) {
      header += ` | Correlation: ${this.logViewExtensions.activeCorrelationId.slice(0, 8)}`;
    }

    if (this.logViewExtensions.activeTraceId) {
      header += ` | Trace: ${this.logViewExtensions.activeTraceId.slice(0, 8)}`;
    }

    if (this.state.filterText) {
      header += ` | Search: "${this.state.filterText}"`;
    }

    header += ` | Group: ${this.logViewExtensions.groupBy}`;
    header += ` | Levels: ${this.logViewExtensions.logLevelFilter.join(",")}`;

    return header;
  }

  override renderStatusBar(): string {
    const statusParts: string[] = [];

    statusParts.push(`${this.logViewExtensions.filteredEntries.length} logs`);

    if (this.logViewExtensions.realTimeEnabled) {
      statusParts.push("LIVE");
    }

    if (this.logViewExtensions.autoRefresh) {
      statusParts.push("AUTO");
    }

    if (this.logViewExtensions.showPerformanceMetrics) {
      statusParts.push("PERF");
    }

    if (this.logViewExtensions.bookmarkedIds.size > 0) {
      statusParts.push(`${this.logViewExtensions.bookmarkedIds.size} bookmarks`);
    }

    return statusParts.join(" | ");
  }

  // ===== Testing Helpers =====

  /** Exposed for testing to access view-specific state */
  getExtensions(): LogViewExtensions {
    return this.logViewExtensions;
  }

  /** Exposed for testing to get selected ID */
  getSelectedId(): string | null {
    return this.state.selectedId;
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
          { key: "R", description: "Force refresh" },
          { key: "a", description: "Toggle auto-refresh" },
          { key: "C", description: "Collapse all" },
          { key: "E", description: "Expand all" },
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
