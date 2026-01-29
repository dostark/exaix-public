/**
 * Formatters for Memory View
 */

import type {
  ExecutionMemory,
  GlobalMemory,
  Learning,
  MemoryUpdateProposal,
  ProjectMemory,
} from "../../services/memory_bank.ts";
import {
  MEMORY_SCOPE_EXECUTIONS,
  MEMORY_SCOPE_GLOBAL,
  MEMORY_SCOPE_PENDING,
  MEMORY_SCOPE_PROJECTS,
} from "../../config/constants.ts";
import {
  TUI_DETAIL_MAX_OVERVIEW_CHARS,
  TUI_MSG_PRESS_QUIT,
  TUI_PREFIX_EXECUTION,
  TUI_PREFIX_PROJECT,
} from "../utils/constants.ts";
import { renderCategoryBadge, renderConfidence, renderMarkdown } from "../utils/markdown_renderer.ts";
import type { MemoryServiceInterface, TreeNode } from "./types.ts";

export class MemoryFormatter {
  /**
   * Format scope detail for display
   */
  static formatScopeDetail(node: TreeNode): string {
    if (node.id === MEMORY_SCOPE_GLOBAL) {
      const memory = node.data as GlobalMemory | null;
      if (!memory) return "Global memory not initialized.\n\nRun: exoctl memory global show";
      return [
        "# Global Memory",
        "",
        `Learnings: ${memory.learnings?.length ?? 0}`,
        `Patterns: ${memory.patterns?.length ?? 0}`,
        `Anti-patterns: ${memory.anti_patterns?.length ?? 0}`,
        "",
        "## Recent Learnings",
        ...(memory.learnings?.slice(0, 5).map((l: Learning) => `- ${l.title} [${l.category}]`) ?? []),
      ].join("\n");
    }
    if (node.id === MEMORY_SCOPE_PROJECTS) {
      return [
        "# Projects",
        "",
        `${node.badge ?? 0} project memories`,
        "",
        "Select a project to view details.",
      ].join("\n");
    }
    if (node.id === MEMORY_SCOPE_EXECUTIONS) {
      return [
        "# Executions",
        "",
        `${node.badge ?? 0} total executions`,
        "",
        "Select an execution to view details.",
      ].join("\n");
    }
    if (node.id === MEMORY_SCOPE_PENDING) {
      return [
        "# Pending Proposals",
        "",
        `${node.badge ?? 0} proposals awaiting review`,
        "",
        "Press [a] to approve, [r] to reject.",
      ].join("\n");
    }
    return `Scope: ${node.label}`;
  }

  /**
   * Format project detail for display
   */
  static async formatProjectDetail(node: TreeNode, service: MemoryServiceInterface): Promise<string> {
    const portal = node.id.replace(TUI_PREFIX_PROJECT, "");
    const memory = node.data as ProjectMemory | null;
    if (!memory) {
      const fresh = await service.getProjectMemory(portal);
      if (!fresh) return `Project '${portal}' has no memory bank.`;
      return this.formatProjectMemory(portal, fresh);
    }
    return this.formatProjectMemory(portal, memory);
  }

  /**
   * Format execution detail for display
   */
  static async formatExecutionDetail(node: TreeNode, service: MemoryServiceInterface): Promise<string> {
    const traceId = node.id.replace(TUI_PREFIX_EXECUTION, "");
    const memory = node.data as ExecutionMemory | null;
    if (!memory) {
      const fresh = await service.getExecutionByTraceId(traceId);
      if (!fresh) return `Execution '${traceId}' not found.`;
      return this.formatExecutionMemory(fresh);
    }
    return this.formatExecutionMemory(memory);
  }

  /**
   * Format learning detail for display
   */
  static formatLearningDetail(node: TreeNode, useColors: boolean): string {
    const proposal = node.data as MemoryUpdateProposal | null;
    if (!proposal) return `Learning: ${node.label}`;

    const learning = proposal.learning;

    // Build content with color badges
    const categoryBadge = renderCategoryBadge(learning.category, useColors);
    const confidenceBadge = renderConfidence(learning.confidence, useColors);

    const content = [
      `# ${learning.title}`,
      "",
      `**Category:** ${categoryBadge}`,
      `**Confidence:** ${confidenceBadge}`,
      `**Scope:** ${proposal.target_scope}`,
      proposal.target_project ? `**Project:** ${proposal.target_project}` : "",
      `**Tags:** ${learning.tags?.join(", ") ?? "none"}`,
      "",
      "## Description",
      learning.description,
      "",
      "## Reason for Proposal",
      proposal.reason,
      "",
      `[a] Approve  [r] Reject`,
    ].filter((l) => l !== "").join("\n");

    return renderMarkdown(content, { useColors });
  }

  /**
   * Format project memory for display
   */
  static formatProjectMemory(portal: string, memory: ProjectMemory): string {
    const lines = [
      `# Project: ${portal}`,
      "",
    ];

    if (memory.overview) {
      lines.push("## Overview");
      lines.push(
        memory.overview.slice(0, TUI_DETAIL_MAX_OVERVIEW_CHARS) +
          (memory.overview.length > TUI_DETAIL_MAX_OVERVIEW_CHARS ? "..." : ""),
      );
      lines.push("");
    }

    if (memory.patterns && memory.patterns.length > 0) {
      lines.push("## Patterns");
      for (const p of memory.patterns.slice(0, 5)) {
        lines.push(`- ${p.name} [${p.tags?.join(", ") ?? ""}]`);
      }
      lines.push("");
    }

    if (memory.decisions && memory.decisions.length > 0) {
      lines.push("## Decisions");
      for (const d of memory.decisions.slice(0, 5)) {
        lines.push(`- ${d.decision}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Format execution memory for display
   */
  static formatExecutionMemory(memory: ExecutionMemory): string {
    const lines = [
      `# Execution: ${memory.trace_id.slice(0, 8)}...`,
      "",
      `**Status:** ${memory.status}`,
      `**Agent:** ${memory.agent}`,
      `**Portal:** ${memory.portal}`,
      `**Started:** ${memory.started_at}`,
      memory.completed_at ? `**Completed:** ${memory.completed_at}` : "",
      "",
    ];

    if (memory.summary) {
      lines.push("## Summary");
      lines.push(memory.summary.slice(0, TUI_DETAIL_MAX_OVERVIEW_CHARS));
      lines.push("");
    }

    if (memory.changes) {
      const totalChanges = (memory.changes.files_created?.length ?? 0) +
        (memory.changes.files_modified?.length ?? 0) +
        (memory.changes.files_deleted?.length ?? 0);
      if (totalChanges > 0) {
        lines.push("## Changes");
        if (memory.changes.files_created?.length) {
          lines.push(`  Created: ${memory.changes.files_created.length} files`);
        }
        if (memory.changes.files_modified?.length) {
          lines.push(`  Modified: ${memory.changes.files_modified.length} files`);
        }
        if (memory.changes.files_deleted?.length) {
          lines.push(`  Deleted: ${memory.changes.files_deleted.length} files`);
        }
        lines.push("");
      }
    }

    if (memory.lessons_learned && memory.lessons_learned.length > 0) {
      lines.push("## Lessons Learned");
      for (const lesson of memory.lessons_learned) {
        lines.push(`- ${lesson}`);
      }
    }

    return lines.filter((l) => l !== "").join("\n");
  }

  /**
   * Format complete detail content with quit message
   */
  static formatDetailWithQuit(content: string): string {
    return `${content}\n\n${TUI_MSG_PRESS_QUIT}`;
  }
}
