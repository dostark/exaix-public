/**
 * @module ClarificationPersistenceTest
 * @path tests/services/quality_gate/clarification_persistence_test.ts
 * @description Tests for clarification session JSON persistence helpers.
 * @architectural-layer Services
 * @related-files [src/services/quality_gate/clarification_persistence.ts]
 */

import { assertEquals, assertExists } from "@std/assert";
import { join } from "@std/path";
import {
  ClarificationSessionStatus,
  type IClarificationSession,
} from "../../../src/shared/schemas/clarification_session.ts";
import { loadClarification, saveClarification } from "../../../src/services/quality_gate/clarification_persistence.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): Promise<string> {
  return Deno.makeTempDir({ prefix: "clari_test_" });
}

function makeSession(requestId: string): IClarificationSession {
  return {
    requestId,
    originalBody: "Fix the authentication bug",
    rounds: [],
    status: ClarificationSessionStatus.ACTIVE,
    qualityHistory: [{ round: 0, score: 40, level: "poor" }],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("[ClarificationPersistence] saves session as JSON sibling file", async () => {
  const dir = await makeTempDir();
  try {
    const requestPath = join(dir, "my_request.md");
    const session = makeSession("req-save-test");

    await saveClarification(requestPath, session);

    const expectedPath = join(dir, "my_request_clarification.json");
    const stat = await Deno.stat(expectedPath);
    assertExists(stat);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("[ClarificationPersistence] loads previously saved session", async () => {
  const dir = await makeTempDir();
  try {
    const requestPath = join(dir, "my_request.md");
    const session = makeSession("req-load-test");

    await saveClarification(requestPath, session);
    const loaded = await loadClarification(requestPath);

    assertExists(loaded);
    assertEquals(loaded?.requestId, "req-load-test");
    assertEquals(loaded?.status, ClarificationSessionStatus.ACTIVE);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("[ClarificationPersistence] returns null for missing file", async () => {
  const dir = await makeTempDir();
  try {
    const requestPath = join(dir, "nonexistent.md");
    const loaded = await loadClarification(requestPath);
    assertEquals(loaded, null);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("[ClarificationPersistence] returns null for corrupted file", async () => {
  const dir = await makeTempDir();
  try {
    const requestPath = join(dir, "corrupt_request.md");
    const jsonPath = join(dir, "corrupt_request_clarification.json");
    await Deno.writeTextFile(jsonPath, "{ not valid json !!!");

    const loaded = await loadClarification(requestPath);
    assertEquals(loaded, null);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("[ClarificationPersistence] uses atomic write", async () => {
  const dir = await makeTempDir();
  try {
    const requestPath = join(dir, "atomic_request.md");
    const session = makeSession("req-atomic-test");

    await saveClarification(requestPath, session);

    // No tmp file should remain after atomic write
    let tmpExists = false;
    for await (const entry of Deno.readDir(dir)) {
      if (entry.name.endsWith(".tmp")) {
        tmpExists = true;
      }
    }
    assertEquals(tmpExists, false);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
