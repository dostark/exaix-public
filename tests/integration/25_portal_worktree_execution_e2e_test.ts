/**
 * E2E regression for Phase 37.6:
 * - When a portal is configured with execution_strategy=worktree
 * - Write-capable execution should run in a per-trace worktree
 * - The portal repo checkout branch should not be disturbed
 * - Review should record worktree_path and the execution pointer should exist under Memory/Execution
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { ensureDir } from "@std/fs";
import { join } from "@std/path";
import { PortalExecutionStrategy, PortalOperation } from "../../src/enums.ts";
import { EventLogger } from "../../src/services/event_logger.ts";
import { ExecutionLoop } from "../../src/services/execution_loop.ts";
import { ReviewRegistry } from "../../src/services/review_registry.ts";
import { setupGitRepo } from "../helpers/git_test_helper.ts";
import { TestEnvironment } from "./helpers/test_environment.ts";

async function gitStdout(repoPath: string, args: string[]): Promise<string> {
  const cmd = new Deno.Command(PortalOperation.GIT, {
    args,
    cwd: repoPath,
    stdout: "piped",
    stderr: "piped",
  });

  const { success, stdout, stderr } = await cmd.output();
  if (!success) {
    const errorText = new TextDecoder().decode(stderr);
    throw new Error(`Git command failed: ${args.join(" ")}\n${errorText}`);
  }

  return new TextDecoder().decode(stdout).trim();
}

async function listBranches(repoPath: string): Promise<string[]> {
  const output = await gitStdout(repoPath, ["branch", "--list"]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    // In worktree setups, git prefixes branches checked out in *other* worktrees with '+'.
    .map((line) => line.replace(/^[*+]\s+/, ""));
}

Deno.test("[e2e][regression] portal worktree execution creates worktree + pointer and preserves portal checkout", async () => {
  const env = await TestEnvironment.create();

  try {
    const portalAlias = "worktree-portal";
    const portalTargetPath = join(env.tempDir, "portal-worktree-target");
    const targetBranch = "release_1.2";

    await ensureDir(join(portalTargetPath, "src"));
    await setupGitRepo(portalTargetPath, { initialCommit: true, branch: "main" });

    // Create a long-lived release branch.
    await gitStdout(portalTargetPath, ["branch", targetBranch, "main"]);

    // Simulate user checkout staying on main.
    await gitStdout(portalTargetPath, ["checkout", "main"]);
    const portalBranchBefore = await gitStdout(portalTargetPath, ["branch", "--show-current"]);
    assertEquals(portalBranchBefore, "main");

    const config = {
      ...env.config,
      portals: [
        {
          alias: portalAlias,
          target_path: portalTargetPath,
          default_branch: "main",
          execution_strategy: PortalExecutionStrategy.WORKTREE,
        },
      ],
    };

    const traceId = crypto.randomUUID();
    const requestId = `request-${traceId.substring(0, 8)}`;

    const planPath = await env.createPlan(traceId, requestId, {
      status: "review",
      agentId: "senior-coder",
      portal: portalAlias,
      targetBranch,
      actions: [
        {
          tool: "write_file",
          params: {
            path: "src/worktree_hello.ts",
            content: `export const hello = ${JSON.stringify("hello-worktree")};\n`,
          },
        },
      ],
    });

    const activePlanPath = await env.approvePlan(planPath);

    const logger = new EventLogger({ db: env.db });
    const reviewRegistry = new ReviewRegistry(env.db, logger);

    const loop = new ExecutionLoop({ config, db: env.db, agentId: "daemon", reviewRegistry });
    const result = await loop.processTask(activePlanPath);

    assertEquals(result.success, true);
    assertEquals(result.traceId, traceId);

    // Ensure portal checkout branch did not change.
    const portalBranchAfter = await gitStdout(portalTargetPath, ["branch", "--show-current"]);
    assertEquals(portalBranchAfter, "main");

    // Find created feature branch.
    const portalBranches = await listBranches(portalTargetPath);
    const createdBranch = portalBranches.find((b) => b.startsWith(`feat/${requestId}-`));
    assertExists(createdBranch, "Expected a feat/* branch to be created");

    // Canonical worktree path must exist.
    const canonicalWorktreePath = join(env.tempDir, ".exo", "worktrees", portalAlias, traceId);
    const canonicalStat = await Deno.stat(canonicalWorktreePath);
    assertEquals(canonicalStat.isDirectory, true);

    // File should exist in the worktree (execution root).
    const worktreeFile = join(canonicalWorktreePath, "src", "worktree_hello.ts");
    const worktreeFileExists = await Deno.stat(worktreeFile).then(() => true).catch(() => false);
    assertEquals(worktreeFileExists, true, "Expected file to be created inside the worktree");

    // The portal repo checkout should not see the file on main.
    const portalFileOnMainExists = await Deno.stat(join(portalTargetPath, "src", "worktree_hello.ts")).then(() => true)
      .catch(() => false);
    assertEquals(portalFileOnMainExists, false, "Expected portal checkout (main) not to contain the worktree file");

    // The feature branch should contain the file.
    const fileFromGit = await gitStdout(portalTargetPath, ["show", `${createdBranch}:src/worktree_hello.ts`]);
    assertStringIncludes(fileFromGit, "hello-worktree");

    // Execution pointer must exist under Memory/Execution/<traceId>/worktree.
    const pointerPath = join(env.tempDir, "Memory", "Execution", traceId, "worktree");
    const pointerInfo = await Deno.lstat(pointerPath);

    if (pointerInfo.isSymlink) {
      const linkTarget = await Deno.readLink(pointerPath);
      assertEquals(linkTarget, canonicalWorktreePath);
    } else {
      assertEquals(pointerInfo.isDirectory, true);
      const pathFile = join(pointerPath, "PATH.txt");
      const pathText = await Deno.readTextFile(pathFile);
      assertEquals(pathText.trim(), canonicalWorktreePath);
    }

    // Review record should include worktree_path for observability/cleanup.
    const reviewRow = await env.db.preparedGet<
      { repository: string; base_branch: string | null; worktree_path: string | null }
    >(
      "SELECT repository, base_branch, worktree_path FROM reviews WHERE branch = ?",
      [createdBranch],
    );

    assertExists(reviewRow);
    assertEquals(reviewRow.repository, portalTargetPath);
    assertEquals(reviewRow.base_branch, targetBranch);
    assertEquals(reviewRow.worktree_path, canonicalWorktreePath);
  } finally {
    await env.cleanup();
  }
});
