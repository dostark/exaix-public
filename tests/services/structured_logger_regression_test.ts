import { assertEquals, assertExists } from "@std/assert";
import { exists } from "@std/fs";
import { join } from "@std/path";
import { FileOutput, LogEntry } from "../../src/services/structured_logger.ts";

/**
 * Regression test for: "NotFound: No such file or directory (os error 2): writefile ..."
 * Root cause: FileOutput tried to write to a path where parent processing directory did not exist.
 * Fix: Added ensureDir logic inside FileOutput.write() to automatically create parent directories.
 */
Deno.test("[regression] FileOutput automatically creates missing parent directories", async () => {
  const tmpDir = await Deno.makeTempDir({ prefix: "exoframe_test_logger_" });
  const deepLogPath = join(tmpDir, "level1", "level2", "test.jsonl");

  try {
    // Ensure parent dir doesn't exist
    assertEquals(await exists(join(tmpDir, "level1")), false);

    const output = new FileOutput(deepLogPath);
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      message: "Test log message",
      context: {},
    };

    // This should NOT throw, but instead create directory and write file
    await output.write(entry);

    // Verify file exists
    assertEquals(await exists(deepLogPath), true);

    // Verify content
    const content = await Deno.readTextFile(deepLogPath);
    assertExists(content.match(/"message":"Test log message"/));
  } finally {
    // Cleanup
    await Deno.remove(tmpDir, { recursive: true });
  }
});
