import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { ChangesetRegistry } from "../../src/services/changeset_registry.ts";
import { GitService } from "../../src/services/git_service.ts";
import { initTestDbService } from "../helpers/db.ts";
import { createMockConfig } from "../helpers/config.ts";
import { EventLogger } from "../../src/services/event_logger.ts";
import type { Config } from "../../src/config/schema.ts";

/**
 * TDD Tests for ChangesetRegistry Portal Support
 * Task 3.2: Changeset Tracking Updates
 *
 * Tests that ChangesetRegistry can track changesets in portal repositories
 * and associate them with portal workspaces
 */

describe("ChangesetRegistry Portal Support", () => {
  let tempDir: string;
  let portalRepoDir: string;
  let workspaceRepoDir: string;
  let config: Config;
  let cleanup: () => Promise<void>;
  let registry: ChangesetRegistry;
  let portalGitService: GitService;
  let workspaceGitService: GitService;
  let logger: EventLogger;

  beforeEach(async () => {
    const dbService = await initTestDbService();
    tempDir = dbService.tempDir;
    cleanup = dbService.cleanup;

    portalRepoDir = join(tempDir, "portal-repo");
    workspaceRepoDir = join(tempDir, "workspace-repo");

    // Create directories with git repos
    await ensureDir(join(portalRepoDir, ".git"));
    await ensureDir(join(workspaceRepoDir, ".git"));
    await initGitRepo(portalRepoDir);
    await initGitRepo(workspaceRepoDir);

    config = createMockConfig(tempDir);
    logger = new EventLogger({ db: dbService.db });

    registry = new ChangesetRegistry(dbService.db, logger);
    portalGitService = new GitService({ config, repoPath: portalRepoDir });
    workspaceGitService = new GitService({ config, repoPath: workspaceRepoDir });
  });

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
    }
  });

  describe("createChangeset with repository path", () => {
    it("stores portal repository path in changeset", async () => {
      const traceId = crypto.randomUUID();
      const branchName = await portalGitService.createBranch({
        requestId: "test-request",
        traceId,
      });

      const changesetId = await registry.createChangeset(
        traceId,
        "test-portal",
        branchName,
        portalRepoDir,
      );

      const changeset = await registry.get(changesetId);
      assertEquals(changeset?.repository, portalRepoDir);
      assertEquals(changeset?.portal, "test-portal");
    });

    it("stores workspace repository path for workspace changesets", async () => {
      const traceId = crypto.randomUUID();
      const branchName = await workspaceGitService.createBranch({
        requestId: "workspace-req",
        traceId,
      });

      const changesetId = await registry.createChangeset(
        traceId,
        null, // No portal for workspace changeset
        branchName,
        workspaceRepoDir,
      );

      const changeset = await registry.get(changesetId);
      assertEquals(changeset?.repository, workspaceRepoDir);
      assertEquals(changeset?.portal, null);
    });

    it("creates branch in specified repository", async () => {
      const traceId = crypto.randomUUID();
      const branchName = await portalGitService.createBranch({
        requestId: "portal-req",
        traceId,
      });

      await registry.createChangeset(
        traceId,
        "test-portal",
        branchName,
        portalRepoDir,
      );

      // Verify branch exists in portal repo
      const portalBranches = await getBranches(portalRepoDir);
      assertEquals(portalBranches.some((b) => b.startsWith("feat/portal-req-")), true);

      // Verify branch does NOT exist in workspace repo
      const workspaceBranches = await getBranches(workspaceRepoDir);
      assertEquals(workspaceBranches.some((b) => b.startsWith("feat/portal-req-")), false);
    });
  });

  describe("getDiff from portal repository", () => {
    it("retrieves diff from portal repository", async () => {
      const traceId = crypto.randomUUID();
      // Create changeset in portal repo
      const branchName = await portalGitService.createBranch({
        requestId: "diff-test",
        traceId,
      });

      const changesetId = await registry.createChangeset(
        traceId,
        "test-portal",
        branchName,
        portalRepoDir,
      );

      // Make a change in portal repo
      await Deno.writeTextFile(join(portalRepoDir, "test.txt"), "portal content");
      await portalGitService.runGitCommand(["add", "."]);
      await portalGitService.commit({
        message: "Test commit",
        traceId,
      });

      // Get diff
      const diff = await registry.getDiff(changesetId);

      // Verify diff contains portal content
      assertEquals(diff.includes("portal content"), true);
      assertEquals(diff.includes("test.txt"), true);
    });

    it("diff from portal repo is isolated from workspace repo", async () => {
      const portalTraceId = crypto.randomUUID();
      const workspaceTraceId = crypto.randomUUID();
      // Create changesets in both repos
      const portalBranch = await portalGitService.createBranch({
        requestId: "portal-diff",
        traceId: portalTraceId,
      });

      const workspaceBranch = await workspaceGitService.createBranch({
        requestId: "workspace-diff",
        traceId: workspaceTraceId,
      });

      const portalChangesetId = await registry.createChangeset(
        portalTraceId,
        "test-portal",
        portalBranch,
        portalRepoDir,
      );

      const workspaceChangesetId = await registry.createChangeset(
        workspaceTraceId,
        null,
        workspaceBranch,
        workspaceRepoDir,
      );

      // Make different changes in each repo
      await Deno.writeTextFile(join(portalRepoDir, "portal.txt"), "portal only");
      await portalGitService.runGitCommand(["add", "."]);
      await portalGitService.commit({
        message: "Portal change",
        traceId: portalTraceId,
      });

      await Deno.writeTextFile(join(workspaceRepoDir, "workspace.txt"), "workspace only");
      await workspaceGitService.runGitCommand(["add", "."]);
      await workspaceGitService.commit({
        message: "Workspace change",
        traceId: workspaceTraceId,
      });

      // Get diffs
      const portalDiff = await registry.getDiff(portalChangesetId);
      const workspaceDiff = await registry.getDiff(workspaceChangesetId);

      // Verify diffs are isolated
      assertEquals(portalDiff.includes("portal.txt"), true);
      assertEquals(portalDiff.includes("workspace.txt"), false);

      assertEquals(workspaceDiff.includes("workspace.txt"), true);
      assertEquals(workspaceDiff.includes("portal.txt"), false);
    });
  });

  describe("changeset listing by repository", () => {
    it("lists changesets from specific portal", async () => {
      const trace1 = crypto.randomUUID();
      const trace2 = crypto.randomUUID();
      const trace3 = crypto.randomUUID();
      // Create changesets in different repos
      const portalBranch1 = await portalGitService.createBranch({
        requestId: "portal1",
        traceId: trace1,
      });
      const portalBranch2 = await portalGitService.createBranch({
        requestId: "portal2",
        traceId: trace2,
      });
      const workspaceBranch = await workspaceGitService.createBranch({
        requestId: "workspace",
        traceId: trace3,
      });

      await registry.createChangeset(trace1, "test-portal", portalBranch1, portalRepoDir);
      await registry.createChangeset(trace2, "test-portal", portalBranch2, portalRepoDir);
      await registry.createChangeset(trace3, null, workspaceBranch, workspaceRepoDir);

      // List changesets for portal
      const portalChangesets = await registry.list({ portal: "test-portal" });
      assertEquals(portalChangesets.length, 2);
      assertEquals(portalChangesets.every((cs) => cs.portal === "test-portal"), true);
      assertEquals(portalChangesets.every((cs) => cs.repository === portalRepoDir), true);
    });

    it("lists workspace changesets separately", async () => {
      const portalTraceId = crypto.randomUUID();
      const workspaceTraceId = crypto.randomUUID();
      const portalBranch = await portalGitService.createBranch({
        requestId: "portal",
        traceId: portalTraceId,
      });
      const workspaceBranch = await workspaceGitService.createBranch({
        requestId: "workspace",
        traceId: workspaceTraceId,
      });

      await registry.createChangeset(portalTraceId, "test-portal", portalBranch, portalRepoDir);
      await registry.createChangeset(workspaceTraceId, null, workspaceBranch, workspaceRepoDir);

      // List all changesets
      const allChangesets = await registry.list();
      const workspaceChangesets = allChangesets.filter((cs) => cs.portal === null);

      assertEquals(workspaceChangesets.length, 1);
      assertEquals(workspaceChangesets[0].repository, workspaceRepoDir);
    });
  });
});

// ============================================================================
// Test Helpers
// ============================================================================

async function initGitRepo(repoPath: string): Promise<void> {
  const initCmd = new Deno.Command("git", {
    args: ["init"],
    cwd: repoPath,
    stdout: "null",
    stderr: "null",
  });
  await initCmd.output();

  // Configure identity
  await new Deno.Command("git", {
    args: ["config", "user.name", "Test User"],
    cwd: repoPath,
    stdout: "null",
  }).output();

  await new Deno.Command("git", {
    args: ["config", "user.email", "test@example.com"],
    cwd: repoPath,
    stdout: "null",
  }).output();

  // Create initial commit
  const file = join(repoPath, "README.md");
  await Deno.writeTextFile(file, "# Test Repo");

  const addCmd = new Deno.Command("git", {
    args: ["add", "."],
    cwd: repoPath,
    stdout: "null",
    stderr: "null",
  });
  await addCmd.output();

  const commitCmd = new Deno.Command("git", {
    args: ["commit", "-m", "Initial commit"],
    cwd: repoPath,
    stdout: "null",
    stderr: "null",
  });
  await commitCmd.output();
}

async function getBranches(repoPath: string): Promise<string[]> {
  const cmd = new Deno.Command("git", {
    args: ["branch", "--format=%(refname:short)"],
    cwd: repoPath,
    stdout: "piped",
  });

  const { stdout } = await cmd.output();
  const output = new TextDecoder().decode(stdout).trim();

  return output ? output.split("\n") : [];
}
