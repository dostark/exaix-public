---
title: "Rejected plans not shown in plan show command"
status: resolved
priority: medium
created: 2026-01-23
updated: 2026-01-23
labels: [bug, cli, plan]
---

## Problem

When a plan is rejected using `exactl plan reject`, it can no longer be viewed using `exactl plan show <id>`. The command returns "Plan not found" even though the plan appears in `exactl plan list` with status "rejected".

## Reproduction Steps

```bash
# Create a request
exactl request "Add goodbye function" --agent senior-coder --portal TestApp

# List plans to see the generated plan
exactl plan list

# Show the plan (works before rejection)
exactl plan show <plan-id>

# Reject the plan
exactl plan reject <plan-id> --reason "Too vague request"

# Try to show the rejected plan (fails)
exactl plan show <plan-id>
# Returns: ❌ cli.error: plan show message: Plan not found: <plan-id>

# But it's still listed
exactl plan list
# Shows the plan with status: rejected
```

## Observed Behavior

- `exactl plan show <rejected-plan-id>` returns "Plan not found"
- `exactl plan list` correctly shows the rejected plan with status "rejected"
- The rejection operation itself succeeds and logs properly

## Expected Behavior

- `exactl plan show <rejected-plan-id>` should display the rejected plan's content, including the rejection reason and timestamp
- Rejected plans should be viewable for audit and review purposes

## Environment

- Exaix Version: 1.0.0
- OS: Linux
- Deno Version: (current)
- Relevant Config: N/A

## Investigation Needed

1. **Plan Show Logic**: Check the plan show command implementation
   - ✅ **FOUND**: `src/cli/plan_commands.ts` `show()` method only searches `Workspace/Plans` directory
   - ❌ **ISSUE**: Rejected plans are moved to `Workspace/Rejected` with `_rejected.md` suffix
   - ✅ **SOLUTION**: Update `show()` method to search multiple directories like `list()` does

1.
   - ✅ **CONFIRMED**: Rejected plans moved to `Workspace/Rejected` with `_rejected.md` suffix
   - ✅ **CONFIRMED**: `list()` method correctly handles this, but `show()` does not

## Related Files

- `src/cli/exactl.ts` - CLI command definitions
- `src/cli/plan_commands.ts` - Plan command implementation (FIXED: updated show method)
- Plan storage/retrieval logic

## Workaround

Use `exactl plan list` to see rejected plans, but cannot view their content.

## Priority Justification

Medium priority - affects user experience for reviewing rejected plans, but has a workaround and doesn't break core functionality.

## Resolution (when resolved)

- **Root Cause**: `show()` method only searched `Workspace/Plans` directory, but rejected plans are stored in `Workspace/Rejected` with `_rejected.md` suffix
- **Fix**: Updated `show()` method to search multiple directories (Plans, Rejected, Active, Archive) in order of likelihood
- **Commit**: a6692a4
- **Verified**: Added test case and all existing tests pass
