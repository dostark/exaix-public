/**
 * E2E regression for Phase 37.7:
 * - Worktree-based code reviews should be cleaned up on approve/reject
 *   - remove canonical worktree checkout
 *   - remove Memory/Execution/<traceId>/worktree pointer
 *   - delete feature branch
 */

import { assertEquals, assertExists } from "@std/assert";
import { ensureDir } from "@std/fs";
import { dirname, fromFileUrl, join } from "@std/path";
import { PortalExecutionStrategy, PortalOperation } from "../../src/enums.ts";
import { EventLogger } from "../../src/services/event_logger.ts";
import { ExecutionLoop } from "../../src/services/execution_loop.ts";
import { ReviewRegistry } from "../../src/services/review_registry.ts";
import { setupGitRepo } from "../helpers/git_test_helper.ts";
import { TestEnvironment } from "./helpers/test_environment.ts";

async function runExoctl(args: string[], cwd: string) {
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..", "..");
  const exoctlPath = join(repoRoot, "src", "cli", "exoctl.ts");

  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-all", exoctlPath, ...args],
    cwd,
    stdout: "piped",
    stderr: "piped",
    env: {
      ...Deno.env.toObject(),
      EXO_CONFIG_PATH: join(cwd, "exo.config.toml"),
    },
  });

  const { code, stdout, stderr } = await command.output();
  const stdoutStr = new TextDecoder().decode(stdout);
  const stderrStr = new TextDecoder().decode(stderr);

  const effectiveStdout = stdoutStr.trim() ? stdoutStr : stderrStr;

  return {
    code,
    stdout: effectiveStdout,
    stderr: stderrStr,
  };
}

async function ensurePortalSymlink(portalsDir: string, alias: string, targetPath: string): Promise<void> {
  await ensureDir(portalsDir);
  const linkPath = join(portalsDir, alias);
  try {
    await Deno.symlink(targetPath, linkPath);
  } catch (error) {
    if (error instanceof Deno.errors.AlreadyExists) return;
    throw error;
  }
}

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

async function gitOk(repoPath: string, args: string[]): Promise<boolean> {
  const cmd = new Deno.Command(PortalOperation.GIT, {
    args,
    cwd: repoPath,
    stdout: "null",
    stderr: "null",
  });
  const { success } = await cmd.output();
  return success;
}

async function existsPath(path: string): Promise<boolean> {
  return await Deno.stat(path).then(() => true).catch(() => false);
}

async function existsPathNoFollow(path: string): Promise<boolean> {
  return await Deno.lstat(path).then(() => true).catch(() => false);
}

Deno.test(
  "[e2e][regression] review reject removes worktree, pointer, and feature branch",
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

      await ensurePortalSymlink(join(env.tempDir, "Portals"), portalAlias, portalTargetPath);

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

      const reviewRow = await env.db.preparedGet<
        { branch: string; repository: string; worktree_path: string | null }
      >(
        "SELECT branch, repository, worktree_path FROM reviews WHERE trace_id = ?",
        [traceId],
      );

      assertExists(reviewRow);
      assertExists(reviewRow.worktree_path);
      assertEquals(reviewRow.repository, portalTargetPath);

      const canonicalWorktreePath = reviewRow.worktree_path;
      const pointerPath = join(env.tempDir, "Memory", "Execution", traceId, "worktree");

      assertEquals(await existsPath(canonicalWorktreePath), true);
      assertEquals(await existsPathNoFollow(pointerPath), true);
      assertEquals(await gitOk(portalTargetPath, ["rev-parse", "--verify", reviewRow.branch]), true);

      const reject = await runExoctl([
        "review",
        "reject",
        reviewRow.branch,
        "--reason",
        "not needed",
      ], env.tempDir);
      assertEquals(reject.code, 0, reject.stderr);

      // Branch should be deleted.
      assertEquals(await gitOk(portalTargetPath, ["rev-parse", "--verify", reviewRow.branch]), false);

      // Worktree should be removed from git and filesystem.
      const wtList = await gitStdout(portalTargetPath, ["worktree", "list", "--porcelain"]);
      assertEquals(wtList.includes(canonicalWorktreePath), false);
      assertEquals(await existsPath(canonicalWorktreePath), false);

      // Pointer should be removed to avoid dangling discoverability.
      assertEquals(await existsPathNoFollow(pointerPath), false);

      // Portal checkout should remain on main and not contain the file.
      assertEquals(await gitStdout(portalTargetPath, ["branch", "--show-current"]), "main");
      assertEquals(await existsPath(join(portalTargetPath, "src", "worktree_hello.ts")), false);
    } finally {
      await env.cleanup();
    }
  },
);

Deno.test(
  "[e2e][regression] review approve removes worktree, pointer, and feature branch",
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

      await ensurePortalSymlink(join(env.tempDir, "Portals"), portalAlias, portalTargetPath);

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

      const reviewRow = await env.db.preparedGet<
        { branch: string; repository: string; worktree_path: string | null }
      >(
        "SELECT branch, repository, worktree_path FROM reviews WHERE trace_id = ?",
        [traceId],
      );

      assertExists(reviewRow);
      assertExists(reviewRow.worktree_path);
      assertEquals(reviewRow.repository, portalTargetPath);

      const canonicalWorktreePath = reviewRow.worktree_path;
      const pointerPath = join(env.tempDir, "Memory", "Execution", traceId, "worktree");

      assertEquals(await existsPath(canonicalWorktreePath), true);
      assertEquals(await existsPathNoFollow(pointerPath), true);
      assertEquals(await gitOk(portalTargetPath, ["rev-parse", "--verify", reviewRow.branch]), true);

      // Approve requires being on the base branch.
      await gitStdout(portalTargetPath, ["checkout", targetBranch]);

      const approve = await runExoctl(["review", "approve", reviewRow.branch], env.tempDir);
      assertEquals(approve.code, 0, approve.stderr);

      // Feature branch should be deleted.
      assertEquals(await gitOk(portalTargetPath, ["rev-parse", "--verify", reviewRow.branch]), false);

      // Worktree should be removed from git and filesystem.
      const wtList = await gitStdout(portalTargetPath, ["worktree", "list", "--porcelain"]);
      assertEquals(wtList.includes(canonicalWorktreePath), false);
      assertEquals(await existsPath(canonicalWorktreePath), false);

      // Pointer should be removed to avoid dangling discoverability.
      assertEquals(await existsPathNoFollow(pointerPath), false);

      // Merged change should be present on the target branch.
      assertEquals(await gitStdout(portalTargetPath, ["branch", "--show-current"]), targetBranch);
      assertEquals(await existsPath(join(portalTargetPath, "src", "worktree_hello.ts")), true);
    } finally {
      await env.cleanup();
    }
  },
);

Deno.test(
  "[e2e][negative] review approve merge conflict aborts merge and cleans worktree",
  async () => {
    const env = await TestEnvironment.create();

    try {
      const portalAlias = "worktree-portal";
      const portalTargetPath = join(env.tempDir, "portal-worktree-target");
      const targetBranch = "release_1.2";

      await ensureDir(join(portalTargetPath, "src"));
      await setupGitRepo(portalTargetPath, { initialCommit: true, branch: "main" });

      // Create a long-lived release branch and seed a file that will later conflict.
      await gitStdout(portalTargetPath, ["branch", targetBranch, "main"]);
      await gitStdout(portalTargetPath, ["checkout", targetBranch]);
      await Deno.writeTextFile(
        join(portalTargetPath, "src", "conflict.ts"),
        `export const conflict = ${JSON.stringify("base")};\n`,
      );
      await gitStdout(portalTargetPath, ["add", "src/conflict.ts"]);
      await gitStdout(portalTargetPath, ["commit", "-m", "Seed conflict file on base"]);

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

      await ensurePortalSymlink(join(env.tempDir, "Portals"), portalAlias, portalTargetPath);

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
              path: "src/conflict.ts",
              content: `export const conflict = ${JSON.stringify("feature")};\n`,
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

      const reviewRow = await env.db.preparedGet<
        { branch: string; repository: string; worktree_path: string | null }
      >(
        "SELECT branch, repository, worktree_path FROM reviews WHERE trace_id = ?",
        [traceId],
      );

      assertExists(reviewRow);
      assertExists(reviewRow.worktree_path);
      assertEquals(reviewRow.repository, portalTargetPath);

      const canonicalWorktreePath = reviewRow.worktree_path;
      const pointerPath = join(env.tempDir, "Memory", "Execution", traceId, "worktree");

      assertEquals(await existsPath(canonicalWorktreePath), true);
      assertEquals(await existsPathNoFollow(pointerPath), true);
      assertEquals(await gitOk(portalTargetPath, ["rev-parse", "--verify", reviewRow.branch]), true);

      // Create a conflicting commit on the base branch after the feature branch exists.
      await gitStdout(portalTargetPath, ["checkout", targetBranch]);
      await Deno.writeTextFile(
        join(portalTargetPath, "src", "conflict.ts"),
        `export const conflict = ${JSON.stringify("base-changed")};\n`,
      );
      await gitStdout(portalTargetPath, ["add", "src/conflict.ts"]);
      await gitStdout(portalTargetPath, ["commit", "-m", "Change conflict file on base"]);

      const approve = await runExoctl(["review", "approve", reviewRow.branch], env.tempDir);
      assertEquals(approve.code === 0, false, "Expected approve to fail due to merge conflict");

      // Repo should not be left in a conflicted merge state (merge --abort should run).
      assertEquals(
        await gitOk(portalTargetPath, ["rev-parse", "-q", "--verify", "MERGE_HEAD"]),
        false,
      );
      const unmerged = await gitStdout(portalTargetPath, ["diff", "--name-only", "--diff-filter=U"]);
      assertEquals(unmerged.trim(), "");

      // Worktree checkout + pointer should still be cleaned up (no orphaned worktrees).
      const wtList = await gitStdout(portalTargetPath, ["worktree", "list", "--porcelain"]);
      assertEquals(wtList.includes(canonicalWorktreePath), false);
      assertEquals(await existsPath(canonicalWorktreePath), false);
      assertEquals(await existsPathNoFollow(pointerPath), false);

      // Feature branch should remain for manual conflict resolution.
      assertEquals(await gitOk(portalTargetPath, ["rev-parse", "--verify", reviewRow.branch]), true);
      assertEquals(await gitStdout(portalTargetPath, ["branch", "--show-current"]), targetBranch);
    } finally {
      await env.cleanup();
    }
  },
);
