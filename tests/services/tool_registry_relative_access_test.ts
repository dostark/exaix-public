import { assertEquals } from "https://deno.land/std@0.201.0/testing/asserts.ts";
import { join } from "https://deno.land/std@0.201.0/path/mod.ts";
import { ToolRegistry } from "../../src/services/tool_registry.ts";
import { Config } from "../../src/config/schema.ts";

Deno.test("ToolRegistry - Relative Path Access in Portal via baseDir", async () => {
  const portalDir = await Deno.makeTempDir({ prefix: "verif-portal-" });
  const workspaceDir = await Deno.makeTempDir({ prefix: "verif-ws-" });

  try {
    const config: Config = {
      system: { root: workspaceDir, log_level: "info" },
      paths: {
        workspace: "Workspace",
        memory: "Memory",
        blueprints: "Blueprints",
        portals: "Portals",
      },
      portals: [
        { alias: "TestPortal", target_path: portalDir },
      ],
      agents: { default_model: "mock:test" },
      models: {},
      database: {},
      watcher: {},
    } as any;

    // Initialize ToolRegistry WITH baseDir set to portalDir
    const registry = new ToolRegistry({
      config,
      baseDir: portalDir,
    });

    // Attempt to write a file using a RELATIVE path
    // This simulates an agent saying 'write_file("src/utils.ts", ...)' while inside the portal
    const relativePath = "src/utils.ts";
    const result = await registry.execute("write_file", {
      path: relativePath,
      content: "const a = 1;",
    });

    if (!result.success) {
      console.error("Write failed:", result.error);
    }
    assertEquals(result.success, true, "Relative write should succeed");

    // Verify file actually exists at the correct location
    const expectedPath = join(portalDir, relativePath);
    const content = await Deno.readTextFile(expectedPath);
    assertEquals(content, "const a = 1;");

    console.log("Verified: Relative path resolved to portal directory correctly.");
  } finally {
    await Deno.remove(portalDir, { recursive: true }).catch(() => {});
    await Deno.remove(workspaceDir, { recursive: true }).catch(() => {});
  }
});
