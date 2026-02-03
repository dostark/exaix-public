import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { GitService } from "../../src/services/git_service.ts";
import { initTestDbService } from "../helpers/db.ts";
import { createMockConfig } from "../helpers/config.ts";
import type { Config } from "../../src/config/schema.ts";

/**
 * TDD Tests for GitService Portal Support
 * Task 3.1: Git Service Portal Support
 *
 * Tests that GitService can work with different repository paths
 * (portal repos vs deployed workspace repo)
 */

describe("GitService Portal Support", () => {
  let tempDir: string;
  let portalRepoDir: string;
  let workspaceRepoDir: string;
  let config: Config;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const dbService = await initTestDbService();
    tempDir = dbService.tempDir;
    cleanup = dbService.cleanup;

    portalRepoDir = join(tempDir, "portal-repo");
    workspaceRepoDir = join(tempDir, "workspace-repo");

    // Create directories with git repos
    await ensureDir(join(portalRepoDir, ".git"));
    await ensureDir(join(workspaceRepoDir, ".git"));

    config = createMockConfig(tempDir);
  });

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
    }
  });

  describe("setRepository method", () => {
    it("accepts valid git repository path", () => {
      const gitService = new GitService({
        config,
        repoPath: workspaceRepoDir,
      });

      // Should not throw
      gitService.setRepository(portalRepoDir);

      // Verify repository was set
      assertEquals(gitService.getRepository(), portalRepoDir);
    });

    it("throws error for non-existent directory", () => {
      const gitService = new GitService({
        config,
        repoPath: workspaceRepoDir,
      });

      const nonExistentPath = join(tempDir, "does-not-exist");

      try {
        gitService.setRepository(nonExistentPath);
        throw new Error("Should have thrown error");
      } catch (error) {
        assertEquals(
          (error as Error).message,
          `Not a git repository: ${nonExistentPath}`,
        );
      }
    });

    it("throws error for directory without .git", async () => {
      const gitService = new GitService({
        config,
        repoPath: workspaceRepoDir,
      });

      const nonGitDir = join(tempDir, "not-git");
      await ensureDir(nonGitDir);

      try {
        gitService.setRepository(nonGitDir);
        throw new Error("Should have thrown error");
      } catch (error) {
        assertEquals(
          (error as Error).message,
          `Not a git repository: ${nonGitDir}`,
        );
      }
    });

    it("allows switching between repositories", () => {
      const gitService = new GitService({
        config,
        repoPath: workspaceRepoDir,
      });

      // Set to portal repo
      gitService.setRepository(portalRepoDir);
      assertEquals(gitService.getRepository(), portalRepoDir);

      // Switch back to workspace repo
      gitService.setRepository(workspaceRepoDir);
      assertEquals(gitService.getRepository(), workspaceRepoDir);
    });
  });

  describe("getRepository method", () => {
    it("returns current repository path", () => {
      const gitService = new GitService({
        config,
        repoPath: workspaceRepoDir,
      });

      assertEquals(gitService.getRepository(), workspaceRepoDir);
    });

    it("returns updated path after setRepository", () => {
      const gitService = new GitService({
        config,
        repoPath: workspaceRepoDir,
      });

      gitService.setRepository(portalRepoDir);
      assertEquals(gitService.getRepository(), portalRepoDir);
    });
  });

  describe("git operations use configured repository", () => {
    it("createBranch uses configured repository", async () => {
      // Initialize both repos with actual git
      await initGitRepo(portalRepoDir);
      await initGitRepo(workspaceRepoDir);

      const gitService = new GitService({
        config,
        repoPath: workspaceRepoDir,
      });

      // Set to portal repo
      gitService.setRepository(portalRepoDir);

      // Create branch in portal repo
      await gitService.createBranch({
        requestId: "test-request",
        traceId: "test-trace-123",
      });

      // Get the created branch name (it will have the pattern feat/test-request-test-t)
      const result = await gitService.runGitCommand(["branch", "--list", "feat/test-request-*"]);
      const _portalBranch = result.output.trim().replace("* ", "");

      // Verify branch exists in portal repo
      const portalBranches = await getBranches(portalRepoDir);
      assertEquals(portalBranches.some((b) => b.startsWith("feat/test-request-")), true);

      // Verify branch does NOT exist in workspace repo
      const workspaceBranches = await getBranches(workspaceRepoDir);
      assertEquals(workspaceBranches.some((b) => b.startsWith("feat/test-request-")), false);
    });

    it("getCurrentBranch reads from configured repository", async () => {
      await initGitRepo(portalRepoDir);
      await initGitRepo(workspaceRepoDir);

      const gitService = new GitService({
        config,
        repoPath: workspaceRepoDir,
      });

      // Create different branches in each repo
      await createBranchInRepo(portalRepoDir, "portal-feature");
      await createBranchInRepo(workspaceRepoDir, "workspace-feature");

      // Check workspace repo
      const workspaceBranch = await gitService.getCurrentBranch();
      assertEquals(workspaceBranch, "workspace-feature");

      // Switch to portal repo
      gitService.setRepository(portalRepoDir);
      const portalBranch = await gitService.getCurrentBranch();
      assertEquals(portalBranch, "portal-feature");
    });
  });

  describe("repository isolation", () => {
    it("operations in portal repo don't affect workspace repo", async () => {
      await initGitRepo(portalRepoDir);
      await initGitRepo(workspaceRepoDir);

      const gitService = new GitService({
        config,
        repoPath: workspaceRepoDir,
      });

      // Set to portal repo and create branch
      gitService.setRepository(portalRepoDir);
      await gitService.createBranch({
        requestId: "portal-only",
        traceId: "test-trace-456",
      });

      // Switch to workspace repo
      gitService.setRepository(workspaceRepoDir);
      const workspaceBranches = await getBranches(workspaceRepoDir);

      // Verify portal branch doesn't exist in workspace
      assertEquals(workspaceBranches.some((b) => b.startsWith("feat/portal-only-")), false);
    });

    it("multiple GitService instances can target different repos", async () => {
      await initGitRepo(portalRepoDir);
      await initGitRepo(workspaceRepoDir);

      const portalGitService = new GitService({
        config,
        repoPath: portalRepoDir,
      });

      const workspaceGitService = new GitService({
        config,
        repoPath: workspaceRepoDir,
      });

      // Create branches in different repos
      await portalGitService.createBranch({
        requestId: "portal",
        traceId: "trace-portal",
      });
      await workspaceGitService.createBranch({
        requestId: "workspace",
        traceId: "trace-workspace",
      });

      // Verify isolation
      const portalBranches = await getBranches(portalRepoDir);
      const workspaceBranches = await getBranches(workspaceRepoDir);

      assertEquals(portalBranches.some((b) => b.startsWith("feat/portal-")), true);
      assertEquals(portalBranches.some((b) => b.startsWith("feat/workspace-")), false);

      assertEquals(workspaceBranches.some((b) => b.startsWith("feat/workspace-")), true);
      assertEquals(workspaceBranches.some((b) => b.startsWith("feat/portal-")), false);
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

async function createBranchInRepo(
  repoPath: string,
  branchName: string,
): Promise<void> {
  const cmd = new Deno.Command("git", {
    args: ["checkout", "-b", branchName],
    cwd: repoPath,
    stdout: "null",
    stderr: "null",
  });

  await cmd.output();
}
