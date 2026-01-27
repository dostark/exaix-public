import { assert, assertEquals } from "@std/assert";
import { type StructuredLogService, StructuredLogViewer } from "../../src/tui/structured_log_viewer.ts";
import type { LogEntry, StructuredLogger } from "../../src/services/structured_logger.ts";

// Mock Service
class MockLogService implements StructuredLogService {
  logs: LogEntry[] = [];

  constructor() {
    this.logs = [
      {
        timestamp: new Date().toISOString(),
        level: "info",
        message: "Test log 1",
        context: { trace_id: "t1", correlation_id: "c1" },
        metadata: {},
      },
      {
        timestamp: new Date(Date.now() - 1000).toISOString(),
        level: "error",
        message: "Test error",
        context: { trace_id: "t2" },
        error: { name: "Error", message: "Boom", stack: "stack..." },
        metadata: {},
      },
    ];
  }

  getStructuredLogs(options: any): Promise<LogEntry[]> {
    let result = this.logs;
    if (options.correlationId) {
      result = result.filter((l) => l.context.correlation_id === options.correlationId);
    }
    if (options.traceId) {
      result = result.filter((l) => l.context.trace_id === options.traceId);
    }
    return Promise.resolve(result);
  }

  subscribeToLogs(_callback: (entry: LogEntry) => void): () => void {
    return () => {};
  }

  getLogsByCorrelationId(id: string): Promise<LogEntry[]> {
    return Promise.resolve(this.logs.filter((l) => l.context.correlation_id === id));
  }

  getLogsByTraceId(id: string): Promise<LogEntry[]> {
    return Promise.resolve(this.logs.filter((l) => l.context.trace_id === id));
  }

  getLogsByAgentId(_id: string): Promise<LogEntry[]> {
    return Promise.resolve([]);
  }
}

const mockLogger = {} as StructuredLogger;

Deno.test("StructuredLogViewer: initialization", () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  // Verify initial state
  // We can't access private state easily, but we can check public methods or side effects
  // Or casts to any
  const state = (viewer as any).state;
  assertEquals(state.logLevelFilter.length, 5);
  assertEquals(state.groupBy, "correlation");
});

Deno.test("StructuredLogViewer: refreshLogs loads entries", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  await viewer.refreshLogs();

  const logs = await viewer.getLogs();
  assertEquals(logs.length, 2);
});

Deno.test("StructuredLogViewer: filtering search query", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs(); // load initial

  viewer.setSearchQuery("error");

  const state = (viewer as any).state;
  assertEquals(state.filteredEntries.length, 1);
  assertEquals(state.filteredEntries[0].message, "Test error");
});

Deno.test("StructuredLogViewer: toggle grouping", () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  // Default is correlation
  viewer.toggleGrouping(); // trace
  assertEquals((viewer as any).state.groupBy, "trace");

  viewer.toggleGrouping(); // agent
  assertEquals((viewer as any).state.groupBy, "agent");
});

Deno.test("StructuredLogViewer: toggle performance metrics", () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  const initial = (viewer as any).state.showPerformanceMetrics;
  viewer.togglePerformanceMetrics();
  assertEquals((viewer as any).state.showPerformanceMetrics, !initial);
});

Deno.test("StructuredLogViewer: handleKey navigation", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // Initial index 0
  await viewer.handleKey("down");
  assertEquals((viewer as any).selectedIndex, 1);

  await viewer.handleKey("up");
  assertEquals((viewer as any).selectedIndex, 0);
});

Deno.test("StructuredLogViewer: log detail view", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  const logs = await viewer.getLogs();
  const logId = logs[1].timestamp; // error log

  const detail = viewer.getLogDetail(logId);
  assert(detail.includes("Test error"));
  assert(detail.includes("Error:"));
  assert(detail.includes("Boom"));
});

Deno.test("StructuredLogViewer: can render output", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  await viewer.refreshLogs();

  // Check render output (returns Promise<string[]>)
  const output = await viewer.render(100, 40);
  assert(Array.isArray(output));
  assert(output.length > 0);

  const combined = output.join("\n");
  // Should contain log message or parts of it
  // Implementation uses renderTree.
  // Ensure mock data is rendered.
  // "Test log 1" might be in the tree lines.
  assert(combined.length > 0);
});

Deno.test("StructuredLogViewer: handleKey expand/collapse details", async () => {
  const service = new MockLogService();
  // Use testMode
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  const _state = (viewer as any).state;
  // Select first log (index 0 might be group or log?)
  // Depends on state.logTree.
  // MockLogService logs: context.correlation_id="c1".
  // Default groupBy="correlation".
  // Tree: Group("c1") -> Log("Test log 1").
  // Index 0 is Group?
  // Let's verify grouping.

  await viewer.handleKey("enter"); // Toggles group or expands log
  // If it was group, it toggles.
  // If it was log, it expands.

  // Just verify no error and state change if possible.
  // Since tree structure depends on grouping, we might need to navigate.
});

Deno.test("StructuredLogViewer: bookmark toggles state", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();
  const logs = await viewer.getLogs();
  const logId = logs[0].timestamp;

  (viewer as any).state.selectedLogId = logId;
  await viewer.handleKey("b");

  assert((viewer as any).state.bookmarkedIds.has(logId));

  await viewer.handleKey("b");
  assert(!(viewer as any).state.bookmarkedIds.has(logId));
});

Deno.test("StructuredLogViewer: help toggle", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  await viewer.handleKey("?");
  assert((viewer as any).state.showHelp);

  const output = await viewer.render(100, 40);
  const helpContent = output.join("\n");
  assert(helpContent.includes("Structured Log Viewer Help"));

  await viewer.handleKey("?");
  assert(!(viewer as any).state.showHelp);
});

Deno.test("StructuredLogViewer: search dialog interaction", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  await viewer.handleKey("s");
  const dialog = (viewer as any).state.activeDialog;
  assert(dialog, "Dialog should be active");
  // Access private options via cast
  assert((dialog as any).options.title.includes("Search Logs"));

  // Cancel dialog
  await viewer.handleKey("escape");
  assert((viewer as any).state.activeDialog === null);
});

Deno.test("StructuredLogViewer: collapse/expand all", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // Test collapse all
  await viewer.handleKey("C");
  let tree = (viewer as any).state.logTree;
  // Deep check: groups should be collapsed (expanded = false or undefined)
  // Our mock data has groups.
  const hasCollapsedGroup = tree.some((node: any) => node.type === "group" && node.expanded === false);
  // Note: collapseAll might return new array
  assert(hasCollapsedGroup, "Should have collapsed groups");

  // Test expand all
  await viewer.handleKey("E");
  tree = (viewer as any).state.logTree; // get fresh ref
  const hasExpandedGroup = tree.some((node: any) => node.type === "group" && node.expanded === true);
  assert(hasExpandedGroup, "Should have expanded groups");
});

Deno.test("StructuredLogViewer: export logs", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // Mock Deno.writeTextFile
  const originalWrite = Deno.writeTextFile;
  let writeCalled = false;
  let writePath = "";
  (Deno as any).writeTextFile = (path: string, _content: string) => {
    writeCalled = true;
    writePath = path;
    return Promise.resolve();
  };

  try {
    await viewer.handleKey("e");
    assert(writeCalled);
    assert(writePath.startsWith("structured-logs-"));
    assert(writePath.endsWith(".jsonl"));
  } finally {
    (Deno as any).writeTextFile = originalWrite;
  }
});

Deno.test("StructuredLogViewer: rendering status bar", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // Enable some flags to check status bar
  (viewer as any).state.realTimeEnabled = true;
  (viewer as any).state.autoRefresh = true;
  (viewer as any).state.showPerformanceMetrics = true;
  (viewer as any).state.bookmarkedIds.add("123");

  const output = await viewer.render(100, 40);
  const statusBar = output[output.length - 1];

  assert(statusBar.includes("LIVE"));
  assert(statusBar.includes("AUTO"));
  assert(statusBar.includes("PERF"));
  assert(statusBar.includes("bookmarks"));
});

Deno.test("StructuredLogViewer: rendering header", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  (viewer as any).state.searchQuery = "test query";
  (viewer as any).state.groupBy = "level";

  const output = await viewer.render(100, 40);
  const header = output[0];

  assert(header.includes('Search: "test query"'));
  assert(header.includes("Group: level"));
});

Deno.test("StructuredLogViewer: correlation and trace mode", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // Test correlation mode filtering
  (viewer as any).state.selectedLogId = (await viewer.getLogs())[0].timestamp;

  await (viewer as any).setCorrelationMode("c1");
  assert((viewer as any).state.correlationMode);
  assert((viewer as any).state.activeCorrelationId === "c1");

  let logs = await viewer.getLogs();
  assert(logs.length > 0);
  assert(logs.every((l) => l.context.correlation_id === "c1"));

  // Toggle off
  await viewer.handleKey("c");
  assert(!(viewer as any).state.correlationMode);

  // Test trace mode filtering
  await (viewer as any).setTraceMode("t1");
  assert((viewer as any).state.activeTraceId === "t1");
  logs = await viewer.getLogs();
  assert(logs.every((l) => l.context.trace_id === "t1"));
});

Deno.test("StructuredLogViewer: real-time updates", () => {
  const service = new MockLogService();
  let subCallback: ((entry: LogEntry) => void) | undefined;

  service.subscribeToLogs = (cb) => {
    subCallback = cb;
    return () => {};
  };

  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  viewer.toggleRealTime();
  assert((viewer as any).state.realTimeEnabled);
  assert(subCallback !== undefined, "Should have subscribed");

  const newLog: LogEntry = {
    timestamp: new Date().toISOString(),
    level: "warn",
    message: "Real-time log",
    context: {},
    metadata: {},
  };

  if (subCallback) {
    subCallback(newLog);
  }

  const logs = (viewer as any).state.logEntries;
  assert(logs[0].message === "Real-time log");
});

Deno.test("StructuredLogViewer: grouping modes coverage", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // Test all grouping modes
  (viewer as any).state.groupBy = "trace";
  (viewer as any).rebuildTree();
  let tree = (viewer as any).state.logTree;
  assert(tree.some((n: any) => n.id === "t1"));

  (viewer as any).state.groupBy = "agent";
  (viewer as any).rebuildTree();
  tree = (viewer as any).state.logTree;
  assert(tree.some((n: any) => n.id === "no-agent")); // Mock logs have no agent_id

  (viewer as any).state.groupBy = "level";
  (viewer as any).rebuildTree();
  tree = (viewer as any).state.logTree;
  assert(tree.some((n: any) => n.id === "info"));

  (viewer as any).state.groupBy = "time";
  (viewer as any).rebuildTree();
  tree = (viewer as any).state.logTree;
  // Should have date keys
  assert(tree.length > 0);
  assert(tree[0].id.includes("-")); // YYYY-MM-DD
});

Deno.test("StructuredLogViewer: navigation edge cases", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // Test home/end
  await viewer.handleKey("end");
  assert((viewer as any).selectedIndex > 0);

  await viewer.handleKey("home");
  assert((viewer as any).selectedIndex === 0);

  // Test left/right on non-expandable or already in state
  // Force selection of a leaf node
  // Expand first group
  await viewer.handleKey("enter");
  await viewer.handleKey("right"); // Should do nothing on leaf or already expanded

  // Test escape/q handling
  await viewer.handleKey("q");
  // Helper does nothing on Q usually, but check no error
});

Deno.test("StructuredLogViewer: dialog key handling", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  // Open search dialog
  await viewer.handleKey("s");

  // Interact with dialog
  // Default focus is on input, but we need to press Enter to start editing
  await viewer.handleKey("enter");

  await viewer.handleKey("t"); // type 't'
  await viewer.handleKey("e"); // type 'e'

  // Verify value inside dialog
  const activeDialog = (viewer as any).state.activeDialog;
  assert(activeDialog.getValue() === "te", `Expected 'te', got '${activeDialog.getValue()}'`);

  await viewer.handleKey("enter"); // stop editing, moves focus to OK
  await viewer.handleKey("enter"); // confirm

  assert((viewer as any).state.searchQuery === "te");
  assert((viewer as any).state.activeDialog === null);
});

Deno.test("StructuredLogViewer: format log entry coverage", () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  // Enable perf metrics to test that branch
  (viewer as any).state.showPerformanceMetrics = true;

  const complexLog: LogEntry = {
    timestamp: new Date().toISOString(),
    level: "debug",
    message: "Complex log",
    context: {
      trace_id: "trace-123",
      agent_id: "agent-456",
      operation: "op-789",
    },
    performance: {
      duration_ms: 100,
      memory_mb: 50,
    },
    metadata: {},
  };

  // call private method via cast
  const formatted = (viewer as any).formatLogEntry(complexLog);

  assert(formatted.includes("trace=trace-12")); // slice(0,8)
  assert(formatted.includes("agent=agent-456"));
  assert(formatted.includes("op=op-789"));
  assert(formatted.includes("100ms"));
  assert(formatted.includes("50MB"));
});

Deno.test("StructuredLogViewer: log level filter", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // Initial count is 2 (info, error)
  const logs = await viewer.getLogs();
  assertEquals(logs.length, 2);

  // Filter to only error
  viewer.setLogLevelFilter(["error"]);
  let filtered = (viewer as any).state.filteredEntries;
  assertEquals(filtered.length, 1);
  assertEquals(filtered[0].level, "error");

  // Filter to debug (none)
  viewer.setLogLevelFilter(["debug"]);
  filtered = (viewer as any).state.filteredEntries;
  assertEquals(filtered.length, 0);
});

Deno.test("StructuredLogViewer: auto refresh toggle", () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  // Enable
  viewer.toggleAutoRefresh();
  assert((viewer as any).state.autoRefresh);
  assert((viewer as any).refreshInterval !== undefined);

  // Disable
  viewer.toggleAutoRefresh();
  assert(!(viewer as any).state.autoRefresh);
  assert((viewer as any).refreshInterval === undefined);
});

Deno.test("StructuredLogViewer: correlation/trace key shortcuts", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // "Real-time log" is created in refreshLogs with MockLogService, it has correlation_id="c1", trace_id="t1"
  // Log tree should be populated.
  // Select first log (index 0 might be group or log depending on grouping).
  // Default grouping is 'none' in viewer? No, default is probably 'none' if not specified?
  // Let's force 'none' grouping or ensure we select a log.
  (viewer as any).state.groupBy = "none";
  (viewer as any).rebuildTree();

  // Select first node
  (viewer as any).selectedIndex = 0;

  // Press 'c' to enable correlation mode for "c1"
  await viewer.handleKey("c");
  assert((viewer as any).state.correlationMode);
  assert((viewer as any).state.activeCorrelationId === "c1");

  // Press 'c' to disable
  await viewer.handleKey("c");
  assert(!(viewer as any).state.correlationMode);
  assert((viewer as any).state.activeCorrelationId === null);

  // Press 't' to enable trace mode for "t1"
  await viewer.handleKey("t");
  assert((viewer as any).state.activeTraceId === "t1");

  // Press 't' to disable
  await viewer.handleKey("t");
  assert((viewer as any).state.activeTraceId === null);
});
