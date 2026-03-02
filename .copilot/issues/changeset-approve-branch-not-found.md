---
title: "Changeset approve fails to find branches in portal repositories"
status: resolved
priority: high
created: 2026-01-22
updated: 2026-01-22
labels: [bug, cli, changeset]
---

# Changeset approve fails to find branches in portal repositories

## Problem

The `exoctl changeset approve` command fails with "Branch not found" error even when the changeset is visible in `exoctl changeset list`. This occurs because the approve command only searches the workspace root repository for branches, but changesets can be created in portal repositories.

## Reproduction Steps

```bash
# Create a request that generates a changeset in a portal repo
exoctl request create "some request"

# Wait for agent to create plan and changeset
exoctl plan approve <plan-id>

# List changesets - shows the changeset
exoctl changeset list

# Try to approve - fails
exoctl changeset approve request-a300d5a5
```text

## Observed Behavior

```text
❌ cli.error: changeset approve
   message: Branch not found: feat/request-a300d5a5-a300d5a5
```text

But `exoctl changeset list` shows:

```text
✅ changeset.list: changesets
   count: 1
✅ 📌 request-a300d5a5: feat/request-a300d5a5-a300d5a5
   files: 0
   created: 1/22/2026, 8:14:56 PM
   trace: a300d5a5...
```text

## Expected Behavior

The approve command should find the branch in the correct repository (portal or workspace) and successfully merge it.

## Environment

- ExoFrame Version: current development
- OS: Linux
- Deno Version: 1.x.x
- Relevant Config: Portal repositories configured

## Investigation Needed

1. **Repository Search Logic**: Verify that `list` searches all repos but `approve` only workspace root
   - Check `findRepoForBranch` method implementation
   - Confirm portal symlink resolution works

1.
   - Portal repos vs workspace root
   - Symlink target validation

## Related Files

- `src/cli/changeset_commands.ts` - Contains approve, show, and list methods
- Lines 160-180: list method portal search logic
- Lines 250-290: approve method (before fix only checked workspaceRoot)

## Workaround

None currently known - changeset approval fails completely.

## Priority Justification

High priority because changeset approval is core functionality for the agent workflow. Without this fix, users cannot approve agent-generated code changes, breaking the entire request->plan->changeset->approve cycle.

## Resolution

- **Root Cause**: The `show`, `approve`, and `reject` methods in `ChangesetCommands` only performed git operations on `this.config.system.root` (workspace root), but changesets can exist in portal repositories. The `list` method correctly searched all repositories.

- **Fix**: Added `findRepoForBranch()` private method that searches through all portal repositories and workspace root to locate the correct repository containing the branch. Modified `show`, `approve`, and `reject` methods to use the correct repository path for all git operations.

- **Additional Fix**: Updated regex in `show` method from `request-\d+` to `request-[\w]+` to support alphanumeric request IDs like `request-a300d5a5`.

- **Commit**: Changes applied to `src/cli/changeset_commands.ts`

- **Verified**: Manual testing confirmed `exoctl changeset approve request-a300d5a5` now works correctly.

```

