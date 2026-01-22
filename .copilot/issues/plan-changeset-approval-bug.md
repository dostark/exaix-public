---
title: "Plan/Changeset Approval Not Reflected in List Commands"
status: resolved
priority: high
created: 2026-01-22
labels: [bug, plan, changeset, cli, approval, regression]
---

# Plan/Changeset Approval Not Reflected in List Commands

## Problem

When following the manual test scenario for plan approval and changeset approval, the following issues were observed:

- After approving a plan, `exoctl plan list` does not show the approved plan (even with `--status=approved`).
- After plan approval, a feature branch with the correct changeset is created in the portal repo, but `exoctl changeset list` returns an empty list.

## Reproduction Steps

1. Deploy a fresh ExoFrame workspace and configure a test portal as described in the manual scenario.
2. Submit a request and approve the generated plan.
3. Run `exoctl plan list` and `exoctl plan list --status=approved`.
4. Observe that no plans are listed, even though approval succeeded.
5. Check the portal repo: the feature branch and changeset are present.
6. Run `exoctl changeset list`.
7. Observe that no changesets are listed.

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

## Resolution

### Root Cause Analysis

**Plan List Issue:**
- `exoctl plan list --status approved` only scanned `Workspace/Active/` directory
- Approved plans are moved to `Workspace/Archive/` after successful execution
- Result: Completed plans were invisible to CLI users

**Changeset List Issue:**
- `exoctl changeset list` only scanned git branches in workspace root
- Changesets are created as `feat/*` branches in portal repositories
- Result: Portal changesets were invisible to CLI users

### Fixes Applied

**Plan List Fix (`src/cli/plan_commands.ts`):**
- Modified `list()` method to scan both `Workspace/Active/` and `Workspace/Archive/` for approved status
- Updated comments to reflect that approved plans can be in either location

**Changeset List Fix (`src/cli/changeset_commands.ts`):**
- Modified `list()` method to enumerate all portal repositories
- Added logic to scan `feat/*` branches in each portal's git repository
- Gracefully handles broken/missing portals

### Testing
- ✅ All existing unit tests pass
- ✅ Added regression test for archived plan listing
- ✅ Integration tests confirm CLI commands work correctly
- ✅ Manual verification shows approved plans and changesets now appear in lists

### Files Changed
- `src/cli/plan_commands.ts` - Include Archive directory in approved plan scanning
- `src/cli/changeset_commands.ts` - Scan portal repositories for changeset branches
- `tests/cli/plan_commands_test.ts` - Added regression test
- Verify changeset indexing and plan state transitions after approval.
- Ensure CLI reflects all relevant states for plans and changesets.
