---
title: "Cannot reject review when branch is used by worktree"
status: resolved
priority: medium
created: 2026-01-23
resolved: 2026-01-26
labels: [bug, cli, review, git]
---

## Problem

When attempting to reject a review using `exoctl review reject <id> --reason "reason"`, the command fails with an error if the branch is currently checked out in a worktree (typically a portal worktree). The error message is:

```text
Failed to delete branch: error: cannot delete branch 'feat/request-XXX-XXX' used by worktree at '/tmp/test-portal'
```

This prevents users from rejecting changesets that are associated with active portals.

## Reproduction Steps

```bash
# Create and approve a plan (creates review)
exoctl request "Add feature" --agent senior-coder --portal TestPortal
exoctl plan approve <plan-id>

# Try to reject the review
exoctl review reject <request-id> --reason "Implementation issues"
# Fails with: Failed to delete branch: error: cannot delete branch 'feat/request-XXX-XXX' used by worktree at '/path/to/portal'
```

## Observed Behavior

- `exoctl review reject` fails when the branch is checked out in a worktree
- Git error: `cannot delete branch 'branch-name' used by worktree at 'path'`
- No alternative way to reject the review

## Expected Behavior

- `exoctl review reject` should succeed even when the branch is used by a worktree
- Either force-remove the worktree before deleting the branch, or provide a clear error message with instructions
- Changesets should be rejectable regardless of worktree status

## Environment

- ExoFrame Version: 1.0.0
- OS: Linux
- Deno Version: (current)
- Git Version: (current)

## Investigation Needed

1. **Worktree Detection**: Check if branch is in use by worktree before attempting deletion
   - Use `git worktree list` to find worktrees using the branch
   - Determine if worktree can be safely removed

1.
   - For portal worktrees: check if portal is still needed
   - For temporary worktrees: safe to remove
   - Consider `git worktree remove --force` vs `git worktree prune`

1.
   - Detect worktree conflict and explain the issue
   - Suggest manual resolution steps if automatic removal isn't safe

## Related Files

- `src/cli/changeset_commands.ts` - `reject()` method that calls `git branch -D`
- Portal worktree management code
- Git worktree handling utilities

## Workaround

None currently available - review cannot be rejected if branch is in use by worktree.

## Priority Justification

Medium priority - affects review rejection workflow when portals are involved, but doesn't break core functionality. Users can manually resolve by removing worktrees first, but this is not user-friendly.

## Resolution (when resolved)

- **Root Cause**: `git branch -D` fails when branch is checked out in worktree
- **Fix**: Enhanced `reject()` method in `src/cli/changeset_commands.ts` to detect worktree conflicts and handle them automatically:
  - Detects when branch is checked out in main working tree and switches to master first
  - Finds worktrees using the branch via `git worktree list --porcelain`
  - Removes worktrees forcefully with `git worktree remove --force` (for non-main worktrees)
  - Provides clear error messages if automatic resolution fails
- **Tests**: Added comprehensive tests in `tests/cli/changeset_commands_test.ts`:
  - `should handle worktree conflicts when rejecting` - verifies worktree removal and branch deletion
  - `should handle branch checked out in main working tree when rejecting` - verifies checkout handling
- **Commit**: [5fdb639] fix: correct execution folder location to use Memory/Execution/
- **Verified**: All tests pass, including new regression tests for worktree conflict handling
