/**
 * Projected tests for Phase 37.6 (worktree execution strategy):
 * - Multiple traces can execute against the same portal without disturbing the main checkout.
 * - Each trace gets an isolated canonical worktree + Memory/Execution pointer.
 * - If worktree creation fails (e.g., bad base branch), execution fails with an actionable error.
 */

import { assertEquals, assertExists, assertMatch, assertStringIncludes } from "@std/assert";
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
    // '*' => current branch, '+' => checked out in another worktree
    .map((line) => line.replace(/^[*+]\s+/, ""));
}

async function pathExists(path: string): Promise<boolean> {
  return await Deno.stat(path).then(() => true).catch(() => false);
}

async function assertPointerPointsTo(traceRoot: string, traceId: string, expectedTarget: string): Promise<void> {
  const pointerPath = join(traceRoot, "Memory", "Execution", traceId, "worktree");
  const info = await Deno.lstat(pointerPath);

  if (info.isSymlink) {
    const linkTarget = await Deno.readLink(pointerPath);
    assertEquals(linkTarget, expectedTarget);
  } else {
    assertEquals(info.isDirectory, true);
    const pathText = await Deno.readTextFile(join(pointerPath, "PATH.txt"));
    assertEquals(pathText.trim(), expectedTarget);
  }
}

Deno.test(
  "[e2e][regression] Phase 37.6: two worktree executions create isolated worktrees and preserve portal checkout",
  async () => {
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
      assertEquals(await gitStdout(portalTargetPath, ["branch", "--show-current"]), "main");

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

      const logger = new EventLogger({ db: env.db });
      const reviewRegistry = new ReviewRegistry(env.db, logger);
      const loop = new ExecutionLoop({ config, db: env.db, agentId: "daemon", reviewRegistry });

      const traceA = crypto.randomUUID();
      const requestA = `request-${traceA.substring(0, 8)}`;
      const planA = await env.createPlan(traceA, requestA, {
        status: "review",
        agentId: "senior-coder",
        portal: portalAlias,
        targetBranch,
        actions: [
          {
            tool: "write_file",
            params: {
              path: "src/worktree_A.ts",
              content: `export const A = ${JSON.stringify("A")};\n`,
            },
          },
        ],
      });

      const traceB = crypto.randomUUID();
      const requestB = `request-${traceB.substring(0, 8)}`;
      const planB = await env.createPlan(traceB, requestB, {
        status: "review",
        agentId: "senior-coder",
        portal: portalAlias,
        targetBranch,
        actions: [
          {
            tool: "write_file",
            params: {
              path: "src/worktree_B.ts",
              content: `export const B = ${JSON.stringify("B")};\n`,
            },
          },
        ],
      });

      const activeA = await env.approvePlan(planA);
      const activeB = await env.approvePlan(planB);

      // Sequential execution (still validates isolation without relying on concurrency).
      const resultA = await loop.processTask(activeA);
      const resultB = await loop.processTask(activeB);

      assertEquals(resultA.success, true);
      assertEquals(resultB.success, true);

      // Portal checkout should remain on main.
      assertEquals(await gitStdout(portalTargetPath, ["branch", "--show-current"]), "main");

      // Both feature branches should exist.
      const branches = await listBranches(portalTargetPath);
      const branchA = branches.find((b) => b.startsWith(`feat/${requestA}-`));
      const branchB = branches.find((b) => b.startsWith(`feat/${requestB}-`));
      assertExists(branchA);
      assertExists(branchB);
      assertMatch(branchA, /^feat\/request-[0-9a-f]{8}-/);
      assertMatch(branchB, /^feat\/request-[0-9a-f]{8}-/);

      const wtA = join(env.tempDir, ".exo", "worktrees", portalAlias, traceA);
      const wtB = join(env.tempDir, ".exo", "worktrees", portalAlias, traceB);

      assertEquals(await pathExists(wtA), true);
      assertEquals(await pathExists(wtB), true);

      // Each worktree should only contain its own new file.
      assertEquals(await pathExists(join(wtA, "src", "worktree_A.ts")), true);
      assertEquals(await pathExists(join(wtA, "src", "worktree_B.ts")), false);
      assertEquals(await pathExists(join(wtB, "src", "worktree_B.ts")), true);
      assertEquals(await pathExists(join(wtB, "src", "worktree_A.ts")), false);

      // Portal checkout on main should not see either file.
      assertEquals(await pathExists(join(portalTargetPath, "src", "worktree_A.ts")), false);
      assertEquals(await pathExists(join(portalTargetPath, "src", "worktree_B.ts")), false);

      // Pointer paths should exist and point to canonical worktrees.
      await assertPointerPointsTo(env.tempDir, traceA, wtA);
      await assertPointerPointsTo(env.tempDir, traceB, wtB);

      // Feature branches should contain their respective file.
      const fileAFromGit = await gitStdout(portalTargetPath, ["show", `${branchA}:src/worktree_A.ts`]);
      assertStringIncludes(fileAFromGit, "export const A");

      const fileBFromGit = await gitStdout(portalTargetPath, ["show", `${branchB}:src/worktree_B.ts`]);
      assertStringIncludes(fileBFromGit, "export const B");
    } finally {
      await env.cleanup();
    }
  },
);

Deno.test(
  "[e2e][negative] Phase 37.6: worktree creation failure returns actionable error",
  async () => {
    const env = await TestEnvironment.create();

    try {
      const portalAlias = "worktree-portal";
      const portalTargetPath = join(env.tempDir, "portal-worktree-target");

      await ensureDir(join(portalTargetPath, "src"));
      await setupGitRepo(portalTargetPath, { initialCommit: true, branch: "main" });

      // Simulate user checkout staying on main.
      await gitStdout(portalTargetPath, ["checkout", "main"]);

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

      const logger = new EventLogger({ db: env.db });
      const reviewRegistry = new ReviewRegistry(env.db, logger);
      const loop = new ExecutionLoop({ config, db: env.db, agentId: "daemon", reviewRegistry });

      const traceId = crypto.randomUUID();
      const requestId = `request-${traceId.substring(0, 8)}`;
      const badBaseBranch = "does-not-exist";

      const planPath = await env.createPlan(traceId, requestId, {
        status: "review",
        agentId: "senior-coder",
        portal: portalAlias,
        targetBranch: badBaseBranch,
        actions: [
          {
            tool: "write_file",
            params: {
              path: "src/should_not_write.ts",
              content: "export const nope = true;\n",
            },
          },
        ],
      });

      const activePlanPath = await env.approvePlan(planPath);

      const result = await loop.processTask(activePlanPath);

      assertEquals(result.success, false);
      assertEquals(result.traceId, traceId);
      assertExists(result.error);

      // Actionable: mention worktree and/or the base branch ref that failed.
      assertStringIncludes(result.error, "worktree");
      assertStringIncludes(result.error, badBaseBranch);

      // Portal checkout should remain untouched.
      assertEquals(await gitStdout(portalTargetPath, ["branch", "--show-current"]), "main");

      // The canonical worktree path should not exist (worktree add failed).
      const canonicalWorktreePath = join(env.tempDir, ".exo", "worktrees", portalAlias, traceId);
      assertEquals(await pathExists(canonicalWorktreePath), false);
    } finally {
      await env.cleanup();
    }
  },
);
