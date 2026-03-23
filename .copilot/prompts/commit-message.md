---
agent: general
scope: dev
title: "Detailed Commit Message Prompt"
short_summary: "Enforces structured, informative commit messages for agents and human developers."
version: "0.2"
topics: ["git", "commit", "documentation", "best-practices", "structured-logging"]
---

```text
Key points
- Review changes with `git status` and `git diff` before committing.
- Use conventional commit format for the subject line: `<type>(<scope>): <summary>`.
- ALL commits (non-auto) MUST follow the Exaix structured format in the body.
- Wrap all body text at 72 chars.

Mandatory Schema:
[type]: [subject]

what: <detailed explanation on what this commit is about>
rationale: <why this change was made>
tests: <which tests were used for validation and their summary status>
who: <agent name (e.g., Antigravity)>
impact: <component from ARCHITECTURE.md>: <details of impact>

Optional Fields:
conversation_id: <originating session ID>
links: <links to plan or issue>
prompt: <summary of the prompt(s) used>
tool_audit: <list of key tools used (e.g., run_command, replace_file_content)>
model: <YOUR actual model name and version>

⚠️ CRITICAL: Identity Accuracy
- DO NOT hallucinate your model name or agent name.
- Identify yourself as "Antigravity".
- Use the actual underlying model name (e.g., "Gemini") for the model field.

Canonical prompt (short):
"You've completed [work]. Create a MANDATORY structured commit message.
Review changes first, then follow the schema: subject line, then what:, rationale:, tests:, who:, and impact: (grounded in ARCHITECTURE.md).
Ensure you identify your actual model correctly (e.g., Gemini) to prevent hallucinations."

Examples:
- "feat(scripts): add commit validator (Step 1)

  what: Implemented validator script...
  rationale: To enforce rules...
  tests: 10/10 tests passed...
  who: Antigravity
  impact: scripts: added validation logic
  model: Gemini"

Do / Don't:
- ✅ Do use a blank line after the subject line.
- ✅ Do reference specific components from ARCHITECTURE.md in the impact field.
- ✅ Do list actual tool usage in tool_audit.
- ✅ Do include your real identity.
- ❌ Don't use a single paragraph for everything.
- ❌ Don't skip mandatory fields like rationale or tests.
- ❌ Don't use --no-verify.
- ❌ Don't hallucinate model versions.

Expected Response Pattern:
1. Show `git add` for changed files.
2. Show a single `git commit` command using heredoc or multiple `-m` flags to ensure the full structured body is included.
3. Verify all mandatory headers are present and correctly filled.
```
