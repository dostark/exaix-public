---
title: "Plan Validation Failed for Senior Coder Agent"
status: closed
priority: high
created: 2026-01-21
github_issue:
labels: [bug, request-processor, validation]
assignee:
related_issues: []
---

## Problem

After deploying a new workspace and submitting a request to the `senior-coder` agent via `exoctl`, the request processing fails with `plan.validation.failed`. This occurs despite the daemon starting successfully and the agent apparently completing its execution.

## Reproduction Steps

```bash
# 1. deploy workspace (simulated)
./scripts/deploy_workspace.sh ~/ExoFrame

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
```

## Observed Behavior

The daemon logs show:

```bash
1/21/2026, 6:26:02 PM request.failed agent=agent:request-processor trace=c9152997 target=/.../request-c9152997.md
1/21/2026, 6:26:02 PM plan.validation.failed agent=agent trace=c9152997 target=request-c9152997
1/21/2026, 6:26:02 PM agent.execution_completed agent=senior-coder trace=c9152997 target=request-c9152997
```

`exoctl plan list` shows 0 plans.

## Expected Behavior

The plan should be validated successfully and appear in `exoctl plan list` as `suggested` (or `approved` if auto-approve is on, though usually it waits).

## Investigation Needed

1. **Check Validation Logic**: Verify if `PlanValidator` (or Zod schema) was updated to support the new `actions` field (if that's what is being generated) or if the agent is generating output that violates the existing schema.

1.

## Related Files

- `src/services/request_processor.ts`
- `src/schemas/plan_schema.ts`
- `Blueprints/Agents/senior-coder.md`

## Root Cause

The `senior-coder` agent was correctly attempting to create directories but was using a tool name (`create_directory` or similar) that was not defined in the `McpToolName` enum or supported by the `ToolRegistry`. The `PlanSchema` (via Zod) strictly enforces that all tools must be valid enum members, causing the `plan.validation.failed` error.

## Resolution

The `create_directory` tool has been officially added to the system as a first-class supported tool.

Changes made:

1. **Added `CREATE_DIRECTORY` to `McpToolName` enum** in `src/enums.ts`.

1.
1.
   - `tests/plan_validation_repro_test.ts`: Verifies that plans containing `create_directory` now pass validation.
   - `tests/services/tool_registry_test.ts`: Verifies the runtime functionality of the `create_directory` tool.
