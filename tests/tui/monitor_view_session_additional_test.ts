import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";

import { MinimalLogServiceMock, MonitorTuiSession, MonitorView } from "../../src/tui/monitor_view.ts";
import type { LogEntry } from "../../src/tui/monitor_view.ts";

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    trace_id: overrides.trace_id ?? "trace",
    actor: overrides.actor ?? "actor",
    agent_id: overrides.agent_id ?? "agent",
    action_type: overrides.action_type ?? "request_created",
    target: overrides.target ?? "t",
    payload: overrides.payload ?? { k: 1 },
    timestamp: overrides.timestamp ?? new Date().toISOString(),
  };
}

Deno.test("MonitorTuiSession: grouping cycles none -> agent -> action -> none", async () => {
  const logs = [
    makeLog({ id: "1", agent_id: "a1", action_type: "request_created" }),
    makeLog({ id: "2", agent_id: "a2", action_type: "plan_approved" }),
  ];

  const svc = new MinimalLogServiceMock(logs);
  const view = new MonitorView(svc);
  await view.refreshLogs();

  const session = view.createTuiSession(false);

  assertEquals(session.getGroupBy(), "none");
  session.toggleGrouping();
  assertEquals(session.getGroupBy(), "agent");
  assertExists(session.getLogTree().find((n) => n.id.startsWith("agent-")));

  session.toggleGrouping();
  assertEquals(session.getGroupBy(), "action");
  assertExists(session.getLogTree().find((n) => n.id.startsWith("action-")));

  session.toggleGrouping();
  assertEquals(session.getGroupBy(), "none");
});

Deno.test("MonitorTuiSession: toggleBookmark ignores group nodes and toggles log nodes", async () => {
  const logs = [makeLog({ id: "1", agent_id: "a1" })];
  const svc = new MinimalLogServiceMock(logs);
  const view = new MonitorView(svc);
  await view.refreshLogs();

  const session = view.createTuiSession(false) as MonitorTuiSession;

  // force a group node selection
  session.toggleGrouping();
  session.toggleBookmark();
  assertEquals(session.getBookmarkedIds().size, 0);

  // select a log node by rebuilding flat tree
  session.toggleGrouping();
  session.toggleGrouping();
  const first = session.getLogTree()[0];
  (session as any).state.selectedId = first.id;

  session.toggleBookmark();
  assertEquals(session.isBookmarked(first.id), true);
  session.toggleBookmark();
  assertEquals(session.isBookmarked(first.id), false);
});

Deno.test("MonitorTuiSession: showLogDetail populates detail panel", async () => {
  const logs = [makeLog({ id: "1", payload: { hello: "world" } })];
  const svc = new MinimalLogServiceMock(logs);
  const view = new MonitorView(svc);
  await view.refreshLogs();

  const session = view.createTuiSession(false) as MonitorTuiSession;
  session.showLogDetail("1");

  assertEquals(session.isDetailVisible(), true);
  assertStringIncludes(session.getDetailContent(), "Payload:");
  assertStringIncludes(session.getDetailContent(), "world");
});

Deno.test("MonitorTuiSession: status line reflects paused, bookmarks, and grouping", async () => {
  const logs = [makeLog({ id: "1" })];
  const svc = new MinimalLogServiceMock(logs);
  const view = new MonitorView(svc);
  await view.refreshLogs();

  const session = view.createTuiSession(false) as MonitorTuiSession;

  // bookmark selected log
  const first = session.getLogTree()[0];
  (session as any).state.selectedId = first.id;
  session.toggleBookmark();

  session.toggleGrouping();

  // pause
  session.togglePause();

  const status = session.renderStatusLine();
  assertStringIncludes(status, "[PAUSED]");
  assertStringIncludes(status, "bookmarked");
  assertStringIncludes(status, "Group:");
});

Deno.test("MonitorTuiSession: renderHelp includes key hints", async () => {
  const logs = [makeLog({ id: "1" })];
  const svc = new MinimalLogServiceMock(logs);
  const view = new MonitorView(svc);
  await view.refreshLogs();

  const session = view.createTuiSession(false);
  const help = session.renderHelp().join("\n");
  assertStringIncludes(help, "Monitor View Help");
  assertStringIncludes(help, "Bookmark");
});
