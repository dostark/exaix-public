import { assert, assertEquals, assertExists } from "@std/assert";
import { DaemonStatus } from "../../src/enums.ts";

import { MemorySource } from "../../src/enums.ts";

import { LOG_COLORS, LOG_ICONS, MONITOR_KEY_BINDINGS, MonitorView } from "../../src/tui/monitor_view.ts";
import type { LogEntry } from "../../src/tui/monitor_view.ts";
import { DatabaseService } from "../../src/services/db.ts";
import {
  createMockDatabaseService,
  createMonitorViewWithLogs,
  createTwoActionLogs,
  createTwoAgentLogs,
  sampleLogEntries,
  sampleLogEntry,
  sampleMonitorLogs,
  sampleSingleMonitorLog,
} from "./helpers.ts";
import {
  KEY_A,
  KEY_B,
  KEY_C,
  KEY_CAPITAL_E,
  KEY_CAPITAL_R,
  KEY_DOWN,
  KEY_END,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_G,
  KEY_HOME,
  KEY_QUESTION,
  KEY_S,
  KEY_SPACE,
  KEY_UP,
} from "../../src/config/constants.ts";

// Helper for creating a monitor session
function createMonitorSession(logs: any[] = []) {
  const { monitorView } = createMonitorViewWithLogs(logs);
  const session = monitorView.createTuiSession();
  return { session, monitorView };
}

// Helper for verifying filters
async function verifyFilter(
  logs: any[],
  filter: any,
  expectedLength: number,
  checkFn: (logs: any[]) => void,
) {
  const { monitorView } = createMonitorViewWithLogs(logs);
  monitorView.setFilter(filter);
  await monitorView.refreshLogs();
  const filteredLogs = monitorView.getFilteredLogs();
  assertEquals(filteredLogs.length, expectedLength);
  checkFn(filteredLogs);
}

// Additional coverage for MonitorView rendering and color helpers
Deno.test("MonitorView - getLogColor covers all cases", () => {
  const db = createMockDatabaseService();
  const monitorView = new MonitorView(db as unknown as DatabaseService);
  assertEquals(monitorView.getLogColor("request_created"), "green");
  assertEquals(monitorView.getLogColor("plan_approved"), "blue");
  assertEquals(monitorView.getLogColor("execution_started"), "yellow");
  assertEquals(monitorView.getLogColor("execution_completed"), "green");
  assertEquals(monitorView.getLogColor("error"), "red");
  assertEquals(monitorView.getLogColor("unknown_type"), "white");
});

Deno.test("MonitorView - getAnsiColorCode covers all cases", () => {
  const db = createMockDatabaseService();
  const monitorView = new MonitorView(db as unknown as DatabaseService);
  assertEquals(monitorView["getAnsiColorCode"]("red"), 31);
  assertEquals(monitorView["getAnsiColorCode"]("green"), 32);
  assertEquals(monitorView["getAnsiColorCode"]("yellow"), 33);
  assertEquals(monitorView["getAnsiColorCode"]("blue"), 34);
  assertEquals(monitorView["getAnsiColorCode"]("white"), 37);
  assertEquals(monitorView["getAnsiColorCode"](DaemonStatus.UNKNOWN), 37);
});

Deno.test("MonitorView - renderLogs outputs ANSI and handles empty", () => {
  const logs = [
    {
      id: "1",
      trace_id: "t1",
      actor: MemorySource.USER,
      agent_id: "a1",
      action_type: "error",
      target: "target.md",
      payload: {},
      timestamp: "2025-12-22T10:00:00Z",
    },
    {
      id: "2",
      trace_id: "t2",
      actor: MemorySource.USER,
      agent_id: "a2",
      action_type: "unknown_type",
      target: "target2.md",
      payload: {},
      timestamp: "2025-12-22T10:01:00Z",
    },
  ];
  const { db: _db, monitorView } = createMonitorViewWithLogs(logs);
  monitorView.setFilter({});
  const output = monitorView.renderLogs();
  assert(output.includes("\x1b[31m")); // red for error
  assert(output.includes("\x1b[37m")); // white for unknown
  // Empty logs
  const { db: _emptyDb, monitorView: emptyView } = createMonitorViewWithLogs([]);
  assertEquals(emptyView.renderLogs(), "");
});

Deno.test("MonitorView - should display real-time log streaming", async () => {
  const { db: _db, monitorView } = createMonitorViewWithLogs([
    sampleLogEntry({ agent_id: "researcher" }),
  ]);

  // Test that it can retrieve logs
  const logs = await monitorView.getLogs();
  assertEquals(logs.length, 1);
  assertEquals(logs[0].actor, MemorySource.AGENT);
  assertEquals(logs[0].action_type, "request_created");
});

Deno.test("MonitorView - should filter logs by agent", async () => {
  await verifyFilter(createTwoAgentLogs(), { agentId: "researcher" }, 1, (filteredLogs) => {
    assertEquals(filteredLogs[0].agent_id, "researcher");
  });
});

Deno.test("MonitorView - should filter logs by action type", async () => {
  await verifyFilter(createTwoActionLogs(), { actionType: "plan_approved" }, 1, (filteredLogs) => {
    assertEquals(filteredLogs[0].action_type, "plan_approved");
  });
});

Deno.test("MonitorView - should pause and resume log streaming", () => {
  const { db: _db, monitorView } = createMonitorViewWithLogs();

  // Initially streaming
  assertEquals(monitorView.isStreaming(), true);

  // Pause streaming
  monitorView.pause();
  assertEquals(monitorView.isStreaming(), false);

  // Resume streaming
  monitorView.resume();
  assertEquals(monitorView.isStreaming(), true);
});

Deno.test("MonitorView - does not fetch when paused", () => {
  const calls: string[] = [];
  class CountingDb {
    private inner: any;
    constructor(logs: any[] = []) {
      this.inner = createMockDatabaseService(logs);
    }
    getRecentActivity(limit?: number) {
      calls.push(`get:${limit}`);
      return this.inner.getRecentActivity(limit);
    }
    addLog(log: any) {
      return this.inner.addLog(log);
    }
  }
  Deno.test("MonitorView - should pause and resume log streaming", async () => {
    const db = new CountingDb([
      {
        id: "1",
        trace_id: "trace-1",
        actor: MemorySource.AGENT,
        agent_id: "dev",
        action_type: "plan.approved",
        target: "Workspace/Plans/test.md",
        payload: {},
        timestamp: "2025-12-21T10:00:00Z",
      },
    ]);
    const monitorView = new MonitorView(db as unknown as DatabaseService);
    calls.length = 0;
    monitorView.pause();
    await monitorView.getLogs(); // should not trigger fetch while paused
    assertEquals(calls.length, 0);
    monitorView.resume();
    await monitorView.getLogs();
    assertEquals(calls.length, 2);
  });
});

Deno.test("MonitorView - maps Activity Journal action names to colors", () => {
  const db = createMockDatabaseService();
  const monitorView = new MonitorView(db as unknown as DatabaseService);
  assertEquals(monitorView.getLogColor("plan.approved"), "blue");
  assertEquals(monitorView.getLogColor("plan.rejected"), "red");
  assertEquals(monitorView.getLogColor("execution.failed"), "red");
  assertEquals(monitorView.getLogColor("execution.started"), "yellow");
  assertEquals(monitorView.getLogColor("execution.completed"), "green");
});

Deno.test("MonitorView - should export logs to file", () => {
  const { db: _db, monitorView } = createMonitorViewWithLogs([
    {
      id: "1",
      trace_id: "trace-1",
      actor: MemorySource.AGENT,
      agent_id: "researcher",
      action_type: "request_created",
      target: "Workspace/Requests/test.md",
      payload: { description: "Test request" },
      timestamp: "2025-12-21T10:00:00Z",
    },
  ]);

  // Test export (this would normally write to a file)
  const exportData = monitorView.exportLogs();
  assertExists(exportData);
  assertEquals(typeof exportData, "string");
  assert(exportData.includes("request_created"));
});

Deno.test("MonitorView - should handle large log volumes without crashing", async () => {
  const largeLogs = Array.from({ length: 1000 }, (_, i) => ({
    id: `${i + 1}`,
    trace_id: `trace-${i + 1}`,
    actor: MemorySource.AGENT,
    agent_id: i % 2 === 0 ? "researcher" : "architect",
    action_type: i % 3 === 0 ? "request_created" : "plan_approved",
    target: `Workspace/Requests/test${i}.md`,
    payload: { description: `Test request ${i}` },
    timestamp: new Date(Date.now() - i * 1000).toISOString(),
  }));

  const { db: _db, monitorView } = createMonitorViewWithLogs(largeLogs);

  // Should handle large volumes
  const logs = await monitorView.getLogs();
  assertEquals(logs.length, 1000);

  // Filtering should still work
  monitorView.setFilter({ agentId: "researcher" });
  await monitorView.refreshLogs();
  const filteredLogs = monitorView.getFilteredLogs();
  assert(filteredLogs.length > 0);
  assert(filteredLogs.every((log: LogEntry) => log.agent_id === "researcher"));
});

Deno.test("MonitorView - should handle empty logs gracefully", async () => {
  const { db: _db, monitorView } = createMonitorViewWithLogs([]);

  const logs = await monitorView.getLogs();
  assertEquals(logs.length, 0);

  const filteredLogs = monitorView.getFilteredLogs();
  assertEquals(filteredLogs.length, 0);

  const exportData = monitorView.exportLogs();
  assertExists(exportData);
  assertEquals(exportData, ""); // Empty export
});

Deno.test("MonitorView - should filter logs by time window", async () => {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const logs = [
    {
      id: "1",
      trace_id: "trace-1",
      actor: MemorySource.AGENT,
      agent_id: "researcher",
      action_type: "request_created",
      target: "Workspace/Requests/test.md",
      payload: { description: "Recent request" },
      timestamp: now.toISOString(),
    },
    {
      id: "2",
      trace_id: "trace-2",
      actor: MemorySource.AGENT,
      agent_id: "architect",
      action_type: "plan_approved",
      target: "Workspace/Plans/test.md",
      payload: { plan: "Old plan" },
      timestamp: twoHoursAgo.toISOString(),
    },
  ];

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await verifyFilter(logs, { since: oneHourAgo }, 1, (filteredLogs) => {
    assertEquals(filteredLogs[0].id, "1");
  });
});

// ============================================================
// Phase 13.5 Enhanced Monitor View Tests
// ============================================================

Deno.test("Phase 13.5: MonitorTuiSession - creates session", () => {
  const { session } = createMonitorSession([sampleLogEntry()]);
  assertExists(session);
  assertEquals(session.getViewName(), "Monitor");
});

Deno.test("Phase 13.5: MonitorTuiSession - builds flat tree", () => {
  const { session } = createMonitorSession(sampleLogEntries([
    { action_type: "request_created" },
    { action_type: "plan.approved" },
  ]));
  const tree = session.getLogTree();
  assertEquals(tree.length, 2, "Flat tree should have 2 entries");
});

Deno.test("Phase 13.5: MonitorTuiSession - toggle grouping", async () => {
  const { session } = createMonitorSession(sampleLogEntries([
    { agent_id: "a1" },
    { agent_id: "a2" },
  ]));

  assertEquals(session.getGroupBy(), "none");

  await session.handleKey(KEY_G);
  assertEquals(session.getGroupBy(), MemorySource.AGENT);

  await session.handleKey(KEY_G);
  assertEquals(session.getGroupBy(), "action");

  await session.handleKey(KEY_G);
  assertEquals(session.getGroupBy(), "none");
});

Deno.test("Phase 13.5: MonitorTuiSession - help toggle", async () => {
  const { session } = createMonitorSession([]);

  assertEquals(session.isHelpVisible(), false);
  await session.handleKey(KEY_QUESTION);
  assertEquals(session.isHelpVisible(), true);
  await session.handleKey(KEY_QUESTION);
  assertEquals(session.isHelpVisible(), false);
});

Deno.test("Phase 13.5: MonitorTuiSession - pause toggle", async () => {
  const { session } = createMonitorSession([]);

  assertEquals(session.isPaused(), false);
  await session.handleKey(KEY_SPACE);
  assertEquals(session.isPaused(), true);
  await session.handleKey(KEY_SPACE);
  assertEquals(session.isPaused(), false);
});

Deno.test("Phase 13.5: MonitorTuiSession - bookmarking", async () => {
  const { session } = createMonitorSession(sampleMonitorLogs().slice(0, 1));

  assertEquals(session.getBookmarkedIds().size, 0);
  await session.handleKey(KEY_B);
  assertEquals(session.getBookmarkedIds().size, 1);
  assert(session.isBookmarked("1"));

  // Toggle off
  await session.handleKey(KEY_B);
  assertEquals(session.getBookmarkedIds().size, 0);
});

Deno.test("Phase 13.5: MonitorTuiSession - navigation", async () => {
  const { session } = createMonitorSession(sampleMonitorLogs());

  // Navigate down
  await session.handleKey(KEY_DOWN);
  // Navigate up
  await session.handleKey(KEY_UP);
  // Go to end
  await session.handleKey(KEY_END);
  // Go to home
  await session.handleKey(KEY_HOME);
});

Deno.test("Phase 13.5: MonitorTuiSession - expand/collapse all", async () => {
  const { session } = createMonitorSession(sampleMonitorLogs());

  // Switch to grouped mode
  await session.handleKey(KEY_G);

  // Collapse all
  await session.handleKey(KEY_C);
  const collapsed = session.getLogTree();
  assert(collapsed.every((n) => !n.expanded), "All should be collapsed");

  // Expand all
  await session.handleKey(KEY_CAPITAL_E);
  const expanded = session.getLogTree();
  assert(expanded.every((n) => n.expanded), "All should be expanded");
});

Deno.test("Phase 13.5: MonitorTuiSession - detail view", async () => {
  const { session } = createMonitorSession([
    {
      id: "1",
      trace_id: "t1",
      actor: MemorySource.USER,
      agent_id: "a1",
      action_type: "request_created",
      target: "target.md",
      payload: { foo: "bar" },
      timestamp: "2025-12-22T10:00:00Z",
    },
  ]);

  assertEquals(session.isDetailVisible(), false);

  // Open detail
  await session.handleKey(KEY_ENTER);
  assertEquals(session.isDetailVisible(), true);
  assert(session.getDetailContent().includes("ID: 1"));

  // Close detail
  await session.handleKey(KEY_ESCAPE);
  assertEquals(session.isDetailVisible(), false);
});

Deno.test("Phase 13.5: MonitorTuiSession - render methods", () => {
  const { session } = createMonitorSession([
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
  ]);

  const treeLines = session.renderLogTree();
  assert(treeLines.length > 0);

  const helpLines = session.renderHelp();
  assert(helpLines.length > 0);
  assert(helpLines.some((l) => l.includes("Navigation")));

  const buttons = session.renderActionButtons();
  assert(buttons.includes("Pause"));
  assert(buttons.includes("Help"));

  const status = session.renderStatusLine();
  assert(status.includes("log"));
});

Deno.test("Phase 13.5: MonitorTuiSession - key bindings", () => {
  const { session } = createMonitorSession([]);

  const bindings = session.getKeyBindings();
  assert(bindings.length > 0);

  const keys = bindings.map((b) => b.key);
  assert(keys.includes("up"));
  assert(keys.includes("down"));
  assert(keys.includes("space"));
  assert(keys.includes("b"));
  assert(keys.includes("?"));
});

Deno.test("Phase 13.5: MonitorTuiSession - export logs", () => {
  const { session } = createMonitorSession(sampleSingleMonitorLog());

  const exported = session.exportLogs();
  assert(exported.includes("request_created"));
  assert(exported.includes("2025-12-22T10:00:00Z"));
});

Deno.test("Phase 13.5: MonitorTuiSession - auto refresh toggle", async () => {
  const { session } = createMonitorSession([]);

  assertEquals(session.isAutoRefreshEnabled(), false);
  await session.handleKey(KEY_A);
  assertEquals(session.isAutoRefreshEnabled(), true);
  await session.handleKey(KEY_A);
  assertEquals(session.isAutoRefreshEnabled(), false);

  // Clean up timer
  session.cleanup();
});

Deno.test("Phase 13.5: MonitorTuiSession - focusable elements", () => {
  const { session } = createMonitorSession([]);

  const elements = session.getFocusableElements();
  assert(elements.includes("log-list"));
  assert(elements.includes("action-buttons"));
});

Deno.test("Phase 13.5: MonitorTuiSession - search dialog", async () => {
  const { session } = createMonitorSession([]);

  assertEquals(session.hasActiveDialog(), false);
  await session.handleKey(KEY_S);
  assertEquals(session.hasActiveDialog(), true);

  // Cancel dialog
  await session.handleKey(KEY_ESCAPE);
  assertEquals(session.hasActiveDialog(), false);
});

Deno.test("Phase 13.5: MonitorTuiSession - refresh", async () => {
  const { session } = createMonitorSession([]);

  // This should not throw
  await session.handleKey(KEY_CAPITAL_R);
});

Deno.test("Phase 13.5: MonitorTuiSession - empty logs tree", () => {
  const { session } = createMonitorSession([]);

  const tree = session.getLogTree();
  assertEquals(tree.length, 0);

  const lines = session.renderLogTree();
  assert(lines.some((l) => l.includes("No logs")));
});

Deno.test("Phase 13.5: LOG_ICONS and LOG_COLORS are defined", () => {
  // Import from module
  // Check they have expected keys
  assertExists(LOG_ICONS);
  assertExists(LOG_COLORS);
  assertExists(LOG_ICONS["request_created"]);
  assertExists(LOG_COLORS["error"]);
});

Deno.test("Phase 13.5: MONITOR_KEY_BINDINGS are defined", () => {
  assertExists(MONITOR_KEY_BINDINGS);
  assert(MONITOR_KEY_BINDINGS.length > 0);
});
