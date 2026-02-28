/**
 * @module FileOpsToolTest
 * @path tests/tools/file_ops_test.ts
 * @description Verifies the core file manipulation tools, including safe reading,
 * writing, and listing of project assets.
 */

import { assertEquals } from "@std/assert";
import { ToolRegistry } from "../../src/services/tool_registry.ts";
import { ConfigSchema } from "../../src/shared/schemas/config.ts";

Deno.test("ToolRegistry: core file operations", async (t) => {
  const tempDir = await Deno.makeTempDir();
  const config = ConfigSchema.parse({
    system: { root: tempDir },
    tools: {},
    paths: {},
    database: {},
    watcher: {},
    agents: {},
    models: {},
    portals: [],
    mcp: {},
  });
  const registry = new ToolRegistry({ config, baseDir: tempDir });

  await t.step("write_file and read_file", async () => {
    const filePath = "test.txt";
    const content = "Hello ExoFrame!";

    // Write
    const writeResult = await registry.execute("write_file", { path: filePath, content });
    assertEquals(writeResult.success, true);

    // Read
    const readResult = await registry.execute("read_file", { path: filePath });
    assertEquals(readResult.success, true);
    assertEquals((readResult.data as { content: string })?.content, content);
  });

  await t.step("create_directory and list_directory", async () => {
    const dirPath = "nested/dir";

    // Create
    const createResult = await registry.execute("create_directory", { path: dirPath });
    assertEquals(createResult.success, true);

    // List
    const listResult = await registry.execute("list_directory", { path: "nested" });
    assertEquals(listResult.success, true);
    const data = listResult.data as { entries: { name: string; isDirectory: boolean }[] };
    assertEquals(data?.entries.some((e: any) => e.name === "dir" && e.isDirectory), true);
  });

  await t.step("search_files", async () => {
    await registry.execute("write_file", { path: "search1.ts", content: "" });
    await registry.execute("write_file", { path: "search2.ts", content: "" });
    await registry.execute("write_file", { path: "other.md", content: "" });

    const result = await registry.execute("search_files", { pattern: "*.ts", path: "." });
    assertEquals(result.success, true);
    const data = result.data as { files: string[] };
    assertEquals(data?.files.length >= 2, true);
    assertEquals(data?.files.some((f: string) => f.endsWith("search1.ts")), true);
    assertEquals(data?.files.some((f: string) => f.endsWith("search2.ts")), true);
  });

  await t.step("security restrictions", async () => {
    // Rejects outside path
    const result = await registry.execute("read_file", { path: "../outside.txt" });
    assertEquals(result.success, false);
    assertEquals(result.error?.includes("Access denied"), true);
  });

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});
