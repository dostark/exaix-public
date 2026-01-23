/**
 * Changeset commands for reviewing agent-generated code changes
 * Handles approval/rejection of git branches created by agents
 */

import { join } from "@std/path";
import { BaseCommand, type CommandContext } from "./base.ts";
import { GitService } from "../services/git_service.ts";
import { ChangesetStatus } from "../enums.ts";

export interface ChangesetMetadata {
  branch: string;
  trace_id: string;
  request_id: string;
  files_changed: number;
  created_at: string;
  agent_id: string;
}

export interface ChangesetDetails extends ChangesetMetadata {
  diff: string;
  commits: Array<{
    sha: string;
    message: string;
    timestamp: string;
  }>;
}

/**
 * Commands for reviewing and managing agent-generated code changesets
 */
export class ChangesetCommands extends BaseCommand {
  private gitService: GitService;

  constructor(
    context: CommandContext,
    gitService: GitService,
  ) {
    super(context);
    this.gitService = gitService;
  }

  private async getDefaultBranch(repoPath: string): Promise<string> {
    try {
      // Try to get the default branch from symbolic-ref
      const checkCmd = new Deno.Command("git", {
        args: ["symbolic-ref", "refs/remotes/origin/HEAD"],
        cwd: repoPath,
        stdout: "piped",
        stderr: "piped",
      });
      const result = await checkCmd.output();
      if (result.success) {
        const ref = new TextDecoder().decode(result.stdout).trim();
        // Result will be like "refs/remotes/origin/main" or "refs/remotes/origin/master"
        const branchName = ref.split("/").pop();
        if (branchName) {
          return branchName;
        }
      }
    } catch {
      // If that fails (no remote), continue to fallback
    }

    // Fallback: try common default branch names
    const commonDefaults = ["main", "master", "develop", "development"];
    for (const branch of commonDefaults) {
      try {
        const checkCmd = new Deno.Command("git", {
          args: ["rev-parse", "--verify", branch],
          cwd: repoPath,
          stdout: "piped",
          stderr: "piped",
        });
        const result = await checkCmd.output();
        if (result.success) {
          return branch;
        }
      } catch {
        continue;
      }
    }

    // Ultimate fallback
    return "main";
  }

  private async findRepoForBranch(branchName: string): Promise<string> {
    const portalsDir = join(this.config.system.root, this.config.paths.portals);

    const portalPaths: string[] = [];
    try {
      for await (const entry of Deno.readDir(portalsDir)) {
        if (!entry.isSymlink) continue;
        const symlinkPath = join(portalsDir, entry.name);
        try {
          const targetPath = await Deno.readLink(symlinkPath);
          await Deno.stat(join(targetPath, ".git"));
          portalPaths.push(targetPath);
        } catch {
          continue;
        }
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    portalPaths.push(this.config.system.root);

    for (const repoPath of portalPaths) {
      const checkCmd = new Deno.Command("git", {
        args: ["rev-parse", "--verify", branchName],
        cwd: repoPath,
        stdout: "piped",
        stderr: "piped",
      });
      const result = await checkCmd.output();
      if (result.success) {
        return repoPath;
      }
    }

    throw new Error(`Branch not found in any repository: ${branchName}`);
  }

  /**
   * List all pending changesets (agent-created branches)
   * @param statusFilter Optional filter: 'pending', 'approved', 'rejected'
   * @returns List of changeset metadata
   */
  async list(statusFilter?: string): Promise<ChangesetMetadata[]> {
    const changesets: ChangesetMetadata[] = [];
    const portalsDir = join(this.config.system.root, this.config.paths.portals);

    // Get all portal directories
    const portalPaths: string[] = [];
    try {
      for await (const entry of Deno.readDir(portalsDir)) {
        if (!entry.isSymlink) continue;
        const symlinkPath = join(portalsDir, entry.name);
        try {
          const targetPath = await Deno.readLink(symlinkPath);
          // Check if target still exists and is a git repo
          await Deno.stat(join(targetPath, ".git"));
          portalPaths.push(targetPath);
        } catch {
          // Skip broken portals or non-git repos
          continue;
        }
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
      // Portals directory doesn't exist yet - continue with empty list
    }

    // Also check workspace root for changesets (legacy/fallback)
    portalPaths.push(this.config.system.root);

    for (const repoPath of portalPaths) {
      const defaultBranch = await this.getDefaultBranch(repoPath);

      // Get all branches with feat/ prefix (agent branches)
      const branchesCmd = new Deno.Command("git", {
        args: ["branch", "--list", "feat/*", "--format=%(refname:short)"],
        cwd: repoPath,
        stdout: "piped",
        stderr: "piped",
      });

      const { stdout, success } = await branchesCmd.output();
      if (!success) {
        continue; // Skip repos with no feat branches
      }

      const branches = new TextDecoder().decode(stdout).trim().split("\n").filter((b) => b);

      for (const branch of branches) {
        // Extract trace_id from branch name (feat/{request_id}-{trace_id})
        // request_id format: request-NNN, trace_id format: xxx-yyy-zzz
        const match = branch.match(/^feat\/(request-[\w]+)-(.+)$/);
        if (!match) continue;

        const [, request_id, trace_id] = match;

        // Get branch creation time and author
        const logCmd = new Deno.Command("git", {
          args: [
            "log",
            branch,
            "--format=%H %aI %ae",
            "-1",
          ],
          cwd: repoPath,
          stdout: "piped",
          stderr: "piped",
        });

        const logResult = await logCmd.output();
        if (!logResult.success) continue;

        const logLine = new TextDecoder().decode(logResult.stdout).trim();
        const [, timestamp, agent_id] = logLine.split(" ");

        // Get number of files changed
        const diffCmd = new Deno.Command("git", {
          args: ["diff", "--name-only", `${defaultBranch}...${branch}`],
          cwd: repoPath,
          stdout: "piped",
          stderr: "piped",
        });

        const diffResult = await diffCmd.output();
        const files = new TextDecoder().decode(diffResult.stdout).trim().split("\n").filter((f) => f);

        // Check if branch has been merged or rejected via activity log
        const activities = await this.db.getActivitiesByTrace(trace_id);
        const status = activities.some((a: { action_type: string }) => a.action_type === "changeset.approved")
          ? ChangesetStatus.APPROVED
          : activities.some((a: { action_type: string }) => a.action_type === "changeset.rejected")
          ? ChangesetStatus.REJECTED
          : ChangesetStatus.PENDING;

        if (statusFilter && status !== statusFilter) continue;

        changesets.push({
          branch,
          trace_id,
          request_id,
          files_changed: files.length,
          created_at: timestamp,
          agent_id,
        });
      }
    }

    return changesets.sort((a, b) => {
      const ta = Number(new Date(a.created_at));
      const tb = Number(new Date(b.created_at));
      // Newer first
      return (tb || 0) - (ta || 0);
    });
  }

  /**
   * Show detailed changeset information including diff
   * @param branchName Branch name or request_id
   * @returns Changeset details
   */
  async show(branchName: string): Promise<ChangesetDetails> {
    // If not a full branch name, try to find matching branch
    let fullBranch = branchName;
    if (!branchName.startsWith("feat/")) {
      const branches = await this.list();
      const match = branches.find((b) => b.request_id === branchName || b.branch === `feat/${branchName}`);
      if (!match) {
        throw new Error(`Changeset not found: ${branchName}\nRun 'exoctl changeset list' to see available changesets`);
      }
      fullBranch = match.branch;
    }

    const repoPath = await this.findRepoForBranch(fullBranch);
    const defaultBranch = await this.getDefaultBranch(repoPath);

    // Verify branch exists
    const checkCmd = new Deno.Command("git", {
      args: ["rev-parse", "--verify", fullBranch],
      cwd: repoPath,
      stdout: "piped",
      stderr: "piped",
    });

    const checkResult = await checkCmd.output();
    if (!checkResult.success) {
      throw new Error(`Branch not found: ${fullBranch}`);
    }

    // Get commit history
    const logCmd = new Deno.Command("git", {
      args: [
        "log",
        fullBranch,
        "--not",
        defaultBranch,
        "--format=%H|||%s|||%aI",
      ],
      cwd: repoPath,
      stdout: "piped",
      stderr: "piped",
    });

    const logResult = await logCmd.output();
    const commits = new TextDecoder().decode(logResult.stdout)
      .trim()
      .split("\n")
      .filter((l) => l)
      .map((line) => {
        const [sha, message, timestamp] = line.split("|||");
        return { sha, message, timestamp };
      });

    // Get diff
    const diffCmd = new Deno.Command("git", {
      args: ["diff", `${defaultBranch}...${fullBranch}`],
      cwd: repoPath,
      stdout: "piped",
      stderr: "piped",
    });

    const diffResult = await diffCmd.output();
    const diff = new TextDecoder().decode(diffResult.stdout);

    // Get files changed count
    const filesCmd = new Deno.Command("git", {
      args: ["diff", "--name-only", `${defaultBranch}...${fullBranch}`],
      cwd: repoPath,
      stdout: "piped",
      stderr: "piped",
    });

    const filesResult = await filesCmd.output();
    const files = new TextDecoder().decode(filesResult.stdout).trim().split("\n").filter((f) => f);

    // Extract metadata from branch name
    // request_id format: request-NNN, trace_id format: xxx-yyy-zzz
    const match = fullBranch.match(/^feat\/(request-[\w]+)-(.+)$/);
    const [, request_id, trace_id] = match || ["", fullBranch, "unknown"];

    return {
      branch: fullBranch,
      trace_id,
      request_id,
      files_changed: files.length,
      created_at: commits[commits.length - 1]?.timestamp || new Date().toISOString(),
      agent_id: commits[0]?.sha.substring(0, 8) || "unknown",
      diff,
      commits,
    };
  }

  /**
   * Approve changeset - merge branch to main
   * @param branchName Branch name or request_id
   */
  async approve(branchName: string): Promise<void> {
    const changeset = await this.show(branchName);
    const repoPath = await this.findRepoForBranch(changeset.branch);

    // Get the default branch for this repository
    const defaultBranch = await this.getDefaultBranch(repoPath);

    // Verify we're on the default branch
    const currentBranchCmd = new Deno.Command("git", {
      args: ["branch", "--show-current"],
      cwd: repoPath,
      stdout: "piped",
      stderr: "piped",
    });

    const branchResult = await currentBranchCmd.output();
    const currentBranch = new TextDecoder().decode(branchResult.stdout).trim();

    if (currentBranch !== defaultBranch) {
      throw new Error(
        `Must be on '${defaultBranch}' branch to approve changesets (currently on '${currentBranch}')\nRun: git checkout ${defaultBranch}`,
      );
    }

    // Create GitService for the portal repository
    const portalGitService = new GitService({
      config: this.config,
      db: this.db,
      repoPath,
      traceId: changeset.trace_id,
      agentId: await this.getUserIdentity(),
    });

    // Merge branch
    await portalGitService.runGitCommand([
      "merge",
      "--no-ff",
      changeset.branch,
      "-m",
      `Merge ${changeset.request_id}: ${
        changeset.commits[0]?.message || "agent changes"
      }\n\nTrace-Id: ${changeset.trace_id}`,
    ]);

    // Get merge commit SHA
    const shaResult = await portalGitService.runGitCommand(["rev-parse", "HEAD"]);
    const commitSha = shaResult.output.trim();

    // Log approval with user identity
    const _userIdentity = await this.getUserIdentity();
    const actionLogger = await this.getActionLogger();
    actionLogger.info("changeset.approved", changeset.request_id, {
      commit_sha: commitSha,
      branch: changeset.branch,
      files_changed: changeset.files_changed,
      approved_at: new Date().toISOString(),
      via: "cli",
      command: this.getCommandLineString(),
    }, changeset.trace_id);
  }

  /**
   * Reject changeset - delete branch without merging
   * @param branchName Branch name or request_id
   * @param reason Rejection reason
   */
  async reject(branchName: string, reason: string): Promise<void> {
    if (!reason || reason.trim().length === 0) {
      throw new Error(
        'Rejection reason is required\nUse: exoctl changeset reject <id> --reason "your reason"',
      );
    }

    const changeset = await this.show(branchName);
    const repoPath = await this.findRepoForBranch(changeset.branch);

    // Create GitService for the portal repository
    const portalGitService = new GitService({
      config: this.config,
      db: this.db,
      repoPath,
      traceId: changeset.trace_id,
      agentId: await this.getUserIdentity(),
    });

    // Try to delete branch
    try {
      await portalGitService.runGitCommand(["branch", "-D", changeset.branch]);
    } catch (error) {
      // Check if the error is due to worktree conflict
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("used by worktree")) {
        // Branch is checked out in a worktree, try to remove the worktree first
        try {
          // Find worktrees using this branch
          const worktreeList = await portalGitService.runGitCommand(["worktree", "list", "--porcelain"]);
          const worktrees = worktreeList.output.trim().split("\n");

          let worktreePath: string | null = null;
          for (let i = 0; i < worktrees.length; i++) {
            const line = worktrees[i];
            if (line.startsWith("worktree ")) {
              const path = line.substring("worktree ".length);
              // Check the next few lines for branch info (skip HEAD line)
              for (let j = i + 1; j < worktrees.length && j < i + 4; j++) {
                if (worktrees[j].startsWith("branch ")) {
                  const branchRef = worktrees[j].substring("branch ".length);
                  // Extract branch name from refs/heads/branch
                  const branchName = branchRef.startsWith("refs/heads/")
                    ? branchRef.substring("refs/heads/".length)
                    : branchRef.split("/").pop();
                  if (branchName === changeset.branch) {
                    worktreePath = path;
                    break;
                  }
                }
              }
              if (worktreePath) break;
            }
          }

          if (worktreePath) {
            // Remove the worktree forcefully
            await portalGitService.runGitCommand(["worktree", "remove", "--force", worktreePath]);
            // Now try to delete the branch again
            await portalGitService.runGitCommand(["branch", "-D", changeset.branch]);
          } else {
            // Couldn't find the worktree, re-throw original error
            throw new Error(`Failed to delete branch: ${errorMessage}\nCould not locate worktree using this branch.`);
          }
        } catch (worktreeError) {
          const wtErrorMessage = worktreeError instanceof Error ? worktreeError.message : String(worktreeError);
          throw new Error(
            `Failed to delete branch: ${errorMessage}\n` +
              `Attempted to remove worktree but failed: ${wtErrorMessage}\n` +
              `Try manually removing the worktree first: git worktree remove --force <worktree-path>`,
          );
        }
      } else {
        // Re-throw non-worktree errors
        throw error;
      }
    }

    // Log rejection with user identity
    const _userIdentity = await this.getUserIdentity();
    const actionLogger = await this.getActionLogger();
    actionLogger.info("changeset.rejected", changeset.request_id, {
      branch: changeset.branch,
      rejection_reason: reason,
      files_changed: changeset.files_changed,
      rejected_at: new Date().toISOString(),
      via: "cli",
      command: this.getCommandLineString(),
    }, changeset.trace_id);
  }
}
