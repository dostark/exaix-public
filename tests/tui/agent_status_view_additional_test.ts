import { assertEquals, assertStringIncludes } from "@std/assert";
import { AgentHealth, LogLevel } from "../../src/enums.ts";
import { AgentStatus } from "../../src/tui/agent_status/agent_status.ts";

import {
  AgentHealthData,
  AgentLogEntry,
  AgentStatusItem,
  AgentStatusView,
  IAgentService,
} from "../../src/tui/agent_status_view.ts";

class EmptyAgentService implements IAgentService {
  listAgents(): Promise<AgentStatusItem[]> {
    return Promise.resolve([]);
  }
  getAgentLogs(): Promise<AgentLogEntry[]> {
    return Promise.resolve([]);
  }
  getAgentHealth(): Promise<AgentHealthData> {
    return Promise.resolve({ status: AgentHealth.HEALTHY, issues: [], uptime: 0 });
  }
}

class DetailedAgentService implements IAgentService {
  listAgents(): Promise<AgentStatusItem[]> {
    return Promise.resolve([
      {
        id: "agent-x",
        name: "Agent X",
        model: "mock-model",
        status: AgentStatus.ERROR,
        lastActivity: new Date().toISOString(),
        capabilities: ["chat"],
        defaultSkills: [],
      },
    ]);
  }
  getAgentLogs(_agentId: string, _limit = 50): Promise<AgentLogEntry[]> {
    return Promise.resolve([
      { timestamp: new Date().toISOString(), level: LogLevel.ERROR, message: "Boom", traceId: "t1" },
      { timestamp: new Date().toISOString(), level: LogLevel.INFO, message: "Recovered" },
    ]);
  }
  getAgentHealth(_agentId: string): Promise<AgentHealthData> {
    return Promise.resolve({ status: AgentHealth.CRITICAL, issues: ["OOM", "Crash loop"], uptime: 3600 * 5 });
  }
}

Deno.test("AgentStatusView: renders empty agent list message", async () => {
  const view = new AgentStatusView(new EmptyAgentService());
  const out = await view.renderAgentList();
  assertStringIncludes(out, "No agents registered.");
});

Deno.test("AgentStatusView: render details after select shows issues and logs", async () => {
  const svc = new DetailedAgentService();
  const view = new AgentStatusView(svc);
  view.selectAgent("agent-x");
  const details = await view.renderAgentDetails();
  assertStringIncludes(details, "Agent: agent-x");
  if (!details.includes("Issues:") && !details.includes("ISSUES")) {
    throw new Error("Agent details missing issues section");
  }
  // logs should contain error icon and message
  assertStringIncludes(details, "Boom");
});

Deno.test("AgentStatusView: focusable elements stable", () => {
  const view = new AgentStatusView(new EmptyAgentService());
  const elems = view.getFocusableElements();
  assertEquals(elems.includes("agent-list"), true);
  assertEquals(elems.includes("agent-details"), true);
  assertEquals(elems.includes("refresh-button"), true);
});
