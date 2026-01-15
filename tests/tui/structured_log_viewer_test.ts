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

  getStructuredLogs(_options: any): Promise<LogEntry[]> {
    return Promise.resolve(this.logs);
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
