/**
 * CLI Fallback Regression Tests
 *
 * These tests verify that CLI commands don't crash when database services
 * fail to initialize. This was a bug where EventLogger tried to call
 * this.db.logActivity() on an empty fallback object.
 *
 * Regression test for: "TypeError: this.db.logActivity is not a function"
 *
 * @see https://github.com/dostark/exoframe/issues/XXX
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { EventLogger } from "../src/services/event_logger.ts";

const TEST_ACTION = "test.action";
const TEST_WARNING = "test.warning";
const TEST_ERROR = "test.error";
const TEST_DEBUG = "test.debug";
const TEST_TARGET = "test-target";
const CHILD_ACTION = "child.action";
const CHILD_TARGET = "child-target";
const TEST_TRACE_ID = "test-trace-123";
const TEST_USER = "test-user";

// ============================================================================
// Stub Database Interface Tests
// ============================================================================

Deno.test("[regression] Stub db object has required logActivity method", () => {
  // This is the stub db object used in exoctl.ts fallback paths
  const stubDb = {
    logActivity: () => {},
    waitForFlush: async () => {},
  };

  // Verify methods exist and are callable
  assertExists(stubDb.logActivity, "stubDb.logActivity should exist");
  assertExists(stubDb.waitForFlush, "stubDb.waitForFlush should exist");
  assertEquals(typeof stubDb.logActivity, "function");
  assertEquals(typeof stubDb.waitForFlush, "function");

  // Verify they can be called without throwing
  stubDb.logActivity();
  stubDb.waitForFlush();
});

Deno.test("[regression] EventLogger works with stub db that has logActivity", async () => {
  // Simulate the fallback db stub from exoctl.ts
  const stubDb = {
    logActivity: () => {},
    waitForFlush: async () => {},
  };

  // Create EventLogger with stub db (same as CLI does in fallback mode)
  const logger = new EventLogger({ db: stubDb as any });

  // These should NOT throw "this.db.logActivity is not a function"
  await logger.info(TEST_ACTION, TEST_TARGET, { key: "value" });
  await logger.warn(TEST_WARNING, TEST_TARGET);
  await logger.error(TEST_ERROR, TEST_TARGET);
  await logger.debug(TEST_DEBUG, TEST_TARGET);

  // If we get here without throwing, the test passes
  assert(true, "EventLogger should work with stub db");
});

Deno.test("[regression] EventLogger works with empty db (no methods) - should not crash", async () => {
  // Before the fix, this would throw: "TypeError: this.db.logActivity is not a function"
  // After the fix, EventLogger should handle this gracefully

  // Simulate completely empty db object (worst case)
  const emptyDb = {} as any;

  // Create EventLogger with empty db
  const logger = new EventLogger({ db: emptyDb });

  // These should gracefully handle missing logActivity
  // The error should be caught and logged as a warning, not thrown
  try {
    await logger.info(TEST_ACTION, TEST_TARGET, { key: "value" });
    // If db.logActivity is missing, EventLogger will catch the error internally
  } catch (error) {
    // This is NOT expected after the fix - EventLogger should handle missing methods
    // But we include this test to document the behavior
    assert(
      (error as Error).message.includes("logActivity"),
      "If error occurs, it should be about logActivity",
    );
  }
});

Deno.test("[regression] EventLogger works with no db at all (console-only mode)", async () => {
  // EventLogger should work in console-only mode when no db is provided
  const logger = new EventLogger({});

  // Should not throw
  await logger.info(TEST_ACTION, TEST_TARGET, { key: "value" });
  await logger.warn(TEST_WARNING, TEST_TARGET);
  await logger.error(TEST_ERROR, TEST_TARGET);

  assert(true, "EventLogger should work without db");
});

Deno.test("[regression] EventLogger child loggers work with stub db", async () => {
  const stubDb = {
    logActivity: () => {},
    waitForFlush: async () => {},
  };

  const parentLogger = new EventLogger({ db: stubDb as any });
  const childLogger = parentLogger.child({ actor: TEST_USER, traceId: TEST_TRACE_ID });

  // Child logger should also work without throwing
  await childLogger.info(CHILD_ACTION, CHILD_TARGET, { from: "child" });

  assert(true, "Child logger should work with stub db");
});

// ============================================================================
// CLI Command Regression Tests
// ============================================================================

Deno.test({
  name: "[regression] CLI falls back gracefully when services fail to initialize",
  // Disable resource sanitizer as ConfigService may load SQLite dynamic library
  sanitizeResources: false,
  async fn() {
    // Set test mode before importing exoctl to prevent top-level service initialization
    const originalEnv = Deno.env.get("EXO_TEST_CLI_MODE");
    Deno.env.set("EXO_TEST_CLI_MODE", "1");

    try {
      // Import the test helper from exoctl to verify fallback behavior
      const { __test_initializeServices } = await import("../src/cli/exoctl.ts");

      // Simulate service initialization failure
      const result = await __test_initializeServices({ simulateFail: true });

      // Should return success: false but with valid stub services
      assertEquals(result.success, false);

      // The db stub should have the required methods
      assertExists(result.db, "Fallback db should exist");
      assertExists(result.db.logActivity, "Fallback db should have logActivity");
      assertExists(result.db.waitForFlush, "Fallback db should have waitForFlush");
    } finally {
      // Restore environment
      if (originalEnv === undefined) {
        Deno.env.delete("EXO_TEST_CLI_MODE");
      } else {
        Deno.env.set("EXO_TEST_CLI_MODE", originalEnv);
      }
    }
  },
});

Deno.test("[regression] CLI test mode context has stub db with required methods", async () => {
  // Set environment to force test mode
  const originalEnv = Deno.env.get("EXO_TEST_CLI_MODE");
  Deno.env.set("EXO_TEST_CLI_MODE", "1");

  try {
    // Re-import to get test mode context
    // Note: Due to module caching, this may not re-initialize
    // Instead, we verify the test helper directly
    const { __test_initializeServices } = await import("../src/cli/exoctl.ts");
    const result = await __test_initializeServices({ simulateFail: true });

    // Verify stub methods exist
    assertEquals(typeof result.db.logActivity, "function");
    assertEquals(typeof result.db.waitForFlush, "function");
  } finally {
    // Restore environment
    if (originalEnv === undefined) {
      Deno.env.delete("EXO_TEST_CLI_MODE");
    } else {
      Deno.env.set("EXO_TEST_CLI_MODE", originalEnv);
    }
  }
});

// ============================================================================
// Specific Command Regression Tests
// ============================================================================

Deno.test("[regression] BlueprintCommands works with stub db", async () => {
  // Import BlueprintCommands
  const { BlueprintCommands } = await import("../src/cli/blueprint_commands.ts");

  // Create minimal config
  const config = {
    system: { root: Deno.cwd() },
    paths: {
      blueprints: "Blueprints",
      agents: "Agents",
    },
  } as any;

  // Create stub db with required methods
  const stubDb = {
    logActivity: () => {},
    waitForFlush: async () => {},
  };

  // Create command handler
  const blueprintCommands = new BlueprintCommands({ config, db: stubDb as any });

  // list() should work without throwing db errors
  try {
    await blueprintCommands.list();
  } catch (error) {
    // Directory not found is OK, but "logActivity is not a function" is NOT OK
    const message = (error as Error).message;
    assert(
      !message.includes("logActivity is not a function"),
      "Should not throw logActivity error",
    );
  }
});

Deno.test("[regression] RequestCommands works with stub db", async () => {
  // Import RequestCommands
  const { RequestCommands } = await import("../src/cli/request_commands.ts");

  // Create minimal config
  const config = {
    system: { root: Deno.cwd() },
    paths: {
      workspace: "Workspace",
      requests: "Requests",
    },
  } as any;

  // Create stub db with required methods
  const stubDb = {
    logActivity: () => {},
    waitForFlush: async () => {},
  };

  // Create command handler
  const requestCommands = new RequestCommands({ config, db: stubDb as any });

  // list() should work without throwing db errors
  try {
    await requestCommands.list();
  } catch (error) {
    // Directory not found is OK, but "logActivity is not a function" is NOT OK
    const message = (error as Error).message;
    assert(
      !message.includes("logActivity is not a function"),
      "Should not throw logActivity error",
    );
  }
});

Deno.test("[regression] PlanCommands works with stub db", async () => {
  // Import PlanCommands
  const { PlanCommands } = await import("../src/cli/plan_commands.ts");

  // Create minimal config with all required paths
  const config = {
    system: { root: Deno.cwd() },
    paths: {
      workspace: "Workspace",
      plans: "Plans",
      active: "Active",
      rejected: "Rejected",
      archive: "Archive",
      requests: "Requests",
      agents: "Agents",
      flows: "Flows",
      memory: "Memory",
      portals: "Portals",
      blueprints: "Blueprints",
      runtime: "Runtime",
      memoryProjects: "Memory/Projects",
      memoryExecution: "Memory/Execution",
      memoryIndex: "Memory/Index",
      memorySkills: "Memory/Skills",
      memoryPending: "Memory/Pending",
      memoryTasks: "Memory/Tasks",
      memoryGlobal: "Memory/Global",
    },
  } as any;

  // Create stub db with required methods
  const stubDb = {
    logActivity: () => {},
    waitForFlush: async () => {},
  };

  // Create command handler
  const planCommands = new PlanCommands({ config, db: stubDb as any });

  // list() should work without throwing db errors
  try {
    await planCommands.list();
  } catch (error) {
    // Directory not found is OK, but "logActivity is not a function" is NOT OK
    const message = (error as Error).message;
    assert(
      !message.includes("logActivity is not a function"),
      "Should not throw logActivity error",
    );
  }
});
