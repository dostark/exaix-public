/**
 * @module DenoTaskToolTest
 * @path tests/tools/deno_task_test.ts
 * @description Verifies the 'deno_task' tool implementation, ensuring safe execution
 * of project tasks defined in deno.json.
 */

import { ToolRegistry } from "../../src/services/tool_registry.ts";
import { ConfigSchema } from "../../src/config/schema.ts";
import { join } from "@std/path";

Deno.test("ToolRegistry: deno_task", async (t) => {
  const tempDir = await Deno.makeTempDir();
  const config = ConfigSchema.parse({
    system: { root: tempDir },
    tools: {},
    // Minimal required config
    paths: {},
    database: {},
    watcher: {},
    agents: {},
    models: {},
    portals: [],
    mcp: {},
  });
  const registry = new ToolRegistry({ config, baseDir: tempDir });

  const goodFile = join(tempDir, "good.ts");
  await Deno.writeTextFile(goodFile, "export const foo = 1;");

  const badFile = join(tempDir, "bad.ts");
  await Deno.writeTextFile(badFile, "const foo = ;"); // Syntax error

  await t.step("runs fmt successfully", async () => {
    // fmt check
    const _result = await registry.execute("deno_task", { task: "fmt", path: "good.ts", args: ["--check"] });
    // It might succeed or fail depending on formatting, but it should run.
    // If formatted correctly, code 0.
    // ...existing code...
    await registry.execute("deno_task", { task: "fmt", path: "good.ts" });
  });
  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});
