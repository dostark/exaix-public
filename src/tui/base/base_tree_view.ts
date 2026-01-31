/**
 * Base class for tree-based TUI views
 *
 * Phase 33.1: Extracted common functionality from:
 * - plan_reviewer_view.ts
 * - portal_manager_view.ts
 * - monitor_view.ts
 * - skills_manager_view.ts
 * - structured_log_viewer.ts
 *
 * This base class implements:
 * - Common state management
 * - Navigation (up, down, home, end)
 * - Key handling skeleton
 * - Dialog management
 * - Help screen rendering
 * - Loading state management
 */

import {
  KEY_C,
  KEY_DOWN,
  KEY_E,
  KEY_END,
  KEY_ESCAPE,
  KEY_HOME,
  KEY_J,
  KEY_K,
  KEY_LEFT,
  KEY_QUESTION,
  KEY_RIGHT,
  KEY_SLASH,
  KEY_UP,
} from "../../config/constants.ts";
import { TuiSessionBase } from "../tui_common.ts";
import type { DialogBase } from "../utils/dialog_base.ts";
import { ConfirmDialog, InputDialog } from "../utils/dialog_base.ts";
import type { KeyBinding } from "../utils/keyboard.ts";
import { nextFrame, renderSpinner, type SpinnerState, startSpinner, stopSpinner } from "../utils/spinner.ts";
import {
  collapseAll,
  expandAll,
  flattenTree,
  getNextNodeId,
  getPrevNodeId,
  renderTree,
  toggleNode,
  type TreeNode,
  type TreeRenderOptions,
} from "../utils/tree_view.ts";
import { createTreeViewState, type TreeViewState } from "./tree_view_state.ts";

/**
 * Abstract base class for tree-based TUI views
 * @template T The type of data stored in tree nodes
 */
export abstract class BaseTreeView<T> extends TuiSessionBase {
  protected state: TreeViewState<T>;
  protected localSpinnerState: SpinnerState;

  constructor(useColors = true) {
    super(useColors);
    this.state = createTreeViewState<T>();
    this.state.useColors = useColors;
    this.localSpinnerState = {
      active: false,
      frame: 0,
      message: "",
      startTime: 0,
    };
  }

  // ===== Abstract Methods (must be implemented by subclasses) =====

  /**
   * Build the tree structure from items
   */
  protected abstract buildTree(items: T[]): void;

  /**
   * Get the key bindings for this view
   */
  abstract override getKeyBindings(): KeyBinding<string>[];

  /**
   * Get the view name
   */
  abstract override getViewName(): string;

  // ===== Navigation Methods =====

  protected navigateUp(): void {
    if (!this.state.selectedId) {
      this.navigateEnd();
      return;
    }
    const prevId = getPrevNodeId(this.state.tree, this.state.selectedId);
    if (prevId) {
      this.state.selectedId = prevId;
    }
  }

  /**
   * Navigate to next node in tree
   */
  protected navigateDown(): void {
    if (!this.state.selectedId) {
      this.navigateHome();
      return;
    }
    const nextId = getNextNodeId(this.state.tree, this.state.selectedId);
    if (nextId) {
      this.state.selectedId = nextId;
    }
  }

  /**
   * Navigate to first node in tree
   */
  protected navigateHome(): void {
    const flat = flattenTree(this.state.tree);
    if (flat.length > 0) {
      this.state.selectedId = flat[0].node.id;
    }
  }

  /**
   * Navigate to last node in tree
   */
  protected navigateEnd(): void {
    const flat = flattenTree(this.state.tree);
    if (flat.length > 0) {
      this.state.selectedId = flat[flat.length - 1].node.id;
    }
  }

  /**
   * Toggle expand/collapse of current node
   */
  protected toggleCurrentNode(): void {
    if (this.state.selectedId) {
      this.state.tree = toggleNode(this.state.tree, this.state.selectedId);
    }
  }

  /**
   * Expand all nodes in tree
   */
  protected expandAllNodes(): void {
    this.state.tree = expandAll(this.state.tree);
  }

  /**
   * Collapse all nodes in tree
   */
  protected collapseAllNodes(): void {
    this.state.tree = collapseAll(this.state.tree);
  }

  // ===== Key Handling =====

  /**
   * Handle common navigation keys
   * Returns true if key was handled, false otherwise
   */
  protected handleNavigationKeys(key: string): boolean {
    switch (key) {
      case KEY_UP:
      case KEY_K:
        this.navigateUp();
        return true;
      case KEY_DOWN:
      case KEY_J:
        this.navigateDown();
        return true;
      case KEY_HOME:
        this.navigateHome();
        return true;
      case KEY_END:
        this.navigateEnd();
        return true;
      case KEY_LEFT:
      case KEY_RIGHT:
        this.toggleCurrentNode();
        return true;
      case KEY_E:
        this.expandAllNodes();
        return true;
      case KEY_C:
        this.collapseAllNodes();
        return true;
      case KEY_SLASH:
        // By default, search is handled by subclasses if they have a search dialog
        return false;
      case KEY_ESCAPE:
        if (this.state.filterText !== "") {
          this.state.filterText = "";
          return true;
        }
        return false;
      default:
        return false;
    }
  }

  /**
   * Handle help screen keys
   * Returns true if key was handled, false otherwise
   */
  protected handleHelpKeys(key: string): boolean {
    if (this.state.showHelp) {
      if (key === KEY_QUESTION || key === KEY_ESCAPE) {
        this.state.showHelp = false;
        return true;
      }
      return true; // Consume all keys when help is shown
    }

    if (key === KEY_QUESTION) {
      this.state.showHelp = true;
      return true;
    }

    return false;
  }

  /**
   * Synchronous version of key handler for internal use
   * to ensure state updates happen in the same tick.
   */
  public handleKeySync(key: string): boolean {
    if (this.handleDialogKeys(key)) return true;
    if (this.handleHelpKeys(key)) return true;
    if (this.handleNavigationKeys(key)) return true;
    return false;
  }

  /**
   * Main key handler for the view
   * Delegates to dialogs, help, and navigation handlers
   * Returns true if key was handled
   */
  handleKey(key: string): Promise<boolean> {
    return Promise.resolve(this.handleKeySync(key));
  }

  /**
   * Handle dialog keys
   * Returns true if dialog is active and consumed the key
   */
  protected handleDialogKeys(key: string): boolean {
    if (this.state.activeDialog) {
      this.state.activeDialog.handleKey(key);

      if (!this.state.activeDialog.isActive()) {
        const dialog = this.state.activeDialog;
        this.state.activeDialog = null;
        this.onDialogClosed(dialog);
      }

      return true;
    }

    return false;
  }

  /**
   * Called when a dialog is closed
   * Subclasses can override to handle dialog results
   */
  protected onDialogClosed(_dialog: DialogBase): void {
    // Default: no-op
  }

  // ===== Dialog Management =====

  /**
   * Show a confirmation dialog
   */
  protected showConfirmDialog(options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
  }): void {
    this.state.activeDialog = new ConfirmDialog(options);
  }

  /**
   * Show an input dialog
   */
  protected showInputDialog(options: {
    title: string;
    label: string;
    placeholder?: string;
    defaultValue?: string;
  }): void {
    this.state.activeDialog = new InputDialog(options);
  }

  // ===== Loading State =====

  /**
   * Set loading state
   */
  protected setLoading(loading: boolean, message = ""): void {
    this.state.isLoading = loading;
    this.state.loadingMessage = message;
    if (loading) {
      this.localSpinnerState = startSpinner(this.localSpinnerState, message);
    } else {
      this.localSpinnerState = stopSpinner(this.localSpinnerState);
    }
  }

  /**
   * Execute an async action with loading state and common error handling
   */
  async executeWithLoading<R>(
    message: string,
    action: () => Promise<R>,
    successMessage?: (result: R) => string,
  ): Promise<R | null> {
    this.setLoading(true, message);
    try {
      const result = await action();
      if (successMessage) {
        this.statusMessage = successMessage(result);
      }
      return result;
    } catch (e) {
      this.statusMessage = e instanceof Error ? `Error: ${e.message}` : `Error: ${String(e)}`;
      return null;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Advance spinner animation frame
   */
  public tickSpinner(): void {
    this.localSpinnerState = nextFrame(this.localSpinnerState);
    this.state.spinnerFrame = this.localSpinnerState.frame % 10;
  }

  // ===== State Accessors =====

  /**
   * Get currently selected node
   */
  protected getSelectedNode(): TreeNode<T> | null {
    const flat = flattenTree(this.state.tree);
    return flat.find((f) => f.node.id === this.state.selectedId)?.node || null;
  }

  /**
   * Check if loading
   */
  isLoading(): boolean {
    return this.state.isLoading;
  }

  /**
   * Get loading message
   */
  getLoadingMessage(): string {
    return this.state.loadingMessage;
  }

  /**
   * Check if help is visible
   */
  override isHelpVisible(): boolean {
    return this.state.showHelp;
  }

  /**
   * Check if dialog is active
   */
  hasActiveDialog(): boolean {
    return this.state.activeDialog !== null && this.state.activeDialog.isActive();
  }

  /**
   * Get active dialog
   */
  getActiveDialog(): DialogBase | null {
    return this.state.activeDialog;
  }

  /**
   * Set color usage
   */
  setUseColors(useColors: boolean): void {
    this.state.useColors = useColors;
  }

  // ===== Rendering =====

  /**
   * Render the tree
   */
  protected renderTreeView(options: Partial<TreeRenderOptions> = {}): string[] {
    return renderTree(this.state.tree, {
      useColors: this.state.useColors,
      selectedId: this.state.selectedId || undefined,
      ...options,
    });
  }

  /**
   * Render status bar
   */
  renderStatusBar(): string {
    if (this.state.isLoading) {
      return renderSpinner(this.localSpinnerState, { useColors: this.state.useColors });
    }
    return this.statusMessage ? `Status: ${this.statusMessage}` : "Ready";
  }

  /**
   * Get tree for rendering
   */
  getTree(): TreeNode<T>[] {
    return this.state.tree;
  }
}
