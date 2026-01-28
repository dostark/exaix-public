/**
 * Common state interface for tree-based TUI views
 *
 * Phase 33.1: Extracted from plan_reviewer_view, portal_manager_view, monitor_view, etc.
 * This interface captures the common state fields shared across all tree-based views.
 */

import type { DialogBase } from "../utils/dialog_base.ts";
import type { TreeNode } from "../utils/tree_view.ts";

/**
 * Common state for tree-based views
 * @template T The type of data stored in tree nodes
 */
export interface TreeViewState<T> {
  /** Currently selected node ID */
  selectedId: string | null;

  /** Tree structure organized by groups */
  tree: TreeNode<T>[];

  /** Filter text for searching */
  filterText: string;

  /** Whether view is loading */
  isLoading: boolean;

  /** Loading message to display */
  loadingMessage: string;

  /** Show help screen */
  showHelp: boolean;

  /** Active dialog (if any) */
  activeDialog: DialogBase | null;

  /** Use colors in rendering */
  useColors: boolean;

  /** Spinner frame for animation */
  spinnerFrame: number;

  /** Last refresh timestamp */
  lastRefresh: number;

  /** Scroll offset for list */
  scrollOffset: number;
}

/**
 * Factory function to create initial tree view state
 */
export function createTreeViewState<T>(): TreeViewState<T> {
  return {
    selectedId: null,
    tree: [],
    filterText: "",
    isLoading: false,
    loadingMessage: "",
    showHelp: false,
    activeDialog: null,
    useColors: true,
    spinnerFrame: 0,
    lastRefresh: 0,
    scrollOffset: 0,
  };
}
