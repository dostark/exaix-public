import { Request } from "../../src/tui/request_manager_view.ts";
import { ExecutionStatus, MemorySource, MemoryStatus, PlanStatus, SkillStatus } from "../../src/enums.ts";
import { LegacyRequestManagerTuiSession, RequestManagerView } from "../../src/tui/request_manager_view.ts";

import { PortalManagerView } from "../../src/tui/portal_manager_view.ts";
import { MonitorView } from "../../src/tui/monitor_view.ts";
import { MinimalPlanServiceMock, PlanReviewerTuiSession } from "../../src/tui/plan_reviewer_view.ts";

export function sampleRequest(overrides: Record<string, any> = {}): Request {
  return {
    trace_id: overrides.trace_id ?? `req-${Math.floor(Math.random() * 1e6)}`,
    filename: overrides.filename ?? "request.md",
    title: overrides.title ?? "Request",
    status: overrides.status ?? MemoryStatus.PENDING,
    priority: overrides.priority ?? "normal",
    agent: overrides.agent ?? "default",
    created: overrides.created ?? new Date().toISOString(),
    created_by: overrides.created_by ?? "test@example.com",
    source: overrides.source ?? "cli",
    ...overrides,
  } as Request;
}

export function sampleRequests(arr: Array<Record<string, any>>): Request[] {
  return arr.map((a) => sampleRequest(a));
}

export function sampleTestRequests() {
  return sampleRequests([
    {
      trace_id: "req-1",
      filename: "request-1.md",
      title: "Request 1",
      status: MemoryStatus.PENDING,
      priority: "normal",
      agent: "default",
      created: "2025-12-23T10:00:00Z",
      created_by: "test@example.com",
      source: "cli",
    },
    {
      trace_id: "req-2",
      filename: "request-2.md",
      title: "Request 2",
      status: ExecutionStatus.COMPLETED,
      priority: "high",
      agent: "other",
      created: "2025-12-23T11:00:00Z",
      created_by: "test@example.com",
      source: "cli",
    },
  ]);
}

export function sampleBasicRequest() {
  return sampleRequests([
    {
      trace_id: "req-1",
      title: "Request 1",
    },
  ]);
}

export function sampleTwoRequests() {
  return sampleRequests([
    {
      trace_id: "req-1",
      title: "Request 1",
    },
    {
      trace_id: "req-2",
      title: "Request 2",
    },
  ]);
}

export function sampleGroupedRequests() {
  return sampleRequests([
    {
      trace_id: "req-1",
      title: "Request 1",
    },
    {
      trace_id: "req-2",
      title: "Request 2",
      status: ExecutionStatus.COMPLETED,
      priority: "high",
      agent: "other",
    },
  ]);
}

export function sampleNewRequest() {
  return sampleRequests([
    {
      trace_id: "new-req",
      title: "New Request",
    },
  ]);
}

// -------------------------
// Plan reviewer helpers
// -------------------------
export function sampleBasicPlans() {
  return [
    { id: "plan1", title: "Plan 1" },
    { id: "plan2", title: "Plan 2" },
    { id: "plan3", title: "Plan 3" },
  ];
}

export function sampleSinglePlan() {
  return [
    { id: "plan1", title: "Plan 1" },
  ];
}

export function samplePlansWithStatuses() {
  return [
    { id: "p1", title: "Plan 1", status: PlanStatus.REVIEW },
    { id: "p2", title: "Plan 2", status: PlanStatus.APPROVED },
    { id: "p3", title: "Plan 3", status: PlanStatus.REJECTED },
  ];
}

export function samplePendingPlans() {
  return [
    { id: "p1", title: "Plan 1", status: PlanStatus.REVIEW },
    { id: "p2", title: "Plan 2", status: PlanStatus.REVIEW },
  ];
}

export function createMockRequestService(initial: Array<Record<string, any>> = []) {
  class MockRequestService {
    requests: any[];
    constructor(requests: any[] = []) {
      this.requests = requests;
    }
    listRequests(status?: string) {
      if (status) {
        return Promise.resolve(this.requests.filter((r) => r.status === status));
      }
      return Promise.resolve(this.requests);
    }
    getRequestContent(id: string) {
      const request = this.requests.find((r) => r.trace_id === id);
      return Promise.resolve(request ? `Content for ${id}` : "");
    }
    createRequest(_description: string, options?: any) {
      const newRequest = {
        trace_id: `test-${Date.now()}`,
        filename: `request-test.md`,
        title: `Request test`,
        status: MemoryStatus.PENDING,
        priority: options?.priority || "normal",
        agent: options?.agent || "default",
        portal: options?.portal,
        model: options?.model,
        created: new Date().toISOString(),
        created_by: "test@example.com",
        source: "cli",
      };
      this.requests.push(newRequest);
      return Promise.resolve(newRequest);
    }
    updateRequestStatus(id: string, status: string) {
      const request = this.requests.find((r) => r.trace_id === id);
      if (request) {
        request.status = status;
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }
  }

  return new MockRequestService(initial);
}

export function createViewWithRequests(arr: Array<Record<string, any>> = []) {
  const service = createMockRequestService(sampleRequests(arr));
  const view = new RequestManagerView(service);
  return { service, view };
}

export function createTuiWithRequests(arr: Array<Record<string, any>> = []) {
  const { service, view } = createViewWithRequests(arr);
  const requests = sampleRequests(arr);
  const tui = view.createTuiSession(requests);
  return { service, view, tui };
}

// -------------------------
// Log entry helpers (for MonitorView tests)
// -------------------------
let logIdCounter = 1;

export function sampleLogEntry(overrides: Record<string, unknown> = {}) {
  const id = overrides.id ?? String(logIdCounter++);
  return {
    id,
    trace_id: overrides.trace_id ?? `trace-${id}`,
    actor: overrides.actor ?? MemorySource.AGENT,
    agent_id: overrides.agent_id ?? "default",
    action_type: overrides.action_type ?? "request_created",
    target: overrides.target ?? "Workspace/Requests/test.md",
    payload: overrides.payload ?? {},
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    ...overrides,
  };
}

export function sampleLogEntries(arr: Array<Record<string, unknown>>) {
  return arr.map((a) => sampleLogEntry(a));
}

/** Convenience: create two logs with different agents for filter tests */
export function createTwoAgentLogs() {
  return sampleLogEntries([
    { agent_id: "researcher", action_type: "request_created" },
    { agent_id: "architect", action_type: "plan_approved", target: "Workspace/Plans/test.md" },
  ]);
}

/** Convenience: create two logs with different action types for filter tests */
export function createTwoActionLogs() {
  return sampleLogEntries([
    { action_type: "request_created" },
    { action_type: "plan_approved" },
  ]);
}

/** Convenience: create basic monitor test logs */
export function sampleMonitorLogs() {
  return sampleLogEntries([
    {
      id: "1",
      trace_id: "t1",
      actor: MemorySource.USER,
      agent_id: "a1",
      action_type: "request_created",
      target: "target.md",
      payload: {},
      timestamp: "2025-12-22T10:00:00Z",
    },
    {
      id: "2",
      trace_id: "t2",
      actor: MemorySource.USER,
      agent_id: "a2",
      action_type: "plan.approved",
      target: "target2.md",
      payload: {},
      timestamp: "2025-12-22T10:01:00Z",
    },
  ]);
}

/** Convenience: create single monitor test log */
export function sampleSingleMonitorLog() {
  return sampleLogEntries([
    {
      id: "1",
      trace_id: "t1",
      actor: MemorySource.USER,
      agent_id: "a1",
      action_type: "request_created",
      target: "target.md",
      payload: { data: "test" },
      timestamp: "2025-12-22T10:00:00Z",
    },
  ]);
}

// -------------------------
// Portal helpers
// -------------------------
export function samplePortal(overrides: Record<string, any> = {}) {
  return {
    alias: overrides.alias ?? `Portal-${Math.floor(Math.random() * 1e6)}`,
    status: overrides.status ?? SkillStatus.ACTIVE,
    targetPath: overrides.targetPath ?? "/Portals/Main",
    symlinkPath: overrides.symlinkPath ?? "",
    contextCardPath: overrides.contextCardPath ?? "",
    ...overrides,
  };
}

export function samplePortals(arr: Array<Record<string, any>>) {
  return arr.map((a) => samplePortal(a));
}

export function createMockPortalService(initial: Array<Record<string, any>> = []) {
  class MockPortalService {
    portals: any[];
    actions: any[];
    constructor(portals: any[] = []) {
      this.portals = portals;
      this.actions = [];
    }
    listPortals() {
      return Promise.resolve(this.portals);
    }
    openPortal(id: string) {
      if (!this.portals.find((p: any) => p.alias === id)) throw new Error("Portal not found");
      this.actions.push({ type: "open", id });
      return Promise.resolve(true);
    }
    closePortal(id: string) {
      if (!this.portals.find((p: any) => p.alias === id)) throw new Error("Portal not found");
      this.actions.push({ type: "close", id });
      return Promise.resolve(true);
    }
    refreshPortal(id: string) {
      if (!this.portals.find((p: any) => p.alias === id)) throw new Error("Portal not found");
      this.actions.push({ type: "refresh", id });
      return Promise.resolve(true);
    }
    removePortal(id: string) {
      if (!this.portals.find((p: any) => p.alias === id)) throw new Error("Portal not found");
      this.actions.push({ type: "remove", id });
      return Promise.resolve(true);
    }
    getPortalDetails(alias: string) {
      return Promise.resolve(this.portals.find((p: any) => p.alias === alias));
    }
    quickJumpToPortalDir(alias: string) {
      return Promise.resolve(this.portals.find((p: any) => p.alias === alias)?.targetPath ?? "");
    }
    getPortalFilesystemPath(alias: string) {
      return Promise.resolve(this.portals.find((p: any) => p.alias === alias)?.targetPath ?? "");
    }
    getPortalActivityLog(_id: string) {
      return [
        `2025-12-22T12:00:00Z: Portal ${_id} started`,
        `2025-12-22T12:05:00Z: No errors reported`,
      ];
    }
  }

  return new MockPortalService(initial);
}

export function createPortalViewWithPortals(arr: Array<Record<string, any>> = []) {
  const service = createMockPortalService(samplePortals(arr));
  const view = new PortalManagerView(service);
  return { service, view };
}

export function createPortalTuiWithPortals(arr: Array<Record<string, any>> = []) {
  const { service, view } = createPortalViewWithPortals(arr);
  // Pass the service's array reference so tests that mutate the service.portals array are reflected in the TUI session
  const tui = view.createTuiSession(service.portals);
  return { service, view, tui };
}

// -------------------------
// Monitor helpers
// -------------------------
export function createMockDatabaseService(initialLogs: Array<Record<string, any>> = []) {
  class MockDatabaseService {
    private logs: Array<any>;
    constructor(logs: Array<any> = []) {
      this.logs = logs;
    }
    queryActivity(filter: any) {
      let filtered = this.logs;
      if (filter.agentId) {
        filtered = filtered.filter((l) => l.agent_id === filter.agentId);
      }
      if (filter.actionType) {
        filtered = filtered.filter((l) => l.action_type === filter.actionType);
      }
      if (filter.traceId) {
        filtered = filtered.filter((l) => l.trace_id === filter.traceId);
      }
      if (filter.since) {
        filtered = filtered.filter((l) => l.timestamp > filter.since);
      }
      return Promise.resolve(filtered);
    }

    getRecentActivity(limit: number = 100) {
      return Promise.resolve(this.logs.slice(-limit).reverse());
    }
    addLog(log: any) {
      this.logs.push(log);
    }
  }
  return new MockDatabaseService(initialLogs);
}

export function createMonitorViewWithLogs(arr: Array<Record<string, any>> = []) {
  const db = createMockDatabaseService(arr);
  const monitorView = new MonitorView(db as unknown as any);
  // For testing, synchronously set the logs since constructor doesn't await
  monitorView["logs"] = arr.map((log): any => ({
    ...log,
    payload: typeof log.payload === "string" ? JSON.parse(log.payload) : log.payload,
  }));
  return { db, monitorView };
}

// -------------------------
// Plan reviewer helpers
// -------------------------
export function createPlanReviewerSession(plans: Array<Record<string, any>> = []) {
  const mock = new MinimalPlanServiceMock();
  const session = new PlanReviewerTuiSession(plans as unknown as any, mock);
  return { mock, session };
}

// -------------------------
// Tree view helpers
// -------------------------
import type { TreeNode } from "../../src/tui/utils/tree_view.ts";

export function createTestTree(): TreeNode[] {
  return [
    {
      id: "root1",
      label: "Root 1",
      type: "root",
      expanded: true,
      children: [
        {
          id: "child1-1",
          label: "Child 1.1",
          type: "item",
          expanded: false,
          children: [],
        },
        {
          id: "child1-2",
          label: "Child 1.2",
          type: "item",
          expanded: true,
          children: [
            {
              id: "grandchild1-2-1",
              label: "Grandchild 1.2.1",
              type: "leaf",
              expanded: false,
              children: [],
            },
          ],
        },
      ],
    },
    {
      id: "root2",
      label: "Root 2",
      type: "root",
      expanded: false,
      children: [
        {
          id: "child2-1",
          label: "Child 2.1",
          type: "item",
          expanded: false,
          children: [],
        },
      ],
    },
  ];
}

export function createLargeTestTree(depth: number = 3, breadth: number = 5): TreeNode[] {
  function createLevel(currentDepth: number, prefix: string): TreeNode[] {
    if (currentDepth >= depth) return [];

    const nodes: TreeNode[] = [];
    for (let i = 0; i < breadth; i++) {
      const id = `${prefix}${i}`;
      nodes.push({
        id,
        label: `Node ${id}`,
        type: currentDepth === 0 ? "root" : "item",
        expanded: currentDepth === 0,
        children: createLevel(currentDepth + 1, `${id}-`),
      });
    }
    return nodes;
  }

  return createLevel(0, "node-");
}

// -------------------------
// Key simulation helpers
// -------------------------
export async function simulateKeySequence(
  handler: (key: string) => void | Promise<void>,
  keys: string[],
  delayMs: number = 0,
): Promise<void> {
  for (const key of keys) {
    await handler(key);
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export function typeString(text: string): string[] {
  return text.split("");
}

// -------------------------
// Render assertion helpers
// -------------------------
export function getVisibleText(lines: string[]): string[] {
  // Strip ANSI codes for easier assertions
  // deno-lint-ignore no-control-regex
  const ansiRegex = /\x1b\[[0-9;]*m/g;
  return lines.map((line) => line.replace(ansiRegex, ""));
}

export function findLineContaining(lines: string[], text: string): number {
  const visibleLines = getVisibleText(lines);
  return visibleLines.findIndex((line) => line.includes(text));
}

export function hasLineContaining(lines: string[], text: string): boolean {
  return findLineContaining(lines, text) !== -1;
}

export function countLinesContaining(lines: string[], text: string): number {
  const visibleLines = getVisibleText(lines);
  return visibleLines.filter((line) => line.includes(text)).length;
}

// -------------------------
// Legacy request manager helpers
// -------------------------
export function createLegacyMockRequestService() {
  return {
    listRequests: () => Promise.resolve([]),
    getRequestContent: () => Promise.resolve(""),
    createRequest: () => Promise.resolve({} as any),
    updateRequestStatus: () => Promise.resolve(true),
  };
}

export function createLegacyTuiSession(requests: any[] = []) {
  const mockService = createLegacyMockRequestService();
  return new LegacyRequestManagerTuiSession(requests, mockService);
}

export function createLegacyTuiSessionWithTracking() {
  let createCalled = false;
  let viewCalled = false;
  let deleteCalled = false;

  const mockService = {
    listRequests: () => Promise.resolve([]),
    getRequestContent: (_id: string) => {
      viewCalled = true;
      return Promise.resolve("content");
    },
    createRequest: () => {
      createCalled = true;
      return Promise.resolve({
        trace_id: "new-req",
        filename: "request-new.md",
        title: "New Request",
        status: MemoryStatus.PENDING,
        priority: "normal",
        agent: "default",
        created: new Date().toISOString(),
        created_by: "test@example.com",
        source: "cli",
      } as any);
    },
    updateRequestStatus: () => {
      deleteCalled = true;
      return Promise.resolve(true);
    },
  };

  const requests = sampleTestRequests();
  const session = new LegacyRequestManagerTuiSession(requests, mockService);

  return { session, createCalled: () => createCalled, viewCalled: () => viewCalled, deleteCalled: () => deleteCalled };
}

export function createLegacyTuiSessionWithLongTraceId() {
  const mockService = {
    listRequests: () => Promise.resolve([]),
    getRequestContent: () => Promise.resolve(""),
    createRequest: () =>
      Promise.resolve({
        trace_id: "12345678-abcd-efgh-ijkl-mnopqrstuvwx",
      } as any),
    updateRequestStatus: () => Promise.resolve(true),
  };

  const requests = sampleTestRequests();
  return new LegacyRequestManagerTuiSession(requests, mockService);
}

export function createLegacyTuiSessionWithErrors() {
  const mockService = {
    listRequests: () => Promise.resolve([]),
    getRequestContent: () => Promise.reject(new Error("View error")),
    createRequest: () => Promise.reject(new Error("Create error")),
    updateRequestStatus: () => Promise.reject(new Error("Delete error")),
  };

  const requests = sampleTestRequests();
  return new LegacyRequestManagerTuiSession(requests, mockService);
}

// -------------------------
// Dialog test helpers
// -------------------------
export function createMockDialogRenderOptions(width: number = 60, height: number = 20) {
  return {
    useColors: false,
    width,
    height,
  };
}

// -------------------------
// Skills Manager helpers
// -------------------------
import { MinimalSkillsServiceMock, SkillsManagerView, type SkillSummary } from "../../src/tui/skills_manager_view.ts";
import { EvaluationCategory, MemoryScope } from "../../src/enums.ts";

// Re-export enums for use by test files
export { EvaluationCategory, MemoryScope };

export function sampleSkill(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? `skill-${Math.floor(Math.random() * 1e6)}`,
    name: overrides.name ?? "Test Skill",
    version: overrides.version ?? "1.0.0",
    status: overrides.status ?? SkillStatus.ACTIVE,
    source: overrides.source ?? MemorySource.CORE,
    description: overrides.description ?? "Test skill description",
    triggers: overrides.triggers ?? {
      keywords: ["test"],
    },
    instructions: overrides.instructions ?? "Test instructions",
    ...overrides,
  };
}

export function sampleSkills(arr: Array<Record<string, any>>) {
  return arr.map((a) => sampleSkill(a));
}

export function sampleTestSkills(): SkillSummary[] {
  return sampleSkills([
    {
      id: "tdd-methodology",
      name: "TDD Methodology",
      version: "1.0.0",
      status: SkillStatus.ACTIVE,
      source: MemorySource.CORE,
      description: "Test-Driven Development methodology",
      triggers: {
        keywords: ["tdd", "test-first"],
        taskTypes: ["testing"],
        filePatterns: ["*_test.ts"],
      },
      instructions: "Write failing test first, then implement.\nRepeat until done.\nRefactor as needed.",
    },
    {
      id: "security-first",
      name: "Security First",
      version: "1.0.0",
      status: SkillStatus.ACTIVE,
      source: MemorySource.CORE,
      description: "Security-focused development",
      triggers: {
        keywords: [EvaluationCategory.SECURITY, "auth"],
      },
    },
    {
      id: "project-conventions",
      name: "Project Conventions",
      version: "1.0.0",
      status: SkillStatus.ACTIVE,
      source: MemoryScope.PROJECT,
    },
    {
      id: "learned-pattern",
      name: "Learned Pattern",
      version: "1.0.0",
      status: SkillStatus.DRAFT,
      source: MemorySource.LEARNED,
    },
    {
      id: "deprecated-skill",
      name: "Deprecated Skill",
      version: "0.5.0",
      status: SkillStatus.DEPRECATED,
      source: MemoryScope.PROJECT,
    },
  ]);
}

export function createTestSkills(): SkillSummary[] {
  return sampleTestSkills();
}

export function createMockSkillsService(initial: Array<Record<string, any>> = []) {
  return new MinimalSkillsServiceMock(sampleSkills(initial));
}

export function createSkillsManagerViewWithMock(skills: SkillSummary[] = sampleTestSkills()) {
  const service = new MinimalSkillsServiceMock(skills);
  const view = new SkillsManagerView(service);
  return { service, view };
}

export function createSkillsManagerTuiSession(skills: SkillSummary[] = sampleTestSkills()) {
  const { service, view } = createSkillsManagerViewWithMock(skills);
  const session = view.createTuiSession(false);
  return { service, view, session };
}

// ===== Memory Service Mock =====

import type { MemoryServiceInterface } from "../../src/tui/memory_view.ts";
import type { MemoryUpdateProposal } from "../../src/schemas/memory_bank.ts";

export class MinimalMemoryServiceMock implements MemoryServiceInterface {
  proposals: MemoryUpdateProposal[] = [];
  approvedCount = 0;

  constructor(proposals: MemoryUpdateProposal[] = []) {
    this.proposals = proposals;
  }

  getProjects(): Promise<string[]> {
    return Promise.resolve(["default"]);
  }

  getProjectMemory(_portal: string): Promise<any> {
    return Promise.resolve(null);
  }

  getGlobalMemory(): Promise<any> {
    return Promise.resolve(null);
  }

  getExecutionByTraceId(_traceId: string): Promise<any> {
    return Promise.resolve(null);
  }

  getExecutionHistory(_options?: { portal?: string; limit?: number }): Promise<any[]> {
    return Promise.resolve([]);
  }

  search(_query: string, _options?: { portal?: string; limit?: number }): Promise<any[]> {
    return Promise.resolve([]);
  }

  listPending(): Promise<MemoryUpdateProposal[]> {
    return Promise.resolve(this.proposals);
  }

  getPending(proposalId: string): Promise<MemoryUpdateProposal | null> {
    return Promise.resolve(
      this.proposals.find((p) => p.id === proposalId) ?? null,
    );
  }

  approvePending(proposalId: string): Promise<void> {
    this.proposals = this.proposals.filter((p) => p.id !== proposalId);
    this.approvedCount++;
    return Promise.resolve();
  }

  rejectPending(proposalId: string, _reason: string): Promise<void> {
    this.proposals = this.proposals.filter((p) => p.id !== proposalId);
    return Promise.resolve();
  }

  getApprovedCount(): number {
    return this.approvedCount;
  }
}

// -------------------------
// Memory View helpers
// -------------------------
import { MemoryViewTuiSession } from "../../src/tui/memory_view.ts";
import { ConfidenceLevel, LearningCategory, MemoryOperation, MemoryReferenceType } from "../../src/enums.ts";

export function createMockProposals(): MemoryUpdateProposal[] {
  return [
    {
      id: "proposal-1",
      agent: "test-agent",
      operation: MemoryOperation.ADD,
      learning: {
        id: "learning-1",
        title: "Error Handling Pattern",
        category: LearningCategory.PATTERN,
        description: "Use try-catch for all async functions",
        confidence: ConfidenceLevel.HIGH,
        tags: ["error-handling"],
        source: MemorySource.AGENT,
        scope: MemoryScope.PROJECT,
        created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      },
      target_scope: MemoryScope.PROJECT,
      target_project: "my-app",
      reason: "Extracted from execution",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      status: MemoryStatus.PENDING,
    },
    {
      id: "proposal-2",
      agent: "test-agent",
      operation: MemoryOperation.ADD,
      learning: {
        id: "learning-2",
        title: "API Rate Limiting",
        category: LearningCategory.DECISION,
        description: "Implement rate limiting for all API endpoints",
        confidence: ConfidenceLevel.MEDIUM,
        tags: [MemoryReferenceType.API, EvaluationCategory.SECURITY],
        source: MemorySource.AGENT,
        scope: MemoryScope.GLOBAL,
        created_at: new Date(Date.now() - 18000000).toISOString(), // 5 hours ago
      },
      target_scope: MemoryScope.GLOBAL,
      reason: "Common pattern across projects",
      created_at: new Date(Date.now() - 18000000).toISOString(),
      status: MemoryStatus.PENDING,
    },
    {
      id: "proposal-3",
      agent: "test-agent",
      operation: MemoryOperation.ADD,
      learning: {
        id: "learning-3",
        title: "Database Connection Issue",
        category: LearningCategory.TROUBLESHOOTING,
        description: "Connection timeout solutions",
        confidence: ConfidenceLevel.HIGH,
        tags: ["database"],
        source: MemorySource.EXECUTION,
        scope: MemoryScope.PROJECT,
        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      },
      target_scope: MemoryScope.PROJECT,
      target_project: "api-service",
      reason: "Documented troubleshooting steps",
      created_at: new Date(Date.now() - 86400000).toISOString(),
      status: MemoryStatus.PENDING,
    },
  ];
}

export function createMemoryViewSession(proposals: MemoryUpdateProposal[] = []) {
  const service = new MinimalMemoryServiceMock(proposals);
  const session = new MemoryViewTuiSession(service);
  return { service, session };
}

export async function createInitializedMemoryViewSession(proposals: MemoryUpdateProposal[] = []) {
  const { service, session } = createMemoryViewSession(proposals);
  await session.initialize();
  return { service, session };
}
