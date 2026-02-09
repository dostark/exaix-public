---
title: "Test-engineer request plan missing frontmatter"
status: open
priority: high
created: 2026-02-09
labels: [bug, execution, plan, cli]
---

# Test-engineer request plan missing frontmatter

## Problem

The `test-engineer` validation request fails and produces a plan file without frontmatter. This breaks `exoctl plan list` with a "No frontmatter found" error and blocks plan review/execution.

## Reproduction Steps

```bash
exoctl request --portal portal-exoframe --agent test-engineer "Implement comprehensive tests for ExoFrame's review registry system. Create: - Unit tests for review tracking and validation in src/services/review_registry.ts - Integration tests for git review operations and workspace synchronization - End-to-end tests for complete review lifecycle (creation, approval, execution) - Mock data and test fixtures for different review scenarios - Test automation setup for CI/CD validation of review integrity Provide specific test implementations that ensure the reliability of the git-based change tracking system."
exoctl request list
exoctl plan list
```

## Observed Behavior

- Request is created, but `exoctl request list` shows `status: failed` for the new request.
- `exoctl plan list` logs a warning:
  - `Warning: Could not parse plan request-5033c240_failed: Error: No frontmatter found`
- The failed plan file appears without YAML frontmatter, so the CLI cannot parse it.

## Expected Behavior

- The request should produce a plan with valid frontmatter.
- `exoctl plan list` should parse all plan files without warnings.
- The request should move into review or approved state rather than failed.

## Environment

- ExoFrame Version: Current development
- OS: Linux
- Deno Version: 1.x.x
- Portal: portal-exoframe

## Investigation Needed

1. **Request processing**: Determine why the `test-engineer` request fails and emits a plan without frontmatter.
   - Check agent output parsing and PlanWriter input in `src/services/request_processor.ts`.
   - Verify agent blueprint response format for `test-engineer`.

1. **Plan writing**: Ensure `PlanWriter` always writes frontmatter even on validation errors.
   - Check `src/services/plan_writer.ts` error paths.

1. **Failure plan handling**: Confirm how `_failed` plan artifacts are generated.
   - Check CLI plan listing and any fallback serialization for failed plans.

## Related Files

- `src/services/request_processor.ts` - Request handling and agent invocation
- `src/services/plan_writer.ts` - Plan serialization and frontmatter
- `src/cli/plan_commands.ts` - Frontmatter parsing and list behavior
- `Blueprints/Agents/test-engineer.md` - Expected response format

## Workaround

None currently known. The failed plan file must be manually removed or repaired to allow `exoctl plan list` to run without warnings.

## Priority Justification

High: breaks the validation pipeline for the `test-engineer` agent and prevents plan review/execution.

## Problem Analysis

- When the agent output fails PlanSchema validation, `RequestProcessor.handleError()` writes the raw LLM content to `Workspace/Rejected/<requestId>_failed.md`.
- The saved `_failed.md` file contains no YAML frontmatter because it is raw model output, not a plan document.
- `exoctl plan list` scans `Workspace/Rejected` for any `.md` file and attempts to parse frontmatter for every file.
- This causes a warning (`No frontmatter found`) and a malformed plan entry, since `_failed.md` does not conform to plan format.

## Fix Plan

1. **Persist a valid rejected plan wrapper**
   - In `RequestProcessor.handleError()`, wrap the rejected content in YAML frontmatter and include:
     - `status: rejected` (or `error` if a dedicated status exists)
     - `trace_id`, `request_id`, `agent`, `portal`, `model`, and `created_at`
     - `error` or `reason` field with the validation message
   - Store the raw LLM output under a `## Rejected Output` section in the body.

1. **Align naming with CLI expectations**
   - Write rejected plans with the `_rejected.md` suffix (instead of `_failed.md`) so the CLI treats them as rejected plans.
   - Ensure `exoctl plan list` and `exoctl plan show` can parse and display them without warnings.

1. **Regression coverage**
   - Add a test that simulates `PlanValidationError` and asserts the rejected file contains frontmatter and is parseable by `PlanCommands.list()`.

1. **Optional hardening (schema flexibility)**
   - Relax plan validation to accept agent-specific fields without failing.
   - Keep strict checks for non-JSON outputs and missing `title`/`description` only.
   - This reduces false rejections for agents like `test-engineer` while preserving core validation.
