/**
 * Skills Manager TUI View
 *
 * Interactive view for managing Skills in the TUI dashboard.
 * Part of Phase 17.13: TUI Skills Support
 *
 * Features:
 * - Tree navigation for skills by source (core/project/learned)
 * - Detail panel with skill information
 * - Search and filtering
 * - Keyboard shortcuts
 */

import { MemorySource, SkillStatus } from "../enums.ts";
import { BaseTreeView } from "./base/base_tree_view.ts";
import { type DialogBase } from "./utils/dialog_base.ts";
import type { KeyBinding } from "./utils/keyboard.ts";
import { createGroupNode, createNode, getFirstNodeId, type TreeNode } from "./utils/tree_view.ts";
import { type HelpSection, renderHelpScreen } from "./utils/help_renderer.ts";

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
  core: "📦",
  project: "📁",
  learned: "📚",
};

export const STATUS_ICONS: Record<string, string> = {
  active: "🟢",
  draft: "🟡",
  deprecated: "⚫",
};

export const SKILL_ICON = "🎯";

// ===== Key Bindings =====

export const SKILLS_KEY_BINDINGS: KeyBinding[] = [
  { key: "↑/↓", description: "Navigate skills", action: "navigate" },
  { key: "Home/End", description: "Jump to first/last", action: "navigate-edge" },
  { key: "←/→", description: "Collapse/Expand group", action: "collapse-expand" },
  { key: "Enter", description: "View skill details", action: "view-detail" },
  { key: "d", description: "Delete skill", action: "delete" },
  { key: "/", description: "Search skills", action: "search" },
  { key: "f", description: "Filter by source", action: "filter-source" },
  { key: "s", description: "Filter by status", action: "filter-status" },
  { key: "g", description: "Toggle grouping", action: "toggle-grouping" },
  { key: "R", description: "Force refresh", action: "refresh" },
  { key: "c/E", description: "Collapse/Expand all", action: "collapse-expand-all" },
  { key: "?", description: "Show help", action: "help" },
  { key: "q/Esc", description: "Back/Close", action: "back" },
];

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
    const order = groupBy === "source" ? ["core", "project", "learned"] : ["active", "draft", "deprecated"];

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
      const instrLines = skill.instructions.split("\n").slice(0, 10);
      for (const line of instrLines) {
        lines.push(`  ${line}`);
      }
      if (skill.instructions.split("\n").length > 10) {
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
    if (result.type !== "confirmed") {
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
    if (normalized === "all" || normalized === "active" || normalized === "draft" || normalized === "deprecated") {
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
      lines.push(`║ Filters: ${filterInfo.join(", ").padEnd(50)}║`);
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
        lines.push(`║ ${line.padEnd(60)}║`);
      }
    }

    lines.push("╠══════════════════════════════════════════════════════════════╣");

    // Status bar
    const statusText = this.renderStatusBar();
    lines.push(`║ ${statusText.padEnd(60)}║`);

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

  override async handleKey(key: string): Promise<boolean> {
    // 1. Handle dialogs (delegated to base)
    if (this.handleDialogKeys(key)) return true;

    // 2. Handle detail view
    if (this.skillsViewExtensions.showDetail) {
      if (key === "q" || key === "escape") {
        this.hideDetail();
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
      case "return":
      case "enter":
        await this.showDetail();
        return true;
      case "/":
        this.showSearchDialog();
        return true;
      case "f":
        this.showFilterSourceDialog();
        return true;
      case "s":
        this.showFilterStatusDialog();
        return true;
      case "g":
        this.cycleGrouping();
        return true;
      case "d":
        this.showDeleteConfirm();
        return true;
      case "R":
        await this.refresh();
        return true;
      default:
        return false;
    }
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
      return this.state.activeDialog.render({ useColors: this.state.useColors, width: 70, height: 10 });
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
