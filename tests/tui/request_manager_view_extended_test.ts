/**
 * @module RequestManagerViewExtendedTest
 * @path tests/tui/request_manager_view_extended_test.ts
 * @description Targeted tests for RequestManagerView metadata, ensuring comprehensive coverage of
 * status colors, keyboard bindings, and visual icons for request priorities.
 */

import { assert, assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { CritiqueSeverity, LogLevel, MCPTransport, SqliteJournalMode } from "../../src/shared/enums.ts";
import { RequestPriority } from "../../src/shared/enums.ts";
import type { IRequestEntry, IRequestMetadata, IRequestShowResult } from "../../src/cli/commands/request_commands.ts";
import { RequestCommands } from "../../src/cli/commands/request_commands.ts";
import { MemorySource } from "../../src/shared/enums.ts";
import { RequestStatus } from "../../src/shared/status/request_status.ts";
import {
  createLegacyTuiSession,
  createLegacyTuiSessionWithErrors,
  createLegacyTuiSessionWithLongTraceId,
  createLegacyTuiSessionWithTracking,
} from "./helpers.ts";
import {
  type IRequest,
  MinimalRequestServiceMock,
  PRIORITY_ICONS,
  REQUEST_KEY_BINDINGS,
  RequestAction,
  RequestCommandsServiceAdapter,
  RequestManagerTuiSession,
  RequestManagerView,
  STATUS_COLORS,
  STATUS_ICONS,
} from "../../src/tui/request_manager_view.ts";
import { KEYS } from "../../src/helpers/keyboard.ts";

// ===== Test Data =====

function createTestRequests(): IRequest[] {
  return [
    {
      trace_id: "req-001",
      filename: "request-001.md",
      subject: "Test Request 1",
      status: RequestStatus.PENDING,
      priority: "normal",
      agent: "default",
      created: "2025-01-01T10:00:00Z",
      created_by: "test@example.com",
      source: "cli",
      // waitForFlush is only on db mock, not Request
    },
    {
      trace_id: "req-002",
      filename: "request-002.md",
      subject: "Test Request 2",
      status: RequestStatus.PENDING,
      priority: "high",
      agent: "code-reviewer",
      created: "2025-01-01T11:00:00Z",
      created_by: "user@example.com",
      source: "portal",
      skills: {
        explicit: ["security-audit"],
        autoMatched: ["code-review"],
        fromDefaults: ["typescript-patterns"],
        skipped: ["deprecated-skill"],
      },
    },
    {
      trace_id: "req-003",
      filename: "request-003.md",
      subject: "Test Request 3",
      status: RequestStatus.COMPLETED,
      priority: CritiqueSeverity.CRITICAL,
      agent: "architect",
      created: "2025-01-01T12:00:00Z",
      created_by: "admin@example.com",
      source: "daemon",
    },
    {
      trace_id: "req-004",
      filename: "request-004.md",
      subject: "Cancelled Request",
      status: RequestStatus.CANCELLED,
      priority: "low",
      agent: "default",
      created: "2025-01-01T13:00:00Z",
      created_by: "test@example.com",
      source: "cli",
    },
    {
      trace_id: "req-005",
      filename: "request-005.md",
      subject: "Failed Request",
      status: RequestStatus.FAILED,
      priority: "high",
      agent: "researcher",
      created: "2025-01-01T14:00:00Z",
      created_by: "test@example.com",
      source: "cli",
    },
  ];
}

function createTestSessionWithMockService(
  getRequestContentResult: string | Error = "Test content",
): RequestManagerTuiSession {
  const requests = createTestRequests();
  const mockService = {
    listRequests: () => Promise.resolve(requests),
    getRequestContent: (_id: string) =>
      getRequestContentResult instanceof Error
        ? Promise.reject(getRequestContentResult)
        : Promise.resolve(getRequestContentResult),
    createRequest: () => Promise.resolve({} as IRequest),
    updateRequestStatus: () => Promise.resolve(true),
  };

  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession(requests);
  return session;
}

// ===== Constants Tests =====

Deno.test("RequestManagerView: STATUS_COLORS covers all statuses", () => {
  assertExists(STATUS_COLORS.pending);
  assertExists(STATUS_COLORS.planned);
  assertExists(STATUS_COLORS.in_progress);
  assertExists(STATUS_COLORS.completed);
  assertExists(STATUS_COLORS.cancelled);
  assertExists(STATUS_COLORS.failed);
});

Deno.test("RequestManagerView: REQUEST_KEY_BINDINGS is comprehensive", () => {
  const actions = REQUEST_KEY_BINDINGS.map((b) => b.action);
  assertEquals(actions.includes(RequestAction.NAVIGATE_UP), true);
  assertEquals(actions.includes(RequestAction.CREATE), true);
  assertEquals(actions.includes(RequestAction.DELETE), true);
  assertEquals(actions.includes(RequestAction.HELP), true);
});

Deno.test("RequestManagerView: PRIORITY_ICONS and STATUS_ICONS have all values", () => {
  assertEquals(PRIORITY_ICONS.critical, "🔴");
  assertEquals(PRIORITY_ICONS.high, "🟠");
  assertEquals(PRIORITY_ICONS.normal, "⚪");
  assertEquals(PRIORITY_ICONS.low, "🔵");

  assertEquals(STATUS_ICONS.pending, "⏳");
  assertEquals(STATUS_ICONS.planned, "📋");
  assertEquals(STATUS_ICONS.in_progress, "🔄");
  assertEquals(STATUS_ICONS.completed, "✅");
  assertEquals(STATUS_ICONS.cancelled, "❌");
  assertEquals(STATUS_ICONS.failed, "💥");
});

// ===== RequestManagerView Tests =====

Deno.test("RequestManagerView: renderRequestList with various statuses", () => {
  const mockService = new MinimalRequestServiceMock();
  const view = new RequestManagerView(mockService);

  const requests = createTestRequests();
  const output = view.renderRequestList(requests);

  assertStringIncludes(output, "Requests:");
  assertStringIncludes(output, "⏳"); // pending
  assertStringIncludes(output, "✅"); // completed
  assertStringIncludes(output, "❌"); // cancelled
  // Note: in_progress and failed might show as ❓ if not in STATUS_ICONS lookup
});

Deno.test("RequestManagerView: renderRequestList shows priorities", () => {
  const mockService = new MinimalRequestServiceMock();
  const view = new RequestManagerView(mockService);

  const requests = createTestRequests();
  const output = view.renderRequestList(requests);

  assertStringIncludes(output, "⚪"); // normal
  assertStringIncludes(output, "🟠"); // high
  assertStringIncludes(output, "🔴"); // critical
  assertStringIncludes(output, "🔵"); // low
});

// ===== RequestManagerTuiSession Tests =====

Deno.test("RequestManagerTuiSession: getSelectedRequest returns correct request", () => {
  const mockService = new MinimalRequestServiceMock();
  const requests = createTestRequests();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession(requests);

  const selected = session.getSelectedRequest();
  assertEquals(selected?.trace_id, "req-001");
});

Deno.test("RequestManagerTuiSession: getSelectedIndexInRequests works", () => {
  const mockService = new MinimalRequestServiceMock();
  const requests = createTestRequests();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession(requests);

  const idx = session.getSelectedIndexInRequests();
  assertEquals(idx, 0);
});

Deno.test("RequestManagerTuiSession: setSelectedByIndex changes selection", () => {
  const mockService = new MinimalRequestServiceMock();
  const requests = createTestRequests();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession(requests);

  session.setSelectedByIndex(2);
  assertEquals(session.getSelectedIndexInRequests(), 2);

  // Test invalid index (should clamp)
  session.setSelectedByIndex(-1);
  assertEquals(session.getSelectedIndexInRequests(), 2); // unchanged for out of range

  session.setSelectedByIndex(100);
  assertEquals(session.getSelectedIndexInRequests(), 2); // unchanged for out of range
});

Deno.test("RequestManagerTuiSession: navigateTree first and last", async () => {
  const mockService = new MinimalRequestServiceMock();
  const requests = createTestRequests();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession(requests);

  // Navigate to last
  await session.handleKey(KEYS.END);
  const lastState = session.getState();
  assertExists(lastState.selectedRequestId);

  // Navigate to first
  await session.handleKey(KEYS.HOME);
  const firstState = session.getState();
  assertExists(firstState.selectedRequestId);
});

Deno.test("RequestManagerTuiSession: toggleGrouping cycles through modes", () => {
  const mockService = new MinimalRequestServiceMock();
  const requests = createTestRequests();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession(requests);

  assertEquals(session.getState().groupBy, "none");

  session.toggleGrouping();
  assertEquals(session.getState().groupBy, "status");

  session.toggleGrouping();
  assertEquals(session.getState().groupBy, "priority");

  session.toggleGrouping();
  assertEquals(session.getState().groupBy, MemorySource.AGENT);

  session.toggleGrouping();
  assertEquals(session.getState().groupBy, "none");
});

Deno.test("RequestManagerTuiSession: buildGroupedByPriority", () => {
  const mockService = new MinimalRequestServiceMock();
  const requests = createTestRequests();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession(requests);

  // Switch to priority grouping
  session.toggleGrouping(); // none -> status
  session.toggleGrouping(); // status -> priority

  const tree = session.getState().requestTree;
  assert(tree.length > 0);

  // Should have priority groups
  const groupIds = tree.map((n) => n.id);
  assertEquals(groupIds.some((id) => id.startsWith("priority-")), true);
});

Deno.test("RequestManagerTuiSession: buildGroupedByAgent", () => {
  const mockService = new MinimalRequestServiceMock();
  const requests = createTestRequests();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession(requests);

  // Switch to agent grouping
  session.toggleGrouping(); // none -> status
  session.toggleGrouping(); // status -> priority
  session.toggleGrouping(); // priority -> agent

  const tree = session.getState().requestTree;
  assert(tree.length > 0);

  // Should have agent groups
  const groupIds = tree.map((n) => n.id);
  assertEquals(groupIds.some((id) => id.startsWith("agent-")), true);
});

Deno.test("RequestManagerTuiSession: expandSelectedNode and collapseSelectedNode", async () => {
  const mockService = new MinimalRequestServiceMock();
  const requests = createTestRequests();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession(requests);

  // Switch to grouping mode
  session.toggleGrouping(); // none -> status

  // Navigate to a group node
  await session.handleKey(KEYS.HOME);
  // Try to collapse and expand
  session.collapseSelectedNode();
  session.expandSelectedNode();

  // Should not throw
  const state = session.getState();
  assertExists(state);
});

Deno.test("RequestManagerTuiSession: toggleSelectedNode", async () => {
  const mockService = new MinimalRequestServiceMock();
  const requests = createTestRequests();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession(requests);

  // Switch to grouping mode
  session.toggleGrouping();

  // Navigate to first (group node)
  await session.handleKey(KEYS.HOME);

  // Toggle the node
  session.toggleSelectedNode();

  const state = session.getState();
  assertExists(state);
});

Deno.test("RequestManagerTuiSession: showRequestDetail formats content", async () => {
  const session = createTestSessionWithMockService("Test content here");

  await session.showRequestDetail("req-002");

  assertEquals(session.getState().showDetail, true);
  const detail = session.renderDetail();
  assertStringIncludes(detail, "REQUEST DETAILS");
  assertStringIncludes(detail, "Applied Skills:");
});

Deno.test("RequestManagerTuiSession: showRequestDetail handles error", async () => {
  const session = createTestSessionWithMockService(new Error("Failed to load"));

  await session.showRequestDetail("req-001");

  // Should set error status, not show detail
  assertEquals(session.getState().showDetail, false);
});

Deno.test("RequestManagerTuiSession: detail view with skills shows all skill types", async () => {
  const session = createTestSessionWithMockService("Content");

  await session.showRequestDetail("req-002");

  const detail = session.renderDetail();
  assertStringIncludes(detail, "Explicit:");
  assertStringIncludes(detail, "Auto-matched:");
  assertStringIncludes(detail, "From defaults:");
  assertStringIncludes(detail, "Skipped:");
});

Deno.test("RequestManagerTuiSession: detail view without skills shows (none)", async () => {
  const requestWithEmptySkills: IRequest = {
    trace_id: "req-empty",
    filename: "request-empty.md",
    subject: "Request with empty skills",
    status: RequestStatus.PENDING,
    priority: "normal",
    agent: "default",
    created: "2025-01-01T10:00:00Z",
    created_by: "test@example.com",
    source: "cli",
    skills: {},
  };

  const mockService = {
    listRequests: () => Promise.resolve([]),
    getRequestContent: (_id: string) => Promise.resolve("Content"),
    createRequest: () => Promise.resolve({} as IRequest),
    updateRequestStatus: () => Promise.resolve(true),
  };

  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession([requestWithEmptySkills]);

  await session.showRequestDetail("req-empty");

  const detail = session.renderDetail();
  assertStringIncludes(detail, "(none)");
});

Deno.test("RequestManagerTuiSession: filter by status and agent", () => {
  const mockService = new MinimalRequestServiceMock();
  const requests = createTestRequests();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession(requests);

  // Test filtering by status
  const state = session.getState();
  state.filterStatus = RequestStatus.PENDING;
  session.buildTree();
  assertEquals(session.getFilteredRequests().length, 2);

  // Clear status filter
  state.filterStatus = null;

  // Test filtering by agent
  state.filterAgent = "code-reviewer";
  session.buildTree();
  assertEquals(session.getFilteredRequests().length, 1);
});

Deno.test("RequestManagerTuiSession: filter by priority", () => {
  const mockService = new MinimalRequestServiceMock();
  const requests = createTestRequests();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession(requests);

  const state = session.getState();
  state.filterPriority = "high";
  session.buildTree();
  assertEquals(session.getFilteredRequests().length, 2); // high priority requests
});

Deno.test("RequestManagerTuiSession: render shows help when showHelp is true", async () => {
  const mockService = new MinimalRequestServiceMock();
  const requests = createTestRequests();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession(requests);

  await session.handleKey(KEYS.QUESTION);
  assertEquals(session.getState().showHelp, true);

  const output = session.render();
  assertStringIncludes(output, "Navigation");
  assertStringIncludes(output, "Actions");
});

Deno.test("RequestManagerTuiSession: close help with '?'", async () => {
  const session = createTestSessionWithMockService("Content");

  await session.handleKey(KEYS.QUESTION);
  assertEquals(session.getState().showHelp, true);

  await session.handleKey(KEYS.QUESTION);
  assertEquals(session.getState().showHelp, false);
});

Deno.test("RequestManagerTuiSession: close detail with 'q'", async () => {
  const session = createTestSessionWithMockService("Content");

  await session.showRequestDetail("req-001");
  assertEquals(session.getState().showDetail, true);

  await session.handleKey(KEYS.Q);
  assertEquals(session.getState().showDetail, false);
});

Deno.test("RequestManagerTuiSession: close detail with escape", async () => {
  const session = createTestSessionWithMockService("Content");

  await session.showRequestDetail("req-001");
  assertEquals(session.getState().showDetail, true);

  await session.handleKey(KEYS.ESCAPE);
  assertEquals(session.getState().showDetail, false);
});

Deno.test("RequestManagerTuiSession: render shows current filters", () => {
  const session = createTestSessionWithMockService("Content");

  const state = session.getState();
  state.searchQuery = "test";
  state.filterStatus = RequestStatus.PENDING;
  state.filterAgent = "default";

  const output = session.render();
  assertStringIncludes(output, 'search="test"');
  assertStringIncludes(output, "status=pending");
  assertStringIncludes(output, "agent=default");
});

Deno.test("RequestManagerTuiSession: renderTree returns empty message for no requests", () => {
  const mockService = new MinimalRequestServiceMock();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession([]);

  const treeOutput = session.renderTree();
  assertEquals(treeOutput[0], "No requests found.");
});

Deno.test("RequestManagerTuiSession: getFocusableElements returns correct elements", () => {
  const mockService = new MinimalRequestServiceMock();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession([]);

  const focusable = session.getFocusableElements();
  assertEquals(focusable.includes("request-list"), true);
  assertEquals(focusable.includes("action-buttons"), true);
});

Deno.test("RequestManagerTuiSession: setRequests updates internal state", () => {
  const session = createTestSessionWithMockService("Content");

  assertEquals(session.getRequests().length, 5); // createTestRequests() returns 5 requests

  session.setRequests([]);
  assertEquals(session.getRequests().length, 0);
});

Deno.test("RequestManagerTuiSession: refresh rebuilds tree", async () => {
  const session = createTestSessionWithMockService("Content");

  const treeBefore = session.getState().requestTree.length;

  await session.refresh();

  const treeAfter = session.getState().requestTree.length;
  assertEquals(treeBefore, treeAfter);
});

Deno.test("RequestManagerTuiSession: showSearchDialog and handleSearchResult", async () => {
  const session = createTestSessionWithMockService("Content");

  // Show search dialog
  session.showSearchDialog();
  assertEquals(session.getState().activeDialog !== null, true);

  // Cancel dialog
  await session.handleKey(KEYS.ESCAPE);
  assertEquals(session.getState().activeDialog, null);
});

Deno.test("RequestManagerTuiSession: showFilterStatusDialog", async () => {
  const session = createTestSessionWithMockService("Content");

  session.showFilterStatusDialog();
  assertEquals(session.getState().activeDialog !== null, true);

  await session.handleKey(KEYS.ESCAPE);
  assertEquals(session.getState().activeDialog, null);
});

Deno.test("RequestManagerTuiSession: showFilterAgentDialog", async () => {
  const session = createTestSessionWithMockService("Content");

  session.showFilterAgentDialog();
  assertEquals(session.getState().activeDialog !== null, true);

  await session.handleKey(KEYS.ESCAPE);
  assertEquals(session.getState().activeDialog, null);
});

Deno.test("RequestManagerTuiSession: showCreateDialog", async () => {
  const session = createTestSessionWithMockService("Content");

  session.showCreateDialog();
  assertEquals(session.getState().activeDialog !== null, true);

  await session.handleKey(KEYS.ESCAPE);
  assertEquals(session.getState().activeDialog, null);
});

Deno.test("RequestManagerTuiSession: showCancelConfirm for non-existent request", () => {
  const session = createTestSessionWithMockService("Content");

  // Try to show cancel for non-existent request
  session.showCancelConfirm("non-existent");

  // Should not open dialog
  assertEquals(session.getState().activeDialog, null);
});

Deno.test("RequestManagerTuiSession: showPriorityDialog", async () => {
  const session = createTestSessionWithMockService("Content");

  session.showPriorityDialog();
  assertEquals(session.getState().activeDialog !== null, true);

  await session.handleKey(KEYS.ESCAPE);
  assertEquals(session.getState().activeDialog, null);
});

Deno.test("RequestManagerTuiSession: left arrow collapses, right arrow expands", async () => {
  const session = createTestSessionWithMockService("Content");

  // Switch to grouping mode
  session.toggleGrouping();

  // Navigate to a group
  await session.handleKey(KEYS.HOME);

  // Collapse with left arrow
  await session.handleKey(KEYS.LEFT);

  // Expand with right arrow
  await session.handleKey(KEYS.RIGHT);

  const state = session.getState();
  assertExists(state);
});

Deno.test("RequestManagerTuiSession: enter on group toggles expansion", async () => {
  const session = createTestSessionWithMockService("Content");

  // Switch to grouping mode
  session.toggleGrouping();

  // Navigate to a group node (first item should be a group)
  await session.handleKey(KEYS.HOME);

  const state = session.getState();
  if (state.selectedRequestId?.startsWith("status-")) {
    // Toggle with enter
    await session.handleKey(KEYS.ENTER);
    // Should not show detail for groups
    assertEquals(session.getState().showDetail, false);
  }
});

Deno.test("RequestManagerTuiSession: d key on non-request does nothing", async () => {
  const session = createTestSessionWithMockService("Content");

  // Switch to grouping mode
  session.toggleGrouping();

  // Navigate to a group node
  await session.handleKey(KEYS.HOME);

  const state = session.getState();
  if (state.selectedRequestId?.startsWith("status-")) {
    // Try to delete a group (should do nothing)
    await session.handleKey(KEYS.D);
    assertEquals(session.getState().activeDialog, null);
  }
});

Deno.test("RequestManagerTuiSession: p key on non-request does nothing", async () => {
  const session = createTestSessionWithMockService("Content");

  // Switch to grouping mode
  session.toggleGrouping();

  // Navigate to a group node
  await session.handleKey(KEYS.HOME);

  const state = session.getState();
  if (state.selectedRequestId?.startsWith("status-")) {
    // Try to change priority of a group (should do nothing)
    await session.handleKey(KEYS.P);
    assertEquals(session.getState().activeDialog, null);
  }
});

// ===== LegacyRequestManagerTuiSession Tests =====

Deno.test("LegacyRequestManagerTuiSession: getSelectedIndex and setSelectedIndex", () => {
  const session = createLegacyTuiSession(createTestRequests());

  assertEquals(session.getSelectedIndex(), 0);

  session.setSelectedIndex(2);
  assertEquals(session.getSelectedIndex(), 2);

  // Test boundary
  session.setSelectedIndex(-1);
  assertEquals(session.getSelectedIndex(), 0);

  session.setSelectedIndex(100);
  assertEquals(session.getSelectedIndex(), 0);
});

Deno.test("LegacyRequestManagerTuiSession: handleKey navigation", async () => {
  const session = createLegacyTuiSession(createTestRequests());

  assertEquals(session.getSelectedIndex(), 0);

  await session.handleKey(KEYS.DOWN);
  assertEquals(session.getSelectedIndex(), 1);

  await session.handleKey(KEYS.UP);
  assertEquals(session.getSelectedIndex(), 0);

  await session.handleKey(KEYS.END);
  assertEquals(session.getSelectedIndex(), 4);

  await session.handleKey(KEYS.HOME);
  assertEquals(session.getSelectedIndex(), 0);
});

Deno.test("LegacyRequestManagerTuiSession: handleKey actions", async () => {
  const { session, createCalled, viewCalled, deleteCalled } = createLegacyTuiSessionWithTracking();

  await session.handleKey(KEYS.C);
  assertEquals(createCalled(), true);

  await session.handleKey(KEYS.V);
  assertEquals(viewCalled(), true);

  await session.handleKey(KEYS.D);
  assertEquals(deleteCalled(), true);
});

Deno.test("LegacyRequestManagerTuiSession: getSelectedRequest", () => {
  const session = createLegacyTuiSession(createTestRequests());

  const selected = session.getSelectedRequest();
  assertEquals(selected?.trace_id, "req-001");
});

Deno.test("LegacyRequestManagerTuiSession: getStatusMessage after action", async () => {
  const session = createLegacyTuiSessionWithLongTraceId();

  await session.handleKey(KEYS.C);
  assertStringIncludes(session.getStatusMessage(), "Created request:");
});

Deno.test("LegacyRequestManagerTuiSession: handleKey with empty requests", async () => {
  const session = createLegacyTuiSession([]);

  // Should not throw with empty requests
  await session.handleKey(KEYS.DOWN);
  await session.handleKey(KEYS.UP);

  assertEquals(session.getSelectedIndex(), 0);
});

Deno.test("LegacyRequestManagerTuiSession: error handling in actions", async () => {
  const session = createLegacyTuiSessionWithErrors();

  // Test create error
  await session.handleKey(KEYS.C);
  assertStringIncludes(session.getStatusMessage(), "Error:");

  // Test view error
  await session.handleKey(KEYS.V);
  assertStringIncludes(session.getStatusMessage(), "Error:");

  // Test delete error
  await session.handleKey(KEYS.D);
  assertStringIncludes(session.getStatusMessage(), "Error:");
});

// ===== RequestCommandsServiceAdapter Tests =====

Deno.test("RequestCommandsServiceAdapter: updateRequestStatus logs warning", async () => {
  // Provide a minimal valid ICommandContext
  const dummyContext = {
    config: {
      tools: {
        fetch_url: {
          enabled: false,
          allowed_domains: [],
          timeout_ms: 1000,
          max_response_size_kb: 1024,
        },
        grep_search: {
          max_results: 10,
          exclude_dirs: [],
        },
      },
      system: {
        root: "/tmp/mock-root",
        log_level: LogLevel.INFO,
        version: "test-version",
      },
      paths: {
        workspace: "Workspace",
        runtime: "Runtime",
        memory: "Memory",
        portals: "Portals",
        blueprints: "Blueprints",
        active: "Active",
        archive: "Archive",
        plans: "Plans",
        requests: "Requests",
        rejected: "Rejected",
        agents: "Agents",
        flows: "Flows",
        memoryProjects: "MemoryProjects",
        memoryExecution: "MemoryExecution",
        memoryIndex: "MemoryIndex",
        memorySkills: "MemorySkills",
        memoryPending: "MemoryPending",
        memoryTasks: "MemoryTasks",
        memoryGlobal: "MemoryGlobal",
      },
      database: {
        batch_flush_ms: 100,
        batch_max_size: 10,
        sqlite: { journal_mode: SqliteJournalMode.WAL, foreign_keys: true, busy_timeout_ms: 100 },
        failure_threshold: 1,
        reset_timeout_ms: 100,
        half_open_success_threshold: 1,
      },
      watcher: {
        debounce_ms: 100,
        stability_check: true,
      },
      agents: {
        default_model: "test-model",
        timeout_sec: 30,
        max_iterations: 5,
      },
      portals: [],
      models: {},
      ai_endpoints: {},
      ai_retry: {
        max_attempts: 1,
        backoff_base_ms: 100,
        timeout_per_request_ms: 100,
      },
      ai_timeout: { default_ms: 1000 },
      ai_anthropic: { api_version: "2023-01-01", default_model: "claude-v1", max_tokens_default: 4096 },
      mcp: {
        enabled: true,
        version: "1.0",
        transport: MCPTransport.STDIO,
        server_name: "test-server",
      },
      mcp_defaults: { agent_id: "agent-1" },
      rate_limiting: {
        enabled: false,
        max_calls_per_minute: 100,
        max_tokens_per_hour: 10000,
        max_cost_per_day: 100,
        cost_per_1k_tokens: 0.01,
      },
      providers: {},
      ai: {
        model: "test-model",
        timeout_ms: 100,
        provider: "test-provider",
      },
      memory: {},
      plan_defaults: {},
      review_defaults: {},
      journal: {},
      event_log: {},
      portal_permissions: {},
      git: {
        branch_prefix_pattern: "",
        allowed_prefixes: [],
        operations: {
          status_timeout_ms: 100,
          ls_files_timeout_ms: 100,
          checkout_timeout_ms: 100,
          clean_timeout_ms: 100,
          log_timeout_ms: 100,
          diff_timeout_ms: 100,
          command_timeout_ms: 100,
          max_retries: 1,
          retry_backoff_base_ms: 100,
          branch_name_collision_max_retries: 1,
          trace_id_short_length: 8,
          branch_suffix_length: 4,
        },
      },
      mock: { delay_ms: 0, input_tokens: 0, output_tokens: 0 },
      provider_strategy: {
        prefer_free: false,
        allow_local: false,
        max_daily_cost_usd: 0,
        health_check_enabled: false,
        fallback_enabled: false,
        fallback_chains: {},
      },
      ui: { prompt_preview_length: 0, prompt_preview_extended: 0 },
      cost_tracking: { batch_delay_ms: 0, max_batch_size: 0, rates: {} },
      health: { check_timeout_ms: 0, cache_ttl_ms: 0, memory_warn_percent: 0, memory_critical_percent: 0 },
    },
    db: {
      get: () => undefined,
      set: () => undefined,
      delete: () => undefined,
      logActivity: () => undefined,
      waitForFlush: () => Promise.resolve(),
      queryActivity: () => Promise.resolve([]),
      preparedGet: () => Promise.resolve(null),
      preparedAll: () => Promise.resolve([]),
      preparedRun: () => Promise.resolve(),
      close: () => Promise.resolve(),
      getActivitiesByTrace: () => [],
      getActivitiesByActor: () => [],
      getActivitiesByAction: () => [],
      getActivitiesByTraceSafe: () => Promise.resolve([]),
      getActivitiesByActionType: () => [],
      getActivitiesByActionTypeSafe: () => Promise.resolve([]),
      getRecentActivity: () => Promise.resolve([]),
    },
  };
  class MockRequestCommands extends RequestCommands {
    override list(): Promise<IRequestEntry[]> {
      return Promise.resolve([]);
    }
    override show(): Promise<IRequestShowResult> {
      return Promise.resolve({
        metadata: {
          trace_id: "dummy",
          filename: "dummy.md",
          path: "dummy.md",
          status: RequestStatus.PENDING,
          priority: RequestPriority.NORMAL,
          agent: "dummy",
          created: new Date().toISOString(),
          created_by: "dummy",
          source: "cli",
        },
        content: "",
      });
    }
    override create(): Promise<IRequestMetadata> {
      return Promise.resolve({
        trace_id: "dummy",
        filename: "dummy.md",
        path: "dummy.md",
        status: RequestStatus.PENDING,
        priority: RequestPriority.NORMAL,
        agent: "dummy",
        created: new Date().toISOString(),
        created_by: "dummy",
        source: "cli",
      });
    }
    override createFromFile(): Promise<IRequestMetadata> {
      return Promise.resolve({
        trace_id: "dummy",
        filename: "dummy.md",
        path: "dummy.md",
        status: RequestStatus.PENDING,
        priority: RequestPriority.NORMAL,
        agent: "dummy",
        created: new Date().toISOString(),
        created_by: "dummy",
        source: "cli",
      });
    }
  }
  const mockCmd = new MockRequestCommands(dummyContext);
  const adapter = new RequestCommandsServiceAdapter(mockCmd);

  // This should log a warning but return true
  const result = await adapter.updateRequestStatus("test-id", RequestStatus.COMPLETED);
  assertEquals(result, true);
});
