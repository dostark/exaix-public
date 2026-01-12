import { assertEquals } from "@std/assert";
import { assertSpyCalls, spy } from "@std/testing/mock";
import { GracefulShutdown } from "../../src/services/graceful_shutdown.ts";

/**
 * Tests for GracefulShutdown - Comprehensive Graceful Shutdown Handling
 */

Deno.test("GracefulShutdown: initializes with logger", () => {
  const mockLogger = {
    info: spy(() => {}),
    warn: spy(() => {}),
    error: spy(() => {}),
    fatal: spy(() => {}),
  } as any;

  const shutdown = new GracefulShutdown(mockLogger);
  assertEquals(shutdown["shuttingDown"], false);
  assertEquals(shutdown["cleanupTasks"].length, 0);
});

Deno.test("GracefulShutdown: registers cleanup tasks", () => {
  const mockLogger = {
    info: spy(() => {}),
    warn: spy(() => {}),
    error: spy(() => {}),
    fatal: spy(() => {}),
  } as any;

  const shutdown = new GracefulShutdown(mockLogger);

  const mockHandler = spy(async () => {
    await Promise.resolve();
  });
  shutdown.registerCleanup("test-task", mockHandler, 5000);

  assertEquals(shutdown["cleanupTasks"].length, 1);
  assertEquals(shutdown["cleanupTasks"][0].name, "test-task");
  assertEquals(shutdown["cleanupTasks"][0].handler, mockHandler);
  assertEquals(shutdown["cleanupTasks"][0].timeout, 5000);
});

Deno.test("GracefulShutdown: runs cleanup tasks in reverse order (LIFO)", async () => {
  const mockLogger = {
    info: spy(() => {}),
    warn: spy(() => {}),
    error: spy(() => {}),
    fatal: spy(() => {}),
  } as any;

  const shutdown = new GracefulShutdown(mockLogger);

  const callOrder: string[] = [];
  const task1 = spy(async () => {
    callOrder.push("task1");
    await Promise.resolve();
  });

  const task2 = spy(async () => {
    callOrder.push("task2");
    await Promise.resolve();
  });
  const task3 = spy(async () => {
    callOrder.push("task3");
    await Promise.resolve();
  });

  shutdown.registerCleanup("task1", task1);
  shutdown.registerCleanup("task2", task2);
  shutdown.registerCleanup("task3", task3);

  await shutdown.shutdown(0, false);

  assertEquals(callOrder, ["task3", "task2", "task1"]);
});

Deno.test("GracefulShutdown: handles cleanup task failures", async () => {
  const mockLogger = {
    info: spy(() => {}),
    warn: spy(() => {}),
    error: spy(() => {}),
    fatal: spy(() => {}),
  } as any;

  const shutdown = new GracefulShutdown(mockLogger);

  const failingTask = spy(async () => {
    await Promise.resolve();
    throw new Error("Task failed");
  });

  shutdown.registerCleanup("failing-task", failingTask);

  await shutdown.shutdown(0, false);

  assertSpyCalls(mockLogger.error, 2); // One for the task failure, one for completion
});

Deno.test("GracefulShutdown: prevents multiple shutdown attempts", async () => {
  const mockLogger = {
    info: spy(() => {}),
    warn: spy(() => {}),
    error: spy(() => {}),
    fatal: spy(() => {}),
  } as any;

  const shutdown = new GracefulShutdown(mockLogger);

  const task = spy(async () => {
    await Promise.resolve();
  });
  shutdown.registerCleanup("task", task);

  // Start two shutdowns concurrently
  const shutdown1 = shutdown.shutdown(0, false);
  const shutdown2 = shutdown.shutdown(0, false);

  await Promise.all([shutdown1, shutdown2]);

  assertSpyCalls(mockLogger.warn, 1); // "Shutdown already in progress"
});

Deno.test("GracefulShutdown: uses default timeout when not specified", () => {
  const mockLogger = {
    info: spy(() => {}),
    warn: spy(() => {}),
    error: spy(() => {}),
    fatal: spy(() => {}),
  } as any;

  const shutdown = new GracefulShutdown(mockLogger);

  const task = spy(async () => {
    await Promise.resolve();
  });
  shutdown.registerCleanup("task", task); // No timeout specified

  assertEquals(shutdown["cleanupTasks"][0].timeout, 30000); // Default 30s
});

Deno.test("GracefulShutdown: logs shutdown progress", async () => {
  const mockLogger = {
    info: spy(() => {}),

    warn: spy(() => {}),
    error: spy(() => {}),
    fatal: spy(() => {}),
  } as any;

  const shutdown = new GracefulShutdown(mockLogger);

  const task = spy(async () => {
    await Promise.resolve();
  });
  shutdown.registerCleanup("test-task", task);

  await shutdown.shutdown(0, false);

  // Should log: starting shutdown, running task, task completed, shutdown completed
  assertSpyCalls(mockLogger.info, 4);
  assertEquals(mockLogger.info.calls[0].args[0], "Starting graceful shutdown");
  assertEquals(mockLogger.info.calls[1].args[0], "Running cleanup: test-task");
  assertEquals(mockLogger.info.calls[2].args[0], "Cleanup completed: test-task");
  assertEquals(mockLogger.info.calls[3].args[0], "Graceful shutdown completed successfully");
});
