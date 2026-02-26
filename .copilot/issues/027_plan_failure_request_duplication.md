cd---
title: "Plan failure handling moves file to Requests causing duplication"
status: fixed
priority: high
fixed_at: 2026-02-26
---

## Status: Fixed

### Verification Results

The following fixes have been verified with integration tests:

1.  **Failure Handling**: Verified that failed plans move to `Workspace/Rejected/` and the primary request status is updated to `failed`. (See `tests/integration/28_plan_failure_handling_regression_test.ts`)
2.  **UI Cleanup**: Verified that `exoctl request list` no longer shows duplicate plan files. (Filtered in `RequestListHandler`)
3.  **Grounding**: Verified that LLM prompts now include portal files up to 3 levels deep. (See `tests/portal_context_grounding_regression_test.ts`)

## Issue: Plan Failure Pollutes Request Inbox and Duplicates Trace States

### Description

When an AI plan execution fails, the `ExecutionLoop` incorrectly moves the plan file from `Workspace/Active/` back to `Workspace/Requests/`. This directory is strictly reserved for primary user requests. Moving a plan file (e.g., `request-974718fb_plan.md`) into the requests folder triggers several side effects:

1. **Request Duplication**: The `RequestProcessor` detects the "new" file in `Requests` and attempts to process it as a fresh request. This results in duplicate trace ID entries in `exoctl request list`.
2. **Invalid Request Processing**: Because the plan file doesn't follow the exact primary request schema, it often fails validation or processing, resulting in a `status: failed` entry that conflicts with the original request's `status: planned`.
3. **UI/UX Confusion**: Approved plans vanish from `exoctl plan list` (because they were moved to `Requests`) and reappear in `exoctl request list` as failed requests.
4. **Context Grounding Issues**: The `code-analyst` agent failed because it hallucinated a file (`src/cli/commands/init.ts`) that didn't exist in the portal. This suggests that the portal file summary injected by `RequestProcessor` is too shallow to be reliable for deep codebases.

### Observed Behavior (from Logs)

1. User creates request `974718fb`.
2. Plan `request-974718fb_plan.md` is generated in `Workspace/Plans`.
3. User approves plan; it moves to `Workspace/Active`.
4. Execution starts but fails quickly (5s) due to missing file in portal.
5. `ExecutionLoop.handleFailure` moves `request-974718fb_plan.md` to `Workspace/Requests`.
6. `exoctl request list` now shows:
   - `974718fb` (status: failed) - coming from the misplaced plan file.
   - `974718fb` (status: planned) - coming from the original request file.
7. `exoctl plan list` returns 0 results because the file was moved out of `Active` following the failure.

### Root Cause Analysis

1. **`src/services/execution_loop.ts`**:
   ```typescript
   private async handleFailure(planPath: string, ...) {
     const requestsDir = join(this.config.system.root, this.config.paths.workspace, "Requests");
     // ...
     await Deno.writeTextFile(requestPath, updatedContent); // Correctly sets status to ERROR but in WRONG dir
     await Deno.remove(planPath);
   }
   ```
   The failure handler should move the file to `Workspace/Rejected` or keep it in a terminal state within `Workspace/Active` or `Workspace/Archive`.

2. **Request Status Desync**: The `ExecutionLoop` does not update the primary request's status in the database to `failed` upon execution failure. It only logs the event, leaving the original request in a `planned` state.

3. **`src/services/request_processor.ts`**:
   The `getPortalFileSummary` method uses a very shallow depth limit (max 100 files, limited subdirectory traversal). For mature codebases, this misses most interior files, forcing agents to rely on prompt-suggested paths which may be hallucinations or outdated.

4. **`src/services/plan_executor.ts` / `execution_loop.ts`**:
   Execution logs show `plan.md` being used in the project root (`/home/dkasymov/git/ExoFrame/plan.md`). This indicates a path resolution fallback that bypasses the isolated worktree/workspace structure.

5. **Lost Portal Context in Reporting**: Even when a portal is correctly specified, execution summaries and `context.json` in `Memory/Execution/` often list the portal as `unknown`. This suggests a breakdown in metadata propagation within the `ExecutionLoop`.

### Proposed Fix Plan

1. **Immediate**: Modify `ExecutionLoop.handleFailure` to move failed plans to `Workspace/Rejected/` (with a suffix) instead of `Workspace/Requests/`.
2. **UI Cleanup**: Update `RequestListHandler` to explicitly exclude file patterns ending in `_plan.md`.
3. **Grounding Improvement**: Increase the robustness of `getPortalFileSummary` in `RequestProcessor`. Use a broader but still performance-conscious listing (e.g., `find -maxdepth 3` type logic).
4. **Path Sanitization**: Ensure `PlanExecutor` and `ExecutionLoop` strictly use workspace-relative or worktree-relative paths for the execution `plan.md`.

### Related Files

- `src/services/execution_loop.ts` (Failure handling logic)
- `src/services/request_processor.ts` (Portal grounding logic)
- `src/cli/handlers/request_list_handler.ts` (Request listing logic)
- `src/services/plan_executor.ts` (Execution path management)
