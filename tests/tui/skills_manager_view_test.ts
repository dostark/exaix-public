/**
 * Skills Manager View Tests
 *
 * Phase 17.13: TUI Skills Support
 *
 * Tests for the SkillsManagerView TUI component.
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { AgentStatus } from "../../src/tui/agent_status/agent_status.ts";
import { RequestStatus } from "../../src/requests/request_status.ts";
import { MinimalSkillsServiceMock, SkillsManagerView, type SkillSummary } from "../../src/tui/skills_manager_view.ts";
import { KEYS } from "../../src/helpers/keyboard.ts";
import { sampleTestSkills } from "./helpers.ts";
import { TEST_MODEL_OPENAI } from "../config/constants.ts";

// ===== Test Data =====

const TEST_SKILLS: SkillSummary[] = sampleTestSkills();

// ===== SkillsManagerView Tests =====

Deno.test("SkillsManagerView: renders skill tree", async () => {
  const mockService = new MinimalSkillsServiceMock(TEST_SKILLS);
  const view = new SkillsManagerView(mockService);
  const session = view.createTuiSession(false);

  await session.initialize();
  const rendered = session.render();

  assertStringIncludes(rendered, "SKILLS MANAGER");
  assertStringIncludes(rendered, "TDD Methodology");
});

Deno.test("SkillsManagerView: navigates with keyboard", async () => {
  const mockService = new MinimalSkillsServiceMock(TEST_SKILLS);
  const view = new SkillsManagerView(mockService);
  const session = view.createTuiSession(false);

  await session.initialize();

  // Navigate down
  await session.handleKey(KEYS.DOWN);
  const selectedId = session.getSelectedId();

  // Should have moved selection
  assertEquals(selectedId !== null, true);
});

Deno.test("SkillsManagerView: shows skill detail on select", async () => {
  const mockService = new MinimalSkillsServiceMock(TEST_SKILLS);
  const view = new SkillsManagerView(mockService);
  const session = view.createTuiSession(false);

  await session.initialize();

  // Navigate to a skill (past the group header)
  await session.handleKey(KEYS.DOWN);
  await session.handleKey(KEYS.DOWN);

  // Show detail
  await session.handleKey(KEYS.ENTER);
  assertEquals(session.isShowingDetail(), true);
  const detail = session.renderDetail();
  assertStringIncludes(detail, "Skill:");
});

Deno.test("SkillsManagerView: opens search dialog", async () => {
  const mockService = new MinimalSkillsServiceMock(TEST_SKILLS);
  const view = new SkillsManagerView(mockService);
  const session = view.createTuiSession(false);

  await session.initialize();

  // Open search dialog
  await session.handleKey(KEYS.SLASH);
  assertEquals(session.hasActiveDialog(), true);

  // Cancel search
  await session.handleKey(KEYS.ESCAPE);
  assertEquals(session.hasActiveDialog(), false);
});

Deno.test("SkillsManagerView: groups by source", async () => {
  const mockService = new MinimalSkillsServiceMock(TEST_SKILLS);
  const view = new SkillsManagerView(mockService);
  const session = view.createTuiSession(false);

  await session.initialize();

  const extensions = session.getExtensions();
  // Default grouping is by source
  assertEquals(extensions.groupBy, "source");

  const rendered = session.render();
  // Should show group headers
  assertStringIncludes(rendered, "Core Skills");
});

Deno.test("SkillsManagerView: cycles grouping mode", async () => {
  const mockService = new MinimalSkillsServiceMock(TEST_SKILLS);
  const view = new SkillsManagerView(mockService);
  const session = view.createTuiSession(false);

  await session.initialize();

  // Cycle grouping
  await session.handleKey(KEYS.G);
  let extensions = session.getExtensions();
  assertEquals(extensions.groupBy, "status");

  await session.handleKey(KEYS.G);
  extensions = session.getExtensions();
  assertEquals(extensions.groupBy, "none");

  await session.handleKey(KEYS.G);
  extensions = session.getExtensions();
  assertEquals(extensions.groupBy, "source");
});

Deno.test("SkillsManagerView: shows help screen", async () => {
  const mockService = new MinimalSkillsServiceMock(TEST_SKILLS);
  const view = new SkillsManagerView(mockService);
  const session = view.createTuiSession(false);

  await session.initialize();

  // Show help
  await session.handleKey(KEYS.QUESTION);
  assertEquals(session.isShowingHelp(), true);

  const help = session.renderHelp();
  // renderHelp returns string[]
  assertStringIncludes(help.join("\n"), "Navigation");
  assertStringIncludes(help.join("\n"), "Actions");
});

// ===== AgentStatusView Skills Tests =====

Deno.test("AgentStatusView: displays defaultSkills in detail", async () => {
  // Import dynamically to avoid circular dependency issues
  const { AgentStatusView, MinimalAgentServiceMock } = await import(
    "../../src/tui/agent_status_view.ts"
  );

  const mockService = new MinimalAgentServiceMock([
    {
      id: "agent-1",
      name: "CodeReviewer",
      model: TEST_MODEL_OPENAI,
      status: AgentStatus.ACTIVE,
      lastActivity: new Date().toISOString(),
      capabilities: ["code-review"],
      defaultSkills: ["tdd-methodology", "typescript-patterns"],
    },
  ]);

  const view = new AgentStatusView(mockService);
  const session = view.createTuiSession(false);

  await session.initialize();

  // Navigate to agent and show detail (use handleKey as that's the AgentStatusView's method)
  await session.handleKey(KEYS.DOWN);
  await session.handleKey(KEYS.ENTER);

  // renderDetail returns string[] in AgentStatusView
  const detail = session.renderDetail();
  const detailText = Array.isArray(detail) ? detail.join("\n") : detail;
  assertStringIncludes(detailText, "Default Skills:");
  assertStringIncludes(detailText, "tdd-methodology");
});

// ===== RequestManagerView Skills Tests =====

Deno.test("RequestManagerView: shows skills in request detail", async () => {
  // Import dynamically
  const { RequestManagerView, MinimalRequestServiceMock } = await import(
    "../../src/tui/request_manager_view.ts"
  );

  const requests = [
    {
      trace_id: "test-123",
      filename: "request-test.md",
      title: "Test Request",
      status: RequestStatus.COMPLETED,
      priority: "normal",
      agent: "code-reviewer",
      created: new Date().toISOString(),
      created_by: "test@example.com",
      source: "cli",
      skills: {
        explicit: ["security-audit"],
        autoMatched: ["code-review"],
        fromDefaults: ["typescript-patterns"],
        skipped: [],
      },
    },
  ];

  const mockService = new MinimalRequestServiceMock();
  const view = new RequestManagerView(mockService);
  const session = view.createTuiSession(requests);

  // Navigate to request and show detail (use handleKey for RequestManagerView)
  await session.handleKey(KEYS.DOWN);
  await session.handleKey(KEYS.ENTER);

  // renderDetail returns string[] for RequestManager
  const detail = session.renderDetail();
  const detailText = Array.isArray(detail) ? detail.join("\n") : detail;
  assertStringIncludes(detailText, "Applied Skills:");
  assertStringIncludes(detailText, "security-audit");
});
