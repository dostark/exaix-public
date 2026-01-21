---
title: "Plan Executed but Changes Not Applied and No Changeset Created"
status: resolved
priority: critical
created: 2026-01-21
updated: 2026-01-21
labels: [bug, execution-loop, git, portal, changesets]
---

# Plan Executed but Changes Not Applied and No Changeset Created

## Problem

After approving an execution plan, the journal indicates that execution was started and completed successfully, including git operations (`git.init`, `git.branch_created`, `git.committed`). However, the actual files proposed in the plan are not created in the target portal, and `exoctl changeset list` reports that no changesets found.

## Reproduction Steps

```bash
# 1. Deploy fresh workspace
rm -rf ~/ExoFrame
./scripts/deploy_workspace.sh ~/ExoFrame
cd ~/ExoFrame

# 2. Configure and start daemon
cp exo.config.sample.toml exo.config.toml
exoctl daemon start

# 3. Create test portal
cat >> ~/ExoFrame/exo.config.toml << EOF
[[portals]]
alias = "TestApp"
target_path = "/tmp/test-portal"
EOF

mkdir -p /tmp/test-portal/src
cd /tmp/test-portal
git init
echo "# Test App" > README.md
echo "export const version = '1.0';" > src/index.ts
git add . && git commit -m "Initial commit"

# 4. Mount portal
cd ~/ExoFrame
exoctl portal add /tmp/test-portal TestApp

# 5. Submit request
exoctl request "Create folder src/, create file src/utils.ts, add hello world function to src/utils.ts" \
    --agent senior-coder \
    --portal TestApp

# 6. Approve plan
exoctl plan approve request-<ID>_plan

# 7. Check changesets
exoctl changeset list
```

## Observed Behavior

- **Journal**: Shows `execution.started`, `git.init`, `git.branch_created`, `git.committed`, and `execution.completed` successfully.
- **Changesets**: `exoctl changeset list` returns "No changesets found".
- **Filesystem**: The files specified in the plan (e.g., `src/utils.ts`) are **not** present in `/tmp/test-portal/src/`.
- **Plan File**: The plan file in `Workspace/Active/` disappears (likely moved or deleted) but doesn't result in a visible changeset.

## Expected Behavior

1. The execution loop should apply the changes to the portal's target path.
2. A new git branch should be created in the portal's repository with the changes.
3. A changeset record should be created and visible via `exoctl changeset list`.
4. The plan should be moved to an archive or updated with the changeset reference.

## Environment

- **ExoFrame Version**: Latest
- **OS**: Linux
- **Deno Version**: 1.4x+
- **Agent**: senior-coder
- **Portal**: TestApp (/tmp/test-portal)

## Investigation Needed

1. **Storage Path**: Where is the execution loop actually applying the changes? Is it working in a temporary directory and failing to move them to the portal or create the changeset record?
2. **Git Integration**: Why does the journal show `git.committed` but no changes are visible in the repo? Is it initializing a new repo in a wrong location?
3. **Changeset Record Creation**: Why is the changeset not being recorded in the database despite the "successful" execution?
4. **Execution Loop Logic**: Check `src/services/execution_loop.ts` to see how it handles portals and changeset creation.
5. **Database Interaction**: Verify if the `changesets` table is being populated.

## Related Files

- `src/services/execution_loop.ts` - Main execution orchestration
- `src/services/changeset_manager.ts` - Changeset lifecycle management
- `src/services/workflow_executor.ts` - Low-level step execution
- `src/cli/commands/changesets.ts` - Changeset listing logic

## Workaround

None known. Execution appears to be broken for portal-based tasks.

## Priority Justification

**CRITICAL** - This is a fundamental failure of the core "Plan → Execute → Changeset" loop. The system claims to have performed work and committed it, but no work is actually done and no record of the change is available to the user. This undermines the entire auditable orchestration premise of the platform.

## Findings

The investigation revealed several critical gaps in the execution pipeline:

1. **Storage Path**: Changes were indeed being applied to the ExoFrame system root (`config.system.root`) instead of the target portal. This happened because the portal context was lost during the transition from Request to Plan.
2. **Git Integration**: The journal showed `git.committed` because the `ExecutionLoop` defaulted to the root repository. When the loop found no executable actions (due to the missing machine-readable TOML blocks), it fell back to creating a `test-execution.txt` file in the root and committing it.
3. **Changeset Record Creation**: The `ExecutionLoop` was identified as being entirely decoupled from the `ChangesetRegistry`. It performed Git commits but never initiated the registration of a new changeset in the database.
4. **Execution Loop Logic**: `src/services/execution_loop.ts` was hardcoded to use the system root for both `GitService` and `ToolRegistry` initialization, making it incapable of targeting portals even if the information was available.
5. **Database Interaction**: Confirmed that the `changesets` table was not being touched during the execution phase, while the `activity` table received "successful" logs for the root-level fallback execution.

## Resolution

The bug was caused by three primary factors:
1. **Lost Portal Context**: The portal ID was being extracted from the request but wasn't being stored in the plan's YAML frontmatter. As a result, the `ExecutionLoop` defaulted to the ExoFrame system root for all operations.
2. **Missing Machine-Readable Actions**: The `PlanAdapter` was converting structured JSON plans into human-readable markdown but was omitting the machine-readable ` ```toml ` blocks required by the `ExecutionLoop`. This caused the loop to find zero actions to perform.
3. **Missing Changeset Registration**: The `ExecutionLoop` was committing changes to Git (if any) but didn't actually call the `ChangesetRegistry` to record the execution as a new changeset.

### Core Fixes:
- **Schema**: Updated `PlanSchema` to include an explicit `actions` array in each step.
- **Adapter**: Updated `PlanAdapter` to generate ` ```toml ` blocks for all step actions.
- **Context**: Modified `PlanWriter` and `RequestProcessor` to preserve `portal` ID in frontmatter.
- **Execution Loop**:
  - Resolve portal path from ID and use as `baseDir` for all tool and git operations.
  - Integrate `ChangesetRegistry` to record successful executions.
  - Return the commit SHA from `GitService.commit` to link the changeset properly.

### Verification:
- Added regression test: `tests/execution_loop_portal_regression_test.ts`
- Verified all execution loop tests pass: `tests/execution_loop_test.ts` (39/39 passing).
- Manual verification confirms files are created in the portal and changesets are visible in `exoctl changeset list`.

**Merged in commit**: `fix: implement portal-aware execution and changeset registration`
