import { assertEquals } from "@std/assert";
import { ensureDir } from "@std/fs";
import { join } from "@std/path";
import { PortalExecutionStrategy, PortalOperation } from "../../../src/enums.ts";
import { ExecutionLoop } from "../../../src/services/execution_loop.ts";
import { EventLogger } from "../../../src/services/event_logger.ts";
import { ReviewRegistry } from "../../../src/services/review_registry.ts";
import { setupGitRepo } from "../../helpers/git_test_helper.ts";
import type { TestEnvironment } from "./test_environment.ts";

export async function setupWorktreePortalRepo(
  portalTargetPath: string,
  targetBranch: string,
): Promise<void> {
  await ensureDir(join(portalTargetPath, "src"));
  await setupGitRepo(portalTargetPath, { initialCommit: true, branch: "main" });

  // Create a long-lived release branch.
  await gitStdout(portalTargetPath, ["branch", targetBranch, "main"]);

  // Simulate user checkout staying on main.
  await gitStdout(portalTargetPath, ["checkout", "main"]);
  assertEquals(await gitStdout(portalTargetPath, ["branch", "--show-current"]), "main");
}

export async function gitStdout(repoPath: string, args: string[]): Promise<string> {
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

export async function listBranches(repoPath: string): Promise<string[]> {
  const output = await gitStdout(repoPath, ["branch", "--list"]);

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    // '*' => current branch, '+' => checked out in another worktree
    .map((line) => line.replace(/^[*+]\s+/, ""));
}

export async function pathExists(path: string): Promise<boolean> {
  return await Deno.stat(path).then(() => true).catch(() => false);
}

export async function pathExistsNoFollow(path: string): Promise<boolean> {
  return await Deno.lstat(path).then(() => true).catch(() => false);
}

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
    actions: [
      {
        tool: "write_file",
        params: {
          path: params.writePath,
          content: params.writeContent,
        },
      },
    ],
  });

  const activePlanPath = await env.approvePlan(planPath);

  const logger = new EventLogger({ db: env.db });
  const reviewRegistry = new ReviewRegistry(env.db, logger);
  const loop = new ExecutionLoop({
    config: config as any,
    db: env.db,
    agentId: "daemon",
    reviewRegistry,
  });
  const result = await loop.processTask(activePlanPath);

  return {
    traceId,
    requestId,
    activePlanPath,
    result: {
      success: result.success,
      traceId: result.traceId,
      error: result.error,
    },
  };
}

export function withSingleWorktreePortal<TConfig extends Record<string, unknown>>(
  baseConfig: TConfig,
  portalAlias: string,
  portalTargetPath: string,
  defaultBranch: string,
): TConfig {
  return {
    ...baseConfig,
    portals: [
      {
        alias: portalAlias,
        target_path: portalTargetPath,
        default_branch: defaultBranch,
        execution_strategy: PortalExecutionStrategy.WORKTREE,
      },
    ],
  } as TConfig;
}
