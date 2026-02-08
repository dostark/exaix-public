import { assertEquals } from "@std/assert";
import { AgentStatus, coerceAgentStatus, isAgentStatus } from "../../../src/tui/agent_status/agent_status.ts";
import { TEST_AGENT_STATUS_INVALID } from "../../config/constants.ts";

Deno.test("isAgentStatus: accepts known values", () => {
  assertEquals(isAgentStatus(AgentStatus.ACTIVE), true);
  assertEquals(isAgentStatus(AgentStatus.INACTIVE), true);
  assertEquals(isAgentStatus(AgentStatus.ERROR), true);
});

Deno.test("isAgentStatus: rejects unknown values", () => {
  assertEquals(isAgentStatus(TEST_AGENT_STATUS_INVALID), false);
  assertEquals(isAgentStatus(123), false);
});

Deno.test("coerceAgentStatus: returns fallback for invalid", () => {
  assertEquals(coerceAgentStatus(TEST_AGENT_STATUS_INVALID), AgentStatus.INACTIVE);
});

Deno.test("coerceAgentStatus: preserves valid status", () => {
  assertEquals(coerceAgentStatus(AgentStatus.ACTIVE), AgentStatus.ACTIVE);
});
