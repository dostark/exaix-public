# Issue: No Changeset Created After Plan Execution

## Description

User reports that after approving a plan, `exoctl changeset list` returns 0 changesets, even though the journal indicates `execution.completed` and `report.generated`.

## Symptoms

- `exoctl plan approve` succeeds.
- Journal logs show:
  - `execution.started`
  - `tool.create_directory`
  - `tool.write_file`
  - `execution.completed`
  - `report.generated` (by `mission_reporter`)
- `exoctl changeset list` returns empty.
- `Memory/Execution` seems empty (except `.gitkeep`).

## Potential Causes

1. **MissionReporter Failure**: Maybe it failed to write the report file or update the changeset registry?
2. **Changeset Not Created**: Maybe the changeset object was never persisted to disk?
3. **Path Issue**: Is it writing to the wrong directory?

## Investigation Plan

1. Check `src/services/agent_executor.ts` (or `PlanExecutor`) to see where changesets are created.
2. Check `src/services/mission_reporter.ts` to see how reports are generated and where changesets are stored.
3. Check `src/cli/changeset_commands.ts` to see where it looks for changesets.
