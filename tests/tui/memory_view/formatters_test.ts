import { assertEquals, assertStringIncludes } from "@std/assert";

import { MemoryFormatter } from "../../../src/tui/memory_view/formatters.ts";
import { MemoryTuiScope } from "../../../src/tui/memory_view/memory_scope.ts";
import type { TreeNode } from "../../../src/tui/memory_view/types.ts";
import type {
  ExecutionMemory,
  GlobalMemory,
  MemoryUpdateProposal,
  ProjectMemory,
} from "../../../src/services/memory_bank.ts";
import { TuiNodeType } from "../../../src/enums.ts";
import {
  TUI_DETAIL_MAX_OVERVIEW_CHARS,
  TUI_MSG_PRESS_QUIT,
  TUI_PREFIX_EXECUTION,
  TUI_PREFIX_PROJECT,
} from "../../../src/helpers/constants.ts";
import { MemoryScope } from "../../../src/enums.ts";
import { MemoryStatus } from "../../../src/memory/memory_status.ts";

function node(id: string, label = id, data?: unknown, badge?: number): TreeNode {
  return {
    id,
    type: TuiNodeType.GROUP,
    label,
    expanded: true,
    children: [],
    data,
    badge,
  };
}

Deno.test("MemoryFormatter.formatScopeDetail: covers known scopes and fallback", () => {
  const globalMemory: GlobalMemory = {
    learnings: [{ title: "L1", category: "insight" as any } as any],
    patterns: [],
    anti_patterns: [],
  } as any;

  const global = MemoryFormatter.formatScopeDetail(node(MemoryTuiScope.GLOBAL, "Global", globalMemory));
  assertStringIncludes(global, "# Global Memory");
  assertStringIncludes(global, "Learnings:");

  const projects = MemoryFormatter.formatScopeDetail(node(MemoryTuiScope.PROJECTS, "Projects", undefined, 2));
  assertStringIncludes(projects, "2 project memories");

  const executions = MemoryFormatter.formatScopeDetail(node(MemoryTuiScope.EXECUTIONS, "Executions", undefined, 3));
  assertStringIncludes(executions, "3 total executions");

  const pending = MemoryFormatter.formatScopeDetail(node(MemoryTuiScope.PENDING, "Pending", undefined, 4));
  assertStringIncludes(pending, "4 proposals awaiting review");

  const other = MemoryFormatter.formatScopeDetail(node("other", "Other"));
  assertStringIncludes(other, "Scope: Other");
});

Deno.test("MemoryFormatter.formatProjectDetail: returns message when project memory missing", async () => {
  const n = node(`${TUI_PREFIX_PROJECT}portal1`, "portal1", null);

  const service = {
    getProjectMemory: () => Promise.resolve(null),
  } as any;

  const result = await MemoryFormatter.formatProjectDetail(n, service);
  assertStringIncludes(result, "has no memory bank");
});

Deno.test("MemoryFormatter.formatExecutionDetail: loads fresh execution when data is null", async () => {
  const exec: ExecutionMemory = {
    trace_id: "trace-12345678",
    status: "completed" as any,
    agent: "a",
    portal: "p",
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    summary: "s",
  } as any;

  const n = node(`${TUI_PREFIX_EXECUTION}${exec.trace_id}`, "exec", null);
  const service = {
    getExecutionByTraceId: () => Promise.resolve(exec),
  } as any;

  const result = await MemoryFormatter.formatExecutionDetail(n, service);
  assertStringIncludes(result, "# Execution:");
  assertStringIncludes(result, "**Agent:** a");
});

Deno.test("MemoryFormatter.formatLearningDetail: renders proposal learning content", () => {
  const proposal: MemoryUpdateProposal = {
    id: "p",
    created_at: new Date().toISOString(),
    operation: "add" as any,
    target_scope: MemoryScope.GLOBAL,
    target_project: undefined,
    learning: {
      title: "Learn",
      description: "Desc",
      scope: MemoryScope.GLOBAL,
      category: "insight" as any,
      confidence: "high" as any,
      tags: ["t"],
    } as any,
    reason: "Because",
    agent: "agent",
    execution_id: "trace",
    status: MemoryStatus.PENDING,
  };

  const out = MemoryFormatter.formatLearningDetail(node("x", "x", proposal), false);
  assertStringIncludes(out, "Learn");
  assertStringIncludes(out, "Reason for Proposal");
  assertStringIncludes(out, "[a] Approve");
});

Deno.test("MemoryFormatter.formatProjectMemory: truncates long overview and lists patterns", () => {
  const memory: ProjectMemory = {
    overview: "x".repeat(TUI_DETAIL_MAX_OVERVIEW_CHARS + 5),
    patterns: [{ name: "P1", tags: ["tag"] } as any],
    decisions: [{ decision: "D1" } as any],
  } as any;

  const out = MemoryFormatter.formatProjectMemory("portal", memory);
  assertStringIncludes(out, "# Project: portal");
  assertStringIncludes(out, "## Overview");
  assertStringIncludes(out, "...");
  assertStringIncludes(out, "## Patterns");
  assertStringIncludes(out, "P1");
  assertStringIncludes(out, "## Decisions");
});

Deno.test("MemoryFormatter.formatExecutionMemory: includes changes only when present", () => {
  const base: ExecutionMemory = {
    trace_id: "trace-12345678",
    status: "completed" as any,
    agent: "a",
    portal: "p",
    started_at: new Date().toISOString(),
  } as any;

  const noChanges = MemoryFormatter.formatExecutionMemory(
    { ...base, changes: { files_created: [], files_modified: [], files_deleted: [] } } as any,
  );
  assertEquals(noChanges.includes("## Changes"), false);

  const withChanges = MemoryFormatter.formatExecutionMemory({
    ...base,
    changes: { files_created: ["a"], files_modified: [], files_deleted: [] },
  } as any);
  assertEquals(withChanges.includes("## Changes"), true);
  assertStringIncludes(withChanges, "Created: 1 files");
});

Deno.test("MemoryFormatter.formatDetailWithQuit: appends quit hint", () => {
  const out = MemoryFormatter.formatDetailWithQuit("Hello");
  assertEquals(out.endsWith(TUI_MSG_PRESS_QUIT), true);
});
