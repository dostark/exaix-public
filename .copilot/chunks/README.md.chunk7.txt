Run validation to check schema compliance and safety:

```bash
deno run --allow-read scripts/validate_agents_docs.ts
```

This checks for:

- Required frontmatter fields
- Canonical prompt section
- Examples section
- Sensitive data patterns (fails if detected)
- YAML syntax

### 7. Test Retrieval

Verify your doc is discoverable:

```bash
deno run --allow-read scripts/inject_agent_context.ts --query "your test query" --agent claude
```

This should return JSON with your doc if the query matches.

### Template File

Copy an existing doc as a starting point:

- For provider-specific: `.copilot/providers/claude.md`
- For testing guidance: `.copilot/tests/testing.md`
- For source patterns: `.copilot/source/exoframe.md`

### Common Mistakes to Avoid