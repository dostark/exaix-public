/**
 * @module debug_monitor_expand
 * @description Script: debug_monitor_expand
 */
import { KEYS } from "../src/helpers/keyboard.ts";
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
  await session.handleKey(KEYS.G);

  console.log("After grouping (before collapse):");
  console.log(JSON.stringify(session.getLogTree(), null, 2));

  await session.handleKey(KEYS.C);
  console.log("After collapse:");
  console.log(JSON.stringify(session.getLogTree(), null, 2));

  await session.handleKey(KEYS.E);
  console.log("After expand:");
  console.log(JSON.stringify(session.getLogTree(), null, 2));
}

run().catch((e) => {
  console.error(e);
  Deno.exit(1);
});
