# Phase 52: Structured Commit Messages and Git Hooks

## Status: 🗓️ PLANNING

## Executive Summary

This phase introduces a mandatory structured format for git commit messages in the ExoFrame repository. By enforcing a consistent structure, we aim to improve "knowledge soliciting" for LLM agents, providing them with a rich, machine-readable (and human-readable) history of what was changed, why it was changed, how it was tested, and who (or which agent) performed the action.

Enforcement will be handled via a git `commit-msg` hook that validates the message against the defined schema before allowing the commit to proceed.

---

## Problem Statement

Currently, commit messages in ExoFrame are largely unstructured. While some commits include details, many are sparse or inconsistent. This lack of structure:
1.  **Reduces Agent Context**: LLM agents often rely on git logs to understand the evolution of the codebase. Unstructured messages make it harder to extract intent, rationale, and testing evidence.
2.  **Hinders Auditability**: It is difficult to quickly ascertain why a specific change was made or how it was validated without deep manual inspection.
3.  **Lacks Attribution**: While git tracks the "author", it doesn't easily distinguish between different LLM agents or specific prompts that triggered a change.
4.  **Gap in Traceability**: There is currently no link between a commit and the source conversation or session ID that spawned it.
5.  **Lack of Impact Analysis**: Commits don't explicitly state their high-level impact on the system architecture (e.g., "DB Schema change", "CLI breaking change").

---

## Phase Goals

### Primary Goals
- [ ] Define a canonical structure for commit messages.
- [ ] Implement `scripts/check_commit_msg.ts` to validate commit messages.
- [ ] Implement a git `commit-msg` hook to enforce this validation locally.
- [ ] Integrate the validation into the CI pipeline to ensure compliance across all PRs.
- [ ] Provide a commit message template for users and agents.

### Secondary Goals
- [ ] Add support for "optional" fields like `links` and `prompt` summary.
- [ ] Ensure the validation script provides extremely clear error messages and "correct" examples when a commit is blocked.

### Non-Goals
- [ ] Automatically rewriting commit messages (must be fixed by the author).
- [ ] Enforcing specific length limits (though basic sanity checks may be added).

---

## Commit Message Schema

The commit message must follow this general structure:

```text
[type]: [subject]

what: <detailed explanation on what this commit is about>

rationale: <why this commit was made>

tests: <which tests were used for validation and their summary status>

who: <agent name / human name>

impact: <component from ARCHITECTURE.md>: <details of impact>

[optional fields]
conversation_id: <ID of the conversation or session>
links: <links to a planning document or issue>
prompt: <summary of the prompt(s) used for this change>
tool_audit: <list of key tools used during implementation>
model: <LLM model name and version used by the agent>
```

### Required Fields
- **what**: A technical description of the changes.
- **rationale**: The motivation or "the why" behind the change.
- **tests**: A list of tests run (unit, integration, e2e) and their results.
- **who**: Identifying the actor (e.g., "Antigravity", "Human").
- **impact**: A concise list of affected components and the nature of the impact. **Components must match names defined in `ARCHITECTURE.md`** (e.g., `ReqProc: Added validation for X`, `DBSvc: Updated schema for Y`).

### Optional Fields
- **conversation_id**: The unique identifier for the conversation/session (e.g., from Antigravity, VS Code, or other IDE tools). Optional as ID schemes vary across tools.
- **links**: References to external docs, tickets, or internal planning files.
- **prompt**: If the change was LLM-driven, a summary of the input prompt.
- **tool_audit**: A list of tools used by the agent (e.g., `grep_search`, `multi_replace_file_content`) to provide a footprint of the agent's actions.
- **model**: The specific LLM model used (e.g., `Claude 3.5 Sonnet`, `GPT-4o`) to track performance and error patterns.

---

## Architecture

### New Files
| Path | Purpose |
| --- | --- |
| `scripts/check_commit_msg.ts` | The core validation logic. It reads a file (commit message) and checks it against the schema. |
| `tests/scripts/check_commit_msg_test.ts` | Unit tests for the validation script covering various valid/invalid messages. |
| `.githooks/commit-msg` | Git hook that invokes `deno task check-commit-msg $1`. |
| `templates/commit_msg.template` | A reference template to be used as a guide. |

### Modified Files
| Path | Change |
| --- | --- |
| `deno.json` | Add `check-commit-msg` task. |
| `.githooks/` | Ensure hooks are properly initialized/linked. |
| `.copilot/prompts/commit-message.md` | Update the canonical commit message prompt for agents. |
| `scripts/setup_hooks.ts` | Add `commit-msg` hook installation logic. |

---

## Implementation Plan

### Step 1 — Define Validation Script (`scripts/check_commit_msg.ts`)
Create a Deno script that:
1.  [x] Reads the commit message from a temporary file (passed as an argument by git).
2.  [x] Uses regex or a simple parser to identify the required sections (`what:`, `rationale:`, `tests:`, `who:`, `impact:`).
3.  [x] Validates that each section has non-empty content.
4.  [x] Model Validation: Specifically validates the `model` field to ensure it matches the actual model being used (extracting this from environment variables or internal config) to prevent hallucinations.
5.  [x] Exits with code `0` on success, or `1` with a helpful error message on failure.

**Success criteria**:
- [x] Script correctly identifies all required headers.
- [x] Script handles whitespace and variations in header casing (if desired).
- [x] Script provides a "How to fix" guide in the output.

**✅ IMPLEMENTED** — `scripts/check_commit_msg.ts`, 10/10 tests passing

---

### Step 2 — Unit Testing for Validator
Create comprehensive tests in `tests/scripts/check_commit_msg_test.ts`.

**Tests**:
- ✅ `Valid structured message passes.`
- ✅ `Missing any required field (what, rationale, tests, who, conversation_id, impact) fails.`
- ✅ `Empty content for a required field fails.`
- ✅ `Presence of optional fields (links, prompt, tool_audit, model) is allowed.`
- ✅ `Conventional Commits prefix (e.g., feat:, fix:) is enforced/validated at the top.`

**✅ IMPLEMENTED** — `tests/scripts/check_commit_msg_test.ts`, 10 tests passed

---

### Step 3 — Git Hook Integration
1.  [x] Create `.githooks/commit-msg`.
2.  [x] Update `deno.json` with `check-commit-msg` task.
3.  [x] Ensure the hook is executable (integrated into `scripts/setup_hooks.ts`).

**Success criteria**:
- [x] Running `git commit` with a bad message is blocked.
- [x] Running `git commit` with a good message succeeds.

**✅ IMPLEMENTED** — `scripts/setup_hooks.ts`, `tests/scripts/setup_hooks_test.ts`

---

---

### Step 4 — Documentation and Templates
1.  Create `templates/commit_msg.template`.
2.  (Optional) Update `.gitconfig` or project setup scripts to suggest using the structured format.

---

### Step 5 — Update Agent Prompt Template
Update `.copilot/prompts/commit-message.md` to ensure all agents (including Antigravity and VS Code Copilot) are instructed to use the new structured format by default.

**Success criteria**:
- `.copilot/prompts/commit-message.md` reflects the mandatory `what`, `rationale`, `tests`, `who`, and `impact` headers.
- The prompt includes examples of how to populate the `impact` field using `ARCHITECTURE.md` components.
- **Model Identity Enforcement**: The prompt explicitly warns agents NOT to hallucinate their model name and provides instructions on where to find their true identity (e.g., system metadata or environment).
- The prompt correctly identifies `conversation_id`, `tool_audit`, and `model` as optional but recommended for agents.

---

## Future Considerations
- Supporting JSON or YAML formatted commit messages for even deeper machine readability.
- Integrating with the search/indexing system to allow agents to find "all commits by Agent X that touched File Y for Rationale Z".

---

## Notes
- Enforcement should be strict enough to be useful, but not so brittle it blocks productivity.
- **Exemptions**: The validation script MUST automatically skip checks for:
    - Merge commits (`Merge branch...`, `Merge remote-tracking branch...`)
    - Revert commits (`Revert "..."`)
    - Fixup commits (`fixup! ...`)
    - Squash commits (`squash! ...`)
- Standard git `--no-verify` can be used to bypass the hook in emergency cases.
