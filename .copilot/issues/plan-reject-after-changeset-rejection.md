---
title: "Cannot reject plan after changeset rejection"
status: resolved
priority: high
created: 2026-01-27
labels: [bug, plan, changeset, rejection]
---

## Problem

After rejecting a changeset, the associated plan remains in the plan list but cannot be rejected. Attempting to reject the plan results in "Plan not found" error, even though the plan is still visible in `exoctl plan list`.

## Reproduction Steps

```bash
# List changesets - shows one changeset
exoctl changeset list

# Reject the changeset successfully
exoctl changeset reject feat/request-08a998d4-08a998d4 --reason 'Wrong change'

# Verify changeset is gone
exoctl changeset list  # Shows no changesets

# List plans - still shows the plan
exoctl plan list

# Attempt to reject the plan - fails with "Plan not found"
exoctl plan reject request-08a998d4_plan --reason 'bad plan'
```

## Observed Behavior

- Changeset rejection succeeds and changeset disappears from list
- Plan remains in `exoctl plan list` with status: completed
- Plan rejection command fails with "Plan not found: request-08a998d4_plan"
- Error persists even after multiple attempts

## Expected Behavior

- Plan should be rejectable even after its changeset has been rejected
- Or plan should be automatically handled/removed when changeset is rejected
- Rejection should succeed and plan should be removed from list

## Environment

- ExoFrame Version: 1.0.0
- OS: Linux
- Deno Version: (unknown)
- Relevant Config: Default exo.config.toml

## Investigation Needed

1. **Plan Status Logic**: Check if plan status changes to "rejected" or "invalid" when changeset is rejected

1.

## Root Cause

The `reject()` method in `PlanCommands` class only searched the `Workspace/Plans` directory, while the `list()` and `show()` methods searched all directories (Plans, Active, Archive, Rejected). After changeset rejection, plans could be moved to different directories, making them invisible to the reject command.

## Resolution

Modified `src/cli/plan_commands.ts` reject() method to search all directories like the show() method:

```typescript
// Before: Only searched Workspace/Plans
const planPath = this.findPlanInDirectory(planId, this.workspacePath("Plans"));

// After: Searches all directories
const planPath = this.findPlanInDirectory(planId, [
  this.workspacePath("Plans"),
  this.workspacePath("Active"),
  this.workspacePath("Archive"),
  this.workspacePath("Rejected"),
]);
```

## Testing

- All PlanCommands tests pass (28 steps)
- CLI fallback regression tests pass
- Code formatting and linting successful
- **Added regression test** in `tests/plan_commands_regression_test.ts`: `[regression] Plan reject finds plans in any directory`
- Fix allows rejecting plans from any directory location

## Related Files

- `src/cli/plan.ts` - Plan CLI commands including reject
- `src/cli/changeset.ts` - Changeset CLI commands including reject
- `src/services/plan_service.ts` - Plan business logic
- `src/services/changeset_service.ts` - Changeset business logic

## Workaround

None currently known. Plan remains in limbo state.

## Priority Justification

High priority - breaks the ability to clean up completed plans, potentially leading to accumulation of stale plan records and confusing UI state.
