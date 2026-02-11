---
title: "Technical Writer Agent Plan Validation Failure - No Plan Saved for Review"
status: open
priority: high
created: 2026-02-11
github_issue:
labels: [bug, request-processor, validation, technical-writer]
assignee:
related_issues: [plan-validation-failure-senior-coder.md]
---

## Problem

When a request to the `technical-writer` agent produces a plan that fails JSON validation, the following issues occur:

1. **No saved plan candidate**: The invalid plan is not saved anywhere for manual review
1. **No possibility to review the plan manually**: Users cannot inspect what the agent actually produced
1. **Missing trace events**: No detailed logs/events in journal showing the plan content or validation failure details

## Reproduction Steps

```bash
# Submit request to technical-writer agent
exoctl request --portal portal-exoframe --agent technical-writer "Create comprehensive API documentation for ExoFrame's flow engine..."

# Check request status
exoctl request show <trace-id>
# Shows: status: failed

# Check journal for details
exoctl journal events --actor technical-writer --limit 10
# Shows: plan.validation.failed agent=agent trace=<id> target=request-<id>
# But no details about WHAT failed or the plan content

# Check for saved plans
exoctl plan list
# Shows no plans (0 results)
```

## Observed Behavior

From the logs provided:

```bash
2/11/2026, 10:14:25 AM plan.validation.failed agent=agent trace=037e74c4 target=request-037e74c4
2/11/2026, 10:14:25 AM agent.execution_completed agent=technical-writer trace=037e74c4 target=request-037e74c4
❌ request.processing.error: /home/dkasymov/ExoFrame/Workspace/Requests/request-037e74c4.md
   error: Plan content is not valid JSON
❌ request.failed: /home/dkasymov/ExoFrame/Workspace/Requests/request-037e74c4.md
   error: Plan content is not valid JSON
```

The request fails with "Plan content is not valid JSON" but:

- No plan file is saved in `Workspace/Plans/` or `Rejected/`
- No detailed validation error information
- No way to see what the agent actually output

## Expected Behavior

When plan validation fails:

1. **Save invalid plan for review**: The plan should be saved (perhaps in `Rejected/` or `Workspace/Plans/` with a `failed` status)
1. **Detailed error logging**: Log the specific validation errors and the raw plan content
1. **Manual review capability**: Allow users to inspect failed plans via `exoctl plan show <id>` or similar

## Investigation Needed

1. **Check Plan Saving Logic**: Verify where and when plans are saved during the validation process
1. **Review Validation Error Handling**: Ensure validation failures are logged with details
1. **Examine Plan Storage**: Confirm if failed plans should be stored for debugging
1. **Check Technical Writer Output**: Inspect what the agent is actually producing that fails JSON parsing

## Related Files

- `src/services/request_processor.ts` - Plan validation and saving logic
- `src/schemas/plan_schema.ts` - Plan validation schema
- `Blueprints/Agents/technical-writer.md` - Agent blueprint
- `src/services/plan_validator.ts` - Plan validation implementation

## Impact

- **Debugging Difficulty**: Developers cannot inspect failed plans to understand validation issues
- **Agent Development**: Makes it hard to debug and improve agent output quality
- **User Experience**: Failed requests provide no actionable information about what went wrong

## Proposed Solution

1. **Save Failed Plans**: Modify plan validation to save invalid plans with metadata about validation failures
1. **Enhanced Logging**: Add detailed logging of validation errors and raw plan content
1. **Review Commands**: Extend `exoctl plan` commands to show failed/invalid plans
1. **Error Details**: Provide specific validation error messages in request status

```toml
---
title: "Technical Writer Agent Plan Validation Failure - No Plan Saved for Review"
status: open
priority: high
created: 2026-02-11
github_issue:
labels: [bug, request-processor, validation, technical-writer]
assignee:
related_issues: [plan-validation-failure-senior-coder.md]
---
```

## Problem

When a request to the `technical-writer` agent produces a plan that fails JSON validation, the following issues occur:

1. **No saved plan candidate**: The invalid plan is not saved anywhere for manual review
1. **No possibility to review the plan manually**: Users cannot inspect what the agent actually produced
1. **Missing trace events**: No detailed logs/events in journal showing the plan content or validation failure details

## Reproduction Steps

```bash
# Submit request to technical-writer agent
exoctl request --portal portal-exoframe --agent technical-writer "Create comprehensive API documentation for ExoFrame's flow engine..."

# Check request status
exoctl request show <trace-id>
# Shows: status: failed

# Check journal for details
exoctl journal events --actor technical-writer --limit 10
# Shows: plan.validation.failed agent=agent trace=<id> target=request-<id>
# But no details about WHAT failed or the plan content

# Check for saved plans
exoctl plan list
# Shows no plans (0 results)
```

## Observed Behavior

From the logs provided:

```bash
2/11/2026, 10:14:25 AM plan.validation.failed agent=agent trace=037e74c4 target=request-037e74c4
2/11/2026, 10:14:25 AM agent.execution_completed agent=technical-writer trace=037e74c4 target=request-037e74c4
❌ request.processing.error: /home/dkasymov/ExoFrame/Workspace/Requests/request-037e74c4.md
   error: Plan content is not valid JSON
❌ request.failed: /home/dkasymov/ExoFrame/Workspace/Requests/request-037e74c4.md
   error: Plan content is not valid JSON
```

The request fails with "Plan content is not valid JSON" but:

- No plan file is saved in `Workspace/Plans/` or `Rejected/`
- No detailed validation error information
- No way to see what the agent actually output

## Expected Behavior

When plan validation fails:

1. **Save invalid plan for review**: The plan should be saved (perhaps in `Rejected/` or `Workspace/Plans/` with a `failed` status)
1. **Detailed error logging**: Log the specific validation errors and the raw plan content
1. **Manual review capability**: Allow users to inspect failed plans via `exoctl plan show <id>` or similar

## Investigation Needed

1. **Check Plan Saving Logic**: Verify where and when plans are saved during the validation process
2. **Review Validation Error Handling**: Ensure validation failures are logged with details
3. **Examine Plan Storage**: Confirm if failed plans should be stored for debugging
4. **Check Technical Writer Output**: Inspect what the agent is actually producing that fails JSON parsing

## Related Files

- `src/services/request_processor.ts` - Plan validation and saving logic
- `src/schemas/plan_schema.ts` - Plan validation schema
- `Blueprints/Agents/technical-writer.md` - Agent blueprint
- `src/services/plan_validator.ts` - Plan validation implementation

## Impact

- **Debugging Difficulty**: Developers cannot inspect failed plans to understand validation issues
- **Agent Development**: Makes it hard to debug and improve agent output quality
- **User Experience**: Failed requests provide no actionable information about what went wrong

## Proposed Solution

1. **Save Failed Plans**: Modify plan validation to save invalid plans with metadata about validation failures
2. **Enhanced Logging**: Add detailed logging of validation errors and raw plan content
3. **Review Commands**: Extend `exoctl plan` commands to show failed/invalid plans
4. **Error Details**: Provide specific validation error messages in request status
