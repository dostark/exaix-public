- **`source/`** — Source code development guidance (patterns, architecture, conventions)
- **`tests/`** — Testing patterns and helpers (TDD, test utilities, security tests)
- **`docs/`** — Documentation maintenance (Implementation Plan, versioning, cross-references)
- **`providers/`** — Provider-specific adaptations (Claude, OpenAI, Google, Copilot)
- **`copilot/`** — Copilot-specific quick references

### 2. Add YAML Frontmatter with Required Fields

Every agent doc MUST start with YAML frontmatter:

```yaml
---
agent: claude  # or: copilot, openai, google, general
scope: dev     # or: ci, docs, test
title: "Your Title Here"
short_summary: "One-liner description (1-3 sentences max, <200 chars)"
version: "0.1"
topics: ["keyword1", "keyword2", "keyword3"]
---
```

**Field descriptions:**