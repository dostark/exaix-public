/**
 * Integration test for Task 4.4 missing scenario:
 * "portal read-only execution creates artifact with portal set"
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { ensureDir } from "@std/fs/ensure-dir";
import { ExecutionLoop } from "../../src/services/execution_loop.ts";
import { TestEnvironment } from "./helpers/test_environment.ts";
import { PortalOperation } from "../../src/enums.ts";
import { setupGitRepo } from "../helpers/git_test_helper.ts";

async function listBranches(repoPath: string): Promise<string[]> {
  const cmd = new Deno.Command(PortalOperation.GIT, {
    args: ["branch", "--list"],
    cwd: repoPath,
    stdout: "piped",
  });

  const { stdout } = await cmd.output();
  const output = new TextDecoder().decode(stdout);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^\*\s+/, ""));
}

Deno.test("[integration] Portal read-only execution creates artifact with portal set", async () => {
  const env = await TestEnvironment.create();

  try {
    const portalAlias = "test-portal";
    const portalTargetPath = join(env.tempDir, "portal-target");
    await ensureDir(portalTargetPath);
    await setupGitRepo(portalTargetPath, { initialCommit: true, branch: "main" });

    // Provide a read-only blueprint so ExecutionLoop can detect capability mode.
    const blueprintsDir = join(env.tempDir, "Blueprints", "Agents");
    await ensureDir(blueprintsDir);
    await Deno.writeTextFile(
      join(blueprintsDir, "code-analyst.md"),
      `---
agent_id: "code-analyst"
name: "Code Analyst"
model: "mock:test"
capabilities: ["read_file", "list_directory", "grep_search"]
created: "2026-02-04T00:00:00Z"
created_by: "test"
version: "1.0.0"
---

# Code Analyst
`,
    );

    const config = {
      ...env.config,
      portals: [{ alias: portalAlias, target_path: portalTargetPath }],
    };

    const traceId = crypto.randomUUID();

    // Legacy/no-op plan: read-only + portal set in frontmatter.
    const planContent = `---
trace_id: "${traceId}"
request_id: portal-readonly
status: active
agent_id: code-analyst
portal: "${portalAlias}"
---

# Read-only Portal Plan

No executable actions.
`;

    const activeDir = join(env.tempDir, "Workspace", "Active");
    await ensureDir(activeDir);
    const planPath = join(activeDir, "portal-readonly.md");
    await Deno.writeTextFile(planPath, planContent);

    const portalBranchesBefore = await listBranches(portalTargetPath);
    const rootBranchesBefore = await env.getGitBranches();

    const loop = new ExecutionLoop({ config, db: env.db, agentId: "daemon" });
    const result = await loop.processTask(planPath);

    assertEquals(result.success, true);
    assertEquals(result.traceId, traceId);

    const artifacts = await env.db.preparedAll<
      { id: string; status: string; agent: string; portal: string | null; request_id: string; file_path: string }
    >(
      "SELECT id, status, agent, portal, request_id, file_path FROM artifacts WHERE request_id = ?",
      ["portal-readonly"],
    );

    assertEquals(artifacts.length, 1, "Exactly one artifact should be created");
    assertExists(artifacts[0].id);
    assertEquals(artifacts[0].status, "pending");
    assertEquals(artifacts[0].agent, "code-analyst");
    assertEquals(artifacts[0].portal, portalAlias);

    const artifactAbsPath = join(env.tempDir, artifacts[0].file_path);
    const artifactContent = await Deno.readTextFile(artifactAbsPath);
    assertStringIncludes(artifactContent, `request_id: ${"portal-readonly"}`);
    assertStringIncludes(artifactContent, `portal: ${portalAlias}`);

    // Ensure read-only execution didn't create branches/reviews.
    const portalBranchesAfter = await listBranches(portalTargetPath);
    assertEquals(portalBranchesAfter, portalBranchesBefore);

    const rootBranchesAfter = await env.getGitBranches();
    assertEquals(rootBranchesAfter, rootBranchesBefore);
  } finally {
    await env.cleanup();
  }
});
