# Issue 001: Daemon Fails to Handle Plan Execution Lifecycle (Zombie Plans)

**Status**: Resolved
**Severity**: High
**Created**: 2026-01-21
**Resolved**: 2026-01-21
**Component**: Daemon (`src/main.ts`)

## Description

The ExoFrame Daemon (`src/main.ts`) uses a generic `FileWatcher` to detect new plans in `Workspace/Active`. When a plan is detected, it acts as a "poor man's orchestrator":

1. Parses the plan locally.

1.

**The Defect**:
When `PlanExecutor.execute()` fails (throws), the Daemon simply logs `plan.execution_failed` and returns. It **does not**:

- Move the plan file out of `Workspace/Active`.
- Update the original Request status to `failed`.
- Generate a Failure Report in `Memory/Execution`.
- Rollback git state.

This leaves the system in a "Zombie State" where failed plans clutter the active workspace indefinitely, and the user receives no feedback other than a log line in the daemon logs (which are not surfaced).

## Reproduction Steps

1. Create a request that generates a valid plan but contains an incentivized failure (e.g., `read_file` on a non-existent path).

1.
1.
1.
1.

## Fix Plan

The `ExecutionLoop` service (`src/services/execution_loop.ts`) already implements robust lifecycle management (`handleSuccess`, `handleFailure`).

**Proposed Changes**:

1. **Refactor `src/main.ts`**:
   - Initialize `ExecutionLoop` service.
   - In the `planWatcher` callback, instead of manually parsing and executing, delegate to `ExecutionLoop.processTask(planPath)`.
   - _Note_: `ExecutionLoop` expects to own the lifecycle. We need to ensure `initGitBranch` behavior is correct for the `FileWatcher` context (since `RequestProcessor` might have already done some git work, or maybe not. `PlanExecutor` handles branch creation inside `execute`? No, `ExecutionLoop` handles it before calling `executeCore`).

1.
   - Ensure `ExecutionLoop` correctly handles the `trace_id` from the existing file.

1.
   - Update technical documentation to reflect that `main.ts` delegates to `ExecutionLoop` instead of manual execution.

## Planned Tests

**Test Case**: `tests/repro_zombie_plan_lifecycle.ts`

1. **Setup**:
   - Spin up a full environment (Mock Config, DB, Logger).
   - Place a "Fail Plan" in `Workspace/Active`.
1.
   - Invoke the patched `main.ts` logic (or a test harness running the same `ExecutionLoop` logic).
1.
   - Plan file is **gone** from `Workspace/Active`.
   - Plan file **exists** in `Workspace/Requests`.
   - Plan file content has `status: error`.
   - `Memory/Execution/<trace_id>/failure.md` exists.

## Resolution

- Refactored `src/main.ts` to delegate plan execution to `ExecutionLoop`, which handles lifecycle correctly.
- Fixed a bug in `ExecutionLoop` status update logic (was not handling quoted statuses or `approved` status).
- Verified with `tests/repro_zombie_plan_lifecycle.ts`.

