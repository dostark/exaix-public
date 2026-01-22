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
- ❌ Don't exceed 72 chars for summary line
- ❌ Don't forget to list breaking changes if any
- ❌ Don't use vague summaries like "updated files" or "WIP"

Expected Response Pattern:
1. Show `git add` command for changed files
2. Show complete `git commit -m "..."` with full message
3. Include summary, detailed body, and footer references
4. List specific changes and testing verification
```
