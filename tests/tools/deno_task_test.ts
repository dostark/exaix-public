import { assertEquals } from "@std/assert";
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
    // If not, code 1.
    // Let's just fmt it first.
    await registry.execute("deno_task", { task: "fmt", path: "good.ts" });
    const result2 = await registry.execute("deno_task", { task: "fmt", path: "good.ts", args: ["--check"] });
    assertEquals(result2.success, true);
  });

  await t.step("runs lint successfully", async () => {
    // Default lint rules might not flag simple file, but it runs.
    const result = await registry.execute("deno_task", { task: "lint", path: "good.ts" });
    assertEquals(result.success, true);
  });

  await t.step("reports check error", async () => {
    const result = await registry.execute("deno_task", { task: "check", path: "bad.ts" });
    assertEquals(result.success, false);
    assertEquals(result.error?.includes("exit code"), true);
    // Data contains output
    const data = result.data as Record<string, unknown>;
    assertEquals(data.exitCode !== 0, true);
  });

  await t.step("rejects invalid task", async () => {
    const result = await registry.execute("deno_task", { task: "invalid" });
    assertEquals(result.success, false);
    assertEquals(result.error?.includes("Invalid task"), true);
  });

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});
