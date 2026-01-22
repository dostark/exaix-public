---
title: "Plan/Changeset Approval Not Reflected in List Commands"
status: open
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

## Latest Update (2026-01-22)
Issue was previously marked as resolved, but manual testing shows the changeset list problem persists. The plan approval works and feature branches are created, but `exoctl changeset list` still returns empty.

### Reproduction from Latest Test
```
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
