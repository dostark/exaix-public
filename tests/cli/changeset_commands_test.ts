/**
 * Tests for ChangesetCommands
 * Covers list, show, approve, and reject operations
 *
 * Success Criteria:
 * - Test 1: list returns changesets sorted by creation date
 * - Test 2: show displays changeset details (branch, commits, files)
 * - Test 3: approve merges branch to main with --no-ff
 * - Test 4: reject archives branch without merging
 * - Test 5: Commands validate branch exists and is correct type
 * - Test 6: Counts files changed in changeset listings
 */

import { assertEquals, assertExists, assertRejects, assertStringIncludes } from "@std/assert";
import { FlowStepType, MemoryOperation, MemoryStatus } from "../../src/enums.ts";

import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { ChangesetCommands } from "../../src/cli/changeset_commands.ts";
import { DatabaseService } from "../../src/services/db.ts";
import { GitService } from "../../src/services/git_service.ts";
import { createCliTestContext, initGitRepo, runGitCommand } from "./helpers/test_setup.ts";
import type { Config } from "../../src/config/schema.ts";

describe("ChangesetCommands", () => {
  let tempDir: string;
  let db: DatabaseService;
  let gitService: GitService;
  let changesetCommands: ChangesetCommands;
  let config: Config;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    // Initialize shared CLI test context
    const result = await createCliTestContext();
    tempDir = result.tempDir;
    db = result.db;
    config = result.config;
    cleanup = result.cleanup;

    // Initialize git repository
    await initGitRepo(tempDir);

    gitService = new GitService({ config, db });
    changesetCommands = new ChangesetCommands({ config, db }, gitService);
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("list", () => {
    it("should return empty array when no changesets exist", async () => {
      const changesets = await changesetCommands.list();
      assertEquals(changesets, []);
    });

    it("should find feat/* branches", async () => {
      // Create a feature branch with proper naming
      await createFeatureBranch(tempDir, "request-001", "abc-123-def");

      const changesets = await changesetCommands.list();
      assertEquals(changesets.length, 1);
      assertEquals(changesets[0].branch, "feat/request-001-abc-123-def");
    });

    it("should extract trace_id from branch name", async () => {
      await createFeatureBranch(tempDir, "request-002", "def-456-abc");

      const changesets = await changesetCommands.list();
      assertEquals(changesets[0].trace_id, "def-456-abc");
      assertEquals(changesets[0].request_id, "request-002");
    });

    it("should filter by status", async () => {
      await createFeatureBranch(tempDir, "request-003", "abc-789-def");

      // Log an approval in activity log
      await db.logActivity(
        "human",
        "changeset.approved",
        "request-003",
        { approved_by: "test@example.com" },
        "abc-789-def",
        null,
      );
      // Wait for batched write to complete
      await db.waitForFlush();

      // Filter for approved
      const approved = await changesetCommands.list(MemoryStatus.APPROVED);
      assertEquals(approved.length, 1);

      // Filter for pending
      const pending = await changesetCommands.list(MemoryStatus.PENDING);
      assertEquals(pending.length, 0);
    });

    it("should sort by creation date descending", async () => {
      // Create multiple branches with delays
      await createFeatureBranch(tempDir, "request-001", "aaa-111-bbb");
      // Git commit timestamps are second-precision, need real delay
      await delay(1500);
      await createFeatureBranch(tempDir, "request-002", "bbb-222-ccc");

      const changesets = await changesetCommands.list();
      assertEquals(changesets.length, 2);
      // Most recent should be first
      assertEquals(changesets[0].request_id, "request-002");
      assertEquals(changesets[1].request_id, "request-001");
    });

    it("should count files changed", async () => {
      await createFeatureBranch(tempDir, "request-004", "ccc-333-ddd", 2);

      const changesets = await changesetCommands.list();
      assertEquals(changesets[0].files_changed, 2);
    });

    it("should scan config.portals for changesets", async () => {
      // Create a separate git repo to simulate a portal
      const portalDir = await Deno.makeTempDir({ prefix: "portal-repo-" });
      try {
        // Initialize git repo in portal directory
        await initGitRepo(portalDir); // Uses shared helper

        // Create a feature branch in the portal repo
        await createFeatureBranch(portalDir, "request-006", "portal-456-ghi");

        // Create a config with the portal defined
        const portalConfig = {
          ...config,
          portals: [{
            alias: "test-portal",
            target_path: portalDir,
            created: new Date().toISOString(),
          }],
        };

        // Create changeset commands with the portal config
        const portalChangesetCommands = new ChangesetCommands(
          { config: portalConfig, db },
          new GitService({ config: portalConfig, db }),
        );

        // Should find the changeset in the portal repo
        const changesets = await portalChangesetCommands.list();
        assertEquals(changesets.length, 1);
        assertEquals(changesets[0].branch, "feat/request-006-portal-456-ghi");
        assertEquals(changesets[0].request_id, "request-006");
        assertEquals(changesets[0].trace_id, "portal-456-ghi");
      } finally {
        await Deno.remove(portalDir, { recursive: true });
      }
    });
  });

  describe("show", () => {
    it("should display changeset details", async () => {
      await createFeatureBranch(tempDir, "request-005", "abc-345-fed");

      const details = await changesetCommands.show("feat/request-005-abc-345-fed");

      assertExists(details);
      assertEquals(details.branch, "feat/request-005-abc-345-fed");
      assertEquals(details.trace_id, "abc-345-fed");
      assertEquals(details.request_id, "request-005");
      assertExists(details.diff);
      assertExists(details.commits);
      assertEquals(details.commits.length, 1);
    });

    it("should accept request_id as shorthand", async () => {
      await createFeatureBranch(tempDir, "request-006", "def-678-abc");

      const details = await changesetCommands.show("request-006");
      assertEquals(details.branch, "feat/request-006-def-678-abc");
    });

    it("should throw error for non-existent changeset", async () => {
      await assertRejects(
        async () => await changesetCommands.show("non-existent"),
        Error,
        "Changeset not found",
      );
    });

    it("should include commit history", async () => {
      await createFeatureBranch(tempDir, "request-007", "abc-901-def");

      const details = await changesetCommands.show("request-007");
      assertEquals(details.commits.length, 1);
      assertExists(details.commits[0].sha);
      assertExists(details.commits[0].message);
      assertStringIncludes(details.commits[0].message, "Add feature");
    });

    it("should generate unified diff", async () => {
      await createFeatureBranch(tempDir, "request-008", "def-234-abc");

      const details = await changesetCommands.show("request-008");
      assertStringIncludes(details.diff, "diff --git");
      assertStringIncludes(details.diff, "feature content");
    });
  });

  describe("approve", () => {
    it("should merge branch to main", async () => {
      await createFeatureBranch(tempDir, "request-009", "abc-567-fed");

      await changesetCommands.approve("request-009");

      // Verify branch was merged
      const log = await runGitCommand(tempDir, ["log", "--oneline"]);
      assertStringIncludes(log, "Merge request-009");
    });

    it("should validate current branch is master", async () => {
      await createFeatureBranch(tempDir, "request-010", "def-890-abc");

      // Switch to a different branch
      await runGitCommand(tempDir, ["checkout", "-b", "other-branch"]);

      await assertRejects(
        async () => await changesetCommands.approve("request-010"),
        Error,
        "Must be on 'master' branch",
      );
    });

    it("should use --no-ff merge", async () => {
      await createFeatureBranch(tempDir, "request-011", "abc-123-fed");

      await changesetCommands.approve("request-011");

      // Check that a merge commit was created
      const log = await runGitCommand(tempDir, ["log", "--oneline", "-n", "1"]);
      assertStringIncludes(log, "Merge");
    });

    it("should log commit SHA to activity", async () => {
      await createFeatureBranch(tempDir, "request-012", "def-456-abc");

      await changesetCommands.approve("request-012");
      // Wait for batched write to complete
      await db.waitForFlush();

      // Check activity log
      const activities = await db.getActivitiesByTraceSafe("def-456-abc");
      const approval = activities.find((a: { action_type: string }) => a.action_type === "changeset.approved");

      assertExists(approval);
      assertExists(approval.payload);
      const payload = JSON.parse(approval.payload);
      assertExists(payload.commit_sha);
      // User identity is now in actor field, not approved_by
      assertExists(approval.actor);
    });
  });

  describe("reject", () => {
    it("should require rejection reason", async () => {
      await createFeatureBranch(tempDir, "request-013", "abc-789-fed");

      await assertRejects(
        async () => await changesetCommands.reject("request-013", ""),
        Error,
        "Rejection reason is required",
      );
    });

    it("should delete branch", async () => {
      await createFeatureBranch(tempDir, "request-014", "def-012-abc");

      await changesetCommands.reject("request-014", "Not needed");

      // Verify branch was deleted
      const branches = await runGitCommand(tempDir, [FlowStepType.BRANCH, "--list", "feat/*"]);
      assertEquals(branches.includes("feat/request-014-def-012-abc"), false);
    });

    it("should log rejection to activity", async () => {
      await createFeatureBranch(tempDir, "request-015", "abc-345-edf");

      await changesetCommands.reject("request-015", "Quality issues");
      // Wait for batched write to complete
      await db.waitForFlush();

      // Check activity log
      const activities = await db.getActivitiesByTraceSafe("abc-345-edf");
      const rejection = activities.find((a: { action_type: string }) => a.action_type === "changeset.rejected");

      assertExists(rejection);
      const payload = JSON.parse(rejection.payload);
      assertEquals(payload.rejection_reason, "Quality issues");
      // User identity is now in actor field, not rejected_by
      assertExists(rejection.actor);
    });

    it("should include rejection reason in log", async () => {
      await createFeatureBranch(tempDir, "request-016", "def-678-bca");

      await changesetCommands.reject("request-016", "Needs redesign");
      // Wait for batched write to complete
      await db.waitForFlush();

      const activities = await db.getActivitiesByTraceSafe("def-678-bca");
      const rejection = activities.find((a: { action_type: string }) => a.action_type === "changeset.rejected");
      assertExists(rejection);
      if (!rejection) throw new Error("Rejection not found");
      const payload = JSON.parse(rejection.payload);

      assertStringIncludes(payload.rejection_reason, "Needs redesign");
    });

    it("should handle worktree conflicts when rejecting", async () => {
      await createFeatureBranch(tempDir, "request-017", "abc-901-def");

      // Create a worktree for the branch to simulate a portal using it
      const worktreePath = join(tempDir, "worktree-portal");
      await runGitCommand(tempDir, ["worktree", "add", worktreePath, "feat/request-017-abc-901-def"]);

      // Verify worktree exists
      const worktreeList = await runGitCommand(tempDir, ["worktree", "list", "--porcelain"]);
      assertStringIncludes(worktreeList, "feat/request-017-abc-901-def");

      // Reject should handle the worktree conflict and succeed
      await changesetCommands.reject("request-017", "Worktree conflict test");

      // Verify branch was deleted despite worktree
      const branches = await runGitCommand(tempDir, ["branch", "--list", "feat/*"]);
      assertEquals(branches.includes("feat/request-017-abc-901-def"), false);

      // Verify worktree was removed
      const worktreeListAfter = await runGitCommand(tempDir, ["worktree", "list", "--porcelain"]);
      assertEquals(worktreeListAfter.includes("feat/request-017-abc-901-def"), false);

      // Clean up worktree directory
      await Deno.remove(worktreePath, { recursive: true }).catch(() => {});
    });

    it("should handle branch checked out in main working tree when rejecting", async () => {
      await createFeatureBranch(tempDir, "request-018", "def-111-ghi");

      // Switch to the feature branch in the main repository (simulating portal checked out to branch)
      await runGitCommand(tempDir, ["checkout", "feat/request-018-def-111-ghi"]);

      // Reject should handle the checkout conflict and succeed
      await changesetCommands.reject("request-018", "Checkout conflict test");

      // Verify we're back on master
      const currentBranch = await runGitCommand(tempDir, ["branch", "--show-current"]);
      assertEquals(currentBranch.trim(), "master");

      // Verify branch was deleted
      const branches = await runGitCommand(tempDir, ["branch", "--list", "feat/*"]);
      assertEquals(branches.includes("feat/request-018-def-111-ghi"), false);
    });
  });

  /**
   * Regression test for: "Branch not found" error when approving changesets in portal repositories
   * Root cause: approve/show/reject methods only searched workspace root, not portal repos
   * Fix: Added findRepoForBranch() method to search all repositories
   */
  it("[regression] approve() should find and merge branches in portal repositories", async () => {
    // Create a portal repository
    const portalDir = await Deno.makeTempDir({ prefix: "portal-repo-" });
    try {
      // Initialize git repo in portal directory with master branch (like user's repo)
      await initGitRepo(portalDir); // Uses shared helper

      // Create a feature branch in the portal repository
      await createFeatureBranch(portalDir, "request-a300d5a5", "a300d5a5");

      // Create portal symlink in the workspace
      const portalsDir = join(tempDir, config.paths.portals);
      await Deno.mkdir(portalsDir, { recursive: true });
      const symlinkPath = join(portalsDir, "TestPortal");
      await Deno.symlink(portalDir, symlinkPath);

      // Verify the changeset appears in the list (should find it in portal)
      const changesets = await changesetCommands.list();
      assertEquals(changesets.length, 1);
      assertEquals(changesets[0].request_id, "request-a300d5a5");
      assertEquals(changesets[0].branch, "feat/request-a300d5a5-a300d5a5");

      // This should NOT throw "Branch not found" error anymore
      await changesetCommands.approve("request-a300d5a5");

      // Verify branch was merged in the portal repository
      const branches = await runGitCommand(portalDir, ["branch", "--list"]);
      assertStringIncludes(branches, "* master"); // Should be on master
      assertStringIncludes(branches, "feat/request-a300d5a5-a300d5a5"); // Branch should still exist

      // Verify merge commit exists
      const log = await runGitCommand(portalDir, ["log", "--oneline", "-3"]);
      assertStringIncludes(log, "Merge request-a300d5a5");
    } finally {
      await Deno.remove(portalDir, { recursive: true }).catch(() => {});
    }
  });
});

async function createFeatureBranch(
  repoDir: string,
  requestId: string,
  traceId: string,
  fileCount: number = 1,
): Promise<void> {
  const branchName = `feat/${requestId}-${traceId}`;

  // Create branch
  await runGitCommand(repoDir, ["checkout", "-b", branchName]);

  // Add files
  for (let i = 0; i < fileCount; i++) {
    const fileName = `feature-${i + 1}.txt`;
    await Deno.writeTextFile(join(repoDir, fileName), `feature content ${i + 1}\n`);
    await runGitCommand(repoDir, [MemoryOperation.ADD, fileName]);
  }

  // Commit
  await runGitCommand(repoDir, ["commit", "-m", `Add feature for ${requestId}\n\nTrace-Id: ${traceId}`]);

  // Switch back to master
  await runGitCommand(repoDir, ["checkout", "master"]);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Additional edge case tests from tests/changeset_commands_test.ts
describe("ChangesetCommands - Edge Cases", () => {
  let tempDir: string;
  let db: DatabaseService;
  let gitService: GitService;
  let changesetCommands: ChangesetCommands;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    // Initialize shared CLI test context
    const result = await createCliTestContext();
    tempDir = result.tempDir;
    db = result.db;
    const config = result.config;
    cleanup = result.cleanup;

    // Initialize git repository with master branch (like user's repo)
    await initGitRepo(tempDir);

    gitService = new GitService({ config, db });
    changesetCommands = new ChangesetCommands({ config, db }, gitService);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("list() should skip branches with invalid naming format", async () => {
    // Create branches with various invalid formats
    await runGitCommand(tempDir, ["checkout", "-b", "feat/invalid"]);
    await runGitCommand(tempDir, ["checkout", "master"]);

    await runGitCommand(tempDir, ["checkout", "-b", "feature/not-feat"]);
    await runGitCommand(tempDir, ["checkout", "master"]);

    const changesets = await changesetCommands.list();
    assertEquals(changesets.length, 0);
  });

  it("list() should handle branches with no files changed", async () => {
    // Create empty feature branch (no actual file changes)
    const branchName = "feat/request-003-empty-branch";
    await runGitCommand(tempDir, ["checkout", "-b", branchName]);
    await runGitCommand(tempDir, ["commit", "--allow-empty", "-m", "Empty commit"]);
    await runGitCommand(tempDir, ["checkout", "master"]);

    const changesets = await changesetCommands.list();
    assertEquals(changesets.length, 1);
    assertEquals(changesets[0].files_changed, 0);
  });

  it("show() should throw error when branch does not exist", async () => {
    await assertRejects(
      async () => await changesetCommands.show("feat/nonexistent-branch"),
      Error,
      "not found",
    );
  });

  it("show() should find branch by request_id", async () => {
    await createFeatureBranch(tempDir, "request-007", "abc-901-def");

    const details = await changesetCommands.show("request-007");
    assertExists(details);
    assertEquals(details.request_id, "request-007");
  });

  it("show() should throw error when request_id not found", async () => {
    await assertRejects(
      async () => await changesetCommands.show("nonexistent-request"),
      Error,
      "Changeset not found",
    );
  });

  it("approve() should throw error when not on master branch", async () => {
    await createFeatureBranch(tempDir, "request-010", "def-890-abc");

    // Switch to a different branch
    await runGitCommand(tempDir, ["checkout", "-b", "other-branch"]);

    await assertRejects(
      async () => await changesetCommands.approve("request-010"),
      Error,
      "master",
    );

    // Switch back for cleanup
    await runGitCommand(tempDir, ["checkout", "master"]);
  });

  it("reject() should throw error when rejection reason is empty", async () => {
    await createFeatureBranch(tempDir, "request-011", "abc-111-def");

    await assertRejects(
      async () => await changesetCommands.reject("request-011", ""),
      Error,
      "Rejection reason is required",
    );
  });

  it("reject() should throw error when rejection reason is whitespace only", async () => {
    await createFeatureBranch(tempDir, "request-012", "def-222-abc");

    await assertRejects(
      async () => await changesetCommands.reject("request-012", "   "),
      Error,
      "Rejection reason is required",
    );
  });

  it("reject() should handle rejection of non-existent branch gracefully", async () => {
    await assertRejects(
      async () => await changesetCommands.reject("nonexistent", "Not needed"),
      Error,
      "Changeset not found",
    );
  });
});
