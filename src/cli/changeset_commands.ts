/**
 * Changeset commands for reviewing agent-generated code changes
 * Handles approval/rejection of git branches created by agents
 */

import { join } from "@std/path";
import { BaseCommand, type CommandContext } from "./base.ts";
import { GitService } from "../services/git_service.ts";
import { ChangesetStatus } from "../enums.ts";
import { RequestCommands } from "./request_commands.ts";
import { PlanCommands } from "./plan_commands.ts";
import { isTestMode } from "../config/env_schema.ts";

export interface ChangesetMetadata {
  branch: string;
  trace_id: string;
  request_id: string;
  files_changed: number;
  created_at: string;
  agent_id: string;
  // Request context
  request_title?: string;
  request_agent?: string;
  request_portal?: string;
  request_priority?: string;
  request_created_by?: string;
  request_flow?: string;
  // Plan context
  plan_id?: string;
  plan_status?: string;
  // Portal context
  portal?: string;
  // Status context
  status?: string;
  approved_at?: string;
  approved_by?: string;
  rejected_at?: string;
  rejected_by?: string;
  rejection_reason?: string;
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
  private requestCommands: RequestCommands;
  private planCommands: PlanCommands;

  constructor(
    context: CommandContext,
    gitService: GitService,
  ) {
    super(context);
    this.gitService = gitService;
    this.requestCommands = new RequestCommands(context);
    this.planCommands = new PlanCommands(context);
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

  private async extractChangesetMetadataWithContext(
    basicMetadata: ChangesetMetadata,
  ): Promise<ChangesetMetadata> {
    const metadata = { ...basicMetadata };

    // Load request information if we have a request_id
    if (metadata.request_id) {
      try {
        // Extract trace_id from request_id (format: "request-{trace_id}")
        let requestIdentifier = metadata.request_id;
        if (metadata.request_id.startsWith("request-")) {
          const traceId = metadata.request_id.substring(8); // Remove "request-" prefix
          requestIdentifier = traceId;
        }

        const requestResult = await this.requestCommands.show(requestIdentifier);
        const request = requestResult.metadata;

        // Extract title from content (first header or first non-empty line)
        const contentLines = requestResult.content.split("\n").map((line) => line.trim()).filter((line) => line);
        let title = "Untitled Request";

        for (const line of contentLines) {
          if (line.startsWith("# ")) {
            title = line.substring(2).trim();
            break;
          } else if (!line.startsWith("#") && line) {
            title = line;
            break;
          }
        }

        metadata.request_title = title;
        metadata.request_agent = request.agent;
        metadata.request_portal = request.portal;
        metadata.request_priority = request.priority;
        metadata.request_created_by = request.created_by;
        metadata.request_flow = request.flow;
      } catch (error) {
        // If request can't be loaded, continue without request info
        if (!isTestMode()) {
          console.warn(`Warning: Could not load request info for changeset ${metadata.request_id}:`, error);
        }
      }
    }

    // Try to find associated plan using trace_id
    if (metadata.trace_id) {
      try {
        const plans = await this.planCommands.list();
        const associatedPlan = plans.find((plan) => plan.trace_id === metadata.trace_id);

        if (associatedPlan) {
          metadata.plan_id = associatedPlan.id;
          metadata.plan_status = associatedPlan.status;
        }
      } catch (error) {
        // If plan can't be loaded, continue without plan info
        console.warn(`Warning: Could not load plan info for changeset ${metadata.request_id}:`, error);
      }
    }

    return metadata;
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

    // Also scan configured portals (fallback for missing/broken symlinks)
    for (const portal of this.config.portals || []) {
      try {
        // Check if target still exists and is a git repo
        await Deno.stat(join(portal.target_path, ".git"));
        // Only add if not already in the list
        if (!portalPaths.includes(portal.target_path)) {
          portalPaths.push(portal.target_path);
        }
      } catch {
        // Skip invalid portal paths
        continue;
      }
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

        const basicMetadata = {
          branch,
          trace_id,
          request_id,
          files_changed: files.length,
          created_at: timestamp,
          agent_id,
          status: status.toLowerCase(),
        };

        // Enrich with request and plan context
        const enrichedMetadata = await this.extractChangesetMetadataWithContext(basicMetadata);
        changesets.push(enrichedMetadata);
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

    const basicMetadata = {
      branch: fullBranch,
      trace_id,
      request_id,
      files_changed: files.length,
      created_at: commits[commits.length - 1]?.timestamp || new Date().toISOString(),
      agent_id: commits[0]?.sha.substring(0, 8) || "unknown",
    };

    // Enrich with request and plan context
    const enrichedMetadata = await this.extractChangesetMetadataWithContext(basicMetadata);

    return {
      ...enrichedMetadata,
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
      // Check if the error is due to branch being checked out
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("used by worktree") || errorMessage.includes("checked out")) {
        // Branch is checked out somewhere, try to handle it
        try {
          // Check what branch is currently checked out
          const currentBranchResult = await portalGitService.runGitCommand(["branch", "--show-current"]);
          const currentBranch = currentBranchResult.output.trim();

          if (currentBranch === changeset.branch) {
            // Branch is checked out in the main working tree, switch to master first
            await portalGitService.runGitCommand(["checkout", "master"]);
          } else {
            // Branch might be checked out in a worktree, try to remove worktrees
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
              // Check if this is the main working tree (can't be removed)
              const mainWorktreeResult = await portalGitService.runGitCommand(["worktree", "list", "--porcelain"]);
              const mainWorktree = mainWorktreeResult.output.trim().split("\n")[0];
              if (mainWorktree && mainWorktree.includes(worktreePath)) {
                // This is the main working tree, switch to master instead
                await portalGitService.runGitCommand(["checkout", "master"]);
              } else {
                // Remove the worktree forcefully
                await portalGitService.runGitCommand(["worktree", "remove", "--force", worktreePath]);
              }
            }
          }

          // Now try to delete the branch again
          await portalGitService.runGitCommand(["branch", "-D", changeset.branch]);
        } catch (worktreeError) {
          const wtErrorMessage = worktreeError instanceof Error ? worktreeError.message : String(worktreeError);
          throw new Error(
            `Failed to delete branch: ${errorMessage}\n` +
              `Attempted to resolve checkout/worktree conflict but failed: ${wtErrorMessage}\n` +
              `Try manually checking out a different branch and then deleting: git checkout master && git branch -D ${changeset.branch}`,
          );
        }
      } else {
        // Re-throw other errors
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
