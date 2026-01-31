/**
 * Key handler utilities for Request Manager View
 * Extracted from request_manager_view.ts to reduce complexity
 */

import {
  KEY_A,
  KEY_C,
  KEY_CAPITAL_C,
  KEY_CAPITAL_E,
  KEY_D,
  KEY_DOWN,
  KEY_END,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_F,
  KEY_G,
  KEY_HOME,
  KEY_LEFT,
  KEY_P,
  KEY_Q,
  KEY_QUESTION,
  KEY_R,
  KEY_RIGHT,
  KEY_S,
  KEY_UP,
} from "../../config/constants.ts";
import { TuiNodeType } from "../../enums.ts";
import type { TreeNode } from "../utils/tree_view.ts";
import { collapseAll, expandAll, findNode, flattenTree, toggleNode } from "../utils/tree_view.ts";

/**
 * Navigation handler for tree navigation
 */
export class NavigationHandler {
  /**
   * Navigate tree in specified direction
   */
  static navigate(
    tree: TreeNode[],
    selectedId: string | null,
    direction: "up" | "down" | "first" | "last",
  ): string | null {
    const flat = flattenTree(tree);
    if (flat.length === 0) return null;

    const currentIdx = selectedId ? flat.findIndex((n) => n.node.id === selectedId) : -1;

    let newIdx: number;
    switch (direction) {
      case "up":
        newIdx = currentIdx > 0 ? currentIdx - 1 : 0;
        break;
      case "down":
        newIdx = currentIdx < flat.length - 1 ? currentIdx + 1 : flat.length - 1;
        break;
      case "first":
        newIdx = 0;
        break;
      case "last":
        newIdx = flat.length - 1;
        break;
    }

    return flat[newIdx]?.node.id || null;
  }
}

/**
 * Tree manipulation handler for expand/collapse operations
 */
export class TreeManipulationHandler {
  /**
   * Expand selected node if it's a collapsed group
   */
  static expandNode(tree: TreeNode[], selectedId: string | null): TreeNode[] {
    if (!selectedId) return tree;
    const node = findNode(tree, selectedId);
    if (node && node.type === "group" && !node.expanded) {
      return toggleNode(tree, selectedId);
    }
    return tree;
  }

  /**
   * Collapse selected node if it's an expanded group
   */
  static collapseNode(tree: TreeNode[], selectedId: string | null): TreeNode[] {
    if (!selectedId) return tree;
    const node = findNode(tree, selectedId);
    if (node && node.type === "group" && node.expanded) {
      return toggleNode(tree, selectedId);
    }
    return tree;
  }

  /**
   * Toggle selected node expansion state
   */
  static toggleNode(tree: TreeNode[], selectedId: string | null): TreeNode[] {
    if (!selectedId) return tree;
    return toggleNode(tree, selectedId);
  }

  /**
   * Collapse all nodes in tree
   */
  static collapseAll(tree: TreeNode[]): TreeNode[] {
    return collapseAll(tree);
  }

  /**
   * Expand all nodes in tree
   */
  static expandAll(tree: TreeNode[]): TreeNode[] {
    return expandAll(tree);
  }
}

/**
 * Check if a node ID represents a group node
 */
export function isGroupNode(tree: TreeNode[], nodeId: string): boolean {
  const node = findNode(tree, nodeId);
  return node?.type === TuiNodeType.GROUP;
}
/**
 * Main key handler for Request Manager view
 */
export class MainKeyHandler {
  /**
   * Handle main view keyboard keys
   */
  static async handle(
    key: string,
    state: {
      selectedRequestId: string | null;
      requestTree: TreeNode[];
    },
    actions: {
      navigateTree: (dir: "up" | "down" | "first" | "last") => void;
      collapseSelectedNode: () => void;
      expandSelectedNode: () => void;
      toggleSelectedNode: () => void;
      toggleGrouping: () => void;
      refresh: () => Promise<void>;
      showRequestDetail: (id: string) => Promise<void>;
      showCreateDialog: () => void;
      showCancelConfirm: (id: string) => void;
      showPriorityDialog: () => void;
      showSearchDialog: () => void;
      showFilterStatusDialog: () => void;
      showFilterAgentDialog: () => void;
      setShowHelp: (show: boolean) => void;
      updateTree: (tree: TreeNode[]) => void;
    },
  ): Promise<boolean> {
    // Handle navigation keys
    if (this.handleNavigationKeys(key, actions)) return true;

    // Handle tree manipulation keys
    if (this.handleTreeKeys(key, actions)) return true;

    // Handle action keys
    if (await this.handleActionKeys(key, state, actions)) return true;

    // Handle filter and search keys
    if (this.handleFilterKeys(key, actions)) return true;

    // Handle global keys
    if (this.handleGlobalKeys(key, state, actions)) return true;

    return false;
  }

  /**
   * Handle navigation keys (up, down, home, end)
   */
  private static handleNavigationKeys(
    key: string,
    actions: { navigateTree: (dir: "up" | "down" | "first" | "last") => void },
  ): boolean {
    switch (key) {
      case KEY_UP:
        actions.navigateTree("up");
        return true;
      case KEY_DOWN:
        actions.navigateTree("down");
        return true;
      case KEY_HOME:
        actions.navigateTree("first");
        return true;
      case KEY_END:
        actions.navigateTree("last");
        return true;
    }
    return false;
  }

  /**
   * Handle tree manipulation keys (left, right, enter for groups)
   */
  private static handleTreeKeys(
    key: string,
    actions: {
      collapseSelectedNode: () => void;
      expandSelectedNode: () => void;
      toggleSelectedNode: () => void;
    },
  ): boolean {
    switch (key) {
      case KEY_LEFT:
        actions.collapseSelectedNode();
        return true;
      case KEY_RIGHT:
        actions.expandSelectedNode();
        return true;
    }
    return false;
  }

  /**
   * Handle action keys (enter for details, create, delete, priority)
   */
  private static async handleActionKeys(
    key: string,
    state: { selectedRequestId: string | null; requestTree: TreeNode[] },
    actions: {
      toggleSelectedNode: () => void;
      showRequestDetail: (id: string) => Promise<void>;
      showCreateDialog: () => void;
      showCancelConfirm: (id: string) => void;
      showPriorityDialog: () => void;
    },
  ): Promise<boolean> {
    switch (key) {
      case KEY_ENTER:
        if (state.selectedRequestId) {
          if (isGroupNode(state.requestTree, state.selectedRequestId)) {
            actions.toggleSelectedNode();
          } else {
            await actions.showRequestDetail(state.selectedRequestId);
          }
        }
        return true;
      case KEY_C:
        actions.showCreateDialog();
        return true;
      case KEY_D:
        if (state.selectedRequestId && !isGroupNode(state.requestTree, state.selectedRequestId)) {
          actions.showCancelConfirm(state.selectedRequestId);
        }
        return true;
      case KEY_P:
        if (state.selectedRequestId && !isGroupNode(state.requestTree, state.selectedRequestId)) {
          actions.showPriorityDialog();
        }
        return true;
    }
    return false;
  }

  /**
   * Handle filter and search keys
   */
  private static handleFilterKeys(
    key: string,
    actions: {
      showSearchDialog: () => void;
      showFilterStatusDialog: () => void;
      showFilterAgentDialog: () => void;
    },
  ): boolean {
    switch (key) {
      case KEY_S:
        actions.showSearchDialog();
        return true;
      case KEY_F:
        actions.showFilterStatusDialog();
        return true;
      case KEY_A:
        actions.showFilterAgentDialog();
        return true;
    }
    return false;
  }

  /**
   * Handle global keys (grouping, refresh, help, quit)
   */
  private static handleGlobalKeys(
    key: string,
    state: { requestTree: TreeNode[] },
    actions: {
      toggleGrouping: () => void;
      refresh: () => Promise<void>;
      setShowHelp: (show: boolean) => void;
      updateTree: (tree: TreeNode[]) => void;
    },
  ): boolean {
    switch (key) {
      case KEY_G:
        actions.toggleGrouping();
        return true;
      case KEY_R:
        actions.refresh();
        return true;
      case KEY_CAPITAL_C:
        actions.updateTree(TreeManipulationHandler.collapseAll(state.requestTree));
        return true;
      case KEY_CAPITAL_E:
        actions.updateTree(TreeManipulationHandler.expandAll(state.requestTree));
        return true;
      case KEY_QUESTION:
        actions.setShowHelp(true);
        return true;
      case KEY_Q:
      case KEY_ESCAPE:
        return true;
    }
    return false;
  }
}
