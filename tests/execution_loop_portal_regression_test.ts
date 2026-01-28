import { assert, assertEquals, assertExists } from "@std/assert";
import { join } from "@std/path";
import { ExecutionLoop } from "../src/services/execution_loop.ts";
import { createMockConfig } from "./helpers/config.ts";
import { initTestDbService } from "./helpers/db.ts";
import { ChangesetRegistry } from "../src/services/changeset_registry.ts";
import { EventLogger } from "../src/services/event_logger.ts";
import { ensureDir } from "@std/fs/ensure-dir";
import { PlanStatus } from "../src/enums.ts";

Deno.test("[regression] ExecutionLoop: targets portal directory and creates changeset", async () => {
  const rootDir = await Deno.makeTempDir({ prefix: "exec-portal-reg-" });
  const portalDir = join(rootDir, "my-portal");
  await ensureDir(portalDir);

  // Initialize git in portal
  const initCmd = new Deno.Command("git", {
    args: ["init"],
    cwd: portalDir,
  });
  await initCmd.output();

  const { db, cleanup } = await initTestDbService();
  try {
    const config = createMockConfig(rootDir);
    config.portals = [{
      alias: "my-portal",
      target_path: portalDir,
    }];

    const activeDir = join(rootDir, config.paths.workspace, "Active");
    await ensureDir(activeDir);

    const logger = new EventLogger({ db, defaultActor: "test" });
    const changesetRegistry = new ChangesetRegistry(db, logger);
    const loop = new ExecutionLoop({
      config,
      db,
      agentId: "test-agent",
      changesetRegistry,
    });

    const traceId = crypto.randomUUID();
    const planContent = `---
trace_id: "${traceId}"
request_id: portal-reg-request
status: ${PlanStatus.APPROVED}
portal: my-portal
---

# Portal Regression Plan

\`\`\`toml
tool = "write_file"
description = "Write file to portal"

[params]
path = "hello.txt"
content = "hello from portal"
\`\`\`
`;

    const planPath = join(activeDir, "portal-reg-request_plan.md");
    await Deno.writeTextFile(planPath, planContent);

    // This should detect the portal and execute there
    const result = await loop.processTask(planPath);

    assertEquals(result.success, true, "Execution failed: " + result.error);

    // Verify file exists in PORTAL dir, not ROOT dir
    const fileInPortal = join(portalDir, "hello.txt");
    const fileInRoot = join(rootDir, "hello.txt");

    const existsInPortal = await Deno.stat(fileInPortal).then(() => true).catch(() => false);
    const existsInRoot = await Deno.stat(fileInRoot).then(() => true).catch(() => false);

    assert(existsInPortal, "File should exist in portal directory");
    assert(!existsInRoot, "File should NOT exist in root directory");

    // Verify changeset was registered
    const changesets = await changesetRegistry.list({ portal: "my-portal" });
    assertEquals(changesets.length, 1, "Should have registered 1 changeset");
    assertEquals(changesets[0].portal, "my-portal");
    assertExists(changesets[0].commit_sha, "Changeset should have a commit SHA");
  } finally {
    await cleanup();
    await Deno.remove(rootDir, { recursive: true });
  }
});
