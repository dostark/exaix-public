/**
 * Portal Manager TUI View
 *
 * Phase 13.3: Enhanced with modern TUI patterns
 * - Tree view by portal status
 * - Detail panel with portal info
 * - Loading spinners for operations
 * - Confirm dialogs for remove
 * - Search/filter functionality
 * - Help screen
 * - Refresh mechanism
 * - Color theming
 */

import { PortalDetails, PortalInfo } from "../cli/portal_commands.ts";
import { BaseTreeView } from "./base/base_tree_view.ts";
import { ConfirmDialog, type DialogBase } from "./utils/dialog_base.ts";
import { type HelpSection, renderHelpScreen } from "./utils/help_renderer.ts";
import type { KeyBinding } from "./utils/keyboard.ts";
import { KeyBindingCategory } from "./utils/keyboard.ts";
import { KeyBindingsBase } from "./base/key_bindings_base.ts";
import { createGroupNode, createNode, flattenTree, type TreeNode, type TreeRenderOptions } from "./utils/tree_view.ts";
import { PortalStatus, TuiIcon } from "../enums.ts";
import { TUI_LAYOUT_NARROW_WIDTH, TUI_PORTAL_ICONS } from "./utils/constants.ts";
import {
  KEY_C,
  KEY_CAPITAL_R,
  KEY_D,
  KEY_DOWN,
  KEY_E,
  KEY_END,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_HOME,
  KEY_LEFT,
  KEY_QUESTION,
  KEY_R,
  KEY_RIGHT,
  KEY_S,
  KEY_UP,
} from "../config/constants.ts";

// ===== Portal View Extensions =====

export interface PortalViewExtensions {
  /** Detail panel content */
  detailContent: string[];
  /** Last refresh timestamp */
  lastRefresh: number;
}

// ===== Service Interface =====

export interface PortalService {
  listPortals(): Promise<PortalInfo[]>;
  getPortalDetails(alias: string): Promise<PortalDetails>;
  openPortal(alias: string): Promise<boolean>;
  closePortal(alias: string): Promise<boolean>;
  refreshPortal(alias: string): Promise<boolean>;
  removePortal(alias: string, options?: { keepCard?: boolean }): Promise<boolean>;
  quickJumpToPortalDir(alias: string): Promise<string>;
  getPortalFilesystemPath(alias: string): Promise<string>;
  getPortalActivityLog(alias: string): string[];
}

// ===== Portal Actions =====

export enum PortalAction {
  NAVIGATE_UP = "navigate-up",
  NAVIGATE_DOWN = "navigate-down",
  NAVIGATE_HOME = "navigate-home",
  NAVIGATE_END = "navigate-end",
  OPEN = "open",
  REFRESH = "refresh",
  REMOVE = "remove",
  COLLAPSE = "collapse",
  EXPAND = "expand",
  SEARCH = "search",
  CANCEL = "cancel",
  REFRESH_VIEW = "refresh-view",
  HELP = "help",
  EXPAND_ALL = "expand-all",
  COLLAPSE_ALL = "collapse-all",
}

// ===== Portal Status Icons =====

const PORTAL_ICONS = {
  active: TUI_PORTAL_ICONS.active,
  broken: TUI_PORTAL_ICONS.broken,
  inactive: TUI_PORTAL_ICONS.inactive,
  folder: TUI_PORTAL_ICONS.folder,
} as const;

// ===== Key Bindings =====

export class PortalKeyBindings extends KeyBindingsBase<PortalAction, KeyBindingCategory> {
  readonly KEY_BINDINGS: readonly KeyBinding<PortalAction, KeyBindingCategory>[] = [
    {
      key: KEY_UP,
      action: PortalAction.NAVIGATE_UP,
      description: "Move up",
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEY_DOWN,
      action: PortalAction.NAVIGATE_DOWN,
      description: "Move down",
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEY_HOME,
      action: PortalAction.NAVIGATE_HOME,
      description: "Go to first",
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEY_END,
      action: PortalAction.NAVIGATE_END,
      description: "Go to last",
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEY_ENTER,
      action: PortalAction.OPEN,
      description: "Open portal / expand",
      category: KeyBindingCategory.ACTIONS,
    },
    { key: "r", action: PortalAction.REFRESH, description: "Refresh portal", category: KeyBindingCategory.ACTIONS },
    { key: KEY_D, action: PortalAction.REMOVE, description: "Remove portal", category: KeyBindingCategory.ACTIONS },
    {
      key: KEY_LEFT,
      action: PortalAction.COLLAPSE,
      description: "Collapse node",
      category: KeyBindingCategory.NAVIGATION,
    },
    {
      key: KEY_RIGHT,
      action: PortalAction.EXPAND,
      description: "Expand node",
      category: KeyBindingCategory.NAVIGATION,
    },
    { key: KEY_S, action: PortalAction.SEARCH, description: "Search/filter", category: KeyBindingCategory.ACTIONS },
    {
      key: KEY_ESCAPE,
      action: PortalAction.CANCEL,
      description: "Clear filter / close dialog",
      category: KeyBindingCategory.ACTIONS,
    },
    { key: "R", action: PortalAction.REFRESH_VIEW, description: "Refresh view", category: KeyBindingCategory.VIEW },
    { key: KEY_QUESTION, action: PortalAction.HELP, description: "Toggle help", category: KeyBindingCategory.VIEW },
    { key: KEY_E, action: PortalAction.EXPAND_ALL, description: "Expand all", category: KeyBindingCategory.VIEW },
    {
      key: KEY_C,
      action: PortalAction.COLLAPSE_ALL,
      description: "Collapse all",
      category: KeyBindingCategory.VIEW,
    },
  ];
}

export const PORTAL_KEY_BINDINGS = new PortalKeyBindings().KEY_BINDINGS;

// ===== TUI Session =====

export class PortalManagerTuiSession extends BaseTreeView<PortalInfo> {
  private portals: PortalInfo[];
  private readonly service: PortalService;
  private portalExtensions: PortalViewExtensions;

  constructor(portals: PortalInfo[], service: PortalService, useColors = true) {
    super(useColors);
    this.portals = portals;
    this.service = service;
    this.portalExtensions = {
      detailContent: [],
      lastRefresh: 0,
    };
    this.buildTree(portals);
  }

  // ===== Tree Building =====

  protected buildTree(portals: PortalInfo[]): void {
    const active: TreeNode<PortalInfo>[] = [];
    const broken: TreeNode<PortalInfo>[] = [];
    const inactive: TreeNode<PortalInfo>[] = [];

    for (const portal of portals) {
      const node = createNode<PortalInfo>(
        portal.alias,
        portal.alias,
        "portal",
        {
          data: portal,
          icon: portal.status === PortalStatus.ACTIVE ? TuiIcon.PORTAL_ACTIVE : TuiIcon.PORTAL_BROKEN,
          badge: portal.status,
        },
      );

      switch (portal.status) {
        case PortalStatus.ACTIVE:
          active.push(node);
          break;
        case PortalStatus.BROKEN:
          broken.push(node);
          break;
        default:
          inactive.push(node);
      }
    }

    this.state.tree = [];

    if (active.length > 0) {
      this.state.tree.push(
        createGroupNode("active-group", `Active (${active.length})`, "group", active, {
          icon: PORTAL_ICONS.active,
          badge: active.length,
        }),
      );
    }

    if (broken.length > 0) {
      this.state.tree.push(
        createGroupNode("broken-group", `Broken (${broken.length})`, "group", broken, {
          icon: PORTAL_ICONS.broken,
          badge: broken.length,
        }),
      );
    }

    if (inactive.length > 0) {
      this.state.tree.push(
        createGroupNode("inactive-group", `Inactive (${inactive.length})`, "group", inactive, {
          icon: PORTAL_ICONS.inactive,
          badge: inactive.length,
        }),
      );
    }

    // Select first portal if none selected
    if (!this.state.selectedId && portals.length > 0) {
      const flat = flattenTree(this.state.tree);
      const firstPortal = flat.find((f) => f.node.type === "portal");
      if (firstPortal) {
        this.state.selectedId = firstPortal.node.id;
      }
    }
    this.syncSelectedIndex();
  }

  // ===== Backwards Compatibility =====

  // ===== Selection & Sync =====

  override setSelectedIndex(idx: number, _maxLength?: number): void {
    // Don't use super.setSelectedIndex because it clamps to 0
    this.selectedIndex = idx;

    // Sync tree selection with index
    if (idx >= 0 && idx < this.portals.length) {
      this.state.selectedId = this.portals[idx].alias;
    } else {
      this.state.selectedId = ""; // Clear selection for invalid index
    }
  }

  /**
   * Sync selectedIndex based on current selectedId in the portals list
   */
  private syncSelectedIndex(): void {
    if (!this.state.selectedId) {
      this.selectedIndex = 0;
      return;
    }

    const idx = this.portals.findIndex((p) => p.alias === this.state.selectedId);
    if (idx >= 0) {
      this.selectedIndex = idx;
    }
  }

  // ===== Dialog Result Handling =====

  protected override onDialogClosed(dialog: DialogBase): void {
    const result = dialog.getResult();
    if (result.type === "cancelled" || result.value !== true) return;

    if (dialog instanceof ConfirmDialog) {
      this.executeRemove();
    }
  }

  // ===== Key Handling =====

  override async handleKey(key: string): Promise<boolean> {
    // 0. Backwards-compatible handling for legacy tests
    if (this.selectedIndex < 0 || this.selectedIndex >= this.portals.length) {
      if (this.portals.length > 0) {
        this.statusMessage = "Error: No portal selected";
        return true;
      }
    }

    // 1. Handle dialogs (delegated to base)
    if (this.handleDialogKeys(key)) return true;

    // 2. Handle help screen (delegated to base)
    if (this.handleHelpKeys(key)) return true;

    // 3. Handle search mode exit
    if (this.state.filterText !== "" && key === "escape") {
      this.state.filterText = "";
      this.buildTree(this.portals);
      return true;
    }

    // 4. Handle navigation (delegated to base)
    if (this.handleNavigationKeys(key)) {
      this.syncSelectedIndex();
      return true;
    }

    // 6. Handle action keys
    switch (key) {
      case KEY_ENTER: {
        const selected = this.getSelectedNode();
        if (selected && selected.type === "group") {
          this.toggleCurrentNode();
        } else if (selected) {
          await this.executeOpen();
        }
        return true;
      }
      case KEY_R:
        await this.executeRefresh();
        return true;
      case KEY_D:
        this.showRemoveConfirmDialog();
        return true;
      case KEY_CAPITAL_R:
        await this.refreshView();
        return true;
      case KEY_QUESTION:
        this.state.showHelp = true;
        return true;
      case KEY_E:
        this.expandAllNodes();
        return true;
      case KEY_C:
        this.collapseAllNodes();
        return true;
      case KEY_S:
        // In a real TUI, this would open a search input
        return true;
      default:
        return false;
    }
  }

  // ===== Actions =====

  private async executeOpen(): Promise<void> {
    const portal = this.portals[this.selectedIndex];
    if (!portal) return;

    this.setLoading(true, `Opening ${portal.alias}...`);

    try {
      await this.service.openPortal(portal.alias);
      this.statusMessage = `Opened ${portal.alias}`;
    } catch (e) {
      this.statusMessage = e instanceof Error ? `Error: ${e.message}` : `Error: ${String(e)}`;
    } finally {
      this.setLoading(false);
    }
  }

  private async executeRefresh(): Promise<void> {
    const portal = this.portals[this.selectedIndex];
    if (!portal) return;

    this.setLoading(true, `Refreshing ${portal.alias}...`);

    try {
      await this.service.refreshPortal(portal.alias);
      this.statusMessage = `Refreshed ${portal.alias}`;
    } catch (e) {
      this.statusMessage = e instanceof Error ? `Error: ${e.message}` : `Error: ${String(e)}`;
    } finally {
      this.setLoading(false);
    }
  }

  private showRemoveConfirmDialog(): void {
    const portal = this.portals[this.selectedIndex];
    if (!portal) return;

    this.showConfirmDialog({
      title: "Remove Portal",
      message:
        `Are you sure you want to remove "${portal.alias}"?\nThis will delete the symlink but keep the context card.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      destructive: true,
    });
  }

  private async executeRemove(): Promise<void> {
    const portal = this.portals[this.selectedIndex];
    if (!portal) return;

    this.setLoading(true, `Removing ${portal.alias}...`);

    try {
      await this.service.removePortal(portal.alias);
      this.statusMessage = `Removed ${portal.alias}`;
      // Refresh the list
      await this.refreshView();
    } catch (e) {
      this.statusMessage = e instanceof Error ? `Error: ${e.message}` : `Error: ${String(e)}`;
    } finally {
      this.setLoading(false);
    }
  }

  private async refreshView(): Promise<void> {
    this.setLoading(true, "Refreshing portals...");

    try {
      const newPortals = await this.service.listPortals();
      this.updatePortals(newPortals);
      this.portalExtensions.lastRefresh = Date.now();
      this.statusMessage = "Refreshed";
    } catch (e) {
      this.statusMessage = e instanceof Error ? `Error: ${e.message}` : `Error: ${String(e)}`;
    } finally {
      this.setLoading(false);
    }
  }

  // ===== State Accessors =====

  getSelectedPortal(): TreeNode<PortalInfo> | null {
    return this.getSelectedNode();
  }

  updatePortals(newPortals: PortalInfo[]): void {
    this.portals = newPortals;
    this.buildTree(newPortals);

    if (this.selectedIndex >= newPortals.length) {
      this.selectedIndex = Math.max(0, newPortals.length - 1);
    }
  }

  getSelectedPortalDetails(): PortalInfo | undefined {
    if (this.portals.length === 0) return undefined;
    return this.portals[this.selectedIndex];
  }

  getPortalTree(): TreeNode<PortalInfo>[] {
    return this.state.tree;
  }

  // ===== Rendering =====

  renderActionButtons(): string {
    if (!this.portals.length) return "";
    return `[Enter] Open   [r] Refresh   [d] Remove   [?] Help`;
  }

  renderPortalTree(options: Partial<TreeRenderOptions> = {}): string[] {
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
          { key: "Enter", description: "Open portal" },
          { key: "r", description: "Refresh portal" },
          { key: "d", description: "Remove portal" },
          { key: "R", description: "Refresh view" },
        ],
      },
      {
        title: "View",
        items: [
          { key: "s", description: "Search portals" },
          { key: "?", description: "Toggle help" },
          { key: "Esc", description: "Close/Cancel" },
        ],
      },
    ];

    return renderHelpScreen({
      title: "Portal Manager Help",
      sections,
      useColors: this.state.useColors,
      width: TUI_LAYOUT_NARROW_WIDTH,
    });
  }

  getFocusableElements(): string[] {
    return ["portal-list", "action-buttons", "status-bar"];
  }

  override getKeyBindings(): KeyBinding<PortalAction, KeyBindingCategory>[] {
    return PORTAL_KEY_BINDINGS as KeyBinding<PortalAction, KeyBindingCategory>[];
  }

  override getViewName(): string {
    return "Portal Manager";
  }
}

// ===== View Controller =====

export class PortalManagerView implements PortalService {
  constructor(public readonly service: PortalService) {}

  createTuiSession(portals: PortalInfo[], useColors = true): PortalManagerTuiSession {
    return new PortalManagerTuiSession(portals, this.service, useColors);
  }

  listPortals(): Promise<PortalInfo[]> {
    return this.service.listPortals();
  }

  getPortalDetails(alias: string): Promise<PortalDetails> {
    return this.service.getPortalDetails(alias);
  }

  openPortal(alias: string): Promise<boolean> {
    return this.service.openPortal(alias);
  }

  closePortal(alias: string): Promise<boolean> {
    return this.service.closePortal(alias);
  }

  refreshPortal(alias: string): Promise<boolean> {
    return this.service.refreshPortal(alias);
  }

  removePortal(alias: string, options?: { keepCard?: boolean }): Promise<boolean> {
    return this.service.removePortal(alias, options);
  }

  quickJumpToPortalDir(alias: string): Promise<string> {
    return this.service.quickJumpToPortalDir(alias);
  }

  getPortalFilesystemPath(alias: string): Promise<string> {
    return this.service.getPortalFilesystemPath(alias);
  }

  getPortalActivityLog(alias: string): string[] {
    return this.service.getPortalActivityLog(alias);
  }

  renderPortalList(portals: PortalInfo[]): string {
    return portals.map((p) => {
      let line = `${p.alias} [${p.status}] (${p.targetPath})`;
      if (p.status && p.status !== PortalStatus.ACTIVE) {
        line += `  ⚠️ ERROR: ${p.status}`;
      }
      return line;
    }).join("\n");
  }
}
