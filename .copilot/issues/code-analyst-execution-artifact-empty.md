---
title: "Code-analyst execution artifact contains only placeholder summary"
status: resolved
priority: high
created: 2026-02-09
labels: [bug, execution, artifacts, agents]
---

## Problem

After approving a correct plan for the `code-analyst` agent, execution completes but produces only a placeholder execution summary artifact. No analysis document is generated, and the review shows an empty diff with a generic summary.

## Reproduction Steps

1. Run the validation request for `code-analyst` from docs/dev/agent-validation-requests.md (line 70).
1. Approve the plan:
   - `exactl plan approve request-f60f935d_plan`
1. Verify the plan is completed:
   - `exactl plan show request-f60f935d_plan`
1. Inspect the review artifact:
   - `exactl review list`
   - `exactl review show artifact-74ff00ab`

## Expected Behavior

Execution produces a concrete analysis document (e.g., in `Memory/Execution/<trace>/` or artifact body) containing the CLI architecture analysis, and the review artifact includes that content.

## Observed Behavior

The review artifact only contains a generic "Execution Summary" placeholder. `files_changed` is 0, and no analysis document is present. The artifact shows:

```text
# Execution Artifact

**Request:** request-f60f935d
**Trace:** f60f935d-4ba1-4a76-95b0-a3a8136696b2
...
## Summary
Successfully executed plan for request: request-f60f935d

## Changes
```

## Notes / Suspected Cause

- `ExecutionLoop.generateMissionReport()` uses placeholder `reasoning` and `summary`, so `Memory/Execution/<trace>/summary.md` is generic.
- Read-only executions create artifacts from `summary.md` only, so any agent output (analysis JSON) is not persisted or referenced.

## Problem Analysis

- Read-only structured plans were previously skipped in the execution loop, which meant no tool actions ran and no analysis output was generated.
- The review artifact for read-only runs was assembled only from `summary.md`, which is produced from placeholder summary text.
- As a result, the artifact body never contained the agent’s analysis output, and `files_changed` remained 0.

## Implemented Fix

- Execute read-only structured plans instead of skipping them, but disable git mutations for read-only runs.
- Capture tool outputs during plan execution and generate a concise analysis report via the model provider.
- Persist the analysis report to `Memory/Execution/<trace>/analysis.md` and include it in the read-only review artifact body.

## Files Updated

- src/services/execution_loop.ts
  - Execute read-only structured plans and generate reports.
  - Persist analysis report and include it in artifact body.
- src/services/plan_executor.ts
  - Added report generation from tool outputs and optional git-disable mode.
- src/config/constants.ts
  - Added execution report constants and analysis section title.
- tests/execution_loop_test.ts
  - Added regression test to verify analysis report is written and surfaced in artifact.
- tests/plan_executor_test.ts
  - Updated to new PlanExecutor result shape.

## References

- docs/dev/agent-validation-requests.md (code-analyst request)
- src/services/execution_loop.ts (read-only artifact creation)
- src/services/mission_reporter.ts and src/services/memory_bank.ts (summary generation)
