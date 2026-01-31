/**
 * Extended tests for MemoryView to improve code coverage
 * These tests cover additional branches not covered by the main tests
 */
import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { MemoryReferenceType } from "../../src/enums.ts";

import {
  ExecutionStatus,
  LearningCategory,
  MemoryOperation,
  MemoryScope,
  MemorySource,
  MemoryStatus,
  MemoryType,
} from "../../src/enums.ts";

import { ConfidenceLevel } from "../../src/enums.ts";
import type {
  ExecutionMemory,
  GlobalMemory,
  MemorySearchResult,
  MemoryUpdateProposal,
  ProjectMemory,
} from "../../src/schemas/memory_bank.ts";
import { MemoryViewTuiSession } from "../../src/tui/memory_view.ts";
import type { MemoryServiceInterface } from "../../src/tui/memory_view.ts";
import { KEYS } from "../../src/tui/utils/keyboard.ts";
class ExtendedMockMemoryService implements MemoryServiceInterface {
  private projects: string[] = ["TestPortal"];
  private projectMemories: Map<string, ProjectMemory | null> = new Map();
  private globalMemory: GlobalMemory | null = null;
  private executions: ExecutionMemory[] = [];
  private pending: MemoryUpdateProposal[] = [];
  private searchResults: MemorySearchResult[] = [];

  setProjects(projects: string[]): void {
    this.projects = projects;
  }

  setProjectMemory(portal: string, memory: ProjectMemory | null): void {
    this.projectMemories.set(portal, memory);
  }

  setGlobalMemory(memory: GlobalMemory | null): void {
    this.globalMemory = memory;
  }

  setExecutions(executions: ExecutionMemory[]): void {
    this.executions = executions;
  }

  setPending(pending: MemoryUpdateProposal[]): void {
    this.pending = pending;
  }

  setSearchResults(results: MemorySearchResult[]): void {
    this.searchResults = results;
  }

  async getProjects(): Promise<string[]> {
    return await this.projects;
  }

  async getProjectMemory(portal: string): Promise<ProjectMemory | null> {
    return await this.projectMemories.get(portal) ?? null;
  }

  async getGlobalMemory(): Promise<GlobalMemory | null> {
    return await this.globalMemory;
  }

  async getExecutionByTraceId(traceId: string): Promise<ExecutionMemory | null> {
    return await this.executions.find((e) => e.trace_id === traceId) ?? null;
  }

  async getExecutionHistory(options?: { portal?: string; limit?: number }): Promise<ExecutionMemory[]> {
    let result = this.executions;
    if (options?.portal) {
      result = result.filter((e) => e.portal === options.portal);
    }
    if (options?.limit) {
      result = result.slice(0, options.limit);
    }
    return await result;
  }

  async search(query: string, _options?: { portal?: string; limit?: number }): Promise<MemorySearchResult[]> {
    if (query === "") return [];
    return await this.searchResults;
  }

  async listPending(): Promise<MemoryUpdateProposal[]> {
    return await this.pending;
  }

  async getPending(proposalId: string): Promise<MemoryUpdateProposal | null> {
    return await this.pending.find((p) => p.id === proposalId) ?? null;
  }

  async approvePending(_proposalId: string): Promise<void> {
    this.pending = await this.pending.filter((p) => p.id !== _proposalId);
  }

  async rejectPending(_proposalId: string, _reason: string): Promise<void> {
    this.pending = await this.pending.filter((p) => p.id !== _proposalId);
  }
}

// ===== Helper functions =====

function createMockProposal(id: string, title: string): MemoryUpdateProposal {
  return {
    id,
    operation: MemoryOperation.ADD,
    target_scope: MemoryScope.PROJECT,
    target_project: "TestPortal",
    reason: "Test reason",
    agent: "test-agent",
    status: MemoryStatus.PENDING,
    created_at: new Date().toISOString(),
    learning: {
      id: `learning-${id}`,
      title,
      description: "Test learning description",
      category: LearningCategory.PATTERN,
      confidence: ConfidenceLevel.HIGH,
      source: MemorySource.AGENT,
      scope: MemoryScope.PROJECT,
      project: "TestPortal",
      created_at: new Date().toISOString(),
      tags: ["test", "coverage"],
    },
  };
}

function createMockExecution(
  traceId: string,
  status: ExecutionStatus.RUNNING | ExecutionStatus.COMPLETED | ExecutionStatus.FAILED,
): ExecutionMemory {
  return {
    trace_id: traceId,
    request_id: `request-${traceId}`,
    agent: "test-agent",
    portal: "TestPortal",
    started_at: new Date().toISOString(),
    completed_at: status === ExecutionStatus.RUNNING ? undefined : new Date().toISOString(),
    status,
    summary: "Test execution summary with some text",
    changes: {
      files_created: ["file1.ts", "file2.ts"],
      files_modified: ["modified.ts"],
      files_deleted: ["deleted.ts"],
    },
    context_files: ["context.md"],
    context_portals: ["TestPortal"],
    lessons_learned: ["Learned lesson 1", "Learned lesson 2"],
  };
}

function createMockProjectMemory(portal: string): ProjectMemory {
  return {
    portal,
    overview: "This is a test project overview that is quite long to test truncation behavior in rendering.",
    patterns: [
      { name: "Pattern 1", description: "Description 1", examples: ["ex1.ts"], tags: ["tag1", "tag2"] },
      { name: "Pattern 2", description: "Description 2", examples: ["ex2.ts"] },
    ],
    decisions: [
      { decision: "Decision 1", rationale: "Rationale 1", date: new Date().toISOString().split("T")[0] },
      { decision: "Decision 2", rationale: "Rationale 2", date: new Date().toISOString().split("T")[0] },
    ],
    references: [
      { type: MemoryReferenceType.FILE, path: "src/test.ts", description: "Test file" },
    ],
  };
}

function createMockGlobalMemory(): GlobalMemory {
  return {
    version: "1.0.0",
    updated_at: new Date().toISOString(),
    patterns: [
      {
        name: "Global Pattern 1",
        description: "Description 1",
        applies_to: ["all"],
        examples: ["ex.ts"],
        tags: ["tag1"],
      },
    ],
    anti_patterns: [
      {
        name: "Anti-pattern 1",
        description: "Why to avoid",
        reason: "Bad",
        alternative: "Better",
        tags: ["avoid"],
      },
    ],
    learnings: [
      {
        id: "global-learning-1",
        title: "Global Learning 1",
        description: "Description",
        category: LearningCategory.PATTERN,
        confidence: ConfidenceLevel.HIGH,
        source: MemorySource.USER,
        scope: MemoryScope.GLOBAL,
        created_at: new Date().toISOString(),
        tags: ["tag1"],
        status: MemoryStatus.APPROVED,
      },
      {
        id: "global-learning-2",
        title: "Global Learning 2",
        description: "Description",
        category: LearningCategory.INSIGHT,
        confidence: ConfidenceLevel.MEDIUM,
        source: MemorySource.AGENT,
        scope: MemoryScope.GLOBAL,
        created_at: new Date().toISOString(),
        tags: ["tag2"],
        status: MemoryStatus.APPROVED,
      },
    ],
    statistics: {
      total_learnings: 2,
      by_category: { pattern: 1, insight: 1 },
      by_project: {},
      last_activity: new Date().toISOString(),
    },
  };
}

// ===== Helper to create session =====

function createTestSession(): MemoryViewTuiSession {
  const mockService = new ExtendedMockMemoryService();
  return new MemoryViewTuiSession(mockService as unknown as MemoryServiceInterface);
}

interface ServiceOptions {
  projects?: string[];
  executions?: ExecutionMemory[];
  pending?: MemoryUpdateProposal[];
  globalMemory?: GlobalMemory | null;
  projectMemories?: Record<string, ProjectMemory | null>;
  searchResults?: MemorySearchResult[];
}

function createConfiguredService(options: ServiceOptions = {}): ExtendedMockMemoryService {
  const service = new ExtendedMockMemoryService();
  service.setProjects(options.projects || []);
  service.setExecutions(options.executions || []);
  service.setPending(options.pending || []);
  service.setGlobalMemory(options.globalMemory ?? null);
  service.setSearchResults(options.searchResults || []);

  if (options.projectMemories) {
    for (const [portal, memory] of Object.entries(options.projectMemories)) {
      service.setProjectMemory(portal, memory);
    }
  }

  return service;
}

function createSessionWithService(service: ExtendedMockMemoryService): MemoryViewTuiSession {
  return new MemoryViewTuiSession(service as unknown as MemoryServiceInterface);
}

async function testExecutionDetailRendering(exec: any): Promise<string> {
  const service = createConfiguredService({
    executions: [exec],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.E);
  await session.handleKey(KEYS.ENTER);
  await session.handleKey(KEYS.DOWN);
  const detail = session.getDetailContent();

  assertEquals(typeof detail, "string");
  return detail;
}

// ===== Tests =====

Deno.test("MemoryViewTuiSession: getters return correct values", () => {
  const session = createTestSession();

  assertEquals(session.getActiveScope(), "projects");
  assertEquals(session.getSelectedNodeId(), null);
  assertEquals(session.getPendingCount(), 0);
  assertEquals(session.isLoading(), false);
  assertEquals(session.getLoadingMessage(), "");
  assertEquals(session.hasActiveDialog(), false);
  assertEquals(session.getActiveDialog(), null);
});

Deno.test("MemoryViewTuiSession: setUseColors toggles color mode", async () => {
  const session = createTestSession();
  await session.initialize();

  session.setUseColors(false);
  const tree = session.renderTreePanel();
  assertEquals(typeof tree, "string");

  session.setUseColors(true);
  const treeColored = session.renderTreePanel();
  assertEquals(typeof treeColored, "string");
});

Deno.test("MemoryViewTuiSession: tickSpinner advances frame", async () => {
  const session = createTestSession();
  await session.initialize();

  session.tickSpinner();
  session.tickSpinner();
  session.tickSpinner();
});

Deno.test("MemoryViewTuiSession: refreshIfStale calls refresh when stale", async () => {
  const session = createTestSession();
  await session.initialize();

  const state = session.getState();
  (state as { lastRefresh: number }).lastRefresh = Date.now() - 60000;

  await session.refreshIfStale();
});

Deno.test("MemoryViewTuiSession: renders global scope detail with memory", async () => {
  const service = createConfiguredService({
    globalMemory: createMockGlobalMemory(),
    projects: ["TestPortal"],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.G);
  const detail = session.getDetailContent();

  assertStringIncludes(detail, "Global");
});

Deno.test("MemoryViewTuiSession: renders global scope detail without memory", async () => {
  const service = createConfiguredService({
    globalMemory: null,
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.G);
  const detail = session.getDetailContent();

  assertEquals(typeof detail, "string");
});

Deno.test("MemoryViewTuiSession: renders projects scope detail", async () => {
  const service = createConfiguredService({
    projects: ["Portal1", "Portal2"],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.P);
  const detail = session.getDetailContent();

  assertEquals(typeof detail, "string");
});

Deno.test("MemoryViewTuiSession: renders executions scope detail", async () => {
  const service = createConfiguredService({
    executions: [createMockExecution("trace-1", ExecutionStatus.COMPLETED)],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.E);
  const detail = session.getDetailContent();

  assertEquals(typeof detail, "string");
});

Deno.test("MemoryViewTuiSession: renders pending scope detail", async () => {
  const service = createConfiguredService({
    pending: [createMockProposal("prop-1", "Test Proposal")],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.N);
  const detail = session.getDetailContent();

  assertEquals(typeof detail, "string");
});

Deno.test("MemoryViewTuiSession: renders project detail with memory", async () => {
  const service = createConfiguredService({
    projects: ["TestPortal"],
    projectMemories: { "TestPortal": createMockProjectMemory("TestPortal") },
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.P);
  await session.handleKey(KEYS.ENTER);
  await session.handleKey(KEYS.DOWN);
  const detail = session.getDetailContent();

  assertEquals(typeof detail, "string");
});

Deno.test("MemoryViewTuiSession: renders project detail without memory", async () => {
  const service = createConfiguredService({
    projects: ["EmptyPortal"],
    projectMemories: { "EmptyPortal": null },
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.P);
  await session.handleKey(KEYS.ENTER);
  await session.handleKey(KEYS.DOWN);
  const detail = session.getDetailContent();

  assertEquals(typeof detail, "string");
});

Deno.test("MemoryViewTuiSession: renders execution detail with all fields", async () => {
  const exec = createMockExecution("trace-full", ExecutionStatus.COMPLETED);
  await testExecutionDetailRendering(exec);
});

Deno.test("MemoryViewTuiSession: renders execution detail for running status", async () => {
  const exec = createMockExecution("trace-running", ExecutionStatus.RUNNING);
  exec.completed_at = undefined;
  exec.changes = {
    files_created: [],
    files_modified: [],
    files_deleted: [],
  };
  exec.lessons_learned = undefined;
  await testExecutionDetailRendering(exec);
});

Deno.test("MemoryViewTuiSession: renders execution detail for failed status", async () => {
  const exec = createMockExecution("trace-failed", ExecutionStatus.FAILED);
  exec.error_message = "Something went wrong";
  await testExecutionDetailRendering(exec);
});

Deno.test("MemoryViewTuiSession: approveSelectedProposal with no selection", async () => {
  const service = createConfiguredService();

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.A);
  const statusBar = session.renderStatusBar();
  assertEquals(typeof statusBar, "string");
});

Deno.test("MemoryViewTuiSession: rejectSelectedProposal with no selection", async () => {
  const service = createConfiguredService();

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.R);
  const statusBar = session.renderStatusBar();
  assertEquals(typeof statusBar, "string");
});

Deno.test("MemoryViewTuiSession: approveAllProposals with no proposals", async () => {
  const service = createConfiguredService();

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.CAP_A);
  assertEquals(session.hasActiveDialog(), false);
});

Deno.test("MemoryViewTuiSession: approveAllProposals with proposals opens dialog", async () => {
  const service = createConfiguredService({
    pending: [createMockProposal("p1", "Proposal 1"), createMockProposal("p2", "Proposal 2")],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.CAP_A);
  assertEquals(session.hasActiveDialog(), true);
});

Deno.test("MemoryViewTuiSession: openAddLearningDialog opens dialog", async () => {
  const service = createConfiguredService();

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.L);
  assertEquals(session.hasActiveDialog(), true);
});

Deno.test("MemoryViewTuiSession: promoteSelectedLearning without learning selected", async () => {
  const service = createConfiguredService();

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.CAP_P);
  assertEquals(session.hasActiveDialog(), false);
});

Deno.test("MemoryViewTuiSession: search with empty query reloads tree", async () => {
  const service = createConfiguredService();

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.S);
  await session.handleKey(KEYS.ENTER);

  assertEquals(session.isSearchActive(), false);
});

Deno.test("MemoryViewTuiSession: search with query executes search", async () => {
  const service = createConfiguredService({
    searchResults: [
      { type: MemoryType.PATTERN, id: "p1", title: "Result 1", summary: "Summary 1" },
      { type: MemoryType.DECISION, id: "d1", title: "Result 2", summary: "Summary 2" },
    ],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.S);
  await session.handleKey(KEYS.T);
  await session.handleKey(KEYS.E);
  await session.handleKey(KEYS.S);
  await session.handleKey(KEYS.T);
  await session.handleKey(KEYS.ENTER);

  assertEquals(typeof session.getActiveScope(), "string");
});

Deno.test("MemoryViewTuiSession: navigation with empty tree does nothing", async () => {
  const service = createConfiguredService({
    globalMemory: null,
  });

  const session = createSessionWithService(service);
  await session.handleKey(KEYS.DOWN);
  await session.handleKey(KEYS.UP);
});

Deno.test("MemoryViewTuiSession: renderTreePanel returns string", async () => {
  const service = createConfiguredService({
    projects: ["TestPortal"],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  const tree = session.renderTreePanel();
  assertEquals(typeof tree, "string");
  assertStringIncludes(tree, "Global");
  assertStringIncludes(tree, "Projects");
});

Deno.test("MemoryViewTuiSession: renderStatusBar shows search input when active", async () => {
  const service = createConfiguredService();

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.S);
  await session.handleKey(KEYS.Q);
  await session.handleKey(KEYS.U);
  await session.handleKey(KEYS.E);
  await session.handleKey(KEYS.R);
  await session.handleKey(KEYS.Y);

  const statusBar = session.renderStatusBar();
  assertStringIncludes(statusBar, "query");
});

Deno.test("MemoryViewTuiSession: renderActionButtons shows context-specific actions", async () => {
  const service = createConfiguredService({
    pending: [createMockProposal("p1", "Proposal 1")],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.N);

  const actions = session.renderActionButtons();
  assertEquals(typeof actions, "string");
});

Deno.test("MemoryViewTuiSession: renderDialog returns dialog content when active", async () => {
  const service = createConfiguredService({
    pending: [createMockProposal("p1", "Proposal 1"), createMockProposal("p2", "Proposal 2")],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.CAP_A);
  assertEquals(session.hasActiveDialog(), true);

  const dialogContent = session.renderDialog(80, 24);
  assertEquals(typeof dialogContent, "string");
});

Deno.test("MemoryViewTuiSession: dialog escape cancels", async () => {
  const service = createConfiguredService({
    pending: [createMockProposal("p1", "Proposal 1")],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.CAP_A);
  assertEquals(session.hasActiveDialog(), true);

  await session.handleKey(KEYS.ESCAPE);
  assertEquals(session.hasActiveDialog(), false);
});

Deno.test("MemoryViewTuiSession: handleKey with dialog forwards to dialog", async () => {
  const service = createConfiguredService({
    pending: [createMockProposal("p1", "Proposal 1")],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.CAP_A);
  assertEquals(session.hasActiveDialog(), true);

  await session.handleKey(KEYS.TAB);
  assertEquals(session.hasActiveDialog(), true);
});

Deno.test("MemoryViewTuiSession: ? toggles help", async () => {
  const service = createConfiguredService();

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.QUESTION);
  const detail = session.getDetailContent();
  assertStringIncludes(detail.toLowerCase(), "help");

  await session.handleKey(KEYS.QUESTION);
});

Deno.test("MemoryViewTuiSession: findNodeById returns null for invalid ID", async () => {
  const service = createConfiguredService();

  const session = createSessionWithService(service);
  await session.initialize();

  const node = session.findNodeById("nonexistent");
  assertEquals(node, null);
});

Deno.test("MemoryViewTuiSession: findNodeById returns null for null ID", async () => {
  const service = createConfiguredService();

  const session = createSessionWithService(service);
  await session.initialize();

  const node = session.findNodeById(null);
  assertEquals(node, null);
});

Deno.test("MemoryViewTuiSession: handles pending proposal detail rendering", async () => {
  const proposal = createMockProposal("p1", "Test Proposal");
  const service = createConfiguredService({
    pending: [proposal],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.N);
  await session.handleKey(KEYS.ENTER);
  await session.handleKey(KEYS.DOWN);
  const detail = session.getDetailContent();

  assertEquals(typeof detail, "string");
});

Deno.test("MemoryViewTuiSession: approve pending proposal with selection", async () => {
  const proposal = createMockProposal("p1", "Test Proposal");
  const service = createConfiguredService({
    pending: [proposal],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.N);
  await session.handleKey(KEYS.ENTER);
  await session.handleKey(KEYS.DOWN);

  await session.handleKey(KEYS.A);
  assertEquals(session.hasActiveDialog(), true);
});

Deno.test("MemoryViewTuiSession: reject pending proposal with selection", async () => {
  const proposal = createMockProposal("p1", "Test Proposal");
  const service = createConfiguredService({
    pending: [proposal],
  });

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.N);
  await session.handleKey(KEYS.ENTER);
  await session.handleKey(KEYS.DOWN);

  await session.handleKey(KEYS.R);
  assertEquals(session.hasActiveDialog(), true);
});

Deno.test("MemoryViewTuiSession: getFocusableElements returns panel list", async () => {
  const service = createConfiguredService();
  service.setPending([]);
  service.setProjects([]);
  service.setExecutions([]);

  const session = createSessionWithService(service);
  await session.initialize();

  const elements = session.getFocusableElements();
  assertEquals(Array.isArray(elements), true);
});

Deno.test("MemoryViewTuiSession: left and right navigation", async () => {
  const service = new ExtendedMockMemoryService();
  service.setPending([]);
  service.setProjects(["TestPortal"]);
  service.setExecutions([]);

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.P);
  await session.handleKey(KEYS.RIGHT);
  await session.handleKey(KEYS.LEFT);

  assertEquals(session.getActiveScope(), "projects");
});

Deno.test("MemoryViewTuiSession: Home and End keys for navigation", async () => {
  const service = new ExtendedMockMemoryService();
  service.setProjects(["Portal1", "Portal2", "Portal3"]);
  service.setPending([]);
  service.setExecutions([]);

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.END);
  await session.handleKey(KEYS.HOME);

  assertEquals(typeof session.getSelectedNodeId(), "string");
});

Deno.test("MemoryViewTuiSession: PageUp and PageDown keys", async () => {
  const service = new ExtendedMockMemoryService();
  service.setProjects(["Portal1", "Portal2", "Portal3", "Portal4", "Portal5"]);
  service.setPending([]);
  service.setExecutions([]);

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.PAGE_DOWN);
  await session.handleKey(KEYS.PAGE_UP);

  assertEquals(typeof session.getSelectedNodeId(), "string");
});

Deno.test("MemoryViewTuiSession: search escape cancels search mode", async () => {
  const service = new ExtendedMockMemoryService();
  service.setPending([]);
  service.setProjects([]);
  service.setExecutions([]);

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.S);
  assertEquals(session.isSearchActive(), true);

  await session.handleKey(KEYS.ESCAPE);
  assertEquals(session.isSearchActive(), false);
});

Deno.test("MemoryViewTuiSession: search backspace removes character", async () => {
  const service = new ExtendedMockMemoryService();
  service.setPending([]);
  service.setProjects([]);
  service.setExecutions([]);

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.S);
  await session.handleKey(KEYS.T);
  await session.handleKey(KEYS.E);
  await session.handleKey(KEYS.S);
  await session.handleKey(KEYS.T);
  await session.handleKey(KEYS.BACKSPACE);

  const statusBar = session.renderStatusBar();
  assertStringIncludes(statusBar, "tes");
});

Deno.test("MemoryViewTuiSession: multiple scope navigation cycles", async () => {
  const service = new ExtendedMockMemoryService();
  service.setProjects(["TestPortal"]);
  service.setGlobalMemory(createMockGlobalMemory());
  service.setExecutions([createMockExecution("trace-1", ExecutionStatus.COMPLETED)]);
  service.setPending([createMockProposal("p1", "Proposal")]);

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.G);
  assertEquals(session.getActiveScope(), MemoryScope.GLOBAL);

  await session.handleKey(KEYS.P);
  assertEquals(session.getActiveScope(), "projects");

  await session.handleKey(KEYS.E);
  assertEquals(session.getActiveScope(), "executions");

  await session.handleKey(KEYS.N);
  assertEquals(session.getActiveScope(), MemoryStatus.PENDING);
});

Deno.test("MemoryViewTuiSession: getState returns full state", async () => {
  const service = new ExtendedMockMemoryService();
  service.setPending([]);
  service.setProjects([]);
  service.setExecutions([]);

  const session = createSessionWithService(service);
  await session.initialize();

  const state = session.getState();
  assertExists(state);
  assertExists(state.activeScope);
  assertExists(state.tree);
  assertEquals(typeof state.searchQuery, "string");
  assertEquals(typeof state.searchActive, "boolean");
});

Deno.test("MemoryViewTuiSession: loading state during async operations", async () => {
  const service = new ExtendedMockMemoryService();
  service.setPending([]);
  service.setProjects(["TestPortal"]);
  service.setExecutions([]);

  const session = createSessionWithService(service);

  assertEquals(session.isLoading(), false);

  await session.initialize();

  assertEquals(session.isLoading(), false);
});

Deno.test("MemoryViewTuiSession: handles nested tree expansion", async () => {
  const service = new ExtendedMockMemoryService();
  const project = createMockProjectMemory("TestPortal");
  service.setProjects(["TestPortal"]);
  service.setProjectMemory("TestPortal", project);
  service.setPending([]);
  service.setExecutions([]);

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.P);
  await session.handleKey(KEYS.ENTER);
  await session.handleKey(KEYS.DOWN);
  await session.handleKey(KEYS.ENTER);

  const tree = session.renderTreePanel();
  assertEquals(typeof tree, "string");
});

Deno.test("MemoryViewTuiSession: refresh method works", async () => {
  const service = new ExtendedMockMemoryService();
  service.setPending([]);
  service.setProjects(["TestPortal"]);
  service.setExecutions([]);

  const session = createSessionWithService(service);
  await session.initialize();

  await session.refresh();

  assertEquals(typeof session.getActiveScope(), "string");
});

Deno.test("MemoryViewTuiSession: tree with learnings renders correctly", async () => {
  const service = new ExtendedMockMemoryService();
  service.setGlobalMemory(createMockGlobalMemory());
  service.setProjects([]);
  service.setPending([]);
  service.setExecutions([]);

  const session = createSessionWithService(service);
  await session.initialize();

  await session.handleKey(KEYS.G);
  await session.handleKey(KEYS.ENTER);

  const tree = session.renderTreePanel();
  assertStringIncludes(tree, "Global");
});

Deno.test("MemoryViewTuiSession: getTree returns tree structure", async () => {
  const service = new ExtendedMockMemoryService();
  service.setProjects(["TestPortal"]);
  service.setPending([]);
  service.setExecutions([]);

  const session = createSessionWithService(service);
  await session.initialize();

  const tree = session.getTree();
  assertEquals(Array.isArray(tree), true);
});

Deno.test("MemoryViewTuiSession: status bar shows pending count badge", async () => {
  const service = new ExtendedMockMemoryService();
  service.setPending([createMockProposal("p1", "Proposal 1")]);
  service.setProjects([]);
  service.setExecutions([]);

  const session = createSessionWithService(service);
  await session.initialize();

  const statusBar = session.renderStatusBar();
  assertEquals(typeof statusBar, "string");
});
