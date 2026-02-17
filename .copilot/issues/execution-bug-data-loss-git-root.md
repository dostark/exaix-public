---
title: "Critical Data Loss: Git Repository Scope Mismatch in Runtime Root"
status: resolved
priority: critical
created: 2026-02-17
resolved: 2026-02-17
labels: [bug, git, data-loss, core]
---

# Critical Data Loss: Git Repository Scope Mismatch in Runtime Root

## Problem

Executing an approved plan for a portal-based request can lead to apparent data loss in the ExoFrame runtime directory (`~/ExoFrame`). The system incorrectly initializes a Git repository in the runtime root and performs destructive operations (reset/checkout) that hide or remove files from the working directory.

## Reproduction Steps

```bash
# 1. Deploy workspace to ~/ExoFrame
# 2. Add a portal pointing to an external repo
# 3. Create a request for that portal
# 4. Approve the generated plan
# 5. If the execution encounters an error or triggers a rollback
# 6. Observe that ~/ExoFrame is now empty except for .git and Memory/
```

## Observed Behavior

- Deletion of `src/`, `Blueprints/`, `Workspace/`, and other critical runtime files from the user's view.
- Files remain in the hidden `.git` history but are missing from the working directory, breaking `exoctl` and the daemon.
- Corruption of the runtime directory with an unwanted Git repository.
- `git status` in `~/ExoFrame` shows all files as deleted or untracked if on a new branch.

## Expected Behavior

- Git operations should ONLY target the portal repository or the specific execution worktree.
- The ExoFrame runtime directory (`~/ExoFrame`) should NEVER be used as a Git repository root by the execution engine.
- Rollbacks should be scoped to the portal/worktree, not the system root.

## Environment

- ExoFrame Version: 0.1.0
- OS: Linux
- Deno Version: 1.x.x

## Root Cause Analysis

**Primary Issue:** `PlanExecutor` instantiates `GitService` without an explicit `repoPath` in some flows, causing it to default to `config.system.root`.

**Technical Details:**
1. **Accidental Git Init**: `GitService.ensureRepository()` is called on this incorrectly-scoped service, running `git init` in `~/ExoFrame`.
2. **Massive Staging**: After each step, `PlanExecutor` calls `git.commit()`, which runs `git add .` in the runtime root, staging and committing the entire ExoFrame installation into a feature branch.
3. **Destructive Rollback**: `ExecutionLoop.handleFailure` runs `git reset --hard HEAD` and `git checkout main` in the system root. This removes all files from the working directory because the `main`/`master` branch in this accidental repo defaults to empty or only contains a `.gitignore`.

## Resolved: Implemented Changes (2026-02-17)

The system has been hardened with multiple layers of security to prevent repository scope mismatch and destructive operations.

### 1. Hardened Git Service (`src/services/git_service.ts`)
- **New Error Types**: Introduced `GitSecurityError` and `GitNothingToCommitError`.
- **Command Guards**: `runGitCommand` now blocks destructive operations (`reset --hard`, `clean -xfd`).
- **Path Awareness**: Prohibits all non-read-only Git operations (like `add`, `commit`, `checkout`) if the current repository path matches `config.system.root`.
- **Branch Protection**: `checkoutBranch` explicitly blocks switching to `main`, `master`, `develop`, etc.
- **Precise Error Reporting**: `commit()` now throws a specific `GitNothingToCommitError` for better lifecycle management.

### 2. Explicit Repository Scoping (`src/services/plan_executor.ts`)
- **Required Pathing**: `PlanExecutor` now requires an explicit `repoPath` in its constructor, eliminating reliance on system-wide defaults.
- **Tool Context Isolation**: The `execute` method now defaults the `baseDir` for `ToolRegistry` to `this.repoPath`. This ensures that all agent file operations (write, read, etc.) are correctly scoped to the repository being worked on.
- **Safe Step Commits**: `executeStep` specifically catches `GitNothingToCommitError` while allowing `GitSecurityError` and other critical failures to bubble up.

### 3. Isolated Execution Lifecycle (`src/services/execution_loop.ts`)
- **Strategy Enforcement**: Forced `PortalExecutionStrategy.WORKTREE` for all portal-assigned tasks to ensure isolation.
- **Removed Dangerous Rollbacks**: Eliminated the global `git reset --hard` and `git checkout main` logic from `handleFailure`.
- **Targeted Cleanup**: Implemented safe worktree removal using `portalGitService.removeWorktree` for failed tasks.
- **System Root Guard**: Added a guard in `setupGitForExecution` to skip Git initialization in the system root for non-portal tasks.

### 4. Tool Registry Guards (`src/services/tool_registry.ts`)
- **Argument Validation**: Enhanced `validateGitArguments` to block destructive Git options and protected branch operations when triggered via the `run_command` tool.

## Related Files

- `src/services/plan_executor.ts` - Instantiation of GitService with default path.
- `src/services/execution_loop.ts` - Logic for rollback and status updates.
- `src/services/git_service.ts` - Path resolution and command execution.
- `src/services/tool_registry.ts` - Security validation for tool arguments.

## Workaround

**Manual Recovery:**
1. Check current branch: `git branch` in `~/ExoFrame`.
2. Locate the branch containing your files (usually `feat/request-...`).
3. Checkout the files: `git checkout <branch> -- .`
4. Delete the accidental `.git` folder ONLY if you are sure you've recovered everything. **CAUTION: This is destructive.**

## Critical Security Requirements

1.  **Destructive Operations Prohibited**: Any git rollback operations like `git reset --hard` are **strictly prohibited** in any circumstances within a portal or the runtime workspace. Rollbacks must be handled through safe mechanisms (e.g., `git restore` on specific files or deleting the temporary worktree/branch) that do not risk deleting uncommitted or unrelated work.
2.  **Protected Branches**: All code changes in a portal are allowed **ONLY** on designated feature branches and/or worktrees. Direct modifications or checkouts to the `main`/`master` branch by the agent are **STRICTLY FORBIDDEN**.
3.  **Isolation**: The system must ensure that the execution environment is completely isolated from the runtime root to prevent accidental "cross-contamination" of Git repositories.

## Recommended Fix

1.  **Pass Repo Path**: Ensure `PlanExecutor` and `ExecutionLoop` always receive and pass the explicit portal repository path when creating `GitService`.
2.  **Safety Guard in GitService**: Implement a guard in `GitService.runGitCommand` to block destructive commands (like `reset --hard`) if the target path is detected as the system root or a protected branch.
3.  **Branch Enforcement**: Modify `GitService.checkoutBranch` to throw an error if an agent attempts to switch to `main`, `master`, or any other protected system branch.
4.  **Remove Global Rollbacks**: Replace the `git reset --hard` logic in `ExecutionLoop.handleFailure` with targeted cleanup of the specific feature branch or worktree associated with the trace ID.

## Fix Plan

The primary objective is to enforce strict repository isolation and eliminate destructive Git operations from the execution lifecycle. We will move from a "cleanup on error" model to a "safe by construction" model using isolated worktrees or branches, and add protective middleware to the `GitService`.

## Implementation Steps

### Phase 1: Repository Isolation
1.  [x] **Refactor `PlanExecutor`**: Update `src/services/plan_executor.ts` to make `repoPath` a required constructor argument. Remove any defaults to `config.system.root`.
2.  [x] **Trace-Scoped Worktrees**: Modify `ExecutionLoop` to always use `PortalExecutionStrategy.WORKTREE` for portal tasks, ensuring work is performed in a temporary directory outside the system root.

### Phase 2: Git Service Guards
1.  [x] **Command Whitelisting/Blacklisting**: Add a validation layer in `GitService.runGitCommand` (`src/services/git_service.ts`):
    *   Throw `GitSecurityError` if arguments contain `reset`, `--hard`, or `clean -xfd` (global destructive operations).
    *   Verify that the `cwd` (repoPath) is not equal to `config.system.root`.
2.  [x] **Branch Protection**: Update `checkoutBranch` to explicitly block checkouts to `main`, `master`, or `develop`.

### Phase 3: Lifecycle Refactoring
1.  [x] **Safe Reversion**: In `ExecutionLoop.handleFailure` (`src/services/execution_loop.ts`), remove the global `git reset --hard` and `git checkout main` calls.
2.  [x] **Cleanup Logic**: Implement safe cleanup:
    *   If using worktrees: `git worktree remove --force <path>`.
    *   If using branches: simply leave the branch in an error state for user inspection, or delete it if it's untracked.

### Phase 4: Audit & Cleanup
1.  [x] **Repository Audit**: Search for any other direct calls to `Deno.Command("git", ...)` and replace them with `GitService` calls to ensure guards are applied.

## Success Criteria

1.  **Zero System Root Taint**: Running any plan (successful or failing) never creates a `.git` folder or initializes a repository in `~/ExoFrame`.
2.  **No Destructive Resets**: The `git reset --hard` command is never executed by the daemon during any lifecycle stage.
3.  **Branch Integrity**: The `main`/`master` branch of any portal repository remains untouched by the agent execution engine.
4.  **Explicit Errors**: Attempting to perform unauthorized Git operations (e.g., path traversal or destructive commands) results in a logged `GitSecurityError`.

## Success Criteria Verification (2026-02-17)

1.  **Zero System Root Taint**: **PASSED**. Multi-layered guards in `GitService` and `ExecutionLoop` prevent any Git activity in `~/ExoFrame`.
2.  **No Destructive Resets**: **PASSED**. Security middleware blocks `reset --hard` at the service level, and all such calls have been removed from the lifecycle.
3.  **Branch Integrity**: **PASSED**. `checkoutBranch` and `validateGitArguments` correctly block operations on protected local and remote branches.
4.  **Regression Testing**: **PASSED**. New suite `tests/git_security_regression_test.ts` covers all guard scenarios.

## Planned Testing

1.  **Security Unit Tests**: **PASSED**
    *   `tests/unit/git_service_security_test.ts`: Verify that `GitService` throws an error when attempting to run `reset --hard`.
    *   `tests/unit/git_service_security_test.ts`: Verify that `checkoutBranch("master")` is blocked.
    *   *Note: These are covered by `tests/git_security_regression_test.ts`.*
2.  **Lifecycle Integration Test**: **PASSED**
    *   `tests/integration/portal_data_safety_test.ts`: Trigger a failing plan in a portal and verify that the runtime directory `src/` folder remains intact and `git status` in the root shows "not a git repository".
3.  **Regression Tests**: **PASSED**
    *   Verify that successful feature branch deployments through portals still function correctly with the new worktree/branch guards.

## Priority Justification

**Critical.** Resolved. The patch eliminates a catastrophic data loss risk and ensures that ExoFrame's runtime environment remains secure and stable during automated plan execution. Detailed reproduction and root cause analysis are preserved for historical audit.
