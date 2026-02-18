/**
 * Shared utilities for portal integration tests
 * Reduces code duplication across portal e2e test files
 */

import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { setupGitRepo } from "./git_test_helper.ts";
import type { Config } from "../../src/config/schema.ts";
import { PortalExecutionStrategy, PortalOperation } from "../../src/enums.ts";
import { ExecutionLoop } from "../../src/services/execution_loop.ts";
import { EventLogger } from "../../src/services/event_logger.ts";
import { ReviewRegistry } from "../../src/services/review_registry.ts";
import type { TestEnvironment } from "../integration/helpers/test_environment.ts";

export interface PortalTestSetup {
  portalAlias: string;
  portalTargetPath: string;
  config: Config;
  tempDir: string;
}

/**
 * Setup a portal test environment with git repository
 */
export async function setupPortalTest(
  tempDir: string,
  portalAlias: string = "write-portal",
  options?: { branch?: string; withSrcDir?: boolean },
): Promise<PortalTestSetup> {
  const { branch = "main", withSrcDir = true } = options || {};
  const portalTargetPath = join(tempDir, "portal-write-target");

  if (withSrcDir) {
    await ensureDir(join(portalTargetPath, "src"));
  }

  await setupGitRepo(portalTargetPath, { initialCommit: true, branch });

  return {
    portalAlias,
    portalTargetPath,
    config: {} as Config,
    tempDir,
  };
}

/**
 * Setup worktree portal repository with target branch
 */
export async function setupWorktreePortalRepo(
  portalTargetPath: string,
  targetBranch: string,
): Promise<void> {
  await ensureDir(join(portalTargetPath, "src"));
  await setupGitRepo(portalTargetPath, { initialCommit: true, branch: "main" });
  await gitStdout(portalTargetPath, ["branch", targetBranch, "main"]);
  await gitStdout(portalTargetPath, ["checkout", "main"]);
  assertEquals(await gitStdout(portalTargetPath, ["branch", "--show-current"]), "main");
}

/**
 * Execute git command and return stdout or throw on error
 */
export async function gitStdout(repoPath: string, args: string[]): Promise<string> {
  const cmd = new Deno.Command(PortalOperation.GIT, {
    args,
    cwd: repoPath,
    stdout: "piped",
    stderr: "piped",
  });

  const { success, stdout, stderr } = await cmd.output();
  if (!success) {
    throw new Error(`Git command failed: ${args.join(" ")}\n${new TextDecoder().decode(stderr)}`);
  }

  return new TextDecoder().decode(stdout).trim();
}

/**
 * Execute git command and return success boolean
 */
export async function gitOk(repoPath: string, args: string[]): Promise<boolean> {
  const cmd = new Deno.Command(PortalOperation.GIT, {
    args,
    cwd: repoPath,
    stdout: "null",
    stderr: "null",
  });
  const { success } = await cmd.output();
  return success;
}

/**
 * List all branches
 */
export async function listBranches(portalPath: string): Promise<string[]> {
  const output = await gitStdout(portalPath, ["branch", "--list"]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[*+]\s+/, ""));
}

/**
 * Check if path exists
 */
export async function pathExists(path: string): Promise<boolean> {
  return await Deno.stat(path).then(() => true).catch(() => false);
}

/**
 * Check if path exists without following symlinks
 */
export async function pathExistsNoFollow(path: string): Promise<boolean> {
  return await Deno.lstat(path).then(() => true).catch(() => false);
}

/**
 * Assert worktree pointer points to expected target
 */
export async function assertPointerPointsTo(
  traceRoot: string,
  traceId: string,
  expectedTarget: string,
): Promise<void> {
  const pointerPath = join(traceRoot, "Memory", "Execution", traceId, "worktree");
  const info = await Deno.lstat(pointerPath);

  if (info.isSymlink) {
    const linkTarget = await Deno.readLink(pointerPath);
    assertEquals(linkTarget, expectedTarget);
    return;
  }

  assertEquals(info.isDirectory, true);
  const pathText = await Deno.readTextFile(join(pointerPath, "PATH.txt"));
  assertEquals(pathText.trim(), expectedTarget);
}

/**
 * Create and run review plan helper
 */
export async function createAndRunReviewPlan<TConfig extends Record<string, unknown>>(
  env: TestEnvironment,
  config: TConfig,
  params: {
    portalAlias: string;
    targetBranch: string;
    writePath: string;
    writeContent: string;
    agentId?: string;
  },
): Promise<{
  traceId: string;
  requestId: string;
  activePlanPath: string;
  result: { success: boolean; traceId: string | undefined; error?: string };
}> {
  const traceId = crypto.randomUUID();
  const requestId = `request-${traceId.substring(0, 8)}`;

  const planPath = await env.createPlan(traceId, requestId, {
    status: "review",
    agentId: params.agentId ?? "senior-coder",
    portal: params.portalAlias,
    targetBranch: params.targetBranch,
    actions: [{
      tool: "write_file",
      params: { path: params.writePath, content: params.writeContent },
    }],
  });

  const activePlanPath = await env.approvePlan(planPath);
  const logger = new EventLogger({ db: env.db });
  const reviewRegistry = new ReviewRegistry(env.db, logger);
  const loop = new ExecutionLoop({ config: config as any, db: env.db, agentId: "daemon", reviewRegistry });
  const result = await loop.processTask(activePlanPath);

  return {
    traceId,
    requestId,
    activePlanPath,
    result: { success: result.success, traceId: result.traceId, error: result.error },
  };
}

/**
 * Create config with single worktree portal
 */
export function withSingleWorktreePortal<TConfig extends Record<string, unknown>>(
  baseConfig: TConfig,
  portalAlias: string,
  portalTargetPath: string,
  defaultBranch: string,
): TConfig {
  return {
    ...baseConfig,
    portals: [{
      alias: portalAlias,
      target_path: portalTargetPath,
      default_branch: defaultBranch,
      execution_strategy: PortalExecutionStrategy.WORKTREE,
    }],
  } as TConfig;
}
