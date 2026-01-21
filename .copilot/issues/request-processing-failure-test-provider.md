---
title: "Request Processing Fails with Test Provider and Plan Validation Error"
status: resolved
priority: high
created: 2026-01-21
updated: 2026-01-21
labels: [bug, request-processor, provider-selection, plan-validation]
---

# Request Processing Fails with Test Provider and Plan Validation Error

## Problem

When submitting a request via `exoctl request`, the daemon processes it but fails with plan validation errors. The system incorrectly selects the test provider instead of the configured Google provider.

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

# 6. Check results
exoctl plan list  # Shows: count: 0, message: No plans found
exoctl journal    # Shows validation failure
```

## Observed Behavior

Journal shows the following error sequence:

```
1/21/2026, 3:16:41 PM request.skipped
1/21/2026, 3:16:41 PM request.skipped
1/21/2026, 3:16:41 PM request.processing
1/21/2026, 3:16:40 PM request.failed
1/21/2026, 3:16:40 PM plan.validation.failed
1/21/2026, 3:16:40 PM agent.execution_completed
1/21/2026, 3:16:36 PM agent.execution_started
1/21/2026, 3:16:36 PM provider.selected agent=agent:request-processor trace=ffb0287f target=test-provider
```

**Key Issues:**
1. System selects `test-provider` instead of configured `google:gemini-2.0-flash-exp`
2. Plan validation fails
3. Request is marked as failed
4. No plan is generated in `Workspace/Plans/`

## Expected Behavior

1. System should use the configured Google provider (as shown in daemon startup logs: `llm.provider.initialized agent=system trace=b5de8b7f target=google-gemini-2.0-flash-exp`)
2. Plan should be generated successfully
3. Plan should pass validation
4. Plan should be written to `Workspace/Plans/`
5. `exoctl plan list` should show the generated plan

## Environment

- **ExoFrame Version**: Latest (deployed from scripts/deploy_workspace.sh)
- **Agent**: senior-coder (google:gemini-2.0-flash-exp)
- **Portal**: TestApp (/tmp/test-portal)
- **Config**: exo.config.toml with default settings + TestApp portal

## Resolution (resolved)

- **Root Cause**: In `src/main.ts`, the `RequestProcessor` was being instantiated with an `llmProvider` as the 4th argument. In the `RequestProcessor` constructor, the 4th argument is `testProvider`. When `testProvider` is present, `RequestProcessor` bypasses the dynamic `ProviderSelector` and forces the use of that specific provider.
- **Fix**: Removed the `llmProvider` argument from `RequestProcessor` instantiation in `src/main.ts`. This allows `RequestProcessor` to use the `ProviderSelector` to dynamically choose the best provider based on task complexity.
- **Commit**: fix(daemon): allow dynamic provider selection in RequestProcessor
- **Verified**:
  - Manually verified in a deployed workspace: `provider.selected` now correctly shows `google` (or the configured provider) and plans are generated successfully.
  - Added regression test: `tests/services/request_processor_regression_test.ts`

## Priority Justification

**HIGH** - This breaks the core request → plan → execution workflow. Users cannot process requests in deployed workspaces, making the system unusable for its primary purpose.

