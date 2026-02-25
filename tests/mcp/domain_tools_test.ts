import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { stub } from "@std/testing/mock";
import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { ApprovePlanTool, CreateRequestTool, ListPlansTool, QueryJournalTool } from "../../src/mcp/domain_tools.ts";
import { DatabaseService as DatabaseService } from "../../src/services/db.ts";
import type { Config } from "../../src/config/schema.ts";
import { ExoPathDefaults } from "../../src/config/constants.ts";

// Mock Config
const createMockConfig = (rootDir: string): Config => ({
  system: {
    root: rootDir,
    log_level: "info",
    version: "1.0.0",
  },
  paths: {
    ...ExoPathDefaults,
  },
  database: {
    batch_flush_ms: 100,
    batch_max_size: 10,
    sqlite: {
      journal_mode: "WAL",
      foreign_keys: true,
      busy_timeout_ms: 1000,
    },
  },
  // Minimal other config as needed
} as Partial<Config> as Config);

Deno.test("MCP Domain Tools", async (t) => {
  const tempDir = await Deno.makeTempDir();
  const config = createMockConfig(tempDir);

  // Ensure runtime dir exists for DB
  await ensureDir(join(tempDir, config.paths.runtime));
  const db = new DatabaseService(config);

  // Initialize DB schema
  db.instance.exec(`
    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      actor TEXT NOT NULL,
      agent_id TEXT,
      action_type TEXT NOT NULL,
      target TEXT,
      payload TEXT NOT NULL,
      timestamp DATETIME DEFAULT (datetime('now'))
    );
  `);

  await t.step("CreateRequestTool", async () => {
    const tool = new CreateRequestTool(config, db);
    const result = await tool.execute({
      description: "Test Request",
      agent: "test-agent",
      agent_id: "user-1",
    });

    assertExists(result.content);
    const text = result.content[0].text;
    assertExists(text);

    // Check if file exists
    // Parse ID from text or check directory
    const requestsDir = join(tempDir, config.paths.workspace, config.paths.requests);
    let found = false;
    for await (const entry of Deno.readDir(requestsDir)) {
      if (entry.name.endsWith(".md")) {
        found = true;
        const content = await Deno.readTextFile(join(requestsDir, entry.name));
        assertEquals(content.includes("Test Request"), true);
        break;
      }
    }
    assertEquals(found, true);
  });

  await t.step("ListPlansTool", async () => {
    // Manually create a plan file
    const plansDir = join(tempDir, config.paths.workspace, config.paths.plans);
    await ensureDir(plansDir);
    const planId = "plan-123";
    const planContent = `---
status: pending
trace_id: trace-1
agent_id: agent-1
created_at: 2023-01-01T00:00:00Z
---
# Plan
Plan content
`;
    await Deno.writeTextFile(join(plansDir, `${planId}.md`), planContent);

    const tool = new ListPlansTool(config, db);
    const result = await tool.execute({
      status: "pending",
      agent_id: "user-1",
    });

    const plans = JSON.parse(result.content[0].text);
    assertEquals(Array.isArray(plans), true);
    assertEquals(plans.length, 1);
    assertEquals(plans[0].id, planId);
  });

  await t.step("ApprovePlanTool", async () => {
    // Needs a plan in 'review' status (PlanCommands requires 'review' status for approval, not 'pending'?)
    // Let's check PlanCommands logic. Yes, lines 84: if (frontmatter.status !== PlanStatus.REVIEW)
    // So we must set status to review.

    const plansDir = join(tempDir, config.paths.workspace, config.paths.plans);
    const planId = "plan-approve";
    const planContent = `---
status: review
trace_id: trace-2
agent_id: agent-1
---
# Plan
To be approved
`;
    await Deno.writeTextFile(join(plansDir, `${planId}.md`), planContent);

    const tool = new ApprovePlanTool(config, db);
    const result = await tool.execute({
      plan_id: planId,
      agent_id: "user-1",
    });

    assertExists(result.content);
    assertEquals(result.content[0].text.includes("approved successfully"), true);

    // Verify moved to active
    const activeDir = join(tempDir, config.paths.workspace, config.paths.active);
    const activePath = join(activeDir, `${planId}.md`);
    assertEquals(await Deno.stat(activePath).then(() => true).catch(() => false), true);
  });

  await t.step("QueryJournalTool", async () => {
    // Log some activity first
    db.logActivity("test", "test.action", "target", { foo: "bar" });
    // Wait for flush? DatabaseService writes async.
    // We need to wait or force flush.
    // Since we don't have public flush, let's just wait a bit or use getRecentActivities which flushes internally?
    // Looking at db.ts: getRecentActivity calls flush(). Great.

    const tool = new QueryJournalTool(config, db);
    const result = await tool.execute({
      limit: 10,
      agent_id: "user-1",
    });

    const activities = JSON.parse(result.content[0].text);
    assertEquals(Array.isArray(activities), true);
    // Might contain logs from previous steps too
    assertEquals(activities.length > 0, true);
  });

  await t.step("ListPlansTool uses default status", async () => {
    const tool = new ListPlansTool(config, db);
    // No status provided -> should be PENDING
    const result = await tool.execute({
      agent_id: "user-1",
    });

    // Check internal log or result
    // Should be successful
    const plans = JSON.parse(result.content[0].text);
    assertEquals(Array.isArray(plans), true);
  });

  await t.step("QueryJournalTool with trace_id", async () => {
    const tool = new QueryJournalTool(config, db);
    // Generate a known trace_id via logActivity
    const traceId = "special-trace-123";
    await db.logActivity("actor", "action", "target", {}, traceId);

    // Wait for flush (config batch_flush_ms = 100)
    await new Promise((resolve) => setTimeout(resolve, 200));

    const result = await tool.execute({
      agent_id: "user-1",
      trace_id: traceId, // This filters by trace_id
    });

    const activities = JSON.parse(result.content[0].text);
    assertEquals(Array.isArray(activities), true);
    // Should find the one we just logged
    const found = activities.find((a: any) => a.trace_id === traceId);
    assertExists(found);
  });

  await t.step("Tools handle errors gracefully (catch block)", async () => {
    // Stub async safe db method to throw, forcing an error in tool execution
    const stubMethod = stub(
      db,
      "getActivitiesByTraceSafe",
      () => Promise.reject(new Error("Database Failure")),
    );

    const tool = new QueryJournalTool(config, db);

    try {
      await assertRejects(
        async () => {
          await tool.execute({
            agent_id: "user-1",
            trace_id: "any",
          });
        },
        Error,
        "Database Failure",
      );
    } finally {
      stubMethod.restore();
    }
  });

  await t.step("Tools expose valid definitions", () => {
    const tools = [
      new CreateRequestTool(config, db),
      new ListPlansTool(config, db),
      new ApprovePlanTool(config, db),
      new QueryJournalTool(config, db),
    ];

    for (const tool of tools) {
      const def = tool.getToolDefinition();
      assertExists(def.name);
      assertExists(def.inputSchema);
    }
  });

  // Cleanup
  await db.close();
  await Deno.remove(tempDir, { recursive: true });
});
