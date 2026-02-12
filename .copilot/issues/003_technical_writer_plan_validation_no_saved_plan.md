---
title: "Technical Writer Agent Plan Validation Failure - No Plan Saved for Review"
status: closed
priority: high
created: 2026-02-11
resolved: 2026-02-12
github_issue:
labels: [bug, request-processor, validation, technical-writer]
assignee: antigravity
related_issues: [plan-validation-failure-senior-coder.md]
---

## Problem

When a request (e.g., to the `technical-writer` or `code-analyst` agent) produces a plan that fails JSON validation, the raw LLM output was occasionally not saved in the `Rejected/` folder, showing "No raw content available" instead. This occurred primarily when the agent's output was so malformed that XML tag extraction (e.g., missing `<content>` tags) failed, resulting in empty content being passed to the validator.

## Resolution

The issue was resolved by ensuring the full raw LLM response is preserved even if structured parsing fails:

1. **Error Enrichment**: Updated `PlanWriter.formatPlan` to catch `PlanValidationError` and enrich its `details` with `fullRawResponse` containing the original `result.raw` from the agent.
2. **Fallback Logic**: Updated `RequestProcessor.handleError` to use `fullRawResponse` as a fallback when `rawContent` (extracted from `<content>` tags) is empty or missing.

### Files Modified:
- [plan_writer.ts](file:///home/dkasymov/git/ExoFrame/src/services/plan_writer.ts)
- [request_processor.ts](file:///home/dkasymov/git/ExoFrame/src/services/request_processor.ts)

## Verification

### Automated Tests
Successfull verification with a dedicated reproduction test and existing regression tests:
- `tests/plan_validation_repro_issue_003_test.ts` (manually run and then removed) verified that malformed XML output still results in a rejected plan file containing the full raw response.
- `tests/request_processor_plan_validation_error_test.ts` passed 4/4 tests.

```bash
ok | 4 passed | 0 failed (119ms)
```

## Related Files

- `src/services/request_processor.ts` - Plan validation and saving logic
- `src/schemas/plan_schema.ts` - Plan validation schema
- `Blueprints/Agents/technical-writer.md` - Agent blueprint
- `src/services/plan_validator.ts` - Plan validation implementation
