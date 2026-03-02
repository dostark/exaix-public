---
title: "Plan/Changeset Approval Not Reflected in List Commands"
status: resolved
priority: high
created: 2026-01-22
labels: [bug, plan, changeset, cli, approval, regression]
---

## Problem

When following the manual test scenario for plan approval and changeset approval, the following issues were observed:

- After approving a plan, `exoctl plan list` does not show the approved plan (even with `--status=approved`).
- After plan approval, a feature branch with the correct changeset is created in the portal repo, but `exoctl changeset list` returns an empty list.

## Reproduction Steps

1. Deploy a fresh ExoFrame workspace and configure a test portal as described in the manual scenario.

1.
1.
1.
1.
1.

## Expected vs Observed Behavior

**Expected:**

- Approved plans should be visible in `exoctl plan list` (with or without status filter).
- Created changesets should be listed by `exoctl changeset list` after plan approval and execution.

**Observed:**

- `exoctl plan list` returns no plans after approval.
- `exoctl changeset list` returns no changesets, despite the branch and file changes being present in the portal repo.

## Additional Context

- Plan file is moved to `Workspace/Archive/` after approval.
- Feature branch is created and changes applied in the portal repo.
- No errors reported in CLI output during the process.

## Impact

- Users cannot track approved plans or resulting changesets via CLI, breaking expected workflow and auditability.

## Attachments

- See detailed CLI session and scenario in `docs/dev/ExoFrame_Manual_Test_Scenarios.md` (lines 830+)

## Suggested Investigation

- Check if plan/changeset list commands are filtering out approved/archived items incorrectly.

## Latest Update (2026-01-22)

Issue was previously marked as resolved, but manual testing shows the changeset list problem persists. The plan approval works and feature branches are created, but `exoctl changeset list` still returns empty.

### Reproduction from Latest Test

```bash
exoctl changeset list
✅ changeset.list: changesets
   count: 0
   message: No changesets found

# But in portal repo:
git branch

* feat/request-a300d5a5-a300d5a5
  master
```

The changeset listing logic needs to be investigated further.

## Resolution

### Fixed on 2026-01-22

Root causes identified and resolved:

1. **Changeset List Missing Config Portals**: The `exoctl changeset list` command only scanned portal symlinks in the workspace but ignored portals defined in `config.portals`. Changesets in portal repositories defined only in config were not discovered.

1.

### Changes Made

- **Enhanced changeset scanning** in `src/cli/changeset_commands.ts`: Added fallback scanning of `config.portals` array when symlink scanning finds no changesets.
- **Fixed archive path usage** in `src/services/execution_loop.ts`: Changed from hardcoded "Archive" to `config.paths.archive`.
- **Added regression test** in `tests/cli/changeset_commands_test.ts`: Ensures changeset list discovers changesets in config-defined portals.

### Verification

- All existing tests pass
- Manual testing confirms `exoctl changeset list` now shows changesets from portal repositories
- Plan approval and archiving now uses correct configured paths

