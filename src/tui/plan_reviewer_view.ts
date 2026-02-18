/**
 * @module PlanReviewerView
 * @path src/tui/plan_reviewer_view.ts
 * @description Interactive TUI view for reviewing and approving/rejecting execution plans, featuring side-by-side diff visualization.
 * @architectural-layer TUI
 * @dependencies [BaseTreeView, tree_view, dialog_base, help_renderer, keyboard, enums, constants]
 * @related-files [src/services/plan_service.ts, src/tui/tui_dashboard.ts]
 */

// --- Adapter: PlanCommands as PlanService ---
import type { PlanCommands } from "../cli/commands/plan_commands.ts";
import { BaseTreeView } from "./base/base_tree_view.ts";
import { coercePlanStatus, PlanStatus, type PlanStatusType } from "../plans/plan_status.ts";
import { ConfirmDialog, type DialogBase, InputDialog } from "../helpers/dialog_base.ts";
import { type HelpSection, renderHelpScreen } from "../helpers/help_renderer.ts";
import { DialogStatus } from "../enums.ts";
import { type KeyBinding, KeyBindingCategory, KEYS } from "../helpers/keyboard.ts";
import { KeyBindingsBase } from "./base/key_bindings_base.ts";
import {
  createGroupNode,
  createNode,
  flattenTree,
  type TreeNode,
  type TreeRenderOptions,
} from "../helpers/tree_view.ts";

// ===== Plan Types =====

export type Plan = {
  id: string;
  title: string;
  author?: string;
  status?: PlanStatusType;
  created_at?: string;
};

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

const PLAN_ICONS: Record<PlanStatusType | "folder", string> = {
  [PlanStatus.REVIEW]: "🔶",
  [PlanStatus.APPROVED]: "✅",
  [PlanStatus.REJECTED]: "❌",
  [PlanStatus.ACTIVE]: "⚙️",
  [PlanStatus.COMPLETED]: "🏁",
  [PlanStatus.FAILED]: "💥",
  [PlanStatus.ERROR]: "⚠️",
  [PlanStatus.NEEDS_REVISION]: "✍️",
  [PlanStatus.PENDING]: "⏳",
  folder: "📁",
} as const;

// ===== Plan Action Types =====
export enum PlanAction {
  NAVIGATE_UP = "navigate-up",
  NAVIGATE_DOWN = "navigate-down",
  NAVIGATE_HOME = "navigate-home",
  NAVIGATE_END = "navigate-end",
  VIEW_DIFF = "view-diff",
  APPROVE = "approve",
  REJECT = "reject",
  APPROVE_ALL = "approve-all",
  COLLAPSE = "collapse",
  EXPAND = "expand",
  SEARCH = "search",
  CANCEL = "cancel",
  REFRESH_VIEW = "refresh-view",
  HELP = "help",
  EXPAND_ALL = "expand-all",
  COLLAPSE_ALL = "collapse-all",
}

export enum PlanActionCategory {
  NAVIGATION = "Navigation",
  ACTIONS = "Actions",
  VIEW = "View",
}

// ===== Key Bindings =====

export class PlanKeyBindings extends KeyBindingsBase<PlanAction, KeyBindingCategory> {
  readonly KEY_BINDINGS: readonly KeyBinding<PlanAction, KeyBindingCategory>[] = [
    {
      key: KEYS.UP,
      action: PlanAction.NAVIGATE_UP,
      description: "Move up",
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.DOWN,
      action: PlanAction.NAVIGATE_DOWN,
      description: "Move down",
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.HOME,
      action: PlanAction.NAVIGATE_HOME,
      description: "Go to first",
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.END,
      action: PlanAction.NAVIGATE_END,
      description: "Go to last",
      category: KeyBindingCategory.NAVIGATION,
    },
    { key: KEYS.ENTER, action: PlanAction.VIEW_DIFF, description: "View diff", category: KeyBindingCategory.ACTIONS },
    { key: KEYS.A, action: PlanAction.APPROVE, description: "Approve plan", category: KeyBindingCategory.ACTIONS },
    { key: KEYS.R, action: PlanAction.REJECT, description: "Reject plan", category: KeyBindingCategory.ACTIONS },
    {
      key: KEYS.CAP_A,
      action: PlanAction.APPROVE_ALL,
      description: "Approve all pending",
      category: KeyBindingCategory.ACTIONS,
    },
    {
      key: KEYS.LEFT,
      action: PlanAction.COLLAPSE,
      description: "Collapse node",
      category: KeyBindingCategory.NAVIGATION,
    },
    { key: KEYS.RIGHT, action: PlanAction.EXPAND, description: "Expand node", category: KeyBindingCategory.NAVIGATION },
    { key: KEYS.S, action: PlanAction.SEARCH, description: "Search/filter", category: KeyBindingCategory.ACTIONS },
    { key: KEYS.ESCAPE, action: PlanAction.CANCEL, description: "Close/Cancel", category: KeyBindingCategory.ACTIONS },
    {
      key: KEYS.CAP_R,
      action: PlanAction.REFRESH_VIEW,
      description: "Refresh view",
      category: KeyBindingCategory.VIEW,
    },
    { key: KEYS.QUESTION, action: PlanAction.HELP, description: "Toggle help", category: KeyBindingCategory.VIEW },
    { key: KEYS.E, action: PlanAction.EXPAND_ALL, description: "Expand all", category: KeyBindingCategory.VIEW },
    { key: KEYS.C, action: PlanAction.COLLAPSE_ALL, description: "Collapse all", category: KeyBindingCategory.VIEW },
  ];
}

export const PLAN_KEY_BINDINGS = new PlanKeyBindings().KEY_BINDINGS;

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
    await this.dbLike.updatePlanStatus(planId, PlanStatus.APPROVED);
    await this.dbLike.logActivity({
      action_type: "plan.approve",
      plan_id: planId,
      reviewer,
      timestamp: new Date().toISOString(),
    });
    return true;
  }
  async reject(planId: string, reviewer: string, reason?: string) {
    await this.dbLike.updatePlanStatus(planId, PlanStatus.REJECTED);
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
      const status = coercePlanStatus(plan.status, PlanStatus.REVIEW);
      const node = createNode<Plan>(
        plan.id,
        plan.title || plan.id,
        "plan",
        {
          data: plan,
          icon: PLAN_ICONS[status],
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
          expanded: true,
        }),
      );
    }

    if (approved.length > 0) {
      this.state.tree.push(
        createGroupNode("approved-group", `Approved (${approved.length})`, "group", approved, {
          icon: PLAN_ICONS[PlanStatus.APPROVED],
          badge: approved.length,
          expanded: true,
        }),
      );
    }

    if (rejected.length > 0) {
      this.state.tree.push(
        createGroupNode("rejected-group", `Rejected (${rejected.length})`, "group", rejected, {
          icon: PLAN_ICONS[PlanStatus.REJECTED],
          badge: rejected.length,
          expanded: true,
        }),
      );
    }

    if (unknown.length > 0) {
      this.state.tree.push(
        createGroupNode("unknown-group", `Unknown (${unknown.length})`, "group", unknown, {
          icon: "❓",
          badge: unknown.length,
          expanded: true,
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
    if (result.type === DialogStatus.CANCELLED) return;

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
    if (this.handleDiffViewKeys(key)) return true;
    if (this.handleBaseKeysAndSync(key)) return true;
    return await this.handleActionKeys(key);
  }

  private handleDiffViewKeys(key: string): boolean {
    if (!this.planExtensions.showDiff) return false;

    if (key === KEYS.ESCAPE || key === KEYS.Q || key === KEYS.ENTER) {
      this.planExtensions.showDiff = false;
      this.planExtensions.diffContent = "";
    }
    return true;
  }

  private handleBaseKeysAndSync(key: string): boolean {
    if (!this.handleKeySync(key)) return false;

    this.syncSelectedIndex();
    // If filter was cleared (handled by base), rebuild tree
    if (this.state.filterText === "" && key === KEYS.ESCAPE) {
      this.buildTree(this.plans);
    }
    return true;
  }

  private async handleActionKeys(key: string): Promise<boolean> {
    switch (key) {
      case KEYS.ENTER:
        await this.handleEnterKey();
        return true;
      case KEYS.A:
        this.showApproveConfirmDialog();
        return true;
      case KEYS.R:
        this.showRejectDialog();
        return true;
      case KEYS.CAP_A:
        await this.approveAllPending();
        return true;
      case KEYS.CAP_R:
        await this.refreshView();
        return true;
      case KEYS.SLASH:
        this.showSearchDialog();
        return true;
      default:
        return false;
    }
  }

  private async handleEnterKey(): Promise<void> {
    const selected = this.getSelectedNode();
    if (!selected) return;
    if (selected.type === "group") {
      this.toggleCurrentNode();
      return;
    }
    if (selected.type === "plan") {
      await this.showDiffAction(selected.data as Plan);
    }
  }

  // ===== Actions =====

  private async showDiffAction(plan: Plan): Promise<void> {
    const diff = await this.executeWithLoading(
      `Loading diff for ${plan.id}...`,
      () => this.service.getDiff(plan.id),
    );

    if (diff !== null) {
      this.planExtensions.diffContent = diff;
      this.planExtensions.showDiff = true;
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

    await this.executeWithLoading(
      `Approving ${planId}...`,
      async () => {
        await this.service.approve(planId, "reviewer");
        await this.refreshView();
      },
      () => `Approved ${planId}`,
    );
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
    await this.executeWithLoading(
      `Rejecting ${planId}...`,
      async () => {
        await this.service.reject(planId, "reviewer", reason);
        await this.refreshView();
      },
      () => `Rejected ${planId}`,
    );
  }

  private async approveAllPending(): Promise<void> {
    const pendingGroup = this.state.tree.find((n) => n.id === "pending-group");
    if (!pendingGroup || pendingGroup.children.length === 0) {
      this.statusMessage = "No pending plans to approve";
      return;
    }

    await this.executeWithLoading(
      "Approving all pending plans...",
      async () => {
        let approved = 0;
        for (const node of pendingGroup.children) {
          if (node.data) {
            await this.service.approve(node.id, "reviewer");
            approved++;
          }
        }
        await this.refreshView();
        return approved;
      },
      (count) => `Approved ${count} plans`,
    );
  }

  private async refreshView(): Promise<void> {
    await this.executeWithLoading(
      "Refreshing plans...",
      async () => {
        const newPlans = await this.service.listPending();
        this.updatePlans(newPlans);
        this.state.lastRefresh = Date.now();
      },
      () => "Refreshed",
    );
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

  override getKeyBindings(): KeyBinding<PlanAction>[] {
    return [...PLAN_KEY_BINDINGS];
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
