/**
 * Portal-specific end-to-end workflow tests
 *
 * Covers the true end-to-end path for portal requests:
 * - request → plan generation/approval → execution → review surface
 *   - read-only agents: artifact-backed review (no git branch)
 *   - write-capable agents: git-backed review in the portal repository
 */

import { assert, assertEquals, assertExists, assertMatch, assertStringIncludes } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import { ensureDir } from "@std/fs";
import { ExecutionLoop } from "../../src/services/execution_loop.ts";
import { PortalExecutionStrategy, PortalOperation } from "../../src/enums.ts";
import { TestEnvironment } from "./helpers/test_environment.ts";
import { setupGitRepo } from "../helpers/git_test_helper.ts";
import { EventLogger } from "../../src/services/event_logger.ts";
import { ReviewRegistry } from "../../src/services/review_registry.ts";
import { assertPointerPointsTo, pathExists } from "./helpers/worktree_portal_test_utils.ts";

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

async function listBranches(repoPath: string): Promise<string[]> {
  const cmd = new Deno.Command(PortalOperation.GIT, {
    args: ["branch", "--list"],
    cwd: repoPath,
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout } = await cmd.output();
  const output = new TextDecoder().decode(stdout);

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    // '*' => current branch, '+' => checked out in another worktree
    .map((line) => line.replace(/^[*+]\s+/, ""));
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

Deno.test("[e2e] Portal request → plan → execution → artifact review (read-only)", async () => {
  const env = await TestEnvironment.create();

  try {
    const portalAlias = "test-portal";
    const portalTargetPath = join(env.tempDir, "portal-target");
    await ensureDir(portalTargetPath);
    await setupGitRepo(portalTargetPath, { initialCommit: true, branch: "main" });

    // Blueprint must include capabilities so ExecutionLoop can detect read-only mode.
    const blueprintsDir = join(env.tempDir, "Blueprints", "Agents");
    await ensureDir(blueprintsDir);
    await Deno.writeTextFile(
      join(blueprintsDir, "code-analyst.md"),
      `---
agent_id: "code-analyst"
name: "Code Analyst"
model: "mock:test"
capabilities: ["read_file", "list_directory", "grep_search"]
created: "2026-02-05T00:00:00Z"
created_by: "test"
version: "1.0.0"
---

# Code Analyst

Return an analysis-only plan.
`,
    );

    const config = {
      ...env.config,
      portals: [{ alias: portalAlias, target_path: portalTargetPath }],
    };

    const { processor } = env.createRequestProcessor();

    const { filePath: requestPath, traceId } = await env.createRequest(
      "Analyze the portal repo and summarize what you find",
      { agentId: "code-analyst", portal: portalAlias },
    );

    const requestId = requestPath.split("/").pop()!.replace(/\.md$/, "");

    const planPath = await processor.process(requestPath);
    assertExists(planPath, "RequestProcessor should generate a plan");

    const planContent = await Deno.readTextFile(planPath);
    assertStringIncludes(planContent, `trace_id: "${traceId}"`);
    assertStringIncludes(planContent, `request_id: "${requestId}"`);
    assertStringIncludes(planContent, `agent_id: "code-analyst"`);
    assertStringIncludes(planContent, `portal: "${portalAlias}"`);

    const activePlanPath = await env.approvePlan(planPath);

    const portalBranchesBefore = await listBranches(portalTargetPath);
    const workspaceBranchesBefore = await env.getGitBranches();

    const loop = new ExecutionLoop({ config, db: env.db, agentId: "daemon" });
    const result = await loop.processTask(activePlanPath);

    assertEquals(result.success, true);
    assertEquals(result.traceId, traceId);

    // Trace artifacts should exist for inspection (supporting evidence).
    const tracePlanPath = join(env.tempDir, "Memory", "Execution", traceId, "plan.md");
    const traceSummaryPath = join(env.tempDir, "Memory", "Execution", traceId, "summary.md");
    const tracePlanExists = await Deno.stat(tracePlanPath).then(() => true).catch(() => false);
    const traceSummaryExists = await Deno.stat(traceSummaryPath).then(() => true).catch(() => false);
    assertEquals(tracePlanExists, true, "Expected Memory/Execution/<traceId>/plan.md");
    assertEquals(traceSummaryExists, true, "Expected Memory/Execution/<traceId>/summary.md");

    const artifacts = await env.db.preparedAll<
      { id: string; status: string; agent: string; portal: string | null; request_id: string; file_path: string }
    >(
      "SELECT id, status, agent, portal, request_id, file_path FROM artifacts WHERE request_id = ?",
      [requestId],
    );

    assertEquals(artifacts.length, 1, "Exactly one artifact should be created");
    assertExists(artifacts[0].id);
    assertEquals(artifacts[0].status, "pending");
    assertEquals(artifacts[0].agent, "code-analyst");
    assertEquals(artifacts[0].portal, portalAlias);

    const artifactAbsPath = join(env.tempDir, artifacts[0].file_path);
    const artifactFileExists = await Deno.stat(artifactAbsPath).then(() => true).catch(() => false);
    assertEquals(artifactFileExists, true, "Expected canonical artifact markdown file to exist");
    const artifactFileContentBefore = await Deno.readTextFile(artifactAbsPath);
    assertStringIncludes(artifactFileContentBefore, "status: pending");
    assertStringIncludes(artifactFileContentBefore, `request_id: ${requestId}`);
    assertStringIncludes(artifactFileContentBefore, `portal: ${portalAlias}`);
    assertStringIncludes(
      artifactFileContentBefore,
      `Memory/Execution/${traceId}/`,
      "Artifact body should reference the trace directory",
    );

    // Ensure read-only execution didn't mutate either repository.
    const portalBranchesAfter = await listBranches(portalTargetPath);
    assertEquals(portalBranchesAfter, portalBranchesBefore);

    const workspaceBranchesAfter = await env.getGitBranches();
    assertEquals(workspaceBranchesAfter, workspaceBranchesBefore);

    // Validate unified CLI review surface works for portal artifacts.
    const show = await runExoctl(["review", "show", artifacts[0].id, "--diff"], env.tempDir);
    assertEquals(show.code, 0);
    assertStringIncludes(show.stdout, "Execution Artifact");
    assertStringIncludes(show.stdout, requestId);
    assertStringIncludes(show.stdout, traceId);

    const approve = await runExoctl(["review", "approve", artifacts[0].id], env.tempDir);
    assertEquals(approve.code, 0);

    const updated = await env.db.preparedGet<{ status: string }>(
      "SELECT status FROM artifacts WHERE id = ?",
      [artifacts[0].id],
    );
    assertExists(updated);
    assertEquals(updated.status, "approved");

    const artifactFileContentAfter = await Deno.readTextFile(artifactAbsPath);
    assertStringIncludes(artifactFileContentAfter, "status: approved");
  } finally {
    await env.cleanup();
  }
});

Deno.test("[e2e] Portal request → execution → git review in portal repo (write-capable)", async () => {
  const env = await TestEnvironment.create();

  try {
    const portalAlias = "write-portal";
    const portalTargetPath = join(env.tempDir, "portal-write-target");
    await ensureDir(join(portalTargetPath, "src"));
    await setupGitRepo(portalTargetPath, { initialCommit: true, branch: "main" });

    const config = {
      ...env.config,
      portals: [{ alias: portalAlias, target_path: portalTargetPath }],
    };

    // Create a request (entry point for trace_id correlation).
    const { traceId } = await env.createRequest(
      "Add a hello file in the portal repo",
      { agentId: "senior-coder", portal: portalAlias },
    );

    // Must match ReviewCommands naming conventions: feat/(request-[\w]+)-(...)
    const requestId = `request-${traceId.substring(0, 8)}`;

    // Plan generation is simulated here for determinism, but the rest is true execution:
    // approve → execute → commit → review registry entry.
    const planPath = await env.createPlan(traceId, requestId, {
      status: "review",
      agentId: "senior-coder",
      portal: portalAlias,
      actions: [
        {
          tool: "write_file",
          params: {
            path: "src/hello.ts",
            content: `export function hello(): string {\n  return \"Hello from portal\";\n}\n`,
          },
        },
      ],
    });

    const activePlanPath = await env.approvePlan(planPath);

    const portalBranchesBefore = await listBranches(portalTargetPath);
    const workspaceBranchesBefore = await env.getGitBranches();

    const logger = new EventLogger({ db: env.db });
    const reviewRegistry = new ReviewRegistry(env.db, logger);

    const loop = new ExecutionLoop({ config, db: env.db, agentId: "daemon", reviewRegistry });
    const result = await loop.processTask(activePlanPath);

    assertEquals(result.success, true);
    assertEquals(result.traceId, traceId);

    // Branch should be created in portal repo (not in workspace root).
    const portalBranchesAfter = await listBranches(portalTargetPath);
    assert(portalBranchesAfter.length >= portalBranchesBefore.length, "Portal branches should not decrease");
    const createdPortalBranch = portalBranchesAfter.find((b) => b.startsWith(`feat/${requestId}-`));
    assertExists(createdPortalBranch, "Expected a feat/* branch in the portal repository");

    const workspaceBranchesAfter = await env.getGitBranches();
    assertEquals(
      workspaceBranchesAfter,
      workspaceBranchesBefore,
      "Workspace repo should not receive new branches for portal execution",
    );

    // Review should be registered with the portal repository as `repository`.
    const reviews = await reviewRegistry.list({ trace_id: traceId });
    assertEquals(reviews.length, 1);
    assertEquals(reviews[0].portal, portalAlias);
    assertEquals(reviews[0].repository, portalTargetPath);

    const diff = await reviewRegistry.getDiff(reviews[0].id);
    assertStringIncludes(diff, "src/hello.ts");

    // Ensure portal discovery works for CLI commands (ReviewCommands.findRepoForBranch scans symlinks).
    const portalsDir = join(env.tempDir, "Portals");
    await ensureDir(portalsDir);
    const portalSymlinkPath = join(portalsDir, portalAlias);
    try {
      await Deno.symlink(portalTargetPath, portalSymlinkPath);
    } catch {
      // If symlink already exists or cannot be created, continue.
    }

    // Approve should merge into the portal default branch.
    // Precondition: checkout default branch in the portal repo.
    await new Deno.Command(PortalOperation.GIT, {
      args: ["checkout", "main"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();

    // Before merge: file should not be present on main (it exists on the feature branch).
    const fileOnMainBefore = await new Deno.Command(PortalOperation.GIT, {
      args: ["show", "main:src/hello.ts"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(fileOnMainBefore.success, false);

    const cliListBefore = await runExoctl(["review", "list"], env.tempDir);
    assertEquals(cliListBefore.code, 0);
    assertStringIncludes(cliListBefore.stdout, createdPortalBranch);

    const cliShow = await runExoctl(["review", "show", createdPortalBranch, "--diff"], env.tempDir);
    assertEquals(cliShow.code, 0);
    assertStringIncludes(cliShow.stdout, "src/hello.ts");

    const cliApprove = await runExoctl(["review", "approve", createdPortalBranch], env.tempDir);
    assertEquals(cliApprove.code, 0);

    const cliListApproved = await runExoctl(["review", "list", "--status", "approved"], env.tempDir);
    assertEquals(cliListApproved.code, 0);
    assertStringIncludes(cliListApproved.stdout, createdPortalBranch);

    // After merge: file should exist on main with expected content.
    const fileOnMainAfter = await new Deno.Command(PortalOperation.GIT, {
      args: ["show", "main:src/hello.ts"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(fileOnMainAfter.success, true);
    const fileText = new TextDecoder().decode(fileOnMainAfter.stdout);
    assertStringIncludes(fileText, "Hello from portal");

    // Merge commit should exist in portal log.
    const portalLog = await new Deno.Command(PortalOperation.GIT, {
      args: ["log", "--oneline", "-3"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();
    const logText = new TextDecoder().decode(portalLog.stdout);
    assertStringIncludes(logText, `Merge ${requestId}`);

    // Branch should still exist (current behavior mirrors CLI regression test expectations).
    const branchesNow = await listBranches(portalTargetPath);
    assert(branchesNow.includes(createdPortalBranch));

    // Ensure repository is on main after merge.
    const currentBranchNow = await new Deno.Command(PortalOperation.GIT, {
      args: ["branch", "--show-current"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(new TextDecoder().decode(currentBranchNow.stdout).trim(), "main");

    // After merge, the feature branch should have no diff against main.
    const diffAfter = await new Deno.Command(PortalOperation.GIT, {
      args: ["diff", "main..." + createdPortalBranch],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(new TextDecoder().decode(diffAfter.stdout).trim(), "");
  } finally {
    await env.cleanup();
  }
});

Deno.test("[e2e] Portal target_branch review approve merges into that branch", async () => {
  const env = await TestEnvironment.create();

  try {
    const portalAlias = "write-portal";
    const portalTargetPath = join(env.tempDir, "portal-write-target");
    const targetBranch = "release_1.2";

    await ensureDir(join(portalTargetPath, "src"));
    await setupGitRepo(portalTargetPath, { initialCommit: true, branch: "main" });

    // Create a long-lived release branch from main.
    await new Deno.Command(PortalOperation.GIT, {
      args: ["branch", targetBranch, "main"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();

    // Make the target branch diverge from main so we can validate
    // that execution creates the feature branch from the target branch.
    await gitStdout(portalTargetPath, ["checkout", targetBranch]);
    await Deno.writeTextFile(
      join(portalTargetPath, "src", "release_base.ts"),
      `export const base = ${JSON.stringify(targetBranch)};\n`,
    );
    await gitStdout(portalTargetPath, ["add", "."]);
    await gitStdout(portalTargetPath, ["commit", "-m", "Release base commit"]);
    const targetHeadBeforeExecution = await gitStdout(portalTargetPath, ["rev-parse", "HEAD"]);
    await gitStdout(portalTargetPath, ["checkout", "main"]);

    const config = {
      ...env.config,
      portals: [{ alias: portalAlias, target_path: portalTargetPath }],
    };

    const { traceId } = await env.createRequest(
      "Add a release-only file in the portal repo",
      { agentId: "senior-coder", portal: portalAlias, targetBranch: targetBranch },
    );

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
            path: "src/release_only.ts",
            content: `export const releaseOnly = ${JSON.stringify(targetBranch)};\n`,
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

    const portalBranchesAfter = await listBranches(portalTargetPath);
    const createdPortalBranch = portalBranchesAfter.find((b) => b.startsWith(`feat/${requestId}-`));
    assertExists(createdPortalBranch, "Expected a feat/* branch in the portal repository");

    // Step 37.5 regression: feature branch should be created from targetBranch.
    const mergeBase = await gitStdout(portalTargetPath, ["merge-base", createdPortalBranch, targetBranch]);
    assertEquals(
      mergeBase,
      targetHeadBeforeExecution,
      "Expected feature branch to be based on target branch HEAD",
    );

    // Verify base_branch stored in reviews table for this branch.
    const stored = await env.db.preparedGet<{ base_branch: string | null }>(
      "SELECT base_branch FROM reviews WHERE branch = ?",
      [createdPortalBranch],
    );
    assertExists(stored);
    assertEquals(stored.base_branch, targetBranch);

    // Enable CLI portal discovery.
    const portalsDir = join(env.tempDir, "Portals");
    await ensureDir(portalsDir);
    const portalSymlinkPath = join(portalsDir, portalAlias);
    try {
      await Deno.symlink(portalTargetPath, portalSymlinkPath);
    } catch {
      // Continue.
    }

    // Precondition: checkout target branch before approval.
    await new Deno.Command(PortalOperation.GIT, {
      args: ["checkout", targetBranch],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();

    const approve = await runExoctl(["review", "approve", createdPortalBranch], env.tempDir);
    assertEquals(approve.code, 0, approve.stderr);

    // After merge: file should exist on the target branch but not on main.
    const fileOnTarget = await new Deno.Command(PortalOperation.GIT, {
      args: ["show", `${targetBranch}:src/release_only.ts`],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(fileOnTarget.success, true);
    assertStringIncludes(new TextDecoder().decode(fileOnTarget.stdout), targetBranch);

    const fileOnMain = await new Deno.Command(PortalOperation.GIT, {
      args: ["show", "main:src/release_only.ts"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(fileOnMain.success, false);
  } finally {
    await env.cleanup();
  }
});

Deno.test("[e2e][negative] Portal CLI review approve fails if not on review base_branch", async () => {
  const env = await TestEnvironment.create();

  try {
    const portalAlias = "write-portal";
    const portalTargetPath = join(env.tempDir, "portal-write-target");
    const targetBranch = "release_1.2";

    await ensureDir(join(portalTargetPath, "src"));
    await setupGitRepo(portalTargetPath, { initialCommit: true, branch: "main" });

    await new Deno.Command(PortalOperation.GIT, {
      args: ["branch", targetBranch, "main"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();

    const config = {
      ...env.config,
      portals: [{ alias: portalAlias, target_path: portalTargetPath }],
    };

    const { traceId } = await env.createRequest(
      "Add a release-only file in the portal repo",
      { agentId: "senior-coder", portal: portalAlias, targetBranch: targetBranch },
    );

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
            path: "src/release_only.ts",
            content: `export const releaseOnly = ${JSON.stringify(targetBranch)};\n`,
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

    const portalBranchesAfter = await listBranches(portalTargetPath);
    const createdPortalBranch = portalBranchesAfter.find((b) => b.startsWith(`feat/${requestId}-`));
    assertExists(createdPortalBranch, "Expected a feat/* branch in the portal repository");

    // Enable CLI portal discovery.
    const portalsDir = join(env.tempDir, "Portals");
    await ensureDir(portalsDir);
    const portalSymlinkPath = join(portalsDir, portalAlias);
    try {
      await Deno.symlink(portalTargetPath, portalSymlinkPath);
    } catch {
      // Continue.
    }

    // Stay on main (wrong base) and ensure the guard triggers.
    await new Deno.Command(PortalOperation.GIT, {
      args: ["checkout", "main"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();

    const cliApprove = await runExoctl(["review", "approve", createdPortalBranch], env.tempDir);
    assert(cliApprove.code !== 0, "Expected review approve to fail off the review base_branch");
    assertStringIncludes(cliApprove.stdout, `Must be on '${targetBranch}' branch`);
    assertStringIncludes(cliApprove.stdout, `Run: git checkout ${targetBranch}`);
  } finally {
    await env.cleanup();
  }
});

Deno.test("[e2e][negative] Portal CLI review show fails without portal symlink", async () => {
  const env = await TestEnvironment.create();

  try {
    const portalAlias = "write-portal";
    const portalTargetPath = join(env.tempDir, "portal-write-target");
    await ensureDir(join(portalTargetPath, "src"));
    await setupGitRepo(portalTargetPath, { initialCommit: true, branch: "main" });

    const config = {
      ...env.config,
      portals: [{ alias: portalAlias, target_path: portalTargetPath }],
    };

    const { traceId } = await env.createRequest(
      "Add a hello file in the portal repo",
      { agentId: "senior-coder", portal: portalAlias },
    );

    const requestId = `request-${traceId.substring(0, 8)}`;

    const planPath = await env.createPlan(traceId, requestId, {
      status: "review",
      agentId: "senior-coder",
      portal: portalAlias,
      actions: [
        {
          tool: "write_file",
          params: {
            path: "src/hello.ts",
            content: `export function hello(): string {\n  return "Hello from portal";\n}\n`,
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

    const portalBranchesAfter = await listBranches(portalTargetPath);
    const createdPortalBranch = portalBranchesAfter.find((b) => b.startsWith(`feat/${requestId}-`));
    assertExists(createdPortalBranch, "Expected a feat/* branch in the portal repository");

    // NOTE: no `Portals/<alias>` symlink created on purpose.
    const cliShow = await runExoctl(["review", "show", createdPortalBranch, "--diff"], env.tempDir);
    assert(cliShow.code !== 0, "Expected review show to fail without portal discovery symlink");
    assertStringIncludes(cliShow.stdout, "Branch not found");
  } finally {
    await env.cleanup();
  }
});

Deno.test(
  "[e2e] Portal target_branch + worktree strategy executes in worktree and review approve merges into that branch",
  async () => {
    const env = await TestEnvironment.create();

    try {
      const portalAlias = "write-portal";
      const portalTargetPath = join(env.tempDir, "portal-write-target");
      const targetBranch = "release_1.2";

      await ensureDir(join(portalTargetPath, "src"));
      await setupGitRepo(portalTargetPath, { initialCommit: true, branch: "main" });

      // Create target branch and make it diverge from main.
      await gitStdout(portalTargetPath, ["branch", targetBranch, "main"]);
      await gitStdout(portalTargetPath, ["checkout", targetBranch]);
      await Deno.writeTextFile(
        join(portalTargetPath, "src", "release_base.ts"),
        `export const base = ${JSON.stringify(targetBranch)};\n`,
      );
      await gitStdout(portalTargetPath, ["add", "."]);
      await gitStdout(portalTargetPath, ["commit", "-m", "Release base commit"]);
      const targetHeadBeforeExecution = await gitStdout(portalTargetPath, ["rev-parse", "HEAD"]);

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

      const { traceId } = await env.createRequest(
        "Add a release-only file in the portal repo",
        { agentId: "senior-coder", portal: portalAlias, targetBranch },
      );
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
              path: "src/release_only.ts",
              content: `export const releaseOnly = ${JSON.stringify(targetBranch)};\n`,
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

      // Portal checkout should remain untouched.
      assertEquals(await gitStdout(portalTargetPath, ["branch", "--show-current"]), "main");

      const portalBranchesAfter = await listBranches(portalTargetPath);
      const createdPortalBranch = portalBranchesAfter.find((b) => b.startsWith(`feat/${requestId}-`));
      assertExists(createdPortalBranch, "Expected a feat/* branch in the portal repository");
      assertMatch(createdPortalBranch, /^feat\/request-[0-9a-f]{8}-/);

      // Feature branch should be based on targetBranch HEAD.
      const mergeBase = await gitStdout(portalTargetPath, ["merge-base", createdPortalBranch, targetBranch]);
      assertEquals(mergeBase, targetHeadBeforeExecution);

      // Review should record worktree_path.
      const reviewRow = await env.db.preparedGet<{ worktree_path: string | null; base_branch: string | null }>(
        "SELECT worktree_path, base_branch FROM reviews WHERE branch = ?",
        [createdPortalBranch],
      );
      assertExists(reviewRow);
      assertEquals(reviewRow.base_branch, targetBranch);
      assertExists(reviewRow.worktree_path);

      const canonicalWorktreePath = reviewRow.worktree_path;
      assertEquals(await pathExists(canonicalWorktreePath), true);
      await assertPointerPointsTo(env.tempDir, traceId, canonicalWorktreePath);

      // Enable CLI portal discovery.
      const portalsDir = join(env.tempDir, "Portals");
      await ensureDir(portalsDir);
      const portalSymlinkPath = join(portalsDir, portalAlias);
      try {
        await Deno.symlink(portalTargetPath, portalSymlinkPath);
      } catch {
        // Continue.
      }

      // Precondition: checkout target branch before approval.
      await gitStdout(portalTargetPath, ["checkout", targetBranch]);

      const approve = await runExoctl(["review", "approve", createdPortalBranch], env.tempDir);
      assertEquals(approve.code, 0, approve.stderr);

      // Worktree + pointer should be cleaned up, and feature branch deleted.
      const wtList = await gitStdout(portalTargetPath, ["worktree", "list", "--porcelain"]);
      assertEquals(wtList.includes(canonicalWorktreePath), false);
      assertEquals(await pathExists(canonicalWorktreePath), false);
      assertEquals(await pathExists(join(env.tempDir, "Memory", "Execution", traceId, "worktree")), false);
      const branchesNow = await listBranches(portalTargetPath);
      assertEquals(branchesNow.includes(createdPortalBranch), false);

      // Merge should land on the target branch only.
      const fileOnTarget = await gitStdout(portalTargetPath, ["show", `${targetBranch}:src/release_only.ts`]);
      assertStringIncludes(fileOnTarget, targetBranch);

      const fileOnMain = await new Deno.Command(PortalOperation.GIT, {
        args: ["show", "main:src/release_only.ts"],
        cwd: portalTargetPath,
        stdout: "piped",
        stderr: "piped",
      }).output();
      assertEquals(fileOnMain.success, false);
    } finally {
      await env.cleanup();
    }
  },
);

Deno.test("[e2e][negative] Portal CLI review approve fails if not on default branch", async () => {
  const env = await TestEnvironment.create();

  try {
    const portalAlias = "write-portal";
    const portalTargetPath = join(env.tempDir, "portal-write-target");
    await ensureDir(join(portalTargetPath, "src"));
    await setupGitRepo(portalTargetPath, { initialCommit: true, branch: "main" });

    const config = {
      ...env.config,
      portals: [{ alias: portalAlias, target_path: portalTargetPath }],
    };

    const { traceId } = await env.createRequest(
      "Add a hello file in the portal repo",
      { agentId: "senior-coder", portal: portalAlias },
    );

    const requestId = `request-${traceId.substring(0, 8)}`;

    const planPath = await env.createPlan(traceId, requestId, {
      status: "review",
      agentId: "senior-coder",
      portal: portalAlias,
      actions: [
        {
          tool: "write_file",
          params: {
            path: "src/hello.ts",
            content: `export function hello(): string {\n  return "Hello from portal";\n}\n`,
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

    const portalBranchesAfter = await listBranches(portalTargetPath);
    const createdPortalBranch = portalBranchesAfter.find((b) => b.startsWith(`feat/${requestId}-`));
    assertExists(createdPortalBranch, "Expected a feat/* branch in the portal repository");

    // Enable CLI portal discovery.
    const portalsDir = join(env.tempDir, "Portals");
    await ensureDir(portalsDir);
    const portalSymlinkPath = join(portalsDir, portalAlias);
    try {
      await Deno.symlink(portalTargetPath, portalSymlinkPath);
    } catch {
      // Continue.
    }

    // Set portal repo to the feature branch to trigger the default-branch guard.
    await new Deno.Command(PortalOperation.GIT, {
      args: ["checkout", createdPortalBranch],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();

    const cliApprove = await runExoctl(["review", "approve", createdPortalBranch], env.tempDir);
    assert(cliApprove.code !== 0, "Expected review approve to fail off the default branch");
    assertStringIncludes(cliApprove.stdout, "Must be on 'main' branch");
    assertStringIncludes(cliApprove.stdout, "Run: git checkout main");
  } finally {
    await env.cleanup();
  }
});

Deno.test("[e2e][negative] Portal CLI review approve fails on merge conflict", async () => {
  const env = await TestEnvironment.create();

  try {
    const portalAlias = "write-portal";
    const portalTargetPath = join(env.tempDir, "portal-write-target");
    await ensureDir(join(portalTargetPath, "src"));
    await setupGitRepo(portalTargetPath, { initialCommit: true, branch: "main" });

    // Seed a base file on main so both branches can modify the same line.
    await Deno.writeTextFile(
      join(portalTargetPath, "src", "hello.ts"),
      `export function hello(): string {\n  return "Base";\n}\n`,
    );
    await new Deno.Command(PortalOperation.GIT, {
      args: ["add", "src/hello.ts"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();
    await new Deno.Command(PortalOperation.GIT, {
      args: ["commit", "-m", "Seed hello.ts"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();

    const config = {
      ...env.config,
      portals: [{ alias: portalAlias, target_path: portalTargetPath }],
    };

    const { traceId } = await env.createRequest(
      "Change hello.ts in the portal repo",
      { agentId: "senior-coder", portal: portalAlias },
    );

    const requestId = `request-${traceId.substring(0, 8)}`;

    const planPath = await env.createPlan(traceId, requestId, {
      status: "review",
      agentId: "senior-coder",
      portal: portalAlias,
      actions: [
        {
          tool: "write_file",
          params: {
            path: "src/hello.ts",
            content: `export function hello(): string {\n  return "Feature";\n}\n`,
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

    const portalBranchesAfter = await listBranches(portalTargetPath);
    const createdPortalBranch = portalBranchesAfter.find((b) => b.startsWith(`feat/${requestId}-`));
    assertExists(createdPortalBranch, "Expected a feat/* branch in the portal repository");

    // Enable CLI portal discovery.
    const portalsDir = join(env.tempDir, "Portals");
    await ensureDir(portalsDir);
    const portalSymlinkPath = join(portalsDir, portalAlias);
    try {
      await Deno.symlink(portalTargetPath, portalSymlinkPath);
    } catch {
      // Continue.
    }

    // Diverge main after the feature branch was created to force a conflict.
    await new Deno.Command(PortalOperation.GIT, {
      args: ["checkout", "main"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();

    await Deno.writeTextFile(
      join(portalTargetPath, "src", "hello.ts"),
      `export function hello(): string {\n  return "Main";\n}\n`,
    );
    await new Deno.Command(PortalOperation.GIT, {
      args: ["add", "src/hello.ts"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();
    await new Deno.Command(PortalOperation.GIT, {
      args: ["commit", "-m", "Conflicting change on main"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();

    const cliApprove = await runExoctl(["review", "approve", createdPortalBranch], env.tempDir);
    assert(cliApprove.code !== 0, "Expected review approve to fail due to merge conflict");

    // Verify repository is left in a conflicted state.
    const unmergedFiles = await new Deno.Command(PortalOperation.GIT, {
      args: ["diff", "--name-only", "--diff-filter=U"],
      cwd: portalTargetPath,
      stdout: "piped",
      stderr: "piped",
    }).output();
    const unmergedText = new TextDecoder().decode(unmergedFiles.stdout);
    assertStringIncludes(unmergedText, "src/hello.ts");

    // Clean up merge state so env cleanup doesn't have to deal with a conflicted repo.
    const mergeHeadPath = join(portalTargetPath, ".git", "MERGE_HEAD");
    const mergeInProgress = await Deno.stat(mergeHeadPath).then(() => true).catch(() => false);
    if (mergeInProgress) {
      await new Deno.Command(PortalOperation.GIT, {
        args: ["merge", "--abort"],
        cwd: portalTargetPath,
        stdout: "piped",
        stderr: "piped",
      }).output();
    }
  } finally {
    await env.cleanup();
  }
});
