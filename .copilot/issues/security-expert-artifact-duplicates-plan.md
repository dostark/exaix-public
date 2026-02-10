---
title: "Read-only security-expert artifacts duplicate plan content"
status: open
priority: medium
created: 2026-02-09
labels: [bug, execution, artifacts, agents]
---


## Problem

For read-only agents like `security-expert`, the execution artifact effectively mirrors the approved plan content. The review artifact contains the plan output but no additional analysis report, so execution appears to add no value beyond plan approval.

## Reproduction Steps

```bash
exoctl request --portal portal-exoframe --agent security-expert "Perform a security audit of ExoFrame's AI provider API key management system. Identify: - Key storage security in src/ai/provider_api_key.ts and configuration files - Encryption practices for sensitive provider credentials - Access control for API keys across different editions (Solo/Team/Enterprise) - Key rotation and expiration handling - Compliance with security best practices for credential management Provide specific remediation steps with code examples for securing the multi-provider API key infrastructure."
exoctl plan approve request-58e188da_plan
exoctl review list
exoctl review show artifact-3ada3b5d
```

## Observed Behavior

- The read-only artifact contains the plan output section and summary only.
- `Memory/Execution/<trace>/analysis.md` is not generated.
- Diff between `plan.md` and `artifact-*.md` shows only wrapper metadata/summary, not new analysis content.

## Expected Behavior

- Read-only execution should produce a distinct analysis report artifact derived from tool-driven execution or explicit analysis output.
- The review artifact should include new content beyond the original plan, or explicitly mark that the plan itself is the final deliverable.

## Problem Analysis

- The current execution pipeline persists `plan.md` and a summary for read-only agents.
- If the plan contains analysis content but no executable steps, `PlanExecutor` does not generate a report and the artifact ends up being a wrapped copy of the plan.
- This is more visible with security analysis requests where the plan already includes the full report.
- `parseStructuredPlanFromMarkdown()` returns `null` when `## Execution Steps` exists without any `## Step N:` headers, so read-only report generation is skipped entirely.
- With no structured steps and no TOML actions, `executePlanWork()` returns without producing `analysis.md`, leaving the artifact to embed only `plan.md`.

## Fix Plan

1. **Persist plan-as-report when no execution occurs**
   - If a read-only plan has no executable steps and no analysis report, extract the plan body (excluding frontmatter) and treat it as the report output.
   - Persist it to `Memory/Execution/<trace>/analysis.md` and include it in the artifact.

1. **Annotate artifacts explicitly**
   - Add a clear marker in the artifact (e.g., "Plan-as-Report") when the plan content is used as the final deliverable.
   - This avoids the impression that execution was skipped or produced no output.

1. **Regression coverage**
   - Add a test that creates a read-only plan with no steps and asserts:
     - `analysis.md` is written.
     - The review artifact includes the report content.

## Related Files

- `src/services/execution_loop.ts` - Read-only artifact creation and report persistence
- `src/services/plan_executor.ts` - Execution/report generation
- `src/services/structured_plan_parser.ts` - Step detection logic

## Workaround

Manually treat the plan content as the final report when reviewing read-only security audits.

## Priority Justification

Medium: This does not block execution but reduces the value of the review artifact for read-only agents.
