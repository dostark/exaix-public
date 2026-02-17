/**
 * @module MemoryTreeBuilder
 * @path src/tui/memory_view/tree_builder.ts
 * @description Tree builder and renderer for Memory View, responsible for building the hierarchical memory structure and rendering it to TUI lines.
 * @architectural-layer TUI
 * @dependencies [Spinner, Enums, MemoryTuiScope, Constants]
 * @related-files [src/tui/memory_view/memory_scope.ts]
 */

import { renderSpinnerFrame } from "../../helpers/spinner.ts";
import { TuiIcon, TuiNodeType } from "../../enums.ts";
import { MemoryTuiScope } from "./memory_scope.ts";
import {
  TUI_LABEL_EXECUTIONS,
  TUI_LABEL_GLOBAL_MEMORY,
  TUI_LABEL_PENDING,
  TUI_LABEL_PROJECTS,
  TUI_PREFIX_EXECUTION,
  TUI_PREFIX_PROJECT,
  TUI_TREE_PAGINATION_LIMIT,
  TUI_TREE_RECENT_LIMIT,
} from "../../helpers/constants.ts";
import type { MemoryServiceInterface, TreeNode } from "./types.ts";

export class TreeBuilder {
  /**
   * Build the memory hierarchy tree
   */
  static async buildTree(service: MemoryServiceInterface): Promise<TreeNode[]> {
    const tree: TreeNode[] = [];

    // 1. Global Scope
    const globalMemory = await service.getGlobalMemory();
    tree.push({
      id: MemoryTuiScope.GLOBAL,
      type: TuiNodeType.SCOPE,
      label: TUI_LABEL_GLOBAL_MEMORY,
      expanded: false,
      children: [],
      data: globalMemory,
    });

    // 2. Projects Scope
    const projects = await service.getProjects();
    const projectNodes: TreeNode[] = [];
    for (const p of projects.slice(0, TUI_TREE_PAGINATION_LIMIT)) {
      projectNodes.push({
        id: `${TUI_PREFIX_PROJECT}${p}`,
        type: TuiNodeType.PROJECT,
        label: `${TuiIcon.FOLDER} ${p}`,
        expanded: false,
        children: [],
      });
    }
    tree.push({
      id: MemoryTuiScope.PROJECTS,
      type: TuiNodeType.SCOPE,
      label: TUI_LABEL_PROJECTS,
      expanded: false,
      children: projectNodes,
      badge: projects.length,
    });

    // 3. Executions Scope
    const executions = await service.getExecutionHistory({ limit: TUI_TREE_RECENT_LIMIT });
    const executionNodes: TreeNode[] = executions.map((e: any) => ({
      id: `${TUI_PREFIX_EXECUTION}${e.trace_id}`,
      type: TuiNodeType.EXECUTION,
      label: e.trace_id.slice(0, 8),
      expanded: false,
      children: [],
      data: e,
    }));
    tree.push({
      id: MemoryTuiScope.EXECUTIONS,
      type: TuiNodeType.SCOPE,
      label: TUI_LABEL_EXECUTIONS,
      expanded: false,
      children: executionNodes,
      badge: executions.length,
    });

    // 4. Pending Scope
    const pending = await service.listPending();
    const pendingNodes: TreeNode[] = pending.map((p) => ({
      id: `${MemoryTuiScope.PENDING}:${p.id}`,
      type: TuiNodeType.LEARNING,
      label: p.learning.title,
      expanded: false,
      children: [],
      data: p,
    }));
    tree.push({
      id: MemoryTuiScope.PENDING,
      type: TuiNodeType.SCOPE,
      label: TUI_LABEL_PENDING,
      expanded: false,
      children: pendingNodes,
      badge: pending.length,
    });

    return tree;
  }

  /**
   * Render the memory tree panel for TUI
   */
  static renderTree(
    tree: TreeNode[],
    selectedNodeId: string | null,
    isLoading: boolean,
    spinnerFrame: number,
    loadingMessage: string,
  ): string {
    // Show loading state
    if (isLoading) {
      const spinner = renderSpinnerFrame(spinnerFrame);
      return `${spinner} ${loadingMessage}`;
    }

    const lines: string[] = [];

    const renderNode = (node: TreeNode, indent: number) => {
      const prefix = "  ".repeat(indent);
      const arrow = node.children && node.children.length > 0 ? (node.expanded ? "▾" : "▸") : " ";
      const badge = node.badge !== undefined ? ` (${node.badge})` : "";
      const selected = node.id === selectedNodeId ? ">" : " ";
      lines.push(`${selected}${prefix}${arrow} ${node.label}${badge}`);

      if (node.expanded && node.children) {
        for (const child of node.children) {
          renderNode(child, indent + 1);
        }
      }
    };

    for (const node of tree) {
      renderNode(node, 0);
    }

    return lines.join("\n");
  }
}
