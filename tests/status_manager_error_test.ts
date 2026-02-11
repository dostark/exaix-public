import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { parse } from "@std/yaml";
import { StatusManager } from "../src/services/request_processing/status_manager.ts";
import { RequestStatus } from "../src/requests/request_status.ts";
import { initTestDbService } from "./helpers/db.ts";

function parseFrontmatter(content: string): Record<string, unknown> {
  const parts = content.split("---");
  if (parts.length < 3) {
    throw new Error("Invalid markdown content: missing YAML frontmatter delimiters.");
  }
  return parse(parts[1]) as Record<string, unknown>;
}

Deno.test("StatusManager error storage regression test", async () => {
  const testDbResult = await initTestDbService();
  const { tempDir, cleanup } = testDbResult;

  try {
    const statusManager = new StatusManager({
      error: async () => {},
      info: async () => {},
      debug: async () => {},
    } as any);

    const requestPath = join(tempDir, "test-request.md");
    const originalContent = `---
trace_id: "test-trace-id"
created: "2024-01-01T00:00:00.000Z"
status: pending
priority: normal
agent: technical-writer
source: cli
created_by: "test@example.com"
---

Test request content.
`;

    await Deno.writeTextFile(requestPath, originalContent);

    // Test error message storage
    await statusManager.updateStatus(
      requestPath,
      RequestStatus.FAILED,
      "Plan validation failed: Invalid JSON structure",
    );

    const updatedContent = await Deno.readTextFile(requestPath);
    const updatedFrontmatter = parseFrontmatter(updatedContent);

    // Verify status was updated
    assertEquals(updatedFrontmatter.status, RequestStatus.FAILED);

    // Verify error message was added
    assertEquals(updatedFrontmatter.error, "Plan validation failed: Invalid JSON structure");

    console.log("✅ StatusManager error storage test passed");
  } finally {
    await cleanup();
  }
});
