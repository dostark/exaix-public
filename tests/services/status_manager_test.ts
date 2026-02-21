import { assertEquals } from "@std/assert";
import { StatusManager } from "../../src/services/request_processing/status_manager.ts";
import { RequestStatus } from "../../src/requests/request_status.ts";
import { EventLogger } from "../../src/services/event_logger.ts";
import { createStubDb } from "../test_helpers.ts";

Deno.test("StatusManager.updateStatus: rewrites status in frontmatter", async () => {
  const tempDir = await Deno.makeTempDir();
  const filePath = `${tempDir}/request.md`;
  const original = "---\nstatus: pending\n---\nBody\n";
  await Deno.writeTextFile(filePath, original);

  try {
    const db = createStubDb();
    const logger = new EventLogger({ db });
    const mgr = new StatusManager(logger);

    await mgr.updateStatus(filePath, RequestStatus.FAILED);

    const updatedContent = await Deno.readTextFile(filePath);
    assertEquals(updatedContent.includes("status: failed"), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("StatusManager.updateStatus: logs on write failure", async () => {
  const tempDir = await Deno.makeTempDir();
  const filePath = `${tempDir}/request.md`;
  // We'll make it fail by making it a directory or removing permissions if possible,
  // but a simpler way is to just mock the logger and ensure it handles errors if we were to mock Deno.
  // Actually, to test "logs on write failure", we still need to trigger a failure.
  // If we can't easily trigger a real failure, we might have to mock Deno, but we should do it at least with proper typing.

  const original = "---\nstatus: pending\n---\n";
  await Deno.writeTextFile(filePath, original);

  const calls: unknown[][] = [];
  const db = createStubDb({
    logActivity: (...args: any[]) => {
      calls.push(args);
    },
  });
  const logger = new EventLogger({ db });

  // In this specific case, to test failure, we can make the file read-only or similar.
  // Or, if we REALLY must mock Deno, we use a type-safe way.
  const mgr = new StatusManager(logger);

  // Trigger error by giving a non-existent path OR a directory path
  await mgr.updateStatus(tempDir, RequestStatus.FAILED);

  assertEquals(calls.length > 0, true);
  const errorEvent = calls.find((c) => c[1] === "request.status_update_failed");
  assertEquals(!!errorEvent, true);

  await Deno.remove(tempDir, { recursive: true });
});
