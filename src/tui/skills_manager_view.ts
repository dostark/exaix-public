/**
 * @module SkillsManagerView
 * @path src/tui/skills_manager_view.ts
 * @description Interactive TUI view for managing Skills (agent capabilities), supporting discovery, status filtering, and skill deletion.
 * @architectural-layer TUI
 * @dependencies [BaseTreeView, tree_view, dialog_base, help_renderer, keyboard, enums, constants]
 * @related-files [src/services/skill_service.ts, src/tui/tui_dashboard.ts]
 */

import { DialogStatus, MemorySource, SkillStatus } from "../enums.ts";
import { BaseTreeView } from "./base/base_tree_view.ts";
import { type DialogBase } from "../helpers/dialog_base.ts";
import { KeyBinding, KeyBindingCategory } from "../helpers/keyboard.ts";
import { KeyBindingsBase } from "./base/key_bindings_base.ts";
import { createGroupNode, createNode, getFirstNodeId, type TreeNode } from "../helpers/tree_view.ts";
import { type HelpSection, renderHelpScreen } from "../helpers/help_renderer.ts";
import {
  TUI_LAYOUT_DIALOG_WIDTH,
  TUI_LAYOUT_MEDIUM_WIDTH,
  TUI_LIMIT_MEDIUM,
  TUI_SKILL_ICON,
  TUI_SOURCE_ICONS,
  TUI_STATUS_ICONS,
} from "../helpers/constants.ts";
import { KEYS } from "../helpers/keyboard.ts";

// ===== Service Interface =====

/**
 * Skill data for TUI display
 */
export interface SkillSummary {
  id: string;
  name: string;
  version: string;
  status: SkillStatus;
  source: MemorySource | "core" | "project";
  description?: string;
  triggers?: {
    keywords?: string[];
    taskTypes?: string[];
    filePatterns?: string[];
  };
  instructions?: string;
}

/**
 * Service interface for skills operations
 */
export interface SkillsViewService {
  listSkills(filter?: { source?: string; status?: string }): Promise<SkillSummary[]>;
  getSkill(skillId: string): Promise<SkillSummary | null>;
  deleteSkill(skillId: string): Promise<boolean>;
}

// ===== View State =====

export interface SkillsViewExtensions {
  /** Whether detail view is shown */
  showDetail: boolean;
  /** Detail content for expanded skill */
  detailContent: string;
  /** Filter by memory source */
  filterSource: "all" | MemorySource | "core" | "project";
  /** Filter by skill status */
  filterStatus: "all" | SkillStatus;
  /** Current grouping mode */
  groupBy: "source" | "status" | "none";
}

// ===== Icons and Visual Constants =====

export const SOURCE_ICONS: Record<string, string> = {
  core: TUI_SOURCE_ICONS.core,
  project: TUI_SOURCE_ICONS.project,
  learned: TUI_SOURCE_ICONS.learned,
};

export const STATUS_ICONS: Record<string, string> = {
  active: TUI_STATUS_ICONS.active,
  draft: TUI_STATUS_ICONS.draft,
  deprecated: TUI_STATUS_ICONS.deprecated,
};

export const SKILL_ICON = TUI_SKILL_ICON;

// ===== Key Bindings =====

export enum SkillsAction {
  NAVIGATE_UP = "navigate-up",
  NAVIGATE_DOWN = "navigate-down",
  NAVIGATE_HOME = "navigate-home",
  NAVIGATE_END = "navigate-end",
  COLLAPSE = "collapse",
  EXPAND = "expand",
  VIEW_DETAIL = "view-detail",
  DELETE = "delete",
  SEARCH = "search",
  FILTER_SOURCE = "filter-source",
  FILTER_STATUS = "filter-status",
  TOGGLE_GROUPING = "toggle-grouping",
  REFRESH = "refresh",
  COLLAPSE_ALL = "collapse-all",
  EXPAND_ALL = "expand-all",
  HELP = "help",
  BACK = "back",
  CLOSE = "close",
}
export class SkillsKeyBindings extends KeyBindingsBase<SkillsAction, KeyBindingCategory> {
  readonly KEY_BINDINGS: readonly KeyBinding<SkillsAction, KeyBindingCategory>[] = [
    {
      key: KEYS.UP,
      description: "Navigate up",
      action: SkillsAction.NAVIGATE_UP,
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.DOWN,
      description: "Navigate down",
      action: SkillsAction.NAVIGATE_DOWN,
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.HOME,
      description: "Jump to first",
      action: SkillsAction.NAVIGATE_HOME,
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.END,
      description: "Jump to last",
      action: SkillsAction.NAVIGATE_END,
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.LEFT,
      description: "Collapse group",
      action: SkillsAction.COLLAPSE,
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.RIGHT,
      description: "Expand group",
      action: SkillsAction.EXPAND,
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEYS.ENTER,
      description: "View skill details",
      action: SkillsAction.VIEW_DETAIL,
      category: KeyBindingCategory.NAVIGATION,
    },
    { key: KEYS.D, description: "Delete skill", action: SkillsAction.DELETE, category: KeyBindingCategory.ACTIONS },
    {
      key: KEYS.SLASH,
      description: "Search skills",
      action: SkillsAction.SEARCH,
      category: KeyBindingCategory.ACTIONS,
    },
    {
      key: KEYS.F,
      description: "Filter by source",
      action: SkillsAction.FILTER_SOURCE,
      category: KeyBindingCategory.ACTIONS,
    },
    {
      key: KEYS.S,
      description: "Filter by status",
      action: SkillsAction.FILTER_STATUS,
      category: KeyBindingCategory.ACTIONS,
    },
    {
      key: KEYS.G,
      description: "Toggle grouping",
      action: SkillsAction.TOGGLE_GROUPING,
      category: KeyBindingCategory.VIEW,
    },
    { key: KEYS.R, description: "Force refresh", action: SkillsAction.REFRESH, category: KeyBindingCategory.VIEW },
    { key: KEYS.C, description: "Collapse all", action: SkillsAction.COLLAPSE_ALL, category: KeyBindingCategory.VIEW },
    { key: KEYS.E, description: "Expand all", action: SkillsAction.EXPAND_ALL, category: KeyBindingCategory.VIEW },
    { key: KEYS.QUESTION, description: "Show help", action: SkillsAction.HELP, category: KeyBindingCategory.HELP },
    { key: KEYS.Q, description: "Back", action: SkillsAction.BACK, category: KeyBindingCategory.HELP },
    { key: KEYS.ESCAPE, description: "Close", action: SkillsAction.CLOSE, category: KeyBindingCategory.HELP },
  ];
}

export const SKILLS_KEY_BINDINGS = new SkillsKeyBindings().KEY_BINDINGS;

// ===== Help Sections =====

const SKILLS_HELP_SECTIONS: HelpSection[] = [
  {
    title: "Navigation",
    items: [
      { key: "↑/↓ or j/k", description: "Move up/down" },
      { key: "Home/End", description: "Jump to first/last" },
      { key: "← / →", description: "Collapse/Expand group" },
      { key: "Enter", description: "View skill details" },
    ],
  },
  {
    title: "Actions",
    items: [
      { key: "d", description: "Delete selected skill" },
      { key: "/", description: "Search skills" },
      { key: "f", description: "Filter by source" },
      { key: "s", description: "Filter by status" },
      { key: "g", description: "Cycle grouping mode" },
      { key: "R", description: "Force refresh" },
    ],
  },
  {
    title: "View Controls",
    items: [
      { key: "c", description: "Collapse all groups" },
      { key: "E", description: "Expand all groups" },
      { key: "?", description: "Toggle this help" },
      { key: "q / Esc", description: "Close detail/help/dialog" },
    ],
  },
];

// ===== Skills Manager View Class =====

/**
 * View/controller for skills management
 */
export class SkillsManagerView {
  private selectedSkillId: string | null = null;
  private skills: SkillSummary[] = [];

  constructor(private readonly skillsService: SkillsViewService) {}

  async getSkillsList(filter?: { source?: string; status?: string }): Promise<SkillSummary[]> {
    this.skills = await this.skillsService.listSkills(filter);
    return this.skills;
  }

  getCachedSkills(): SkillSummary[] {
    return [...this.skills];
  }

  async getSkillDetail(skillId: string): Promise<SkillSummary | null> {
    return await this.skillsService.getSkill(skillId);
  }

  async deleteSkill(skillId: string): Promise<boolean> {
    return await this.skillsService.deleteSkill(skillId);
  }

  selectSkill(skillId: string): void {
    this.selectedSkillId = skillId;
  }

  getSelectedSkill(): string | null {
    return this.selectedSkillId;
  }

  createTuiSession(useColors = true): SkillsManagerTuiSession {
    return new SkillsManagerTuiSession(this, useColors);
  }
}

// ===== Minimal Mock for Tests =====

export class MinimalSkillsServiceMock implements SkillsViewService {
  private skills: SkillSummary[] = [];

  constructor(skills: SkillSummary[] = []) {
    this.skills = skills;
  }

  listSkills(filter?: { source?: string; status?: string }): Promise<SkillSummary[]> {
    let result = [...this.skills];
    if (filter?.source) {
      result = result.filter((s) => s.source === filter.source);
    }
    if (filter?.status) {
      result = result.filter((s) => s.status === filter.status);
    }
    return Promise.resolve(result);
  }

  getSkill(skillId: string): Promise<SkillSummary | null> {
    return Promise.resolve(this.skills.find((s) => s.id === skillId) || null);
  }

  deleteSkill(skillId: string): Promise<boolean> {
    const idx = this.skills.findIndex((s) => s.id === skillId);
    if (idx >= 0) {
      this.skills.splice(idx, 1);
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  setSkills(skills: SkillSummary[]): void {
    this.skills = skills;
  }
}

// ===== TUI Session Class =====

/**
 * Interactive TUI session for Skills Manager View
 */
export class SkillsManagerTuiSession extends BaseTreeView<SkillSummary> {
  private readonly skillsView: SkillsManagerView;
  private skillsViewExtensions: SkillsViewExtensions;
  private skills: SkillSummary[] = [];
  private pendingDeleteSkillId: string | null = null;
  private pendingDialogType: "search" | "filter-source" | "filter-status" | "delete" | null = null;

  constructor(skillsView: SkillsManagerView, useColors = true) {
    super(useColors);
    this.skillsView = skillsView;
    this.skillsViewExtensions = {
      showDetail: false,
      detailContent: "",
      filterSource: "all",
      filterStatus: "all",
      groupBy: "source",
    };
  }

  // ===== Initialization =====

  async initialize(): Promise<void> {
    this.setLoading(true, "Loading skills...");
    try {
      await this.loadSkills();
      this.buildTree();

      // Select first skill if available
      const firstId = getFirstNodeId(this.state.tree);
      if (firstId && !this.isGroupNode(firstId)) {
        this.state.selectedId = firstId;
      }
    } finally {
      this.setLoading(false);
    }
  }

  private async loadSkills(): Promise<void> {
    const filter: { source?: string; status?: string } = {};
    if (this.skillsViewExtensions.filterSource !== "all") {
      filter.source = this.skillsViewExtensions.filterSource as string;
    }
    if (this.skillsViewExtensions.filterStatus !== "all") {
      filter.status = this.skillsViewExtensions.filterStatus as string;
    }
    this.skills = await this.skillsView.getSkillsList(filter);
  }

  // ===== Tree Building =====

  protected override buildTree(): void {
    let filteredSkills = [...this.skills];

    // Apply search filter
    if (this.state.filterText) {
      const query = this.state.filterText.toLowerCase();
      filteredSkills = filteredSkills.filter(
        (s) =>
          s.id.toLowerCase().includes(query) ||
          s.name.toLowerCase().includes(query) ||
          s.triggers?.keywords?.some((k) => k.toLowerCase().includes(query)),
      );
    }

    // Build tree based on grouping
    if (this.skillsViewExtensions.groupBy === "none") {
      this.state.tree = filteredSkills.map((s) => this.createSkillNode(s));
    } else if (this.skillsViewExtensions.groupBy === "source") {
      this.state.tree = this.buildGroupedTree(filteredSkills, "source");
    } else {
      this.state.tree = this.buildGroupedTree(filteredSkills, "status");
    }
  }

  private buildGroupedTree(skills: SkillSummary[], groupBy: "source" | "status"): TreeNode<SkillSummary>[] {
    const groups = new Map<string, SkillSummary[]>();

    for (const skill of skills) {
      const key = groupBy === "source" ? skill.source : skill.status;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(skill);
    }

    const tree: TreeNode<SkillSummary>[] = [];
    const order = groupBy === "source"
      ? ["core", "project", "learned"]
      : [SkillStatus.ACTIVE, SkillStatus.DRAFT, SkillStatus.DEPRECATED];

    for (const key of order) {
      const groupSkills = groups.get(key);
      if (groupSkills && groupSkills.length > 0) {
        const icon = groupBy === "source" ? SOURCE_ICONS[key] : STATUS_ICONS[key];
        const label = `${icon} ${key.charAt(0).toUpperCase() + key.slice(1)} Skills (${groupSkills.length})`;
        tree.push(
          createGroupNode<SkillSummary>(
            `group-${key}`,
            label,
            "group",
            groupSkills.map((s) => this.createSkillNode(s)),
            { expanded: true },
          ),
        );
      }
    }

    return tree;
  }

  private createSkillNode(skill: SkillSummary): TreeNode<SkillSummary> {
    const statusIcon = STATUS_ICONS[skill.status] || "⚪";
    return createNode<SkillSummary>(`skill-${skill.id}`, `${SKILL_ICON} ${skill.name} ${statusIcon}`, "skill", {
      data: skill,
    });
  }

  private isGroupNode(nodeId: string): boolean {
    return nodeId.startsWith("group-");
  }

  private getSkillIdFromNodeId(nodeId: string): string | null {
    if (nodeId.startsWith("skill-")) {
      return nodeId.substring(6);
    }
    return null;
  }

  async showDetail(): Promise<void> {
    if (!this.state.selectedId || this.isGroupNode(this.state.selectedId)) {
      return;
    }

    const skillId = this.getSkillIdFromNodeId(this.state.selectedId);
    if (!skillId) return;

    this.setLoading(true, "Loading skill details...");
    try {
      const skill = await this.skillsView.getSkillDetail(skillId);
      if (skill) {
        this.skillsViewExtensions.detailContent = this.formatDetailContent(skill);
        this.skillsViewExtensions.showDetail = true;
      }
    } finally {
      this.setLoading(false);
    }
  }

  private formatDetailContent(skill: SkillSummary): string {
    const lines: string[] = [];
    lines.push(`Skill: ${skill.name}`);
    lines.push(`ID: ${skill.id}`);
    lines.push(`Version: ${skill.version}`);
    lines.push(`Status: ${STATUS_ICONS[skill.status]} ${skill.status.toUpperCase()}`);
    lines.push(`Source: ${SOURCE_ICONS[skill.source]} ${skill.source}`);

    if (skill.description) {
      lines.push("");
      lines.push("Description:");
      lines.push(`  ${skill.description}`);
    }

    if (skill.triggers) {
      lines.push("");
      lines.push("Triggers:");
      if (skill.triggers.keywords?.length) {
        lines.push(`  Keywords: ${skill.triggers.keywords.join(", ")}`);
      }
      if (skill.triggers.taskTypes?.length) {
        lines.push(`  Task Types: ${skill.triggers.taskTypes.join(", ")}`);
      }
      if (skill.triggers.filePatterns?.length) {
        lines.push(`  File Patterns: ${skill.triggers.filePatterns.join(", ")}`);
      }
    }

    if (skill.instructions) {
      lines.push("");
      lines.push("Instructions:");
      const instrLines = skill.instructions.split("\n").slice(0, TUI_LIMIT_MEDIUM);
      for (const line of instrLines) {
        lines.push(`  ${line}`);
      }
      if (skill.instructions.split("\n").length > TUI_LIMIT_MEDIUM) {
        lines.push("  ...(truncated)");
      }
    }

    return lines.join("\n");
  }

  hideDetail(): void {
    this.skillsViewExtensions.showDetail = false;
    this.skillsViewExtensions.detailContent = "";
  }

  // ===== Dialogs =====

  showSearchDialog(): void {
    this.showInputDialog({
      title: "Search Skills",
      label: "Enter search term:",
      placeholder: "name, ID, or keyword...",
      defaultValue: this.state.filterText,
    });
    this.pendingDialogType = "search";
  }

  showFilterSourceDialog(): void {
    this.showInputDialog({
      title: "Filter by Source",
      label: "Source (all, core, project, learned):",
      placeholder: "source...",
      defaultValue: this.skillsViewExtensions.filterSource,
    });
    this.pendingDialogType = "filter-source";
  }

  showFilterStatusDialog(): void {
    this.showInputDialog({
      title: "Filter by Status",
      label: "Status (all, active, draft, deprecated):",
      placeholder: "status...",
      defaultValue: this.skillsViewExtensions.filterStatus,
    });
    this.pendingDialogType = "filter-status";
  }

  showDeleteConfirm(): void {
    if (!this.state.selectedId || this.isGroupNode(this.state.selectedId)) {
      return;
    }

    const skillId = this.getSkillIdFromNodeId(this.state.selectedId);
    if (!skillId) return;

    const skill = this.skills.find((s) => s.id === skillId);
    if (!skill) return;

    // Don't allow deleting core skills
    if (skill.source === "core") {
      this.setStatus("Cannot delete core skills", "error");
      return;
    }

    this.showConfirmDialog({
      title: "Delete Skill",
      message: `Are you sure you want to delete skill "${skill.name}"?`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    this.pendingDeleteSkillId = skillId;
    this.pendingDialogType = "delete";
  }

  // ===== Dialog Handlers =====

  protected override onDialogClosed(dialog: DialogBase): void {
    const result = dialog.getResult();
    if (result.type !== DialogStatus.CONFIRMED) {
      this.pendingDialogType = null;
      this.pendingDeleteSkillId = null;
      return;
    }

    const value = result.value as string;
    switch (this.pendingDialogType) {
      case "search":
        this.handleSearchResult(value);
        break;
      case "filter-source":
        this.handleFilterSourceResult(value);
        break;
      case "filter-status":
        this.handleFilterStatusResult(value);
        break;
      case "delete":
        this.handleDeleteConfirm();
        break;
    }
    this.pendingDialogType = null;
  }

  // ===== Dialog Handlers =====

  private handleSearchResult(value: string): void {
    this.state.filterText = value;
    this.buildTree();
    this.setStatus(value ? `Search: "${value}"` : "Search cleared", "info");
  }

  private handleFilterSourceResult(value: string): void {
    const normalized = value.toLowerCase().trim();
    if (normalized === "all" || normalized === "core" || normalized === "project" || normalized === "learned") {
      this.skillsViewExtensions.filterSource = normalized as any;
      this.loadSkills().then(() => {
        this.buildTree();
        this.setStatus(`Filter: source=${normalized}`, "info");
      });
    } else {
      this.setStatus("Invalid source. Use: all, core, project, learned", "error");
    }
  }

  private handleFilterStatusResult(value: string): void {
    const normalized = value.toLowerCase().trim();
    if (
      normalized === "all" || normalized === SkillStatus.ACTIVE || normalized === SkillStatus.DRAFT ||
      normalized === SkillStatus.DEPRECATED
    ) {
      this.skillsViewExtensions.filterStatus = normalized as any;
      this.loadSkills().then(() => {
        this.buildTree();
        this.setStatus(`Filter: status=${normalized}`, "info");
      });
    } else {
      this.setStatus("Invalid status. Use: all, active, draft, deprecated", "error");
    }
  }

  private async handleDeleteConfirm(): Promise<void> {
    if (!this.pendingDeleteSkillId) return;

    try {
      this.setLoading(true, "Deleting skill...");
      const success = await this.skillsView.deleteSkill(this.pendingDeleteSkillId);
      if (success) {
        await this.loadSkills();
        this.buildTree();
        this.setStatus(`Deleted skill: ${this.pendingDeleteSkillId}`, "success");
      } else {
        this.setStatus("Failed to delete skill", "error");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.setStatus(`Delete failed: ${msg}`, "error");
    } finally {
      this.setLoading(false);
      this.pendingDeleteSkillId = null;
    }
  }

  // ===== Grouping =====

  cycleGrouping(): void {
    const modes: Array<"source" | "status" | "none"> = ["source", "status", "none"];
    const currentIdx = modes.indexOf(this.skillsViewExtensions.groupBy);
    this.skillsViewExtensions.groupBy = modes[(currentIdx + 1) % modes.length];
    this.buildTree();
    this.setStatus(`Grouping: ${this.skillsViewExtensions.groupBy}`, "info");
  }

  // ===== Refresh =====

  override async refresh(): Promise<void> {
    this.setLoading(true, "Refreshing...");
    try {
      await this.loadSkills();
      this.buildTree();
      this.setStatus("Refreshed", "success");
    } finally {
      this.setLoading(false);
    }
  }

  // ===== Base Implementation =====

  override getKeyBindings(): KeyBinding<string>[] {
    return SKILLS_KEY_BINDINGS.map((b) => ({ ...b, action: b.action as string }));
  }

  override getViewName(): string {
    return "Skills Manager";
  }

  // ===== Rendering =====

  render(): string {
    const lines: string[] = [];

    // Header
    lines.push("╔══════════════════════════════════════════════════════════════╗");
    lines.push("║                    🎯 SKILLS MANAGER                         ║");
    lines.push("╠══════════════════════════════════════════════════════════════╣");

    // Filter info
    const filterInfo = [];
    if (this.skillsViewExtensions.filterSource !== "all") {
      filterInfo.push(`source=${this.skillsViewExtensions.filterSource}`);
    }
    if (this.skillsViewExtensions.filterStatus !== "all") {
      filterInfo.push(`status=${this.skillsViewExtensions.filterStatus}`);
    }
    if (this.state.filterText) filterInfo.push(`search="${this.state.filterText}"`);
    if (filterInfo.length > 0) {
      lines.push(`║ Filters: ${filterInfo.join(", ").padEnd(TUI_LAYOUT_MEDIUM_WIDTH - 10)}║`);
      lines.push("╠══════════════════════════════════════════════════════════════╣");
    }

    // Tree view
    if (this.state.tree.length === 0) {
      lines.push("║                                                              ║");
      lines.push("║   No skills found.                                           ║");
      lines.push("║                                                              ║");
    } else {
      const treeLines = this.renderTreeView({
        indentSize: 2,
      });
      for (const line of treeLines.slice(0, 15)) {
        lines.push(`║ ${line.padEnd(TUI_LAYOUT_MEDIUM_WIDTH)}║`);
      }
    }

    lines.push("╠══════════════════════════════════════════════════════════════╣");

    // Status bar
    const statusText = this.renderStatusBar();
    lines.push(`║ ${statusText.padEnd(TUI_LAYOUT_MEDIUM_WIDTH)}║`);

    // Key hints
    lines.push("║ ↑↓:nav  Enter:detail  /:search  f:source  s:status  ?:help   ║");
    lines.push("╚══════════════════════════════════════════════════════════════╝");

    return lines.join("\n");
  }

  renderHelp(): string[] {
    return renderHelpScreen({
      title: "Skills Manager Help",
      sections: SKILLS_HELP_SECTIONS,
    });
  }

  renderDetail(): string {
    return this.skillsViewExtensions.detailContent;
  }

  // ===== Input Handling =====

  public override handleKeySync(key: string): boolean {
    // 1. Handle dialogs (delegated to base)
    if (this.handleDialogKeys(key)) return true;

    // 2. Handle detail view
    if (this.skillsViewExtensions.showDetail) {
      return this.handleDetailKeysSync(key);
    }

    // 3. Handle help screen (delegated to base)
    if (this.handleHelpKeys(key)) return true;

    // 4. Handle navigation (delegated to base)
    // Avoid keys that we handle specifically in this subclass or asynchronously
    if (this.shouldDelegateNavigation(key) && this.handleNavigationKeys(key)) {
      return true;
    }

    // 5. Handle action keys
    return this.handleActionKeysSync(key);
  }

  private handleDetailKeysSync(key: string): boolean {
    if (key === KEYS.ESCAPE || key === KEYS.Q) {
      this.hideDetail();
    }
    return true;
  }

  private shouldDelegateNavigation(key: string): boolean {
    // BASE handles c and e by default
    return key !== KEYS.R && key !== KEYS.CAP_R;
  }

  private handleActionKeysSync(key: string): boolean {
    switch (key) {
      case KEYS.ENTER:
      case KEYS.CAP_R:
        return false; // Handle asynchronously
      case KEYS.SLASH:
        this.showSearchDialog();
        return true;
      case KEYS.F:
        this.showFilterSourceDialog();
        return true;
      case KEYS.S:
        this.showFilterStatusDialog();
        return true;
      case KEYS.G:
        this.cycleGrouping();
        return true;
      case KEYS.D:
        this.showDeleteConfirm();
        return true;
      default:
        return false;
    }
  }

  /**
   * Override base help key handling to support 'q' for closing help
   */
  protected override handleHelpKeys(key: string): boolean {
    if (this.state.showHelp) {
      if (key === KEYS.QUESTION || key === KEYS.ESCAPE || key === KEYS.Q) {
        this.state.showHelp = false;
        return true;
      }
      return true; // Consume all keys when help is shown
    }

    if (key === KEYS.QUESTION) {
      this.state.showHelp = true;
      return true;
    }

    return false;
  }

  override async handleKey(key: string): Promise<boolean> {
    if (this.handleKeySync(key)) return true;

    switch (key) {
      case KEYS.ENTER:
        await this.showDetail();
        return true;
      case KEYS.CAP_R:
        await this.refresh();
        return true;
    }
    return false;
  }

  isShowingHelp(): boolean {
    return this.state.showHelp;
  }

  isShowingDetail(): boolean {
    return this.skillsViewExtensions.showDetail;
  }

  getExtensions(): SkillsViewExtensions {
    return { ...this.skillsViewExtensions };
  }

  getSelectedId(): string | null {
    return this.state.selectedId;
  }

  getState(): any {
    return {
      ...this.state,
      ...this.skillsViewExtensions,
      selectedSkillId: this.state.selectedId,
    };
  }

  override hasActiveDialog(): boolean {
    return this.state.activeDialog !== null;
  }

  renderDialog(): string[] {
    if (this.state.activeDialog) {
      return this.state.activeDialog.render({
        useColors: this.state.useColors,
        width: TUI_LAYOUT_DIALOG_WIDTH,
        height: TUI_LIMIT_MEDIUM,
      });
    }
    return [];
  }
}

// ===== View Factory =====

/**
 * Create a SkillsManagerView instance
 */
export function createSkillsManagerView(service: SkillsViewService): SkillsManagerView {
  return new SkillsManagerView(service);
}
