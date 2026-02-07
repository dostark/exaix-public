import { assertEquals } from "@std/assert";
import { StatusManager } from "../../src/services/request_processing/status_manager.ts";
import { RequestStatus } from "../../src/requests/request_status.ts";
import type { EventLogger } from "../../src/services/event_logger.ts";

Deno.test("StatusManager.updateStatus: rewrites status in frontmatter", async () => {
  const calls: unknown[] = [];
  const logger = {
    error: (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve();
    },
  } as unknown as EventLogger;

  const originalWrite = Deno.writeTextFile;
  let written: { path: string; content: string } | null = null;

  try {
    (Deno as any).writeTextFile = (path: string, content: string) => {
      written = { path, content };
      return Promise.resolve();
    };

    const mgr = new StatusManager(logger);
    const filePath = "/tmp/request.md";
    const original = "---\nstatus: pending\n---\nBody\n";

    await mgr.updateStatus(filePath, original, RequestStatus.FAILED);

    assertEquals(written === null, false);
    assertEquals(written!.path, filePath);
    assertEquals(written!.content.includes("status: failed"), true);
    assertEquals(calls.length, 0);
  } finally {
    (Deno as any).writeTextFile = originalWrite;
  }
});

Deno.test("StatusManager.updateStatus: logs on write failure", async () => {
  const calls: any[] = [];
  const logger = {
    error: (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve();
    },
  } as unknown as EventLogger;

  const originalWrite = Deno.writeTextFile;
  try {
    (Deno as any).writeTextFile = () => {
      throw new Error("write failed");
    };

    const mgr = new StatusManager(logger);
    await mgr.updateStatus("/tmp/request.md", "---\nstatus: pending\n---\n", RequestStatus.FAILED);

    assertEquals(calls.length, 1);
    assertEquals(calls[0][0], "request.status_update_failed");
  } finally {
    (Deno as any).writeTextFile = originalWrite;
  }
});
