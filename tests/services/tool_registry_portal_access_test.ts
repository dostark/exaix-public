import { assertEquals } from "https://deno.land/std@0.201.0/testing/asserts.ts";
import { join } from "https://deno.land/std@0.201.0/path/mod.ts";
import { ToolRegistry } from "../src/services/tool_registry.ts";
import { Config } from "../src/config/schema.ts";

Deno.test("ToolRegistry should allow access to portal targets", async () => {
  const portalDir = await Deno.makeTempDir({ prefix: "portal-target-" });
  const workspaceDir = await Deno.makeTempDir({ prefix: "workspace-" });

  try {
    const config: Config = {
      system: { root: workspaceDir, log_level: "info" },
      paths: {
        workspace: "Workspace",
        memory: "Memory",
        blueprints: "Blueprints",
        // ... defaults
        portals: "Portals",
      },
      portals: [
        { alias: "TestPortal", target_path: portalDir },
      ],
      // Minimal required config
      agents: { default_model: "mock:test" },
      models: {},
      database: {},
      watcher: {},
    } as any;

    const registry = new ToolRegistry({ config });

    // 1. Write to workspace should succeed (baseline)
    const workspaceRes = await registry.execute("write_file", {
      path: join(workspaceDir, "test.txt"),
      content: "workspace content",
    });
    assertEquals(workspaceRes.success, true, `Workspace write failed: ${workspaceRes.error}`);

    // 2. Write to portal target should succeed
    const portalFile = join(portalDir, "portal.txt");
    const portalRes = await registry.execute("write_file", {
      path: portalFile,
      content: "portal content",
    });

    if (!portalRes.success) {
      console.log("Portal write failed:", portalRes.error);
    }

    assertEquals(portalRes.success, true, `Portal write should succeed. Error: ${portalRes.error}`);
  } finally {
    await Deno.remove(portalDir, { recursive: true }).catch(() => {});
    await Deno.remove(workspaceDir, { recursive: true }).catch(() => {});
  }
});
