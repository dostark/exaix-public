/**
 * Key handler utilities for Memory View
 * Extracted from memory_view.ts to reduce complexity
 */

import type { TreeNode } from "../memory_view.ts";
import {
  KEY_BACKSPACE,
  KEY_DOWN,
  KEY_END,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_HOME,
  KEY_UP,
  MEMORY_SCOPE_EXECUTIONS,
  MEMORY_SCOPE_GLOBAL,
  MEMORY_SCOPE_PENDING,
  MEMORY_SCOPE_PROJECTS,
} from "../../config/constants.ts";

/**
 * Handle search mode key input
 */
export class SearchModeHandler {
  static handleKey(
    key: string,
    searchQuery: string,
    onEscape: () => void,
    onEnter: () => void,
  ): { handled: boolean; newQuery?: string } {
    if (key === KEY_ESCAPE) {
      onEscape();
      return { handled: true };
    }
    if (key === KEY_ENTER) {
      onEnter();
      return { handled: true };
    }
    if (key === KEY_BACKSPACE) {
      return { handled: true, newQuery: searchQuery.slice(0, -1) };
    }
    if (key.length === 1) {
      return { handled: true, newQuery: searchQuery + key };
    }
    return { handled: true };
  }
}

/**
 * Handle navigation key input
 */
export class NavigationHandler {
  static async handleKey(
    key: string,
    flatNodes: TreeNode[],
    currentNodeId: string | null,
    onNavigate: (nodeId: string, node: TreeNode) => Promise<void>,
  ): Promise<boolean> {
    if (flatNodes.length === 0) return false;

    const currentIndex = flatNodes.findIndex((n) => n.id === currentNodeId);

    switch (key) {
      case KEY_UP:
        if (currentIndex > 0) {
          const node = flatNodes[currentIndex - 1];
          await onNavigate(node.id, node);
        }
        return true;
      case KEY_DOWN:
        if (currentIndex < flatNodes.length - 1) {
          const node = flatNodes[currentIndex + 1];
          await onNavigate(node.id, node);
        }
        return true;
      case KEY_HOME:
        if (flatNodes.length > 0) {
          const node = flatNodes[0];
          await onNavigate(node.id, node);
        }
        return true;
      case KEY_END:
        if (flatNodes.length > 0) {
          const node = flatNodes[flatNodes.length - 1];
          await onNavigate(node.id, node);
        }
        return true;
    }
    return false;
  }
}

/**
 * Handle shortcut key input
 */
export class ShortcutHandler {
  static async handleKey(
    key: string,
    handlers: {
      jumpToScope?: (scope: string) => Promise<void>;
      startSearch?: () => void;
      showHelp?: () => void;
      approveProposal?: () => Promise<void>;
      rejectProposal?: () => Promise<void>;
      approveAll?: () => Promise<void>;
      addLearning?: () => void;
      promoteLearning?: () => void;
      refresh?: () => Promise<void>;
    },
  ): Promise<boolean> {
    switch (key) {
      case "g":
        if (handlers.jumpToScope) await handlers.jumpToScope(MEMORY_SCOPE_GLOBAL);
        return true;
      case "p":
        if (handlers.jumpToScope) await handlers.jumpToScope(MEMORY_SCOPE_PROJECTS);
        return true;
      case "e":
        if (handlers.jumpToScope) await handlers.jumpToScope(MEMORY_SCOPE_EXECUTIONS);
        return true;
      case "n":
        if (handlers.jumpToScope) await handlers.jumpToScope(MEMORY_SCOPE_PENDING);
        return true;
      case "s":
      case "/":
        if (handlers.startSearch) handlers.startSearch();
        return true;
      case "?":
        if (handlers.showHelp) handlers.showHelp();
        return true;
      case "a":
        if (handlers.approveProposal) await handlers.approveProposal();
        return true;
      case "r":
        if (handlers.rejectProposal) await handlers.rejectProposal();
        return true;
      case "A":
        if (handlers.approveAll) await handlers.approveAll();
        return true;
      case "L":
        if (handlers.addLearning) handlers.addLearning();
        return true;
      case "P":
        if (handlers.promoteLearning) handlers.promoteLearning();
        return true;
      case "R":
        if (handlers.refresh) await handlers.refresh();
        return true;
    }
    return false;
  }
}
