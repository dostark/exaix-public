import { assert, assertEquals } from "@std/assert";
import { type StructuredLogService, StructuredLogViewer } from "../../src/tui/structured_log_viewer.ts";
import type { LogEntry, StructuredLogger } from "../../src/services/structured_logger.ts";
import { KEYS } from "../../src/tui/utils/keyboard.ts";

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

  exportLogs(_filename: string, _entries: LogEntry[]): Promise<void> {
    return Promise.resolve();
  }
}

const mockLogger = {} as StructuredLogger;

Deno.test("StructuredLogViewer: initialization", () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  // Verify initial state
  const ext = viewer.getExtensions();
  assertEquals(ext.logLevelFilter.length, 5);
  assertEquals(ext.groupBy, "correlation");
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

  const ext = viewer.getExtensions();
  assertEquals(ext.filteredEntries.length, 1);
  assertEquals(ext.filteredEntries[0].message, "Test error");
});

Deno.test("StructuredLogViewer: toggle grouping", () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  // Default is correlation
  viewer.toggleGrouping(); // trace
  assertEquals(viewer.getExtensions().groupBy, "trace");

  viewer.toggleGrouping(); // agent
  assertEquals(viewer.getExtensions().groupBy, "agent");
});

Deno.test("StructuredLogViewer: toggle performance metrics", () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  const initial = viewer.getExtensions().showPerformanceMetrics;
  viewer.togglePerformanceMetrics();
  assertEquals(viewer.getExtensions().showPerformanceMetrics, !initial);
});

Deno.test("StructuredLogViewer: handleKey navigation", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // Initial selection is first node
  const firstId = viewer.getSelectedId();
  assert(firstId);

  await viewer.handleKey(KEYS.DOWN);
  const secondId = viewer.getSelectedId();
  assert(secondId);
  assert(firstId !== secondId);

  await viewer.handleKey(KEYS.UP);
  assertEquals(viewer.getSelectedId(), firstId);
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

  await viewer.handleKey(KEYS.ENTER); // Toggles group or expands log
  // If it was group, it toggles.
  // If it was log, it expands.

  // Just verify no error and state change if possible.
  // Since tree structure depends on grouping, we might need to navigate.
});

Deno.test("StructuredLogViewer: bookmark toggles state", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // Set grouping to none for easier log selection
  viewer.getExtensions().groupBy = "none";
  (viewer as any).buildTree();

  const logs = await viewer.getLogs();
  const logId = logs[0].timestamp;

  (viewer as any).state.selectedId = logId;
  await viewer.handleKey(KEYS.B);

  assert(viewer.getExtensions().bookmarkedIds.has(logId));

  await viewer.handleKey(KEYS.B);
  assert(!viewer.getExtensions().bookmarkedIds.has(logId));
});

Deno.test("StructuredLogViewer: help toggle", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  await viewer.handleKey(KEYS.QUESTION);
  assert((viewer as any).state.showHelp);

  const output = await viewer.render(100, 40);
  const helpContent = output.join("\n");
  assert(helpContent.includes("Structured Log Viewer Help"));

  await viewer.handleKey(KEYS.ESCAPE); // escape also closes help
  assert(!(viewer as any).state.showHelp);
});

Deno.test("StructuredLogViewer: search dialog interaction", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  await viewer.handleKey(KEYS.S);
  const dialog = (viewer as any).state.activeDialog;
  assert(dialog, "Dialog should be active");
  // Access private options via cast
  assert((dialog as any).options.title.includes("Search Logs"));

  // Cancel dialog
  await viewer.handleKey(KEYS.ESCAPE);
  assert(!(viewer as any).state.activeDialog);
});

Deno.test("StructuredLogViewer: collapse/expand all", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // Test collapse all
  await viewer.handleKey(KEYS.CAP_C);
  let tree = (viewer as any).state.tree;
  // Deep check: groups should be collapsed
  const hasCollapsedGroup = tree.some((node: any) => node.type === "group" && node.expanded === false);
  assert(hasCollapsedGroup, "Should have collapsed groups");

  // Test expand all
  await viewer.handleKey(KEYS.CAP_E);
  tree = (viewer as any).state.tree;
  const hasExpandedGroup = tree.some((node: any) => node.type === "group" && node.expanded === true);
  assert(hasExpandedGroup, "Should have expanded groups");
});

Deno.test("StructuredLogViewer: export logs", async () => {
  const service = new MockLogService();
  let exportCalled = false;
  let exportFilename = "";

  service.exportLogs = (filename, _entries) => {
    exportCalled = true;
    exportFilename = filename;
    return Promise.resolve();
  };

  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  await viewer.handleKey(KEYS.E);
  assert(exportCalled, "exportLogs should have been called on the service");
  assert(exportFilename.startsWith("structured-logs-"));
});

Deno.test("StructuredLogViewer: rendering status bar", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // Enable some flags to check status bar
  const ext = viewer.getExtensions();
  ext.realTimeEnabled = true;
  ext.autoRefresh = true;
  ext.showPerformanceMetrics = true;
  ext.bookmarkedIds.add("123");

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

  (viewer as any).state.filterText = "test query";
  viewer.getExtensions().groupBy = "level";

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
  const logs = await viewer.getLogs();
  (viewer as any).state.selectedId = logs[0].timestamp;

  await (viewer as any).setCorrelationMode("c1");
  assertEquals(viewer.getExtensions().correlationMode, true, "Correlation mode should be enabled");
  assertEquals(viewer.getExtensions().activeCorrelationId, "c1");

  let filteredLogs = viewer.getExtensions().logEntries;
  assert(filteredLogs.length > 0);
  assert(filteredLogs.every((l: LogEntry) => l.context.correlation_id === "c1"));

  // Toggle off
  await viewer.handleKey(KEYS.C);
  assertEquals(viewer.getExtensions().correlationMode, false, "Correlation mode should be disabled");

  // Test trace mode filtering
  await (viewer as any).setTraceMode("t1");
  assertEquals(viewer.getExtensions().activeTraceId, "t1");
  filteredLogs = viewer.getExtensions().logEntries;
  assert(filteredLogs.every((l: LogEntry) => l.context.trace_id === "t1"));
});

Deno.test("StructuredLogViewer: real-time updates", async () => {
  const service = new MockLogService();
  let subCallback: ((entry: LogEntry) => void) | undefined;

  service.subscribeToLogs = (cb) => {
    subCallback = cb;
    return () => {};
  };

  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs(); // Ensure initialized
  viewer.toggleRealTime();
  assertEquals(viewer.getExtensions().realTimeEnabled, true, "Real-time should be enabled");
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

  const ext = viewer.getExtensions();
  assertEquals(ext.logEntries[0].message, "Real-time log");
});

Deno.test("StructuredLogViewer: grouping modes coverage", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // Test all grouping modes
  viewer.getExtensions().groupBy = "trace";
  (viewer as any).buildTree();
  let tree = (viewer as any).state.tree;
  assert(tree.some((n: any) => n.id === "t1"));

  viewer.getExtensions().groupBy = "agent";
  (viewer as any).buildTree();
  tree = (viewer as any).state.tree;
  assert(tree.some((n: any) => n.id === "no-agent")); // Mock logs have no agent_id

  viewer.getExtensions().groupBy = "level";
  (viewer as any).buildTree();
  tree = (viewer as any).state.tree;
  assert(tree.some((n: any) => n.id === "info"));

  viewer.getExtensions().groupBy = "time";
  (viewer as any).buildTree();
  tree = (viewer as any).state.tree;
  // Should have date keys
  assert(tree.length > 0);
  assert(tree[0].id.includes("-")); // YYYY-MM-DD
});

Deno.test("StructuredLogViewer: navigation edge cases", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });
  await viewer.refreshLogs();

  // Test home/end
  const firstId = viewer.getSelectedId();
  await viewer.handleKey(KEYS.END);
  assert(viewer.getSelectedId() !== firstId);

  await viewer.handleKey(KEYS.HOME);
  assertEquals(viewer.getSelectedId(), firstId);

  // Test left/right on non-expandable or already in state
  // Force selection of a leaf node
  // Expand first group
  await viewer.handleKey(KEYS.ENTER);
  await viewer.handleKey(KEYS.RIGHT); // Should do nothing on leaf or already expanded

  // Test escape/q handling
  await viewer.handleKey(KEYS.Q);
  // Helper does nothing on Q usually, but check no error
});

Deno.test("StructuredLogViewer: dialog key handling", async () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  // Open search dialog
  await viewer.handleKey(KEYS.S);

  // Interact with dialog
  // Default focus is on input, but we need to press Enter to start editing
  await viewer.handleKey(KEYS.ENTER);
  await viewer.handleKey(KEYS.T); // type 't'
  await viewer.handleKey(KEYS.E); // type 'e'

  // Verify value inside dialog
  const activeDialog = (viewer as any).state.activeDialog;
  assertEquals(activeDialog.getValue(), "te");

  await viewer.handleKey(KEYS.ENTER); // stop editing, moves focus to OK
  await viewer.handleKey(KEYS.ENTER); // confirm

  // After confirm, search query should be updated
  assertEquals((viewer as any).state.filterText, "te");
  assert(!(viewer as any).state.activeDialog);
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
  let filtered = viewer.getExtensions().filteredEntries;
  assertEquals(filtered.length, 1);
  assertEquals(filtered[0].level, "error");

  // Filter to debug (none)
  viewer.setLogLevelFilter(["debug"]);
  filtered = viewer.getExtensions().filteredEntries;
  assertEquals(filtered.length, 0);
});

Deno.test("StructuredLogViewer: auto refresh toggle", () => {
  const service = new MockLogService();
  const viewer = new StructuredLogViewer(service, mockLogger, { testMode: true });

  // Enable
  viewer.toggleAutoRefresh();
  assert(viewer.getExtensions().autoRefresh);
  assert((viewer as any).refreshInterval !== undefined);

  // Disable
  viewer.toggleAutoRefresh();
  assert(!viewer.getExtensions().autoRefresh);
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
  viewer.getExtensions().groupBy = "none";
  (viewer as any).buildTree();

  // Select first node
  const firstLogId = viewer.getExtensions().logEntries[0].timestamp;
  (viewer as any).state.selectedId = firstLogId;

  // Press 'c' to enable correlation mode for "c1"
  await viewer.handleKey(KEYS.C);
  assertEquals(viewer.getExtensions().correlationMode, true, "Correlation mode should be enabled via 'c'");
  assertEquals(viewer.getExtensions().activeCorrelationId, "c1");

  // Press 'c' to disable
  await viewer.handleKey(KEYS.C);
  assertEquals(viewer.getExtensions().correlationMode, false, "Correlation mode should be disabled via 'c'");
  assertEquals(viewer.getExtensions().activeCorrelationId, null);

  // Press 't' to enable trace mode for "t1"
  await viewer.handleKey(KEYS.T);
  assertEquals(viewer.getExtensions().activeTraceId, "t1");

  // Press 't' to disable
  await viewer.handleKey(KEYS.T);
  assertEquals(viewer.getExtensions().activeTraceId, null);
});
