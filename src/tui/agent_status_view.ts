/**
 * Agent Status View - TUI for monitoring agent health and status
 *
 * Phase 13.7: Enhanced with modern patterns including:
 * - Tree view for agent hierarchy
 * - Detail panel with health metrics
 * - Live updating (auto-refresh)
 * - Log viewer integration
 * - Health indicators
 * - Help screen
 */

import { TuiSessionBase } from "./tui_common.ts";
import { createSpinnerState, type SpinnerState, startSpinner, stopSpinner } from "./utils/spinner.ts";
import type { TreeNode } from "./utils/tree_view.ts";
import {
  collapseAll,
  expandAll,
  findNode,
  flattenTree,
  getFirstNodeId,
  getLastNodeId,
  getNextNodeId,
  getPrevNodeId,
  renderTree,
  toggleNode,
} from "./utils/tree_view.ts";
import { AgentHealth, AgentStatus, TuiGroupBy } from "../enums.ts";
import { type HelpSection, renderHelpScreen } from "./utils/help_renderer.ts";
import { ConfirmDialog, InputDialog } from "./utils/dialog_base.ts";
import { type KeyBinding, KeyBindingCategory, KEYS } from "./utils/keyboard.ts";
import { KeyBindingsBase } from "./base/key_bindings_base.ts";
import {
  TUI_AGENT_HEALTH_ICONS,
  TUI_AGENT_STATUS_ICONS,
  TUI_LAYOUT_NARROW_WIDTH,
  TUI_LIMIT_MEDIUM,
  TUI_LOG_LEVEL_ICONS,
} from "./utils/constants.ts";
import { MONITOR_AUTO_REFRESH_INTERVAL_MS } from "./tui.config.ts";
import { DEFAULT_QUERY_LIMIT } from "../config/constants.ts";

// Extracted utilities
import { MainViewHandler, ViewModeHandler } from "./agent_status/key_handlers.ts";
import { buildFlatTree, buildTreeByModel, buildTreeByStatus } from "./agent_status/tree_builder.ts";

// ===== Service Interfaces =====

/**
 * Service interface for agent status access.
 */
export interface AgentService {
  listAgents(): Promise<AgentStatusItem[]>;
  getAgentLogs(agentId: string, limit?: number): Promise<AgentLogEntry[]>;
  getAgentHealth(agentId: string): Promise<AgentHealthData>;
}

export interface AgentStatusItem {
  id: string;
  name: string;
  model: string;
  status: AgentStatus;
  lastActivity: string; // ISO timestamp
  capabilities: string[];
  defaultSkills: string[]; // Phase 17: Skills from blueprint default_skills
}
export interface AgentHealthData {
  status: AgentHealth;
  issues: string[];
  uptime: number; // seconds
}

export interface AgentLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  traceId?: string;
}

// ===== View State =====

/**
 * State interface for Agent Status View
 */
export interface AgentViewState {
  /** Currently selected agent ID */
  selectedAgentId: string | null;
  /** Agent tree structure */
  agentTree: TreeNode[];
  /** Whether help is visible */
  showHelp: boolean;
  /** Whether detail view is shown */
  showDetail: boolean;
  /** Whether log view is shown */
  showLogs: boolean;
  /** Detail content for selected agent */
  detailContent: string;
  /** Log content for selected agent */
  logContent: string;
  /** Active dialog */
  activeDialog: ConfirmDialog | InputDialog | null;
  /** Current search query */
  searchQuery: string;
  /** Current grouping mode */
  groupBy: TuiGroupBy;
  /** Whether auto-refresh is enabled */
  autoRefresh: boolean;
  /** Auto-refresh interval in ms */
  autoRefreshInterval: number;
}

// ===== Icons and Visual Constants =====

// ===== Constants & Enums =====

export const AGENT_STATUS_ICONS: Record<string, string> = {
  [AgentStatus.ACTIVE]: TUI_AGENT_STATUS_ICONS.active,
  [AgentStatus.INACTIVE]: TUI_AGENT_STATUS_ICONS.inactive,
  [AgentStatus.ERROR]: TUI_AGENT_STATUS_ICONS.error,
};

export const AGENT_HEALTH_ICONS: Record<string, string> = {
  [AgentHealth.HEALTHY]: TUI_AGENT_HEALTH_ICONS.healthy,
  [AgentHealth.WARNING]: TUI_AGENT_HEALTH_ICONS.warning,
  [AgentHealth.CRITICAL]: TUI_AGENT_HEALTH_ICONS.critical,
};

export const LOG_LEVEL_ICONS: Record<string, string> = {
  info: TUI_LOG_LEVEL_ICONS.info,
  warn: TUI_LOG_LEVEL_ICONS.warn,
  error: TUI_LOG_LEVEL_ICONS.error,
};

export const AGENT_STATUS_COLORS: Record<string, string> = {
  active: "green",
  inactive: "yellow",
  error: "red",
  healthy: "green",
  warning: "yellow",
  critical: "red",
};

// ===== Key Bindings =====

// ===== Agent Action Types =====
export enum AgentAction {
  NAVIGATE_UP = "navigate-up",
  NAVIGATE_DOWN = "navigate-down",
  NAVIGATE_HOME = "navigate-home",
  NAVIGATE_END = "navigate-end",
  COLLAPSE = "collapse",
  EXPAND = "expand",
  VIEW_DETAILS = "view-details",
  VIEW_LOGS = "view-logs",
  SEARCH = "search",
  TOGGLE_GROUPING = "toggle-grouping",
  REFRESH = "refresh",
  AUTO_REFRESH = "auto-refresh",
  COLLAPSE_ALL = "collapse-all",
  EXPAND_ALL = "expand-all",
  HELP = "help",
  QUIT = "quit",
  CANCEL = "cancel",
}
// ===== Key Binding Categories =====

export class AgentKeyBindings extends KeyBindingsBase<AgentAction, KeyBindingCategory> {
  readonly KEY_BINDINGS: readonly KeyBinding<AgentAction, KeyBindingCategory>[] = [
    {
      key: KEYS.UP,
      action: AgentAction.NAVIGATE_UP,
      description: "Move up",
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.DOWN,
      action: AgentAction.NAVIGATE_DOWN,
      description: "Move down",
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.HOME,
      action: AgentAction.NAVIGATE_HOME,
      description: "Go to first",
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.END,
      action: AgentAction.NAVIGATE_END,
      description: "Go to last",
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.LEFT,
      action: AgentAction.COLLAPSE,
      description: "Collapse group",
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.RIGHT,
      action: AgentAction.EXPAND,
      description: "Expand group",
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.ENTER,
      action: AgentAction.VIEW_DETAILS,
      description: "View agent details",
      category: KeyBindingCategory.ACTIONS,
    },
    {
      key: KEYS.L,
      action: AgentAction.VIEW_LOGS,
      description: "View agent logs",
      category: KeyBindingCategory.ACTIONS,
    },
    { key: KEYS.S, action: AgentAction.SEARCH, description: "Search agents", category: KeyBindingCategory.ACTIONS },
    {
      key: KEYS.G,
      action: AgentAction.TOGGLE_GROUPING,
      description: "Toggle grouping",
      category: KeyBindingCategory.VIEW,
    },
    {
      key: KEYS.CAP_R,
      action: AgentAction.REFRESH,
      description: "Force refresh",
      category: KeyBindingCategory.VIEW,
    },
    {
      key: KEYS.A,
      action: AgentAction.AUTO_REFRESH,
      description: "Toggle auto-refresh",
      category: KeyBindingCategory.VIEW,
    },
    {
      key: KEYS.C,
      action: AgentAction.COLLAPSE_ALL,
      description: "Collapse all",
      category: KeyBindingCategory.VIEW,
    },
    {
      key: KEYS.CAP_E,
      action: AgentAction.EXPAND_ALL,
      description: "Expand all",
      category: KeyBindingCategory.VIEW,
    },
    { key: KEYS.QUESTION, action: AgentAction.HELP, description: "Toggle help", category: KeyBindingCategory.HELP },
    { key: KEYS.Q, action: AgentAction.QUIT, description: "Close/Back", category: KeyBindingCategory.HELP },
    {
      key: KEYS.ESCAPE,
      action: AgentAction.CANCEL,
      description: "Close dialog/view",
      category: KeyBindingCategory.HELP,
    },
  ];
}

export const AGENT_KEY_BINDINGS = new AgentKeyBindings().KEY_BINDINGS;

// ===== Agent Status View Class =====

/**
 * View/controller for agent status. Delegates to injected AgentService.
 */
export class AgentStatusView {
  private selectedAgentId: string | null = null;
  private agents: AgentStatusItem[] = [];

  constructor(private readonly agentService: AgentService) {}

  /** Get all agents with their status. */
  async getAgentList(): Promise<AgentStatusItem[]> {
    this.agents = await this.agentService.listAgents();
    return this.agents;
  }

  /** Get cached agents (without fetch) */
  getCachedAgents(): AgentStatusItem[] {
    return [...this.agents];
  }

  /** Get detailed health for an agent. */
  async getAgentHealth(agentId: string): Promise<AgentHealthData> {
    return await this.agentService.getAgentHealth(agentId);
  }

  /** Get logs for an agent. */
  async getAgentLogs(agentId: string, limit = DEFAULT_QUERY_LIMIT): Promise<AgentLogEntry[]> {
    return await this.agentService.getAgentLogs(agentId, limit);
  }

  /** Select an agent for detailed view. */
  selectAgent(agentId: string): void {
    this.selectedAgentId = agentId;
  }

  /** Get currently selected agent. */
  getSelectedAgent(): string | null {
    return this.selectedAgentId;
  }

  /** Render agent list for TUI display. */
  async renderAgentList(): Promise<string> {
    const agents = await this.getAgentList();
    if (agents.length === 0) {
      return "No agents registered.";
    }
    const lines = ["Agent Status:", ""];
    for (const agent of agents) {
      const statusIcon = AGENT_STATUS_ICONS[agent.status] || "⚪";
      lines.push(
        `${statusIcon} ${agent.name} (${agent.model}) - Last: ${new Date(agent.lastActivity).toLocaleString()}`,
      );
    }
    return lines.join("\n");
  }

  /** Render detailed view for selected agent. */
  async renderAgentDetails(): Promise<string> {
    if (!this.selectedAgentId) {
      return "No agent selected.";
    }
    const [health, logs] = await Promise.all([
      this.getAgentHealth(this.selectedAgentId),
      this.getAgentLogs(this.selectedAgentId, TUI_LIMIT_MEDIUM),
    ]);
    const lines = [`Agent: ${this.selectedAgentId}`, ""];
    const healthIcon = AGENT_HEALTH_ICONS[health.status] || "❓";
    lines.push(`${healthIcon} Health: ${health.status.toUpperCase()} (Uptime: ${this.formatUptime(health.uptime)})`);
    if (health.issues.length > 0) {
      lines.push("Issues:");
      for (const issue of health.issues) {
        lines.push(`  - ${issue}`);
      }
    }
    lines.push("");
    lines.push("Recent Logs:");
    for (const log of logs) {
      const levelIcon = LOG_LEVEL_ICONS[log.level] || "📝";
      lines.push(`${levelIcon} ${log.timestamp} ${log.message}`);
    }
    return lines.join("\n");
  }

  /** Format uptime in human-readable format */
  formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /** Get focusable elements for accessibility. */
  getFocusableElements(): string[] {
    return ["agent-list", "agent-details", "refresh-button"];
  }

  /**
   * Create TUI session for interactive mode
   */
  createTuiSession(useColors = true): AgentStatusTuiSession {
    return new AgentStatusTuiSession(this, useColors);
  }
}

// ===== Minimal Mock for Tests =====

/**
 * Minimal AgentService mock for TUI session tests
 */
export class MinimalAgentServiceMock implements AgentService {
  private agents: AgentStatusItem[] = [];

  constructor(agents: AgentStatusItem[] = []) {
    this.agents = agents;
  }

  listAgents(): Promise<AgentStatusItem[]> {
    return Promise.resolve([...this.agents]);
  }

  getAgentLogs(_agentId: string, _limit = TUI_LIMIT_MEDIUM): Promise<AgentLogEntry[]> {
    return Promise.resolve([
      {
        timestamp: new Date().toISOString(),
        level: "info",
        message: "Test log entry",
      },
    ]);
  }

  getAgentHealth(_agentId: string): Promise<AgentHealthData> {
    // Mock health data
    return Promise.resolve({
      status: AgentHealth.HEALTHY,
      issues: [],
      uptime: 3600,
    });
  }

  setAgents(agents: AgentStatusItem[]): void {
    this.agents = agents;
  }
}

// ===== TUI Session Class =====

/**
 * Interactive TUI session for Agent Status View
 */
export class AgentStatusTuiSession extends TuiSessionBase {
  private readonly agentView: AgentStatusView;
  private state: AgentViewState;
  private localSpinnerState: SpinnerState;
  private autoRefreshTimer: number | null = null;
  private agents: AgentStatusItem[] = [];

  constructor(agentView: AgentStatusView, useColors = true) {
    super(useColors);
    this.agentView = agentView;
    this.localSpinnerState = createSpinnerState();
    this.state = {
      selectedAgentId: null,
      agentTree: [],
      showHelp: false,
      showDetail: false,
      showLogs: false,
      detailContent: "",
      logContent: "",
      activeDialog: null,
      searchQuery: "",
      groupBy: TuiGroupBy.NONE,
      autoRefresh: useColors ? true : false,
      autoRefreshInterval: MONITOR_AUTO_REFRESH_INTERVAL_MS,
    };
  }

  // ===== Initialization =====

  /**
   * Initialize the session by loading agents
   */
  async initialize(): Promise<void> {
    this.localSpinnerState = startSpinner(this.localSpinnerState, "Loading agents...");
    try {
      this.agents = await this.agentView.getAgentList();
      this.buildTree();
      this.selectFirstAgent();
    } finally {
      this.localSpinnerState = stopSpinner(this.localSpinnerState);
    }
  }

  // ===== State Accessors =====

  override getViewName(): string {
    return "Agent Status";
  }

  getAgentTree(): TreeNode[] {
    return this.state.agentTree;
  }

  getAgents(): AgentStatusItem[] {
    return this.agents;
  }

  setAgents(agents: AgentStatusItem[]): void {
    this.agents = agents;
    this.buildTree();
    this.selectFirstAgent();
  }

  getSelectedAgentId(): string | null {
    return this.state.selectedAgentId;
  }

  override isHelpVisible(): boolean {
    return this.state.showHelp;
  }

  isDetailVisible(): boolean {
    return this.state.showDetail;
  }

  isLogsVisible(): boolean {
    return this.state.showLogs;
  }

  getDetailContent(): string {
    return this.state.detailContent;
  }

  getLogContent(): string {
    return this.state.logContent;
  }

  hasActiveDialog(): boolean {
    return this.state.activeDialog !== null;
  }

  getActiveDialog(): ConfirmDialog | InputDialog | null {
    return this.state.activeDialog;
  }

  getSearchQuery(): string {
    return this.state.searchQuery;
  }

  getGroupBy(): TuiGroupBy {
    return this.state.groupBy;
  }

  getGroupByLabel(): string {
    switch (this.state.groupBy) {
      case TuiGroupBy.NONE:
        return "None";
      case TuiGroupBy.STATUS:
        return "Status";
      case TuiGroupBy.MODEL:
        return "Model";
      default:
        return "Unknown";
    }
  }

  isAutoRefreshEnabled(): boolean {
    return this.state.autoRefresh;
  }

  isLoading(): boolean {
    return this.localSpinnerState.active;
  }

  getLoadingMessage(): string {
    return this.localSpinnerState.message;
  }

  override getKeyBindings(): KeyBinding[] {
    return [...AGENT_KEY_BINDINGS];
  }

  // ===== Tree Building =====

  private isGroupNode(id: string): boolean {
    return id.startsWith("status-") || id.startsWith("model-");
  }

  private buildTree(): void {
    const agents = this.getFilteredAgents();

    switch (this.state.groupBy) {
      case TuiGroupBy.NONE:
        this.state.agentTree = buildFlatTree(agents);
        break;
      case TuiGroupBy.STATUS:
        this.state.agentTree = buildTreeByStatus(agents);
        break;
      case TuiGroupBy.MODEL:
        this.state.agentTree = buildTreeByModel(agents);
        break;
    }
  }

  private getFilteredAgents(): AgentStatusItem[] {
    let result = [...this.agents];

    // Apply search filter
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      result = result.filter(
        (agent) =>
          agent.name.toLowerCase().includes(query) ||
          agent.model.toLowerCase().includes(query) ||
          agent.id.toLowerCase().includes(query),
      );
    }

    return result;
  }

  private selectFirstAgent(): void {
    const firstId = getFirstNodeId(this.state.agentTree);
    if (firstId) {
      this.state.selectedAgentId = firstId;
    }
  }

  // ===== Navigation =====

  navigateUp(): void {
    if (this.state.selectedAgentId) {
      const prevId = getPrevNodeId(this.state.agentTree, this.state.selectedAgentId);
      if (prevId) {
        this.state.selectedAgentId = prevId;
      }
    }
  }

  navigateDown(): void {
    if (this.state.selectedAgentId) {
      const nextId = getNextNodeId(this.state.agentTree, this.state.selectedAgentId);
      if (nextId) {
        this.state.selectedAgentId = nextId;
      }
    } else {
      this.selectFirstAgent();
    }
  }

  navigateToFirst(): void {
    const firstId = getFirstNodeId(this.state.agentTree);
    if (firstId) {
      this.state.selectedAgentId = firstId;
    }
  }

  navigateToLast(): void {
    const lastId = getLastNodeId(this.state.agentTree);
    if (lastId) {
      this.state.selectedAgentId = lastId;
    }
  }

  // ===== Tree Operations =====

  toggleSelectedNode(): void {
    if (this.state.selectedAgentId && this.isGroupNode(this.state.selectedAgentId)) {
      this.state.agentTree = toggleNode(this.state.agentTree, this.state.selectedAgentId);
    }
  }

  collapseSelected(): void {
    if (this.state.selectedAgentId) {
      const node = findNode(this.state.agentTree, this.state.selectedAgentId);
      if (node && node.expanded) {
        this.state.agentTree = toggleNode(this.state.agentTree, this.state.selectedAgentId);
      }
    }
  }

  expandSelected(): void {
    if (this.state.selectedAgentId) {
      const node = findNode(this.state.agentTree, this.state.selectedAgentId);
      if (node && !node.expanded && node.children.length > 0) {
        this.state.agentTree = toggleNode(this.state.agentTree, this.state.selectedAgentId);
      }
    }
  }

  collapseAllNodes(): void {
    this.state.agentTree = collapseAll(this.state.agentTree);
  }

  expandAllNodes(): void {
    this.state.agentTree = expandAll(this.state.agentTree);
  }

  // ===== Grouping =====

  toggleGrouping(): void {
    if (this.state.groupBy === TuiGroupBy.NONE) {
      this.state.groupBy = TuiGroupBy.STATUS;
    } else if (this.state.groupBy === TuiGroupBy.STATUS) {
      this.state.groupBy = TuiGroupBy.MODEL;
    } else {
      this.state.groupBy = TuiGroupBy.NONE;
    }
    this.buildTree();
    this.selectFirstAgent();
  }

  setGroupBy(mode: TuiGroupBy): void {
    this.state.groupBy = mode;
    this.buildTree();
    this.selectFirstAgent();
  }

  // ===== Detail Panel =====

  async showAgentDetail(): Promise<void> {
    if (!this.state.selectedAgentId || this.isGroupNode(this.state.selectedAgentId)) {
      return;
    }

    this.localSpinnerState = startSpinner(this.localSpinnerState, "Loading agent details...");
    try {
      const health = await this.agentView.getAgentHealth(this.state.selectedAgentId);
      const agent = this.agents.find((a) => a.id === this.state.selectedAgentId);
      this.state.detailContent = this.formatDetailContent(agent, health);
      this.state.showDetail = true;
    } finally {
      this.localSpinnerState = stopSpinner(this.localSpinnerState);
    }
  }

  private formatDetailContent(agent: AgentStatusItem | undefined, health: AgentHealthData): string {
    if (!agent) return "Agent not found.";

    const lines: string[] = [];
    lines.push(`Agent: ${agent.name}`);
    lines.push(`ID: ${agent.id}`);
    lines.push(`Model: ${agent.model}`);
    lines.push(`Status: ${AGENT_STATUS_ICONS[agent.status]} ${agent.status.toUpperCase()}`);
    lines.push(`Last Activity: ${new Date(agent.lastActivity).toLocaleString()}`);
    lines.push("");
    lines.push(`Health: ${AGENT_HEALTH_ICONS[health.status]} ${health.status.toUpperCase()}`);
    lines.push(`Uptime: ${this.agentView.formatUptime(health.uptime)}`);

    if (health.issues.length > 0) {
      lines.push("");
      lines.push("Issues:");
      for (const issue of health.issues) {
        lines.push(`  ⚠️ ${issue}`);
      }
    }

    if (agent.capabilities.length > 0) {
      lines.push("");
      lines.push("Capabilities:");
      for (const cap of agent.capabilities) {
        lines.push(`  • ${cap}`);
      }
    }

    if (agent.defaultSkills && agent.defaultSkills.length > 0) {
      lines.push("");
      lines.push("Default Skills:");
      for (const skill of agent.defaultSkills) {
        lines.push(`  🎯 ${skill}`);
      }
    }

    return lines.join("\n");
  }

  hideDetail(): void {
    this.state.showDetail = false;
    this.state.detailContent = "";
  }

  // ===== Log Viewer =====

  async showAgentLogs(): Promise<void> {
    if (!this.state.selectedAgentId || this.isGroupNode(this.state.selectedAgentId)) {
      return;
    }

    this.localSpinnerState = startSpinner(this.localSpinnerState, "Loading agent logs...");
    try {
      const logs = await this.agentView.getAgentLogs(this.state.selectedAgentId, 20);
      this.state.logContent = this.formatLogContent(logs);
      this.state.showLogs = true;
    } finally {
      this.localSpinnerState = stopSpinner(this.localSpinnerState);
    }
  }

  private formatLogContent(logs: AgentLogEntry[]): string {
    if (logs.length === 0) {
      return "No logs available.";
    }

    return logs
      .map((log) => {
        const icon = LOG_LEVEL_ICONS[log.level] || "📝";
        const time = new Date(log.timestamp).toLocaleTimeString();
        const traceInfo = log.traceId ? ` [${log.traceId}]` : "";
        return `${icon} ${time}${traceInfo} ${log.message}`;
      })
      .join("\n");
  }

  hideLogs(): void {
    this.state.showLogs = false;
    this.state.logContent = "";
  }

  // ===== Search =====

  showSearchDialog(): void {
    this.state.activeDialog = new InputDialog({
      title: "Search Agents",
      label: "Search query",
      placeholder: "Enter name, model, or ID...",
      defaultValue: this.state.searchQuery,
    });
  }

  applySearch(query: string): void {
    this.state.searchQuery = query;
    this.state.activeDialog = null;
    this.buildTree();
    this.selectFirstAgent();
  }

  clearSearch(): void {
    this.state.searchQuery = "";
    this.buildTree();
    this.selectFirstAgent();
  }

  // ===== Auto-Refresh =====

  toggleAutoRefresh(): void {
    this.state.autoRefresh = !this.state.autoRefresh;
    if (this.state.autoRefresh) {
      this.startAgentAutoRefresh();
    } else {
      this.stopAgentAutoRefresh();
    }
  }

  private startAgentAutoRefresh(): void {
    if (this.autoRefreshTimer === null) {
      this.autoRefreshTimer = setInterval(() => {
        this.refreshAgents();
      }, this.state.autoRefreshInterval);
    }
  }

  private stopAgentAutoRefresh(): void {
    if (this.autoRefreshTimer !== null) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  async refreshAgents(): Promise<void> {
    this.localSpinnerState = startSpinner(this.localSpinnerState, "Refreshing...");
    try {
      const previousSelectedId = this.state.selectedAgentId;
      this.agents = await this.agentView.getAgentList();
      this.buildTree();

      // Try to restore selection
      if (previousSelectedId) {
        const node = findNode(this.state.agentTree, previousSelectedId);
        if (node) {
          this.state.selectedAgentId = previousSelectedId;
        } else {
          this.selectFirstAgent();
        }
      }

      this.setStatus("Refreshed", "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.setStatus(`Refresh failed: ${msg}`, "error");
    } finally {
      this.localSpinnerState = stopSpinner(this.localSpinnerState);
    }
  }

  // ===== Help Screen =====

  override toggleHelp(): void {
    this.state.showHelp = !this.state.showHelp;
  }

  getHelpSections(): HelpSection[] {
    return [
      {
        title: "Navigation",
        items: [
          { key: "↑/↓", description: "Move selection" },
          { key: "Home/End", description: "Jump to first/last" },
          { key: "←/→", description: "Collapse/Expand" },
        ],
      },
      {
        title: "Actions",
        items: [
          { key: "Enter", description: "View agent details" },
          { key: "l", description: "View agent logs" },
          { key: "s", description: "Search agents" },
        ],
      },
      {
        title: "View",
        items: [
          { key: "g", description: "Toggle grouping" },
          { key: "R", description: "Force refresh" },
          { key: "a", description: "Toggle auto-refresh" },
          { key: "c/E", description: "Collapse/Expand all" },
        ],
      },
      {
        title: "General",
        items: [
          { key: "?", description: "Toggle this help" },
          { key: "q/Esc", description: "Close/Back" },
        ],
      },
    ];
  }

  // ===== Dialog Handling =====

  closeDialog(): void {
    if (this.state.activeDialog) {
      const result = this.state.activeDialog.getResult();
      if (this.state.activeDialog instanceof InputDialog && result.type === "confirmed") {
        this.applySearch(result.value as string);
      } else {
        this.state.activeDialog = null;
      }
    }
  }

  // ===== Key Handling =====

  async handleKey(key: string): Promise<boolean> {
    // Handle active dialog first
    if (this.state.activeDialog) {
      this.state.activeDialog.handleKey(key);
      if (!this.state.activeDialog.isActive()) {
        this.closeDialog();
      }
      return true;
    }

    // Handle view modes (detail, logs, help)
    const viewModeHandled = ViewModeHandler.handleKey(
      key,
      {
        showDetail: this.state.showDetail,
        showLogs: this.state.showLogs,
        showHelp: this.state.showHelp,
      },
      {
        hideDetail: () => this.hideDetail(),
        hideLogs: () => this.hideLogs(),
        toggleHelp: () => {
          this.state.showHelp = false;
        },
      },
    );
    if (viewModeHandled) return true;

    // Main view key handling
    return await MainViewHandler.handleKey(key, {
      navigateUp: () => this.navigateUp(),
      navigateDown: () => this.navigateDown(),
      navigateToFirst: () => this.navigateToFirst(),
      navigateToLast: () => this.navigateToLast(),
      collapseSelected: () => this.collapseSelected(),
      expandSelected: () => this.expandSelected(),
      showAgentDetail: () => this.showAgentDetail(),
      showAgentLogs: () => this.showAgentLogs(),
      showSearchDialog: () => this.showSearchDialog(),
      toggleGrouping: () => this.toggleGrouping(),
      refreshAgents: () => this.refreshAgents(),
      toggleAutoRefresh: () => this.toggleAutoRefresh(),
      collapseAllNodes: () => this.collapseAllNodes(),
      expandAllNodes: () => this.expandAllNodes(),
      toggleHelp: () => {
        this.state.showHelp = true;
      },
    });
  }

  // ===== Rendering =====

  renderAgentTree(): string[] {
    if (this.state.agentTree.length === 0) {
      if (this.state.searchQuery) {
        return ["  (No agents match search query)"];
      }
      return ["  (No agents available)"];
    }

    return renderTree(this.state.agentTree, {
      useColors: this.useColors,
      selectedId: this.state.selectedAgentId || undefined,
      indentSize: 2,
    });
  }

  renderDetail(): string[] {
    const lines: string[] = [];
    lines.push("╔═══════════════════════════════════════════════════════════════╗");
    lines.push("║                     AGENT DETAILS                             ║");
    lines.push("╠═══════════════════════════════════════════════════════════════╣");

    if (this.state.detailContent) {
      const contentLines = this.state.detailContent.split("\n");
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

  renderLogs(): string[] {
    const lines: string[] = [];
    lines.push("╔═══════════════════════════════════════════════════════════════╗");
    lines.push("║                      AGENT LOGS                               ║");
    lines.push("╠═══════════════════════════════════════════════════════════════╣");

    if (this.state.logContent) {
      const contentLines = this.state.logContent.split("\n");
      for (const line of contentLines) {
        lines.push(`║ ${line.padEnd(63)} ║`);
      }
    } else {
      lines.push("║  (No logs available)                                           ║");
    }

    lines.push("╚═══════════════════════════════════════════════════════════════╝");
    lines.push("");
    lines.push("[ESC] Close logs");
    return lines;
  }

  renderHelp(): string[] {
    return renderHelpScreen({
      title: "Agent Status Help",
      sections: this.getHelpSections(),
      useColors: this.useColors,
      width: TUI_LAYOUT_NARROW_WIDTH,
    });
  }

  // ===== Focusable Elements =====

  getFocusableElements(): string[] {
    if (this.state.activeDialog) {
      return this.state.activeDialog.getFocusableElements();
    }
    if (this.state.showDetail || this.state.showLogs || this.state.showHelp) {
      return ["close-button"];
    }

    const elements: string[] = [];
    const flat = flattenTree(this.state.agentTree);
    for (const node of flat) {
      elements.push(node.node.id);
    }
    return elements;
  }

  // ===== Backwards Compatibility =====

  /**
   * Get selected index in agent list (for compatibility)
   */
  getSelectedIndexInAgents(): number {
    if (!this.state.selectedAgentId) return 0;
    const flat = flattenTree(this.state.agentTree);
    const idx = flat.findIndex((n) => n.node.id === this.state.selectedAgentId);
    return idx >= 0 ? idx : 0;
  }

  /**
   * Set selected by index (for compatibility)
   */
  setSelectedByIndex(index: number): void {
    const flat = flattenTree(this.state.agentTree);
    if (index >= 0 && index < flat.length) {
      this.state.selectedAgentId = flat[index].node.id;
    }
  }

  // ===== Lifecycle =====

  override dispose(): void {
    this.stopAgentAutoRefresh();
    super.dispose();
  }
}

// ===== Legacy Support =====

/**
 * Legacy TUI session for backwards compatibility
 * @deprecated Use AgentStatusTuiSession instead
 */
export class LegacyAgentStatusTuiSession extends TuiSessionBase {
  private readonly agentView: AgentStatusView;
  private agents: AgentStatusItem[] = [];

  constructor(agentView: AgentStatusView, useColors = true) {
    super(useColors);
    this.agentView = agentView;
  }

  async initialize(): Promise<void> {
    this.agents = await this.agentView.getAgentList();
  }

  getAgentCount(): number {
    return this.agents.length;
  }

  getSelectedAgentId(): string | null {
    const agent = this.agents[this.selectedIndex];
    return agent?.id ?? null;
  }

  getFocusableElements(): string[] {
    return this.agents.map((a) => a.id);
  }
}
