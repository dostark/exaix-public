/**
 * @module RequestManagerView
 * @path src/tui/request_manager_view.ts
 * @description TUI view for managing user requests, featuring tree-based navigation, status/priority grouping, and request creation.
 * @architectural-layer TUI
 * @dependencies [TuiSessionBase, tree_view, dialog_base, help_renderer, keyboard, enums, constants]
 * @related-files [src/services/request_service.ts, src/tui/tui_dashboard.ts]
 */

import { KEYS } from "../helpers/keyboard.ts";
import { KeyBindingCategory } from "../helpers/keyboard.ts";
export interface RequestService {
  listRequests(status?: RequestStatusType): Promise<Request[]>;
  getRequestContent(requestId: string): Promise<string>;
  createRequest(description: string, options?: RequestOptions): Promise<Request>;
  updateRequestStatus(requestId: string, status: RequestStatusType): Promise<boolean>;
}

// --- Request data types ---
export interface Request {
  trace_id: string;
  filename: string;
  title: string;
  status: RequestStatusType;
  priority: string;
  agent: string;
  portal?: string;
  model?: string;
  created: string;
  created_by: string;
  source: string;
  rejected_path?: string;
  // Phase 17: Skills information
  skills?: {
    explicit?: string[]; // User-specified skills
    autoMatched?: string[]; // Skills matched by triggers
    fromDefaults?: string[]; // Skills from agent defaults
    skipped?: string[]; // Skills excluded by user
  };
}

export interface RequestOptions {
  agent?: string;
  priority?: RequestPriority;
  portal?: string;
  model?: string;
  skills?: string[]; // Phase 17: Explicit skills override
  skipSkills?: string[]; // Phase 17: Skills to exclude
}

// --- Phase 13.6: View state interface ---
export interface RequestViewState {
  selectedRequestId: string | null;
  requestTree: TreeNode[];
  showHelp: boolean;
  showDetail: boolean;
  detailContent: string;
  activeDialog: InputDialog | ConfirmDialog | null;
  searchQuery: string;
  filterStatus: RequestStatusType | null;
  filterPriority: string | null;
  filterAgent: string | null;
  groupBy: "none" | "status" | "priority" | "agent";
}

// --- Phase 13.6: Visual constants ---
export const PRIORITY_ICONS: Record<string, string> = {
  [RequestPriority.CRITICAL]: TUI_PRIORITY_ICONS.critical,
  [RequestPriority.HIGH]: TUI_PRIORITY_ICONS.high,
  [RequestPriority.NORMAL]: TUI_PRIORITY_ICONS.normal,
  [RequestPriority.LOW]: TUI_PRIORITY_ICONS.low,
};

export const STATUS_ICONS: Record<string, string> = {
  [RequestStatus.PENDING]: TUI_STATUS_ICONS.pending,
  [RequestStatus.PLANNED]: TUI_STATUS_ICONS.queued,
  [RequestStatus.IN_PROGRESS]: TUI_STATUS_ICONS.running,
  [RequestStatus.COMPLETED]: TUI_STATUS_ICONS.completed,
  [RequestStatus.CANCELLED]: TUI_STATUS_ICONS.cancelled,
  [RequestStatus.FAILED]: TUI_STATUS_ICONS.failed,
};

export const STATUS_COLORS: Record<string, string> = {
  [RequestStatus.PENDING]: "yellow",
  [RequestStatus.PLANNED]: "cyan",
  [RequestStatus.IN_PROGRESS]: "blue",
  [RequestStatus.COMPLETED]: "green",
  [RequestStatus.CANCELLED]: "dim",
  [RequestStatus.FAILED]: "red",
};

// --- Phase 13.6: Key bindings ---

export enum RequestAction {
  NAVIGATE_UP = "navigate-up",
  NAVIGATE_DOWN = "navigate-down",
  NAVIGATE_HOME = "navigate-home",
  NAVIGATE_END = "navigate-end",
  COLLAPSE = "collapse",
  EXPAND = "expand",
  VIEW_DETAIL = "view-detail",
  CREATE = "create",
  DELETE = "delete",
  PRIORITY = "priority",
  SEARCH = "search",
  FILTER_STATUS = "filter-status",
  FILTER_AGENT = "filter-agent",
  TOGGLE_GROUPING = "toggle-grouping",
  REFRESH = "refresh",
  COLLAPSE_ALL = "collapse-all",
  EXPAND_ALL = "expand-all",
  HELP = "help",
  QUIT = "quit",
  CANCEL = "cancel",
}

export class RequestKeyBindings extends KeyBindingsBase<RequestAction, KeyBindingCategory> {
  readonly KEY_BINDINGS: readonly KeyBinding<RequestAction, KeyBindingCategory>[] = [
    {
      key: KEYS.UP,
      description: "Navigate up",
      action: RequestAction.NAVIGATE_UP,
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.DOWN,
      description: "Navigate down",
      action: RequestAction.NAVIGATE_DOWN,
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.HOME,
      description: "Jump to first",
      action: RequestAction.NAVIGATE_HOME,
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.END,
      description: "Jump to last",
      action: RequestAction.NAVIGATE_END,
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.LEFT,
      description: "Collapse group",
      action: RequestAction.COLLAPSE,
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.RIGHT,
      description: "Expand group",
      action: RequestAction.EXPAND,
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.ENTER,
      description: "View request details",
      action: RequestAction.VIEW_DETAIL,
      category: KeyBindingCategory.ACTIONS,
    },
    {
      key: KEYS.C,
      description: "Create new request",
      action: RequestAction.CREATE,
      category: KeyBindingCategory.ACTIONS,
    },
    { key: KEYS.D, description: "Cancel request", action: RequestAction.DELETE, category: KeyBindingCategory.ACTIONS },
    {
      key: KEYS.P,
      description: "Change priority",
      action: RequestAction.PRIORITY,
      category: KeyBindingCategory.ACTIONS,
    },
    { key: KEYS.S, description: "Search requests", action: RequestAction.SEARCH, category: KeyBindingCategory.ACTIONS },
    {
      key: KEYS.F,
      description: "Filter by status",
      action: RequestAction.FILTER_STATUS,
      category: KeyBindingCategory.ACTIONS,
    },
    {
      key: KEYS.A,
      description: "Filter by agent",
      action: RequestAction.FILTER_AGENT,
      category: KeyBindingCategory.ACTIONS,
    },
    {
      key: KEYS.G,
      description: "Toggle grouping",
      action: RequestAction.TOGGLE_GROUPING,
      category: KeyBindingCategory.VIEW,
    },
    { key: KEYS.R, description: "Force refresh", action: RequestAction.REFRESH, category: KeyBindingCategory.VIEW },
    {
      key: KEYS.CAP_C,
      description: "Collapse all",
      action: RequestAction.COLLAPSE_ALL,
      category: KeyBindingCategory.VIEW,
    },
    {
      key: KEYS.CAP_E,
      description: "Expand all",
      action: RequestAction.EXPAND_ALL,
      category: KeyBindingCategory.VIEW,
    },
    { key: KEYS.QUESTION, description: "Show help", action: RequestAction.HELP, category: KeyBindingCategory.HELP },
    { key: KEYS.Q, description: "Quit", action: RequestAction.QUIT, category: KeyBindingCategory.HELP },
    { key: KEYS.ESCAPE, description: "Cancel/close", action: RequestAction.CANCEL, category: KeyBindingCategory.HELP },
  ];
}

export const REQUEST_KEY_BINDINGS = new RequestKeyBindings().KEY_BINDINGS;

// --- Imports for Phase 13.6 ---
import { TuiSessionBase } from "./tui_common.ts";
import { RequestPriority } from "../enums.ts";
import { isRequestStatus, RequestStatus, type RequestStatusType } from "../requests/request_status.ts";
import { createGroupNode, createNode, findNode, flattenTree, renderTree, type TreeNode } from "../helpers/tree_view.ts";
import { type HelpSection, renderHelpScreen } from "../helpers/help_renderer.ts";
import type { KeyBinding } from "../helpers/keyboard.ts";
import { KeyBindingsBase } from "./base/key_bindings_base.ts";

// --- Extracted utilities ---
import {
  isGroupNode as helperIsGroupNode,
  MainKeyHandler,
  NavigationHandler,
  TreeManipulationHandler,
} from "./request_manager/key_handlers.ts";
import { RequestFormatter } from "./request_manager/formatters.ts";
import {
  processDialogCompletion as helperProcessDialogCompletion,
  type RequestDialogTypeUnion,
} from "./request_manager/dialog_handlers.ts";
import { RequestDialogType } from "../enums.ts";
import { ConfirmDialog, InputDialog } from "../helpers/dialog_base.ts";

// --- Adapter: RequestCommands as RequestService ---
import type { RequestCommands } from "../cli/commands/request_commands.ts";
import { TUI_PRIORITY_ICONS, TUI_STATUS_ICONS } from "../helpers/constants.ts";

/**
 * Adapter: RequestCommands as RequestService
 */
export class RequestCommandsServiceAdapter implements RequestService {
  constructor(private readonly cmd: RequestCommands) {}

  async listRequests(status?: RequestStatusType): Promise<Request[]> {
    const requests = await this.cmd.list(status);
    return requests.map((r) => ({
      trace_id: r.trace_id,
      filename: r.filename,
      title: `Request ${r.trace_id.slice(0, 8)}`,
      status: r.status,
      priority: r.priority,
      agent: r.agent,
      portal: r.portal,
      model: r.model,
      created: r.created,
      created_by: r.created_by,
      source: r.source,
      rejected_path: (r as any).rejected_path,
    }));
  }

  async getRequestContent(requestId: string): Promise<string> {
    const result = await this.cmd.show(requestId);
    return result.content;
  }

  async createRequest(description: string, options?: RequestOptions): Promise<Request> {
    const metadata = await this.cmd.create(description, options as any); // Type compatibility wrapper
    return {
      trace_id: metadata.trace_id,
      filename: metadata.filename,
      title: `Request ${metadata.trace_id.slice(0, 8)}`,
      status: metadata.status,
      priority: metadata.priority,
      agent: metadata.agent,
      portal: metadata.portal,
      model: metadata.model,
      created: metadata.created,
      created_by: metadata.created_by,
      source: metadata.source,
      rejected_path: (metadata as any).rejected_path,
    };
  }

  updateRequestStatus(requestId: string, status: RequestStatusType): Promise<boolean> {
    // RequestCommands doesn't have update status method, so we'll need to implement this
    // For now, return true as a placeholder
    console.warn(`updateRequestStatus not implemented for ${requestId} -> ${status}`);
    return Promise.resolve(true);
  }
}

// --- Minimal RequestService mock for TUI session tests ---
/**
 * Minimal RequestService mock for TUI session tests.
 */
export class MinimalRequestServiceMock implements RequestService {
  listRequests = (_status?: RequestStatusType) => Promise.resolve([]);
  getRequestContent = (_: string) => Promise.resolve("");
  createRequest = (_: string, __?: RequestOptions) => Promise.resolve({} as Request);
  updateRequestStatus = (_: string, __: RequestStatusType) => Promise.resolve(true);
}

// --- Phase 13.6: Enhanced TUI Session ---
/**
 * Enhanced TUI session for Request Manager.
 * Features: tree view, grouping, detail panel, search/filter, help screen.
 */
export class RequestManagerTuiSession extends TuiSessionBase {
  // Enhanced state
  protected state: RequestViewState;

  // Request list cache
  protected requests: Request[] = [];

  // Track pending dialog type for result handling
  private pendingDialogType: RequestDialogTypeUnion = null;

  // Pending cancel request ID for confirm dialog
  private pendingCancelRequestId: string | null = null;

  constructor(
    requests: Request[],
    protected readonly service: RequestService,
    useColors = true,
  ) {
    super(useColors);
    this.requests = requests;

    this.state = {
      selectedRequestId: requests[0]?.trace_id || null,
      requestTree: [],
      showHelp: false,
      showDetail: false,
      detailContent: "",
      activeDialog: null,
      searchQuery: "",
      filterStatus: null,
      filterPriority: null,
      filterAgent: null,
      groupBy: "none",
    };

    // Build initial tree
    this.buildTree();
  }

  // ===== State Accessors =====

  getState(): RequestViewState {
    return this.state;
  }

  getRequests(): Request[] {
    return this.requests;
  }

  getSelectedRequest(): Request | null {
    if (!this.state.selectedRequestId) return null;
    return this.requests.find((r) => r.trace_id === this.state.selectedRequestId) || null;
  }

  /**
   * Check if an ID is a group node ID (not a request ID).
   */
  private isGroupNode(id: string): boolean {
    return helperIsGroupNode(this.state.requestTree, id);
  }

  /**
   * Get the index of the currently selected request (for backwards compatibility).
   * Returns the index in the requests array, or 0 if nothing selected.
   */
  getSelectedIndexInRequests(): number {
    if (!this.state.selectedRequestId) return 0;
    const idx = this.requests.findIndex((r) => r.trace_id === this.state.selectedRequestId);
    return idx >= 0 ? idx : 0;
  }

  /**
   * Set selection by index (for backwards compatibility).
   * Selects the request at the given index in the requests array.
   */
  setSelectedByIndex(idx: number): void {
    if (idx >= 0 && idx < this.requests.length) {
      this.state.selectedRequestId = this.requests[idx].trace_id;
    }
  }

  // ===== Tree Building =====

  buildTree(): void {
    const filtered = this.getFilteredRequests();

    switch (this.state.groupBy) {
      case "status":
        this.state.requestTree = this.buildGroupedByStatus(filtered);
        break;
      case "priority":
        this.state.requestTree = this.buildGroupedByPriority(filtered);
        break;
      case "agent":
        this.state.requestTree = this.buildGroupedByAgent(filtered);
        break;
      default:
        this.state.requestTree = this.buildFlatTree(filtered);
    }

    // Ensure selection is valid
    if (this.state.selectedRequestId) {
      const node = findNode(this.state.requestTree, this.state.selectedRequestId);
      if (!node) {
        // Selection not found, select first available
        const flat = flattenTree(this.state.requestTree);
        const first = flat.find((n) => n.node.type === "item");
        this.state.selectedRequestId = first?.node.id || null;
      }
    }
  }

  private buildFlatTree(requests: Request[]): TreeNode[] {
    return requests.map((r) => this.createRequestNode(r));
  }

  private buildGroupedByStatus(requests: Request[]): TreeNode[] {
    const groups = new Map<RequestStatusType, Request[]>();
    for (const req of requests) {
      const status = req.status;
      if (!groups.has(status)) groups.set(status, []);
      groups.get(status)!.push(req);
    }

    return Array.from(groups.entries()).map(([status, reqs]) => {
      const icon = STATUS_ICONS[status] || "❓";
      return createGroupNode(
        `status-${status}`,
        `${icon} ${status} (${reqs.length})`,
        "group",
        reqs.map((r) => this.createRequestNode(r)),
        { expanded: true },
      );
    });
  }

  private buildGroupedByPriority(requests: Request[]): TreeNode[] {
    const priorityOrder = ["critical", "high", "normal", "low"];
    const groups = new Map<string, Request[]>();

    for (const req of requests) {
      const priority = req.priority || "normal";
      if (!groups.has(priority)) groups.set(priority, []);
      groups.get(priority)!.push(req);
    }

    return priorityOrder
      .filter((p) => groups.has(p))
      .map((priority) => {
        const reqs = groups.get(priority)!;
        const icon = PRIORITY_ICONS[priority] || "⚪";
        return createGroupNode(
          `priority-${priority}`,
          `${icon} ${priority} (${reqs.length})`,
          "group",
          reqs.map((r) => this.createRequestNode(r)),
          { expanded: true },
        );
      });
  }

  private buildGroupedByAgent(requests: Request[]): TreeNode[] {
    const groups = new Map<string, Request[]>();
    for (const req of requests) {
      const agent = req.agent || "unassigned";
      if (!groups.has(agent)) groups.set(agent, []);
      groups.get(agent)!.push(req);
    }

    return Array.from(groups.entries()).map(([agent, reqs]) => {
      return createGroupNode(
        `agent-${agent}`,
        `👤 ${agent} (${reqs.length})`,
        "group",
        reqs.map((r) => this.createRequestNode(r)),
        { expanded: true },
      );
    });
  }

  private createRequestNode(request: Request): TreeNode {
    const statusIcon = STATUS_ICONS[request.status] || "❓";
    const priorityIcon = PRIORITY_ICONS[request.priority] || "⚪";
    const date = new Date(request.created).toLocaleString();
    const label = `${statusIcon} ${priorityIcon} ${request.title} - ${request.agent} - ${date}`;

    return createNode(request.trace_id, label, "item");
  }

  // ===== Filtering =====

  getFilteredRequests(): Request[] {
    let filtered = this.requests;

    // Apply status filter
    if (this.state.filterStatus) {
      filtered = filtered.filter((r) => r.status === this.state.filterStatus);
    }

    // Apply priority filter
    if (this.state.filterPriority) {
      filtered = filtered.filter((r) => r.priority === this.state.filterPriority);
    }

    // Apply agent filter
    if (this.state.filterAgent) {
      const query = this.state.filterAgent.toLowerCase();
      filtered = filtered.filter((r) => r.agent.toLowerCase().includes(query));
    }

    // Apply search query
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      filtered = filtered.filter((r) =>
        r.title.toLowerCase().includes(query) ||
        r.trace_id.toLowerCase().includes(query) ||
        r.agent.toLowerCase().includes(query) ||
        r.created_by.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  // ===== Grouping =====

  toggleGrouping(): void {
    const modes: Array<"none" | "status" | "priority" | "agent"> = [
      "none",
      "status",
      "priority",
      "agent",
    ];
    const currentIdx = modes.indexOf(this.state.groupBy);
    this.state.groupBy = modes[(currentIdx + 1) % modes.length];
    this.buildTree();
    this.setStatus(`Grouping: ${this.state.groupBy}`, "info");
  }

  // ===== Navigation =====

  navigateTree(direction: "up" | "down" | "first" | "last"): void {
    this.state.selectedRequestId = NavigationHandler.navigate(
      this.state.requestTree,
      this.state.selectedRequestId,
      direction,
    );
  }

  // Node expansion/collapse
  expandSelectedNode(): void {
    this.state.requestTree = TreeManipulationHandler.expandNode(
      this.state.requestTree,
      this.state.selectedRequestId,
    );
  }

  collapseSelectedNode(): void {
    this.state.requestTree = TreeManipulationHandler.collapseNode(
      this.state.requestTree,
      this.state.selectedRequestId,
    );
  }

  toggleSelectedNode(): void {
    this.state.requestTree = TreeManipulationHandler.toggleNode(
      this.state.requestTree,
      this.state.selectedRequestId,
    );
  }

  // ===== Detail View =====

  async showRequestDetail(requestId: string): Promise<void> {
    try {
      const content = await this.service.getRequestContent(requestId);
      const request = this.requests.find((r) => r.trace_id === requestId);

      this.state.detailContent = this.formatDetailContent(request, content);
      this.state.showDetail = true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.setStatus(`Failed to load details: ${msg}`, "error");
    }
  }

  private formatDetailContent(request: Request | undefined, content: string): string {
    return RequestFormatter.formatDetailContent(request, content);
  }

  renderDetail(): string {
    return this.state.detailContent;
  }

  // ===== Dialogs =====

  showSearchDialog(): void {
    this.state.activeDialog = new InputDialog({
      title: "Search Requests",
      label: "Enter search term:",
      placeholder: "title, ID, or agent...",
      defaultValue: this.state.searchQuery,
    });
    this.pendingDialogType = RequestDialogType.SEARCH;
  }

  showFilterStatusDialog(): void {
    this.state.activeDialog = new InputDialog({
      title: "Filter by Status",
      label: "Status (pending, planned, in_progress, completed, cancelled):",
      placeholder: "status...",
      defaultValue: this.state.filterStatus || "",
    });
    this.pendingDialogType = RequestDialogType.FILTER_STATUS;
  }

  showFilterAgentDialog(): void {
    this.state.activeDialog = new InputDialog({
      title: "Filter by Agent",
      label: "Enter agent name (or empty for all):",
      placeholder: "agent name...",
      defaultValue: this.state.filterAgent || "",
    });
    this.pendingDialogType = RequestDialogType.FILTER_AGENT;
  }

  showCreateDialog(): void {
    this.state.activeDialog = new InputDialog({
      title: "Create Request",
      label: "Enter request description:",
      placeholder: "What would you like to request?",
    });
    this.pendingDialogType = RequestDialogType.CREATE;
  }

  showCancelConfirm(requestId: string): void {
    const request = this.requests.find((r) => r.trace_id === requestId);
    if (!request) return;

    this.state.activeDialog = new ConfirmDialog({
      title: "Cancel Request",
      message: `Are you sure you want to cancel request "${request.title}"?`,
      confirmText: "Cancel Request",
      cancelText: "Keep",
    });
    this.pendingCancelRequestId = requestId;
  }

  showPriorityDialog(): void {
    this.state.activeDialog = new InputDialog({
      title: "Change Priority",
      label: "Enter new priority (low, normal, high, critical):",
      placeholder: "priority...",
    });
    this.pendingDialogType = RequestDialogType.PRIORITY;
  }

  // Dialog result handlers
  private handleSearchResult(value: string): void {
    this.state.searchQuery = value;
    this.buildTree();
    this.setStatus(value ? `Search: "${value}"` : "Search cleared", "info");
  }

  private handleFilterStatusResult(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) {
      this.state.filterStatus = null;
      this.buildTree();
      this.setStatus("Status filter cleared", "info");
      return;
    }

    if (!isRequestStatus(trimmed)) {
      this.setStatus(
        `Invalid status: ${trimmed}. Expected one of: ${Object.values(RequestStatus).join(", ")}`,
        "error",
      );
      return;
    }

    this.state.filterStatus = trimmed;
    this.buildTree();
    this.setStatus(`Filtering: status=${trimmed}`, "info");
  }

  private handleFilterAgentResult(value: string): void {
    this.state.filterAgent = value || null;
    this.buildTree();
    this.setStatus(value ? `Filtering: agent=${value}` : "Agent filter cleared", "info");
  }

  private async handleCreateResult(description: string): Promise<void> {
    if (!description) return;

    try {
      this.startLoading("Creating request...");
      const newRequest = await this.service.createRequest(description, { priority: RequestPriority.NORMAL });
      this.requests.push(newRequest);
      this.buildTree();
      this.setStatus(`Created request: ${newRequest.trace_id.slice(0, 8)}`, "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.setStatus(`Failed to create: ${msg}`, "error");
    } finally {
      this.stopLoading();
    }
  }

  private async handleCancelConfirm(): Promise<void> {
    if (!this.pendingCancelRequestId) return;

    const requestId = this.pendingCancelRequestId;
    this.pendingCancelRequestId = null;

    try {
      this.startLoading("Cancelling request...");
      await this.service.updateRequestStatus(requestId, RequestStatus.CANCELLED);

      // Update local state
      const request = this.requests.find((r) => r.trace_id === requestId);
      if (request) {
        request.status = RequestStatus.CANCELLED;
      }
      this.buildTree();
      this.setStatus(`Cancelled request: ${requestId.slice(0, 8)}`, "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.setStatus(`Failed to cancel: ${msg}`, "error");
    } finally {
      this.stopLoading();
    }
  }

  /**
   * Handle completed dialogs (delegated from handleKey).
   * Extracted to keep handleKey concise and improve testability.
   */
  private async processDialogCompletion(
    dialog: InputDialog | ConfirmDialog | null,
    dialogType: RequestDialogTypeUnion,
  ): Promise<void> {
    await helperProcessDialogCompletion(dialog, dialogType, {
      handleSearchResult: this.handleSearchResult.bind(this),
      handleFilterStatusResult: this.handleFilterStatusResult.bind(this),
      handleFilterAgentResult: this.handleFilterAgentResult.bind(this),
      handleCreateResult: this.handleCreateResult.bind(this),
      handlePriorityResult: this.handlePriorityResult.bind(this),
      processConfirmDialog: this.processConfirmDialog.bind(this),
      setStatus: this.setStatus.bind(this),
    });
  }

  private async processConfirmDialog(_dialog: ConfirmDialog): Promise<void> {
    try {
      await this.handleCancelConfirm();
    } catch (e) {
      this.setStatus(`Error: ${e}`, "error");
    }
  }

  private handlePriorityResult(value: string): void {
    if (!value || !this.state.selectedRequestId) return;

    const validPriorities = ["low", "normal", "high", "critical"];
    if (!validPriorities.includes(value.toLowerCase())) {
      this.setStatus("Invalid priority. Use: low, normal, high, critical", "error");
      return;
    }

    // For now, just update local state (service may not support this)
    const request = this.requests.find((r) => r.trace_id === this.state.selectedRequestId);
    if (request) {
      request.priority = value.toLowerCase();
      this.buildTree();
      this.setStatus(`Priority changed to ${value}`, "success");
    }
  }

  // ===== Help =====

  getHelpSections(): HelpSection[] {
    return [
      {
        title: "Navigation",
        items: [
          { key: "↑/↓", description: "Navigate requests" },
          { key: "Home/End", description: "Jump to first/last" },
          { key: "←/→", description: "Collapse/Expand group" },
          { key: "Enter", description: "View request details" },
        ],
      },
      {
        title: "Actions",
        items: [
          { key: "c", description: "Create new request" },
          { key: "d", description: "Cancel selected request" },
          { key: "p", description: "Change priority" },
          { key: "R", description: "Refresh list" },
        ],
      },
      {
        title: "Search & Filter",
        items: [
          { key: "s", description: "Search requests" },
          { key: "f", description: "Filter by status" },
          { key: "a", description: "Filter by agent" },
          { key: "g", description: "Toggle grouping" },
        ],
      },
      {
        title: "View",
        items: [
          { key: "c/E", description: "Collapse/Expand all" },
          { key: "?", description: "Toggle help" },
          { key: "q/ESC", description: "Close/Exit" },
        ],
      },
    ];
  }

  renderHelp(): string[] {
    return renderHelpScreen({
      title: "Request Manager Help",
      sections: this.getHelpSections(),
      useColors: this.useColors,
      width: 60,
    });
  }

  // ===== Rendering =====

  renderTree(): string[] {
    if (this.state.requestTree.length === 0) {
      return ["No requests found."];
    }

    return renderTree(this.state.requestTree, {
      selectedId: this.state.selectedRequestId || undefined,
      useColors: this.useColors,
    });
  }

  render(): string {
    // If help is showing
    if (this.state.showHelp) {
      return this.renderHelp().join("\n");
    }

    // If detail is showing
    if (this.state.showDetail) {
      return this.renderDetail();
    }

    // Build header
    const lines: string[] = [];
    lines.push("═══════════════════════════════════════════════════════════════");
    lines.push("                     REQUEST MANAGER                            ");
    lines.push("═══════════════════════════════════════════════════════════════");
    lines.push("");

    // Show current filters
    const filters: string[] = [];
    if (this.state.searchQuery) filters.push(`search="${this.state.searchQuery}"`);
    if (this.state.filterStatus) filters.push(`status=${this.state.filterStatus}`);
    if (this.state.filterAgent) filters.push(`agent=${this.state.filterAgent}`);
    if (filters.length > 0) {
      lines.push(`Filters: ${filters.join(", ")}`);
    }
    lines.push(
      `Grouping: ${this.state.groupBy} | Total: ${this.requests.length} | Shown: ${this.getFilteredRequests().length}`,
    );
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("");

    // Tree
    lines.push(...this.renderTree());
    lines.push("");

    // Status bar
    if (this.spinnerState.active) {
      lines.push(`${this.spinnerState.message}`);
    } else if (this.statusMessage) {
      lines.push(this.statusMessage);
    }

    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("↑↓:Navigate  Enter:View  c:Create  d:Cancel  s:Search  ?:Help");

    return lines.join("\n");
  }

  // ===== Key Handling =====

  async handleKey(key: string): Promise<boolean> {
    // Handle active dialog first
    if (this.state.activeDialog) {
      this.state.activeDialog.handleKey(key);

      // Check if dialog completed
      if (!this.state.activeDialog.isActive()) {
        const dialog = this.state.activeDialog;
        const dialogType = this.pendingDialogType;
        this.state.activeDialog = null;
        this.pendingDialogType = null;
        // Delegate dialog completion handling to helpers
        await this.processDialogCompletion(dialog, dialogType);
      }
      return true;
    }

    // Handle detail view
    if (this.state.showDetail) {
      return this.handleDetailKey(key);
    }

    // Handle help
    if (this.state.showHelp) {
      return this.handleHelpKey(key);
    }

    // Main key handling
    return this.handleMainKey(key);
  }

  private handleDetailKey(key: string): boolean {
    if (key === KEYS.ESCAPE || key === KEYS.Q) {
      this.state.showDetail = false;
    }
    return true;
  }

  private handleHelpKey(key: string): boolean {
    if (key === KEYS.QUESTION || key === KEYS.ESCAPE || key === KEYS.Q) {
      this.state.showHelp = false;
    }
    return true;
  }

  private async handleMainKey(key: string): Promise<boolean> {
    return await MainKeyHandler.handle(
      key,
      {
        selectedRequestId: this.state.selectedRequestId,
        requestTree: this.state.requestTree,
      },
      {
        navigateTree: this.navigateTree.bind(this),
        collapseSelectedNode: this.collapseSelectedNode.bind(this),
        expandSelectedNode: this.expandSelectedNode.bind(this),
        toggleSelectedNode: this.toggleSelectedNode.bind(this),
        toggleGrouping: this.toggleGrouping.bind(this),
        refresh: this.refresh.bind(this),
        showRequestDetail: this.showRequestDetail.bind(this),
        showCreateDialog: this.showCreateDialog.bind(this),
        showCancelConfirm: this.showCancelConfirm.bind(this),
        showPriorityDialog: this.showPriorityDialog.bind(this),
        showSearchDialog: this.showSearchDialog.bind(this),
        showFilterStatusDialog: this.showFilterStatusDialog.bind(this),
        showFilterAgentDialog: this.showFilterAgentDialog.bind(this),
        setShowHelp: (show: boolean) => this.state.showHelp = show,
        updateTree: (tree: TreeNode[]) => this.state.requestTree = tree,
      },
    );
  }

  // ===== Lifecycle =====

  override refresh(): Promise<void> {
    if (this.refreshConfig) {
      return super.refresh();
    }
    // If no refresh config, rebuild tree from current data
    this.buildTree();
    return Promise.resolve();
  }

  setRequests(requests: Request[]): void {
    this.requests = requests;
    this.buildTree();
  }

  getFocusableElements(): string[] {
    return ["request-list", "action-buttons"];
  }
}

// --- Legacy TUI Session (backwards compatibility) ---
/**
 * Legacy TUI session for Request Manager. Encapsulates state and user interaction logic.
 * @deprecated Use RequestManagerTuiSession instead
 */
export class LegacyRequestManagerTuiSession {
  private selectedIndex = 0;
  private statusMessage = "";

  /**
   * @param requests Initial list of requests
   * @param service Service for request operations
   */
  constructor(private readonly requests: Request[], private readonly service: RequestService) {}

  /** Get the currently selected request index. */
  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  /** Set the selected request index, clamped to valid range. */
  setSelectedIndex(idx: number): void {
    if (idx < 0 || idx >= this.requests.length) {
      this.selectedIndex = 0;
    } else {
      this.selectedIndex = idx;
    }
  }

  /** Handle a TUI key event. */
  async handleKey(key: string): Promise<void> {
    if (this.requests.length === 0) return;

    switch (key) {
      case "down":
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.requests.length - 1);
        break;
      case "up":
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        break;
      case "end":
        this.selectedIndex = this.requests.length - 1;
        break;
      case "home":
        this.selectedIndex = 0;
        break;
      case "c":
        await this.#triggerAction("create");
        break;
      case "v":
        await this.#triggerAction("view");
        break;
      case "d":
        await this.#triggerAction("delete");
        break;
    }

    if (this.selectedIndex >= this.requests.length) {
      this.selectedIndex = Math.max(0, this.requests.length - 1);
    }
  }

  /**
   * Trigger a request action and update status.
   * @param action Action to perform
   */
  async #triggerAction(action: "create" | "view" | "delete") {
    try {
      switch (action) {
        case "create": {
          const newRequest = await this.service.createRequest("New request from TUI", {
            priority: RequestPriority.NORMAL,
          });
          this.statusMessage = `Created request: ${newRequest.trace_id.slice(0, 8)}`;
          break;
        }
        case "view": {
          const request = this.requests[this.selectedIndex];
          if (request) {
            const _content = await this.service.getRequestContent(request.trace_id);
            this.statusMessage = `Viewing: ${request.trace_id.slice(0, 8)}`;
            // In a real implementation, this would open a detail view
          }
          break;
        }
        case "delete": {
          const delRequest = this.requests[this.selectedIndex];
          if (delRequest) {
            await this.service.updateRequestStatus(delRequest.trace_id, RequestStatus.CANCELLED);
            this.statusMessage = `Cancelled request: ${delRequest.trace_id.slice(0, 8)}`;
          }
          break;
        }
      }
    } catch (e) {
      if (e && typeof e === "object" && "message" in e) {
        this.statusMessage = `Error: ${(e as Error).message}`;
      } else {
        this.statusMessage = `Error: ${String(e)}`;
      }
    }
  }

  /** Get the current status message. */
  getStatusMessage(): string {
    return this.statusMessage;
  }

  /** Get the currently selected request. */
  getSelectedRequest(): Request | null {
    return this.requests[this.selectedIndex] || null;
  }
}

/**
 * View/controller for Request Manager. Delegates to injected RequestService.
 */
export class RequestManagerView implements RequestService {
  constructor(public readonly service: RequestService) {}

  /** Create a new TUI session for the given requests. */
  createTuiSession(requests: Request[]): RequestManagerTuiSession {
    return new RequestManagerTuiSession(requests, this.service);
  }

  listRequests(status?: RequestStatusType): Promise<Request[]> {
    return this.service.listRequests(status);
  }

  getRequestContent(requestId: string): Promise<string> {
    return this.service.getRequestContent(requestId);
  }

  createRequest(description: string, options?: RequestOptions): Promise<Request> {
    return this.service.createRequest(description, options);
  }

  updateRequestStatus(requestId: string, status: RequestStatusType): Promise<boolean> {
    return this.service.updateRequestStatus(requestId, status);
  }

  /** Render a list of requests for display. */
  renderRequestList(requests: Request[]): string {
    if (requests.length === 0) {
      return "No requests found.";
    }

    const lines = ["Requests:", ""];
    for (const request of requests) {
      const priorityIcon = request.priority === "critical"
        ? "🔴"
        : request.priority === "high"
        ? "🟠"
        : request.priority === "low"
        ? "🔵"
        : "⚪";
      const statusIcon = request.status === RequestStatus.PENDING
        ? "⏳"
        : request.status === RequestStatus.PLANNED
        ? "📋"
        : request.status === RequestStatus.COMPLETED
        ? "✅"
        : request.status === RequestStatus.CANCELLED
        ? "❌"
        : "❓";

      lines.push(
        `${statusIcon} ${priorityIcon} ${request.title} - ${request.agent} - ${
          new Date(request.created).toLocaleString()
        }`,
      );
    }
    return lines.join("\n");
  }

  /** Render request content for display. */
  renderRequestContent(content: string): string {
    return content;
  }
}
