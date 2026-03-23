---
agent: general
scope: dev
title: "Plan step execution logic not implemented"
short_summary: "Approved plans marked complete without executing steps, causing false positive execution results."
version: "0.1"
topics: ["execution", "plan", "logic", "daemon"]
status: resolved
priority: high
created: 2026-01-26
labels: [bug, execution, plan, logic]
---

## Problem

Approved plans are marked as "completed" but the actual step execution logic is not implemented. Plans show successful completion without actually executing any steps, leading to false positive execution results.

## Reproduction Steps

```bash
# Create and approve a plan
cd ~/Exaix && deno run --allow-all src/cli/exactl.ts request "Analyze test suite" --agent default --model google:gemini-2.0-flash-exp --priority normal
cd ~/Exaix && deno run --allow-all src/cli/exactl.ts plan approve <plan-id>

# Check plan status - shows completed
cd ~/Exaix && deno run --allow-all src/cli/exactl.ts plan list

# Check execution results - no actual work done
cd ~/Exaix && git branch -a  # May show unexpected commits
cd ~/Exaix && ls -la Memory/Execution/  # May be missing expected results
```

## Observed Behavior

- Plan approval succeeds
- Plan status changes to "completed" immediately
- No step-by-step execution occurs
- Execution memory records may be incomplete or missing
- Git branches created with unexpected file additions instead of analysis results

## Expected Behavior

- Plans should execute steps sequentially
- Each step should be tracked and logged
- Execution results should be properly stored in Memory/Execution/
- Git operations should reflect actual analysis work, not random commits

## Environment

- Exaix Version: Current development
- OS: Linux
- Deno Version: 1.x.x
- Plan Schema: JSON validation working

## Investigation Needed

1. **Execution Engine**: Find where plan execution should happen
   - Check daemon execution logic
   - Verify step execution implementation exists

1. **Plan Processing**: Examine plan approval vs execution flow
   - Is approval triggering execution?
   - Are steps being parsed and executed?

## Related Files

- `src/daemon/execution_engine.ts` - Likely execution logic location
- `src/services/plan_executor.ts` - Plan execution service
- `src/schemas/plan_schema.ts` - Plan JSON schema
- `Blueprints/Agents/default.md` - Agent blueprint that generates plans

## Workaround

None currently known - plans cannot be properly executed.

## Priority Justification

High priority - core execution functionality is missing. The system can create and approve plans but cannot execute them, making the entire planning system non-functional.

## Resolution

**Root Cause**: The ExecutionLoop was only designed to execute plans with TOML action blocks, but the current plan generation system creates structured plans with descriptive steps. When no TOML actions were found, ExecutionLoop would create a dummy file and mark the plan as completed without executing the actual steps.

**Fix Implemented**:

1. **Enhanced ExecutionLoop** to detect structured plans with "## Execution Steps" headers
1. **Integrated PlanExecutor** for structured plan execution using LLM-generated actions
1. **Updated ExecutionLoop constructor** to accept LLM provider for PlanExecutor
1. **Modified main.ts** to pass LLM provider to ExecutionLoop

**Changes Made**:

- `src/services/execution_loop.ts`: Added structured plan detection and PlanExecutor integration
- `src/main.ts`: Updated ExecutionLoop initialization with LLM provider
- All tests pass and code quality checks pass

## Addendum: Read-only agent execution artifacts

This issue did not cover the read-only execution artifact gap. After structured execution was added, read-only agents (e.g., `code-analyst`) still produced placeholder artifacts because report output was not persisted or embedded. That follow-up fix is documented in .copilot/issues/code-analyst-execution-artifact-empty.md and includes:

- Executing read-only structured plans while disabling git mutations.
- Generating an analysis report from tool outputs and writing it to `Memory/Execution/<trace>/analysis.md`.
- Embedding the analysis report into the review artifact for `exactl review show`.

## Examples

- Plan marked "completed" immediately after approval without running steps
- No execution results stored in Memory/Execution/
- Git branches created with unexpected file additions instead of analysis results

## Problem

Approved plans are marked as "completed" but the actual step execution logic is not implemented. Plans show successful completion without actually executing any steps, leading to false positive execution results.

## Reproduction Steps

```bash
# Create and approve a plan
cd ~/Exaix && deno run --allow-all src/cli/exactl.ts request "Analyze test suite" --agent default --model google:gemini-2.0-flash-exp --priority normal
cd ~/Exaix && deno run --allow-all src/cli/exactl.ts plan approve <plan-id>

# Check plan status - shows completed
cd ~/Exaix && deno run --allow-all src/cli/exactl.ts plan list

# Check execution results - no actual work done
cd ~/Exaix && git branch -a  # May show unexpected commits
cd ~/Exaix && ls -la Memory/Execution/  # May be missing expected results
```

## Observed Behavior

- Plan approval succeeds
- Plan status changes to "completed" immediately
- No step-by-step execution occurs
- Execution memory records may be incomplete or missing
- Git branches may contain unexpected file additions instead of analysis results

## Expected Behavior

- Plans should execute steps sequentially
- Each step should be tracked and logged
- Execution results should be properly stored in Memory/Execution/
- Git operations should reflect actual analysis work, not random commits

## Environment

- Exaix Version: Current development
- OS: Linux
- Deno Version: 1.x.x
- Plan Schema: JSON validation working

## Investigation Needed

1. **Execution Engine**: Find where plan execution should happen
   - Check daemon execution logic
   - Verify step execution implementation exists

1. **Plan Processing**: Examine plan approval vs execution flow
   - Is approval triggering execution?
   - Are steps being parsed and executed?

## Related Files

- `src/daemon/execution_engine.ts` - Likely execution logic location
- `src/services/plan_executor.ts` - Plan execution service
- `src/schemas/plan_schema.ts` - Plan JSON schema
- `Blueprints/Agents/default.md` - Agent blueprint that generates plans

## Workaround

None currently known - plans cannot be properly executed.

## Priority Justification

High priority - core execution functionality is missing. The system can create and approve plans but cannot execute them, making the entire planning system non-functional.

## Examples

- Plan marked "completed" immediately after approval without running steps
- No execution results stored in Memory/Execution/
- Git branches created with unexpected file additions instead of analysis results
