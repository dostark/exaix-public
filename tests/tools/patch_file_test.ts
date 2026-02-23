import { assertEquals } from "@std/assert";
import { ToolRegistry } from "../../src/services/tool_registry.ts";
import { ConfigSchema } from "../../src/config/schema.ts";
import { join } from "@std/path";
import type { JSONObject } from "../../src/types.ts";

Deno.test("ToolRegistry: patch_file", async (t) => {
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

  const file = join(tempDir, "test.ts");
  const initialContent = `
    function hello() {
      console.log("Hello World");
      console.log("Hello World");
    }
  `;
  await Deno.writeTextFile(file, initialContent);

  await t.step("applies single patch (first occurrence)", async () => {
    const result = await registry.execute("patch_file", {
      path: "test.ts",
      patches: [
        { search: 'console.log("Hello World");', replace: 'console.log("Goodbye World");' },
      ],
    });

    assertEquals(result.success, true);
    const data = result.data as JSONObject;
    assertEquals(data.appliedCount, 1);

    const content = await Deno.readTextFile(file);
    // First console.log should be changed, second remains
    assertEquals(content.includes('console.log("Goodbye World");'), true);
    assertEquals(content.includes('console.log("Hello World");'), true);
  });

  await t.step("applies multiple patches sequentially", async () => {
    const result = await registry.execute("patch_file", {
      path: "test.ts",
      patches: [
        { search: "function hello()", replace: "function bye()" },
        { search: 'console.log("Hello World");', replace: 'console.log("Done");' }, // Replaces the remaining one
      ],
    });

    assertEquals(result.success, true);
    const data = result.data as JSONObject;
    assertEquals(data.appliedCount, 2);

    const content = await Deno.readTextFile(file);
    assertEquals(content.includes("function bye()"), true);
    assertEquals(content.includes('console.log("Done");'), true);
    assertEquals(content.includes('console.log("Hello World");'), false); // Both are gone now
  });

  await t.step("fails if search string not found", async () => {
    const result = await registry.execute("patch_file", {
      path: "test.ts",
      patches: [
        { search: "non-existent", replace: "foo" },
      ],
    });

    assertEquals(result.success, false);
    assertEquals(result.error?.includes("Search string not found"), true);
  });

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});
