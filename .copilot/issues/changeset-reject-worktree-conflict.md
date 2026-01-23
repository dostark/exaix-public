---
title: "Cannot reject changeset when branch is used by worktree"
status: open
priority: medium
created: 2026-01-23
labels: [bug, cli, changeset, git]
---

# Cannot reject changeset when branch is used by worktree

## Problem

When attempting to reject a changeset using `exoctl changeset reject <id> --reason "reason"`, the command fails with an error if the branch is currently checked out in a worktree (typically a portal worktree). The error message is:

```
Failed to delete branch: error: cannot delete branch 'feat/request-XXX-XXX' used by worktree at '/tmp/test-portal'
```

This prevents users from rejecting changesets that are associated with active portals.

## Reproduction Steps

```bash
# Create and approve a plan (creates changeset)
exoctl request "Add feature" --agent senior-coder --portal TestPortal
exoctl plan approve <plan-id>

# Try to reject the changeset
exoctl changeset reject <request-id> --reason "Implementation issues"
# Fails with: Failed to delete branch: error: cannot delete branch 'feat/request-XXX-XXX' used by worktree at '/path/to/portal'
```

## Observed Behavior

- `exoctl changeset reject` fails when the branch is checked out in a worktree
- Git error: `cannot delete branch 'branch-name' used by worktree at 'path'`
- No alternative way to reject the changeset

## Expected Behavior

- `exoctl changeset reject` should succeed even when the branch is used by a worktree
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

2. **Worktree Removal**: Implement safe worktree removal
   - For portal worktrees: check if portal is still needed
   - For temporary worktrees: safe to remove
   - Consider `git worktree remove --force` vs `git worktree prune`

3. **Error Handling**: Provide better error messages
   - Detect worktree conflict and explain the issue
   - Suggest manual resolution steps if automatic removal isn't safe

## Related Files

- `src/cli/changeset_commands.ts` - `reject()` method that calls `git branch -D`
- Portal worktree management code
- Git worktree handling utilities

## Workaround

None currently available - changeset cannot be rejected if branch is in use by worktree.

## Priority Justification

Medium priority - affects changeset rejection workflow when portals are involved, but doesn't break core functionality. Users can manually resolve by removing worktrees first, but this is not user-friendly.

## Resolution (when resolved)

- **Root Cause**: `git branch -D` fails when branch is checked out in worktree
- **Fix**: Detect worktree usage and handle appropriately (force remove or better error)
- **Commit**: [pending]
- **Verified**: [pending]
