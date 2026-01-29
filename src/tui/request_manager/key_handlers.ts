/**
 * Key handler utilities for Request Manager View
 * Extracted from request_manager_view.ts to reduce complexity
 */

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
  return node?.type === "group";
}
