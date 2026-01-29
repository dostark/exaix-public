/**
 * Monitor View - TUI for real-time log monitoring
 *
 * Phase 13.5: Enhanced with modern patterns including:
 * - Tree view grouping (by agent, by action type)
 * - Detail panel for log expansion
 * - Search with highlighting
 * - Bookmarking (mark important entries)
 * - Export to file
 * - Time range filtering
 * - Help screen
 * - Auto-refresh toggle
 */

import { BaseTreeView } from "./base/base_tree_view.ts";
import { createGroupNode, createNode, getFirstNodeId, type TreeNode } from "./utils/tree_view.ts";
import { type HelpSection, renderHelpScreen } from "./utils/help_renderer.ts";
import { type DialogBase } from "./utils/dialog_base.ts";
import type { KeyBinding } from "./utils/keyboard.ts";
import type { ActivityRecord, JournalFilterOptions } from "../services/db.ts";

// ===== Service Interfaces =====

/**
 * Service interface for log access.
 */
export interface LogService {
  queryActivity(filter: JournalFilterOptions): Promise<ActivityRecord[]>;
}

export interface LogEntry {
  id: string;
  trace_id: string;
  actor: string | null;
  agent_id: string | null;
  action_type: string;
  target: string | null;
  payload: Record<string, unknown>;
  timestamp: string;
}

// ===== View State =====

export interface MonitorViewExtensions {
  /** Whether detail view is shown */
  showDetail: boolean;
  /** Detail content for expanded log */
  detailContent: string;
  /** Bookmarked log IDs */
  bookmarkedIds: Set<string>;
  /** Current grouping mode */
  groupBy: "agent" | "action" | "none";
}

// ===== Icons and Visual Constants =====

// ===== Icons and Visual Constants =====
import { LOG_COLORS, LOG_ICONS, MONITOR_AUTO_REFRESH_INTERVAL_MS, MONITOR_KEY_BINDINGS } from "./tui.config.ts";
import { TUI_LAYOUT_NARROW_WIDTH } from "./utils/constants.ts";

export { LOG_COLORS, LOG_ICONS, MONITOR_KEY_BINDINGS };

// ===== Monitor View Class =====

/**
 * View/controller for monitoring logs. Delegates to injected LogService.
 */
export class MonitorView {
  private filter: JournalFilterOptions = {};
  private isPaused = false;
  private logs: LogEntry[] = [];

  constructor(private readonly logService: LogService) {
    this.refreshLogs();
  }

  /** Refresh logs from the service. */
  async refreshLogs(): Promise<void> {
    if (!this.isPaused) {
      const activities = await this.logService.queryActivity(this.filter);
      this.logs = activities.map((log): LogEntry => ({
        ...log,
        payload: typeof log.payload === "string" ? JSON.parse(log.payload) : log.payload,
      }));
    }
  }

  /** Get all current logs. */
  async getLogs(): Promise<LogEntry[]> {
    await this.refreshLogs();
    return [...this.logs];
  }

  /** Set the filter for logs. */
  setFilter(filter: JournalFilterOptions): void {
    this.filter = { ...this.filter, ...filter };
  }

  /** Get filtered logs (DB filtering is applied on refresh). */
  getFilteredLogs(): LogEntry[] {
    // DB handles structural filtering (agent, action, trace)
    // Client only needs to handle textual search if applied later in TUI session
    return this.logs;
  }

  /** Pause log streaming. */
  pause(): void {
    this.isPaused = true;
  }

  /** Resume log streaming. */
  resume(): void {
    this.isPaused = false;
    this.refreshLogs();
  }

  /** Check if streaming is active. */
  isStreaming(): boolean {
    return !this.isPaused;
  }

  /**
   * Export logs to string format
   */
  exportLogs(): string {
    const logs = this.getFilteredLogs();
    return logs.map((log) => {
      return `${log.timestamp} [${log.actor || "unknown"}] ${log.action_type}: ${log.target || ""} ${
        JSON.stringify(log.payload)
      }`;
    }).join("\n");
  }

  /**
   * Get color for log level based on action type
   */
  getLogColor(actionType: string): string {
    return LOG_COLORS[actionType] || LOG_COLORS["default"];
  }

  /**
   * Render logs for TUI display
   */
  renderLogs(): string {
    const logs = this.getFilteredLogs();
    return logs.map((log) => {
      const color = this.getLogColor(log.action_type);
      return `\x1b[${this.getAnsiColorCode(color)}m${log.timestamp} [${log.actor || "unknown"}] ${log.action_type}: ${
        log.target || ""
      }\x1b[0m`;
    }).join("\n");
  }

  /**
   * Get ANSI color code
   */
  private getAnsiColorCode(color: string): number {
    switch (color) {
      case "red":
        return 31;
      case "green":
        return 32;
      case "yellow":
        return 33;
      case "blue":
        return 34;
      case "white":
      default:
        return 37;
    }
  }

  /**
   * Create TUI session for interactive mode
   */
  createTuiSession(useColors = true): MonitorTuiSession {
    return new MonitorTuiSession(this, useColors);
  }
}

// ===== Minimal Mock for Tests =====

/**
 * Minimal LogService mock for TUI session tests
 */
export class MinimalLogServiceMock implements LogService {
  private logs: LogEntry[] = [];

  constructor(logs: LogEntry[] = []) {
    this.logs = logs;
  }

  queryActivity(filter: JournalFilterOptions): Promise<ActivityRecord[]> {
    let filtered = this.logs;

    if (filter.agentId) {
      filtered = filtered.filter((l) => l.agent_id === filter.agentId);
    }
    if (filter.actionType) {
      filtered = filtered.filter((l) => l.action_type === filter.actionType);
    }
    if (filter.traceId) {
      filtered = filtered.filter((l) => l.trace_id === filter.traceId);
    }

    return Promise.resolve([...filtered.map((log) => ({
      ...log,
      payload: JSON.stringify(log.payload),
    }))]);
  }

  setLogs(logs: LogEntry[]): void {
    this.logs = logs;
  }
}

// ===== TUI Session Class =====

/**
 * Interactive TUI session for Monitor View
 */
export class MonitorTuiSession extends BaseTreeView<LogEntry> {
  private readonly monitorView: MonitorView;
  private monitorExtensions: MonitorViewExtensions;
  private autoRefreshTimer: number | null = null;
  // Track what dialog is pending
  private pendingDialogType: "search" | "filter-agent" | "filter-time" | "filter-trace" | "filter-action" | null = null;

  constructor(monitorView: MonitorView, useColors = true) {
    super(useColors);
    this.monitorView = monitorView;
    this.monitorExtensions = {
      showDetail: false,
      detailContent: "",
      bookmarkedIds: new Set(),
      groupBy: "none",
    };
    // Build tree synchronously for immediate access
    this.buildTree();
    this.selectFirstLog();
  }

  // ===== State Accessors =====

  override getViewName(): string {
    return "Monitor";
  }

  getLogTree(): TreeNode[] {
    return this.state.tree;
  }

  isDetailVisible(): boolean {
    return this.monitorExtensions.showDetail;
  }

  getDetailContent(): string {
    return this.monitorExtensions.detailContent;
  }

  getSearchQuery(): string {
    return this.state.filterText;
  }

  getBookmarkedIds(): Set<string> {
    return this.monitorExtensions.bookmarkedIds;
  }

  getGroupBy(): "agent" | "action" | "none" {
    return this.monitorExtensions.groupBy;
  }

  isAutoRefreshEnabled(): boolean {
    return this.state.refreshConfig.enabled;
  }

  override getKeyBindings(): KeyBinding[] {
    return MONITOR_KEY_BINDINGS;
  }

  isPaused(): boolean {
    return !this.monitorView.isStreaming();
  }

  // ===== Tree Building =====

  protected override buildTree(items: LogEntry[] = []): void {
    const logs = items.length > 0 ? items : this.monitorView.getFilteredLogs();

    if (this.monitorExtensions.groupBy === "none") {
      // Flat list
      this.state.tree = logs.map((log) => {
        const icon = LOG_ICONS[log.action_type as keyof typeof LOG_ICONS] || LOG_ICONS["default"];
        const label = `${icon} ${this.formatTimestamp(log.timestamp)} ${log.action_type}`;
        return createNode<LogEntry>(log.id, label, "log", { expanded: true });
      });
    } else if (this.monitorExtensions.groupBy === "agent") {
      // Group by agent
      const byAgent = new Map<string, LogEntry[]>();
      for (const log of logs) {
        const agent = log.agent_id || "unknown";
        if (!byAgent.has(agent)) {
          byAgent.set(agent, []);
        }
        byAgent.get(agent)!.push(log);
      }

      this.state.tree = Array.from(byAgent.entries()).map(([agent, agentLogs]) => {
        const children = agentLogs.map((log) => {
          const icon = LOG_ICONS[log.action_type as keyof typeof LOG_ICONS] || LOG_ICONS["default"];
          const label = `${icon} ${this.formatTimestamp(log.timestamp)} ${log.action_type}`;
          return createNode<LogEntry>(log.id, label, "log", { expanded: true });
        });
        return createGroupNode<LogEntry>(
          `agent-${agent}`,
          `🤖 ${agent} (${agentLogs.length})`,
          "agent-group",
          children,
        );
      });
    } else if (this.monitorExtensions.groupBy === "action") {
      // Group by action type
      const byAction = new Map<string, LogEntry[]>();
      for (const log of logs) {
        if (!byAction.has(log.action_type)) {
          byAction.set(log.action_type, []);
        }
        byAction.get(log.action_type)!.push(log);
      }

      this.state.tree = Array.from(byAction.entries()).map(([action, actionLogs]) => {
        const icon = LOG_ICONS[action as keyof typeof LOG_ICONS] || LOG_ICONS["default"];
        const children = actionLogs.map((log) => {
          const label = `${this.formatTimestamp(log.timestamp)} [${log.agent_id || "unknown"}]`;
          return createNode<LogEntry>(log.id, label, "log", { expanded: true });
        });
        return createGroupNode<LogEntry>(
          `action-${action}`,
          `${icon} ${action} (${actionLogs.length})`,
          "action-group",
          children,
        );
      });
    }
  }

  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  private selectFirstLog(): void {
    const firstId = getFirstNodeId(this.state.tree);
    if (firstId) {
      this.state.selectedId = firstId;
    }
  }

  // ===== Rendering =====

  renderLogTree(): string[] {
    if (this.state.tree.length === 0) {
      return ["  (No logs available)"];
    }

    return this.renderTreeView({
      selectedId: this.state.selectedId || undefined,
    });
  }

  renderDetail(): string[] {
    const lines: string[] = [];
    lines.push("╔═══════════════════════════════════════════════════════════════╗");
    lines.push("║                      LOG DETAILS                              ║");
    lines.push("╠═══════════════════════════════════════════════════════════════╣");

    if (this.monitorExtensions.detailContent) {
      const contentLines = this.monitorExtensions.detailContent.split("\n");
      for (const line of contentLines) {
        lines.push(`║ ${line.padEnd(63)} ║`);
      }
    } else {
      lines.push("║  (No details available)                                        ║");
    }

    lines.push("╚═══════════════════════════════════════════════════════════════╝");
    lines.push("");
    lines.push("[ESC] Close details");
    return lines;
  }

  renderHelp(): string[] {
    const sections: HelpSection[] = [
      {
        title: "Navigation",
        items: [
          { key: "↑/↓", description: "Move selection" },
          { key: "Home/End", description: "Jump to first/last" },
          { key: "←/→", description: "Collapse/Expand" },
          { key: "c/E", description: "Collapse/Expand all" },
        ],
      },
      {
        title: "Actions",
        items: [
          { key: "Enter", description: "View log details" },
          { key: "Space", description: "Toggle pause" },
          { key: "b", description: "Bookmark entry" },
          { key: "e", description: "Export logs" },
          { key: "s", description: "Search logs" },
          { key: "f", description: "Filter by agent" },
          { key: "t", description: "Filter by time" },
          { key: "T", description: "Filter by Trace ID" },
          { key: "A", description: "Filter by Action Type" },
        ],
      },
      {
        title: "View",
        items: [
          { key: "g", description: "Toggle grouping" },
          { key: "R", description: "Force refresh" },
          { key: "a", description: "Toggle auto-refresh" },
          { key: "?", description: "Toggle help" },
          { key: "Esc", description: "Close/Cancel" },
        ],
      },
    ];

    return renderHelpScreen({
      title: "Monitor View Help",
      sections,
      useColors: this.useColors,
      width: TUI_LAYOUT_NARROW_WIDTH,
    });
  }

  renderActionButtons(): string {
    const parts: string[] = [];
    parts.push("[Space] Pause");
    parts.push("[b] Bookmark");
    parts.push("[s] Search");
    parts.push("[g] Group");
    parts.push("[R] Refresh");
    parts.push("[?] Help");
    return parts.join(" | ");
  }

  renderStatusLine(): string {
    const logs = this.monitorView.getFilteredLogs();
    const paused = this.isPaused() ? " [PAUSED]" : "";
    const autoRefresh = this.state.refreshConfig.enabled ? " [AUTO]" : "";
    const bookmarks = this.monitorExtensions.bookmarkedIds.size > 0
      ? ` [${this.monitorExtensions.bookmarkedIds.size} bookmarked]`
      : "";
    const grouping = this.monitorExtensions.groupBy !== "none" ? ` [Group: ${this.monitorExtensions.groupBy}]` : "";
    return `${logs.length} logs${paused}${autoRefresh}${bookmarks}${grouping}`;
  }

  // ===== Actions =====

  showLogDetail(logId: string): void {
    this.setLoading(true, "Loading details...");
    try {
      const logs = this.monitorView.getFilteredLogs();
      const log = logs.find((l) => l.id === logId);
      if (log) {
        this.monitorExtensions.detailContent = this.formatLogDetail(log);
        this.monitorExtensions.showDetail = true;
      }
    } finally {
      this.setLoading(false);
    }
  }

  private formatLogDetail(log: LogEntry): string {
    const lines: string[] = [];
    lines.push(`ID: ${log.id}`);
    lines.push(`Trace ID: ${log.trace_id}`);
    lines.push(`Timestamp: ${log.timestamp}`);
    lines.push(`Actor: ${log.actor || "unknown"}`);
    lines.push(`Agent: ${log.agent_id || "(none)"}`);
    lines.push(`Action: ${log.action_type}`);
    lines.push(`Target: ${log.target || "(none)"}`);
    lines.push("");
    lines.push("Payload:");
    lines.push(JSON.stringify(log.payload, null, 2));
    return lines.join("\n");
  }

  togglePause(): void {
    if (this.monitorView.isStreaming()) {
      this.monitorView.pause();
      this.statusMessage = "Log streaming paused";
    } else {
      this.monitorView.resume();
      this.buildTree();
      this.statusMessage = "Log streaming resumed";
    }
  }

  toggleBookmark(): void {
    const selectedId = this.state.selectedId;
    if (!selectedId) return;

    // Skip group nodes
    if (selectedId.startsWith("agent-") || selectedId.startsWith("action-")) {
      return;
    }

    if (this.monitorExtensions.bookmarkedIds.has(selectedId)) {
      this.monitorExtensions.bookmarkedIds.delete(selectedId);
      this.statusMessage = "Bookmark removed";
    } else {
      this.monitorExtensions.bookmarkedIds.add(selectedId);
      this.statusMessage = "Log bookmarked";
    }
  }

  isBookmarked(logId: string): boolean {
    return this.monitorExtensions.bookmarkedIds.has(logId);
  }

  toggleGrouping(): void {
    if (this.monitorExtensions.groupBy === "none") {
      this.monitorExtensions.groupBy = "agent";
    } else if (this.monitorExtensions.groupBy === "agent") {
      this.monitorExtensions.groupBy = "action";
    } else {
      this.monitorExtensions.groupBy = "none";
    }
    this.buildTree();
    this.selectFirstLog();
    this.statusMessage = `Grouping: ${this.monitorExtensions.groupBy}`;
  }

  toggleAutoRefresh(): void {
    this.state.refreshConfig.enabled = !this.state.refreshConfig.enabled;
    if (this.state.refreshConfig.enabled) {
      this.startAutoRefresh();
      this.statusMessage = "Auto-refresh enabled";
    } else {
      this.stopAutoRefresh();
      this.statusMessage = "Auto-refresh disabled";
    }
  }

  override startAutoRefresh(): void {
    if (this.autoRefreshTimer) return;
    this.autoRefreshTimer = setInterval(() => {
      if (!this.isPaused()) {
        this.doRefresh();
      }
    }, MONITOR_AUTO_REFRESH_INTERVAL_MS) as unknown as number;
  }

  override stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  private doRefresh(): void {
    this.monitorView.refreshLogs();
    this.buildTree();
    this.statusMessage = "Logs refreshed";
  }

  override refresh(): Promise<void> {
    this.doRefresh();
    return Promise.resolve();
  }

  exportLogs(): string {
    const exported = this.monitorView.exportLogs();
    this.statusMessage = `Exported ${this.monitorView.getFilteredLogs().length} logs`;
    return exported;
  }

  showSearchDialog(): void {
    this.pendingDialogType = "search";
    this.showInputDialog({
      title: "Search Logs",
      label: "Enter search query:",
      defaultValue: this.state.filterText,
    });
  }

  showFilterByAgentDialog(): void {
    const logs = this.monitorView.getFilteredLogs();
    const agents = [...new Set(logs.map((l) => l.agent_id).filter(Boolean))];
    const agentList = agents.length > 0 ? agents.join(", ") : "(no agents)";

    this.pendingDialogType = "filter-agent";
    this.showInputDialog({
      title: "Filter by Agent",
      label: `Available agents: ${agentList}\nEnter agent ID (empty to clear):`,
      defaultValue: "",
    });
  }

  showTimeFilterDialog(): void {
    this.pendingDialogType = "filter-time";
    this.showInputDialog({
      title: "Filter by Time",
      label: "Enter time window in minutes (empty to clear):",
      defaultValue: "",
    });
  }

  showFilterByTraceIdDialog(): void {
    this.pendingDialogType = "filter-trace";
    this.showInputDialog({
      title: "Filter by Trace ID",
      label: "Enter trace ID (empty to clear):",
      defaultValue: "",
    });
  }

  showFilterByActionTypeDialog(): void {
    const logs = this.monitorView.getFilteredLogs();
    const actions = [...new Set(logs.map((l) => l.action_type).filter(Boolean))];
    const actionList = actions.length > 0 ? actions.join(", ") : "(no actions)";

    this.pendingDialogType = "filter-action";
    this.showInputDialog({
      title: "Filter by Action Type",
      label: `Available actions: ${actionList}\nEnter action type (empty to clear):`,
      defaultValue: "",
    });
  }

  private handleSearchResult(query: string): void {
    this.state.filterText = query;
    this.statusMessage = `Searching for: ${query}`;
  }

  private handleAgentFilterResult(agent: string): void {
    if (agent) {
      this.monitorView.setFilter({ agentId: agent });
      this.statusMessage = `Filtered by agent: ${agent}`;
    } else {
      this.monitorView.setFilter({ agentId: undefined });
      this.statusMessage = "Filter cleared";
    }
    this.monitorView.refreshLogs().then(() => {
      this.buildTree();
      this.selectFirstLog();
    });
  }

  private handleTimeFilterResult(minutes: string): void {
    if (minutes) {
      const ms = parseInt(minutes, 10) * 60 * 1000;
      const since = new Date(Date.now() - ms).toISOString();
      this.monitorView.setFilter({ since });
      this.statusMessage = `Showing logs from last ${minutes} minutes`;
    } else {
      this.monitorView.setFilter({ since: undefined });
      this.statusMessage = "Time filter cleared";
    }
    this.monitorView.refreshLogs().then(() => {
      this.buildTree();
      this.selectFirstLog();
    });
  }

  private handleTraceFilterResult(traceId: string): void {
    if (traceId) {
      this.monitorView.setFilter({ traceId: traceId });
      this.statusMessage = `Filtered by Trace ID: ${traceId}`;
    } else {
      this.monitorView.setFilter({ traceId: undefined });
      this.statusMessage = "Trace filter cleared";
    }
    this.monitorView.refreshLogs().then(() => {
      this.buildTree();
      this.selectFirstLog();
    });
  }

  private handleActionFilterResult(actionType: string): void {
    if (actionType) {
      this.monitorView.setFilter({ actionType: actionType });
      this.statusMessage = `Filtered by Action: ${actionType}`;
    } else {
      this.monitorView.setFilter({ actionType: undefined });
      this.statusMessage = "Action filter cleared";
    }
    this.monitorView.refreshLogs().then(() => {
      this.buildTree();
      this.selectFirstLog();
    });
  }

  // ===== Navigation =====

  // ===== Dialog Management =====

  protected override onDialogClosed(dialog: DialogBase): void {
    const result = dialog.getResult();
    if (result.type === "cancelled") {
      this.pendingDialogType = null;
      return;
    }

    const value = result.value as string;
    switch (this.pendingDialogType) {
      case "search":
        this.handleSearchResult(value);
        break;
      case "filter-agent":
        this.handleAgentFilterResult(value);
        break;
      case "filter-time":
        this.handleTimeFilterResult(value);
        break;
      case "filter-trace":
        this.handleTraceFilterResult(value);
        break;
      case "filter-action":
        this.handleActionFilterResult(value);
        break;
    }
    this.pendingDialogType = null;
  }

  override async handleKey(key: string): Promise<boolean> {
    // 1. Handle dialogs (delegated to base)
    if (this.handleDialogKeys(key)) return true;

    // 2. Handle detail view
    if (this.monitorExtensions.showDetail) {
      if (key === "escape" || key === "q") {
        this.monitorExtensions.showDetail = false;
      }
      return true;
    }

    // 3. Handle help screen (delegated to base)
    if (this.handleHelpKeys(key)) return true;

    // 4. Handle navigation (delegated to base)
    if (this.handleNavigationKeys(key)) {
      return true;
    }

    // 5. Handle action keys
    switch (key) {
      case "enter": {
        const selectedId = this.state.selectedId;
        if (selectedId) {
          const selected = this.getSelectedNode();
          if (selected && selected.type !== "log") {
            this.toggleCurrentNode();
          } else {
            this.showLogDetail(selectedId);
          }
        }
        return true;
      }
      case "space":
        this.togglePause();
        return true;
      case "b":
        this.toggleBookmark();
        return true;
      case "s":
        this.showSearchDialog();
        return true;
      case "f":
        this.showFilterByAgentDialog();
        return true;
      case "t":
        this.showTimeFilterDialog();
        return true;
      case "T":
        this.showFilterByTraceIdDialog();
        return true;
      case "A":
        this.showFilterByActionTypeDialog();
        return true;
      case "g":
        this.toggleGrouping();
        return true;
      case "a":
        this.toggleAutoRefresh();
        return true;
      case "R":
        await this.refresh();
        return true;
      case "e":
        this.exportLogs();
        return true;
      case "E":
        this.expandAllNodes();
        return true;
      case "c":
        this.collapseAllNodes();
        return true;
      case "?":
        this.state.showHelp = true;
        return true;
      default:
        return false;
    }
  }

  // ===== Lifecycle =====

  cleanup(): void {
    this.stopAutoRefresh();
  }

  getFocusableElements(): string[] {
    return ["log-list", "action-buttons"];
  }
}
