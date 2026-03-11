---
agent: general
scope: dev
title: "Detailed Commit Message Prompt"
short_summary: "Example prompt for creating structured, informative commit messages."
version: "0.1"
topics: ["git", "commit", "documentation", "best-practices"]
---

```text
Key points
- Review changes with `git status` and `git diff` before committing
- Use conventional commit format: `<type>(<scope>): <summary>`
- Reference Implementation Plan steps and issues
- Wrap body at 72 chars, keep summary ≤72 chars
- Prefer structured body sections for readability: Context, Changes, Validation, References

Canonical prompt (short):
"You've completed [work]. Create a detailed commit message following ExoFrame conventions. Review changes first, then format as `<type>(<scope>): <summary>` with detailed body and references."

Examples
- Example prompt: "I've completed Step 10.5 - Claude agent interaction enhancements. Create a detailed commit message."
- Example prompt: "Fixed bug in PathResolver validation. Create commit message referencing issue #123."
- Example prompt: "Refactored EventLogger to use CircuitBreaker. Create commit message with breaking change note."

Do / Don't
- ✅ Do review actual changes before writing message
- ✅ Do reference Implementation Plan steps: "Implements Step X.Y"
- ✅ Do use imperative mood in summary ("Add" not "Added")
- ✅ Do explain WHY in body, not just WHAT
- ✅ Do keep summary ≤72 chars, body wrapped at 72
- ✅ Do include testing verification and file changes
- ✅ Do format body with short section headers for non-trivial commits
- ✅ Do create commits with a real multiline message (editor or heredoc)
- ❌ Don't exceed 72 chars for summary line
- ❌ Don't forget to list breaking changes if any
- ❌ Don't use vague summaries like "updated files" or "WIP"
- ❌ Don't chain multiple `-m` flags to assemble commit bodies
- ❌ Don't use --no-verify; all pre-commit hooks MUST pass before any commit

Recommended detailed format:
`<type>(<scope>): <summary>`

`Context:`
- One short paragraph describing why this change is needed.

`Changes:`
- Bullet list of the most important code/doc/test updates.

`Validation:`
- Commands or checks run (for example: `deno check`, `deno lint`).

`References:`
- Optional issue links, plan step, or breaking-change note.

Recommended command pattern (single multiline message):
`git commit -F - <<'COMMIT_MSG'`
`<type>(<scope>): <summary>`

`Context:`
`<why this change is needed>`

`Changes:`
`- <important change 1>`
`- <important change 2>`

`Validation:`
`- <checks run>`

`References:`
`- <issue/plan step/breaking change note>`
`COMMIT_MSG`

Expected Response Pattern:
1. Show `git add` command for changed files
2. Show a single multiline commit command (heredoc or editor flow), not chained `-m` flags
3. Include summary plus structured body sections (Context/Changes/Validation/References)
4. List specific changes and testing verification
```
