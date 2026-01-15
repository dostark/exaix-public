/**
 * Safe Subprocess Tests
 *
 * Tests for subprocess execution utility including timeout and error handling.
 */

import { assert, assertEquals, assertRejects } from "@std/assert";
import { SafeSubprocess, SubprocessError, SubprocessTimeoutError } from "../../src/utils/subprocess.ts";

Deno.test("SafeSubprocess: runs command successfully", async () => {
  const result = await SafeSubprocess.run("echo", ["hello"]);
  assertEquals(result.code, 0);
  assert(result.stdout.includes("hello"));
});

Deno.test("SafeSubprocess: respects timeout", async () => {
  // timeout 100ms, sleep 1s (using integer to be safe)
  await assertRejects(
    async () => {
      await SafeSubprocess.run("sleep", ["2"], { timeoutMs: 100 });
    },
    SubprocessTimeoutError,
    "timed out",
  );
});

Deno.test("SafeSubprocess: handles command not found", async () => {
  await assertRejects(
    async () => {
      await SafeSubprocess.run("nonexistent-command-xyz", []);
    },
    SubprocessError,
    "Command not found",
  );
});

Deno.test("SafeSubprocess: respects cwd option", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const result = await SafeSubprocess.run("pwd", [], { cwd: tempDir });
    assertEquals(result.code, 0);
    // On linux /tmp/... is often realpath'd
    const realTemp = await Deno.realPath(tempDir);
    assert(result.stdout.trim().includes(realTemp.trim()));
  } finally {
    await Deno.remove(tempDir);
  }
});

Deno.test("SafeSubprocess: respects env option", async () => {
  const result = await SafeSubprocess.run("printenv", ["TEST_VAR"], {
    env: { "TEST_VAR": "test_value" },
  });
  assertEquals(result.code, 0);
  assert(result.stdout.includes("test_value"));
});

Deno.test("SafeSubprocess: handles non-zero exit code", async () => {
  // explicit false or sh -c 'exit 1'
  const result = await SafeSubprocess.run("sh", ["-c", "exit 1"]);
  assertEquals(result.code, 1);
  // Should NOT throw, just return code 1
});

Deno.test("SafeSubprocess: handles abort signal", async () => {
  const controller = new AbortController();
  const task = SafeSubprocess.run("sleep", ["2"], { abortSignal: controller.signal });

  // Abort after a tiny delay to ensure command started
  setTimeout(() => controller.abort(), 10);

  await assertRejects(
    async () => {
      await task;
    },
    SubprocessTimeoutError,
  );
});
