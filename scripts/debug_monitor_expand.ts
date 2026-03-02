/**
 * @module debug_monitor_expand
 * @description Script: debug_monitor_expand
 */
import { createMonitorViewWithLogs } from "../tests/tui/helpers.ts";

const { monitorView } = await createMonitorViewWithLogs([
  {
    id: "1",
    trace_id: "t1",
    actor: "user",
    agent_id: "a1",
    action_type: "request_created",
    target: "target.md",
    payload: {},
    timestamp: "2025-12-22T10:00:00Z",
  },
  {
    id: "2",
    trace_id: "t2",
    actor: "user",
    agent_id: "a2",
    action_type: "plan.approved",
    target: "target2.md",
    payload: {},
    timestamp: "2025-12-22T10:01:00Z",
  },
]);

const session = monitorView.createTuiSession();

async function run() {
  // Switch to grouped mode
  await session.handleKey("g");

  console.log("After grouping (before collapse):");
  console.log(JSON.stringify(session.getLogTree(), null, 2));

  await session.handleKey("c");
  console.log("After collapse:");
  console.log(JSON.stringify(session.getLogTree(), null, 2));

  await session.handleKey("e");
  console.log("After expand:");
  console.log(JSON.stringify(session.getLogTree(), null, 2));
}

run().catch((e) => {
  console.error(e);
  Deno.exit(1);
});
