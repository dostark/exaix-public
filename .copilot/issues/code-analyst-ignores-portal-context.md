---
title: "Code-analyst ignores portal context and hallucinates stack"
status: closed
resolution: fixed
---

## Issue: Code Analyst Ignores Portal Context Hallucinates Logic

### Description
The `code-analyst` agent often generates plans that reference files or logic that do not exist in the specified portal. This is because the agent was not provided with the actual file structure during the planning phase.

### Fix
1.  **Context Injection**: Updated `RequestProcessor` to fetch a shallow file list of the target portal and inject it into the `Portal Context` block.
2.  **Prompt Refinement**: Updated `code-analyst.md` system prompt to explicitly instruct the agent to use the provided file list and avoid hallucinations.
3.  **Prompt System**: Updated `buildPortalContextBlock` to include optional file lists.

### Verification
- Verified with `tests/portal_context_grounding_test.ts`.

## Reproduction Steps

```bash
exoctl request --agent code-analyst --portal portal-exoframe "Review current implementation of 'exoctl plan revise' if it has correct and full functionality."
exoctl plan show request-2c470736_plan
exoctl plan revise request-2c470736_plan --comment "Create another plan. An implementation is related to ExoFrame framework. Its functional source code is contained in src/ folder of the current portal."
exoctl plan show request-2c470736_plan
```

## Observed Behavior

- Plan reasoning claims the source code is unavailable.
- The plan assumes a Go/Cobra CLI structure and invents `cmd/plan/revise.go`.
- Revision comments do not alter the plan output to inspect `src/`.

## Expected Behavior

- Plan should read from the configured portal repository (`portal-exoframe`).
- Plan should reference actual ExoFrame files in `src/cli/` and related modules.
- Revision comments should cause the agent to regenerate a plan grounded in the repo.

## Problem Analysis

- The plan output looks like a generic, hallucinated template rather than tool-driven analysis.
- The read-only agent may not be using `list_directory`/`read_file` tools despite having portal context.
- Revision comments currently append to the plan body but do not trigger re-planning.

## Fix Plan

1. **Enforce portal-aware context injection (all agents)**
   - Include portal root path and required repo hints in the prompt for both read-only and write agents.
   - Inject explicit instructions to use `list_directory`/`read_file` before analysis.

1. **Regenerate plan on revision**
   - When a plan is revised, trigger re-planning rather than appending comments only.
   - Ensure revised plan updates content using new instructions for any agent.

1. **Regression coverage**
   - Add a test that ensures agent plans reference actual `src/` files when a portal is provided.

## Related Files

- `src/services/request_processor.ts` - Request handling and prompt construction
- `src/services/agent_runner.ts` - Prompt assembly
- `src/cli/plan_commands.ts` - Plan revision handling
- `Blueprints/Agents/code-analyst.md` - Agent instructions

## Workaround

Manually perform analysis or request a revision and regenerate a new plan via a fresh request with explicit file paths.

## Priority Justification

High: breaks the core value of portal-aware analysis for code-analyst.
