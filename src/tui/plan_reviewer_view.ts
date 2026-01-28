/**
 * Plan Reviewer TUI View
 *
 * Phase 13.4: Enhanced with modern TUI patterns
 * - Tree view by plan status
 * - Diff viewer with markdown rendering
 * - Confirm dialogs for approve/reject
 * - Search/filter functionality
 * - Help screen
 * - Bulk operations
 * - Color theming
 *
 * Phase 33.1: Refactored to use BaseTreeView
 * - Removed duplicated navigation code (~50 lines)
 * - Removed duplicated key handling patterns (~80 lines)
 * - Removed duplicated state management (~20 lines)
 * - Total reduction: ~150 lines
 */

// --- Adapter: PlanCommands as PlanService ---
import type { PlanCommands } from "../cli/plan_commands.ts";
import { BaseTreeView } from "./base/base_tree_view.ts";
import { PlanStatus } from "../enums.ts";
import { ConfirmDialog, type DialogBase, InputDialog } from "./utils/dialog_base.ts";
import { type HelpSection, renderHelpScreen } from "./utils/help_renderer.ts";
import type { KeyBinding } from "./utils/keyboard.ts";
import { createGroupNode, createNode, flattenTree, type TreeNode, type TreeRenderOptions } from "./utils/tree_view.ts";

// ===== Plan Types =====

export type Plan = {
  id: string;
  title: string;
  author?: string;
  status?: string;
  created_at?: string;
};

export type PlanStatusType = PlanStatus | "unknown";

// ===== Plan View State Extensions =====

/**
 * Plan-specific state extensions beyond BaseTreeView
 * BaseTreeView provides: selectedId, tree, filterText, isLoading, loadingMessage,
 * showHelp, activeDialog, useColors, spinnerFrame, lastRefresh, scrollOffset
 */
export interface PlanViewExtensions {
  /** Show diff view */
  showDiff: boolean;
  /** Current diff content */
  diffContent: string;
}

// ===== Plan Status Icons =====

const PLAN_ICONS: Record<string, string> = {
  [PlanStatus.REVIEW]: "🔶",
  [PlanStatus.APPROVED]: "✅",
  [PlanStatus.REJECTED]: "❌",
  [PlanStatus.ACTIVE]: "⚙️",
  [PlanStatus.COMPLETED]: "🏁",
  [PlanStatus.FAILED]: "💥",
  [PlanStatus.ERROR]: "⚠️",
  [PlanStatus.NEEDS_REVISION]: "✍️",
  [PlanStatus.PENDING]: "⏳",
  unknown: "❓",
  folder: "📁",
} as const;

// ===== Key Bindings =====

const PLAN_KEY_BINDINGS: KeyBinding<string>[] = [
  { key: "up", action: "navigate-up", description: "Move up", category: "Navigation" },
  { key: "down", action: "navigate-down", description: "Move down", category: "Navigation" },
  { key: "home", action: "navigate-home", description: "Go to first", category: "Navigation" },
  { key: "end", action: "navigate-end", description: "Go to last", category: "Navigation" },
  { key: "enter", action: "view-diff", description: "View diff", category: "Actions" },
  { key: "a", action: "approve", description: "Approve plan", category: "Actions" },
  { key: "r", action: "reject", description: "Reject plan", category: "Actions" },
  { key: "A", action: "approve-all", description: "Approve all pending", category: "Actions" },
  { key: "left", action: "collapse", description: "Collapse node", category: "Navigation" },
  { key: "right", action: "expand", description: "Expand node", category: "Navigation" },
  { key: "s", action: "search", description: "Search/filter", category: "Actions" },
  { key: "escape", action: "cancel", description: "Close/Cancel", category: "Actions" },
  { key: "R", action: "refresh-view", description: "Refresh view", category: "View" },
  { key: "?", action: "help", description: "Toggle help", category: "View" },
  { key: "e", action: "expand-all", description: "Expand all", category: "View" },
  { key: "c", action: "collapse-all", description: "Collapse all", category: "View" },
];

// ===== Service Interface =====

export interface PlanService {
  listPending(): Promise<Plan[]>;
  getDiff(planId: string): Promise<string>;
  approve(planId: string, reviewer: string): Promise<boolean>;
  reject(planId: string, reviewer: string, reason?: string): Promise<boolean>;
}

// ===== Service Adapters =====

/**
 * Adapter: PlanCommands as PlanService
 */
export class PlanCommandsServiceAdapter implements PlanService {
  constructor(private readonly cmd: PlanCommands) {}
  async listPending() {
    const rows = await this.cmd.list(PlanStatus.REVIEW);
    return rows.map((r: any) => ({
      id: r.id,
      title: (r as any).title ?? r.id,
      author: r.agent_id ?? r.reviewed_by,
      status: r.status,
    }));
  }
  async getDiff(planId: string) {
    const details = await this.cmd.show(planId);
    return details.content ?? "";
  }
  async approve(planId: string, _reviewer: string) {
    await this.cmd.approve(planId);
    return true;
  }
  async reject(planId: string, _reviewer: string, reason?: string) {
    if (!reason) throw new Error("Rejection reason is required");
    await this.cmd.reject(planId, reason);
    return true;
  }
}

/**
 * Adapter: DB-like mock as PlanService
 */
export class DbLikePlanServiceAdapter implements PlanService {
  constructor(private readonly dbLike: any) {}
  listPending() {
    return this.dbLike.getPendingPlans();
  }
  getDiff(planId: string) {
    return this.dbLike.getPlanDiff(planId);
  }
  async approve(planId: string, reviewer: string) {
    await this.dbLike.updatePlanStatus(planId, "approved");
    await this.dbLike.logActivity({
      action_type: "plan.approve",
      plan_id: planId,
      reviewer,
      timestamp: new Date().toISOString(),
    });
    return true;
  }
  async reject(planId: string, reviewer: string, reason?: string) {
    await this.dbLike.updatePlanStatus(planId, "rejected");
    await this.dbLike.logActivity({
      action_type: "plan.reject",
      plan_id: planId,
      reason: reason ?? null,
      reviewer,
      timestamp: new Date().toISOString(),
    });
    return true;
  }
}

/**
 * Minimal PlanService mock for TUI session tests.
 */
export class MinimalPlanServiceMock implements PlanService {
  listPending: () => Promise<Plan[]> = () => Promise.resolve([]);
  getDiff = (_: string) => Promise.resolve("");
  approve = (_: string, _r: string) => Promise.resolve(true);
  reject = (_: string, _r: string, _reason?: string) => Promise.resolve(true);
}

// ===== TUI Session =====

export class PlanReviewerTuiSession extends BaseTreeView<Plan> {
  private plans: Plan[];
  private readonly service: PlanService;
  private planExtensions: PlanViewExtensions;
  private pendingRejectId: string | null = null;

  constructor(plans: Plan[], service: PlanService, useColors = true) {
    super(useColors);
    this.plans = plans;
    this.service = service;
    this.planExtensions = {
      showDiff: false,
      diffContent: "",
    };
    this.buildTree(plans);
  }

  // ===== Tree Building =====

  protected buildTree(plans: Plan[]): void {
    const pending: TreeNode<Plan>[] = [];
    const approved: TreeNode<Plan>[] = [];
    const rejected: TreeNode<Plan>[] = [];
    const unknown: TreeNode<Plan>[] = [];

    for (const plan of plans) {
      const status = (plan.status || "unknown") as PlanStatusType;
      const node = createNode<Plan>(
        plan.id,
        plan.title || plan.id,
        "plan",
        {
          data: plan,
          icon: PLAN_ICONS[status] || PLAN_ICONS.unknown,
          badge: status,
        },
      );

      switch (status) {
        case PlanStatus.REVIEW:
          pending.push(node);
          break;
        case PlanStatus.APPROVED:
          approved.push(node);
          break;
        case PlanStatus.REJECTED:
          rejected.push(node);
          break;
        default:
          unknown.push(node);
      }
    }

    this.state.tree = [];

    if (pending.length > 0) {
      this.state.tree.push(
        createGroupNode("pending-group", `Pending (${pending.length})`, "group", pending, {
          icon: PLAN_ICONS[PlanStatus.REVIEW],
          badge: pending.length,
        }),
      );
    }

    if (approved.length > 0) {
      this.state.tree.push(
        createGroupNode("approved-group", `Approved (${approved.length})`, "group", approved, {
          icon: PLAN_ICONS[PlanStatus.APPROVED],
          badge: approved.length,
        }),
      );
    }

    if (rejected.length > 0) {
      this.state.tree.push(
        createGroupNode("rejected-group", `Rejected (${rejected.length})`, "group", rejected, {
          icon: PLAN_ICONS[PlanStatus.REJECTED],
          badge: rejected.length,
        }),
      );
    }

    if (unknown.length > 0) {
      this.state.tree.push(
        createGroupNode("unknown-group", `Unknown (${unknown.length})`, "group", unknown, {
          icon: PLAN_ICONS.unknown,
          badge: unknown.length,
        }),
      );
    }

    // Select first plan if none selected
    if (!this.state.selectedId && plans.length > 0) {
      const flat = flattenTree(this.state.tree);
      const firstPlan = flat.find((f) => f.node.type === "plan");
      if (firstPlan) {
        this.state.selectedId = firstPlan.node.id;
      }
    }
    this.syncSelectedIndex();
  }

  // ===== Selection & Sync =====

  override setSelectedIndex(idx: number, maxLength?: number): void {
    const len = maxLength ?? this.plans.length;
    super.setSelectedIndex(idx, len);

    // Sync tree selection with plan index
    if (this.plans[this.selectedIndex]) {
      this.state.selectedId = this.plans[this.selectedIndex].id;
    }
  }

  /**
   * Sync selectedIndex based on current selectedId in the plans list
   */
  private syncSelectedIndex(): void {
    if (!this.state.selectedId) {
      this.selectedIndex = 0;
      return;
    }

    const idx = this.plans.findIndex((p) => p.id === this.state.selectedId);
    if (idx !== -1) {
      this.selectedIndex = idx;
    }
  }

  // ===== Dialog Result Handling =====

  protected override onDialogClosed(dialog: DialogBase): void {
    const result = dialog.getResult();
    if (result.type === "cancelled") return;

    if (dialog instanceof ConfirmDialog && result.value === true) {
      if (this.pendingRejectId) {
        this.executeReject(this.pendingRejectId, "Rejected via TUI");
        this.pendingRejectId = null;
      } else {
        this.executeApprove();
      }
    } else if (dialog instanceof InputDialog) {
      if (this.pendingRejectId) {
        this.executeReject(this.pendingRejectId, (result.value as string) || "Rejected via TUI");
        this.pendingRejectId = null;
      } else {
        // Handle search
        this.state.filterText = (result.value as string).toLowerCase();
        this.buildTree(this.plans);
      }
    }
  }

  private showSearchDialog(): void {
    this.showInputDialog({
      title: "Search Plans",
      label: "Search",
      placeholder: "Enter search text...",
      defaultValue: this.state.filterText,
    });
  }

  // ===== Key Handling =====

  override async handleKey(key: string): Promise<boolean> {
    // 1. Handle dialogs (delegated to base)
    if (this.handleDialogKeys(key)) return true;

    // 2. Handle help screen (delegated to base)
    if (this.handleHelpKeys(key)) return true;

    // 3. Handle diff view
    if (this.planExtensions.showDiff) {
      if (key === "escape" || key === "q" || key === "enter") {
        this.planExtensions.showDiff = false;
        this.planExtensions.diffContent = "";
      }
      return true;
    }

    // 4. Handle search mode reset
    if (this.state.filterText !== "" && key === "escape") {
      this.state.filterText = "";
      this.buildTree(this.plans);
      return true;
    }

    // 5. Handle navigation (delegated to base)
    if (this.handleNavigationKeys(key)) {
      this.syncSelectedIndex();
      return true;
    }

    // 6. Handle action keys
    switch (key) {
      case "enter": {
        const selected = this.getSelectedNode();
        if (selected && selected.type === "group") {
          this.toggleCurrentNode();
        } else if (selected && selected.type === "plan") {
          await this.showDiffAction(selected.data as Plan);
        }
        return true;
      }
      case "a":
        this.showApproveConfirmDialog();
        return true;
      case "r":
        this.showRejectDialog();
        return true;
      case "A":
        await this.approveAllPending();
        return true;
      case "R":
        await this.refreshView();
        return true;
      case "/":
        this.showSearchDialog();
        return true;
      default:
        return false;
    }
  }

  // ===== Actions =====

  private async showDiffAction(plan: Plan): Promise<void> {
    this.setLoading(true, `Loading diff for ${plan.id}...`);

    try {
      const diff = await this.service.getDiff(plan.id);
      this.planExtensions.diffContent = diff;
      this.planExtensions.showDiff = true;
      this.statusMessage = "";
    } catch (e) {
      this.statusMessage = e instanceof Error ? `Error: ${e.message}` : `Error: ${String(e)}`;
    } finally {
      this.setLoading(false);
    }
  }

  private showApproveConfirmDialog(): void {
    const selected = this.getSelectedNode();
    if (!selected || selected.type !== "plan") return;
    const plan = selected.data as Plan;

    this.showConfirmDialog({
      title: "Approve Plan",
      message: `Approve plan "${plan.title}"?\nThis action will move the plan to active status.`,
      confirmText: "Approve",
      cancelText: "Cancel",
    });
  }

  private async executeApprove(): Promise<void> {
    const selected = this.getSelectedNode();
    if (!selected || selected.type !== "plan") return;
    const planId = selected.id;

    this.setLoading(true, `Approving ${planId}...`);

    try {
      await this.service.approve(planId, "reviewer");
      this.statusMessage = `Approved ${planId}`;
      await this.refreshView();
    } catch (e) {
      this.statusMessage = e instanceof Error ? `Error: ${e.message}` : `Error: ${String(e)}`;
    } finally {
      this.setLoading(false);
    }
  }

  private showRejectDialog(): void {
    const selected = this.getSelectedNode();
    if (!selected || selected.type !== "plan") return;
    const plan = selected.data as Plan;

    this.pendingRejectId = plan.id;
    this.showConfirmDialog({
      title: "Reject Plan",
      message: `Reject plan "${plan.title}"?\nThis action will move the plan to rejected status.`,
      confirmText: "Reject",
      cancelText: "Cancel",
      destructive: true,
    });
  }

  private async executeReject(planId: string, reason: string): Promise<void> {
    this.setLoading(true, `Rejecting ${planId}...`);

    try {
      await this.service.reject(planId, "reviewer", reason);
      this.statusMessage = `Rejected ${planId}`;
      await this.refreshView();
    } catch (e) {
      this.statusMessage = e instanceof Error ? `Error: ${e.message}` : `Error: ${String(e)}`;
    } finally {
      this.setLoading(false);
    }
  }

  private async approveAllPending(): Promise<void> {
    const pendingGroup = this.state.tree.find((n) => n.id === "pending-group");
    if (!pendingGroup || pendingGroup.children.length === 0) {
      this.statusMessage = "No pending plans to approve";
      return;
    }

    this.setLoading(true, "Approving all pending plans...");
    let approved = 0;

    try {
      for (const node of pendingGroup.children) {
        if (node.data) {
          await this.service.approve(node.id, "reviewer");
          approved++;
        }
      }
      this.statusMessage = `Approved ${approved} plans`;
      await this.refreshView();
    } catch (e) {
      this.statusMessage = e instanceof Error ? `Error: ${e.message}` : `Error: ${String(e)}`;
    } finally {
      this.setLoading(false);
    }
  }

  private async refreshView(): Promise<void> {
    this.setLoading(true, "Refreshing plans...");

    try {
      const newPlans = await this.service.listPending();
      this.updatePlans(newPlans);
      this.state.lastRefresh = Date.now();
      this.statusMessage = "Refreshed";
    } catch (e) {
      this.statusMessage = e instanceof Error ? `Error: ${e.message}` : `Error: ${String(e)}`;
    } finally {
      this.setLoading(false);
    }
  }

  // ===== State Accessors =====

  getSelectedPlan(): TreeNode<Plan> | null {
    const flat = flattenTree(this.state.tree);
    return flat.find((f) => f.node.id === this.state.selectedId)?.node || null;
  }

  updatePlans(newPlans: Plan[]): void {
    this.plans = newPlans;
    this.buildTree(newPlans);
  }

  getSelectedPlanDetails(): Plan | undefined {
    const selected = this.getSelectedNode();
    return selected?.data as Plan | undefined;
  }

  getPlanTree(): TreeNode<Plan>[] {
    return this.state.tree;
  }

  isDiffVisible(): boolean {
    return this.planExtensions.showDiff;
  }

  getDiffContent(): string {
    return this.planExtensions.diffContent;
  }

  // ===== Rendering =====

  renderActionButtons(): string {
    if (!this.plans.length) return "";
    return `[Enter] View diff   [a] Approve   [r] Reject   [A] Approve all   [?] Help`;
  }

  renderPlanTree(options: Partial<TreeRenderOptions> = {}): string[] {
    return this.renderTreeView({
      selectedId: this.state.selectedId || undefined,
      ...options,
    });
  }

  renderHelp(): string[] {
    const sections: HelpSection[] = [
      {
        title: "Navigation",
        items: [
          { key: "↑/↓", description: "Move selection" },
          { key: "Home/End", description: "Jump to first/last" },
          { key: "←/→", description: "Collapse/Expand" },
          { key: "e/c", description: "Expand/Collapse all" },
        ],
      },
      {
        title: "Actions",
        items: [
          { key: "Enter", description: "View diff" },
          { key: "a", description: "Approve plan" },
          { key: "r", description: "Reject plan" },
          { key: "A", description: "Approve all pending" },
          { key: "R", description: "Refresh view" },
        ],
      },
      {
        title: "View",
        items: [
          { key: "s", description: "Search plans" },
          { key: "?", description: "Toggle help" },
          { key: "Esc", description: "Close/Cancel" },
        ],
      },
    ];

    return renderHelpScreen({
      title: "Plan Reviewer Help",
      sections,
      useColors: this.state.useColors,
      width: 50,
    });
  }

  renderDiff(): string[] {
    if (!this.planExtensions.showDiff) return [];

    const lines: string[] = [];
    lines.push("═".repeat(60));
    lines.push(" DIFF VIEWER (Press ESC or Enter to close)");
    lines.push("═".repeat(60));
    lines.push("");

    // Render diff with simple syntax highlighting
    for (const line of this.planExtensions.diffContent.split("\n")) {
      if (line.startsWith("+")) {
        lines.push(`  + ${line.slice(1)}`);
      } else if (line.startsWith("-")) {
        lines.push(`  - ${line.slice(1)}`);
      } else if (line.startsWith("@@")) {
        lines.push(`  ${line}`);
      } else {
        lines.push(`    ${line}`);
      }
    }

    lines.push("");
    lines.push("═".repeat(60));
    return lines;
  }

  getFocusableElements(): string[] {
    return ["plan-list", "action-buttons", "status-bar"];
  }

  override getStatusMessage(): string {
    return this.statusMessage;
  }

  override getKeyBindings(): KeyBinding<string>[] {
    return PLAN_KEY_BINDINGS as KeyBinding<string>[];
  }

  override getViewName(): string {
    return "Plan Reviewer";
  }
}

// ===== View Controller =====

export class PlanReviewerView implements PlanService {
  constructor(public readonly service: PlanService) {}

  createTuiSession(plans: Plan[], useColors = true): PlanReviewerTuiSession {
    return new PlanReviewerTuiSession(plans, this.service, useColors);
  }

  listPending(): Promise<Plan[]> {
    return this.service.listPending();
  }

  getDiff(planId: string): Promise<string> {
    return this.service.getDiff(planId);
  }

  approve(planId: string, reviewer: string): Promise<boolean> {
    return this.service.approve(planId, reviewer);
  }

  reject(planId: string, reviewer: string, reason?: string): Promise<boolean> {
    return this.service.reject(planId, reviewer, reason);
  }

  renderPlanList(plans: Plan[]): string {
    return plans.map((p) => `${p.id} ${p.title} [${p.status ?? "unknown"}]`).join("\n");
  }

  renderDiff(diff: string): string {
    return diff;
  }
}
