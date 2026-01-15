- **`agent`**: Target agent type (`claude`, `copilot`, `openai`, `google`, `general`)
- **`scope`**: Context scope (`dev`, `ci`, `docs`, `test`)
- **`title`**: Human-readable title
- **`short_summary`**: Concise summary for quick injection (≤200 characters recommended)
- **`version`**: Semantic version (start with `"0.1"`)
- **`topics`**: Array of searchable keywords (helps with semantic retrieval)

### 3. Include Required Sections

Structure your document with these sections:

#### Key Points (Required)

Bullet list of 3-5 critical takeaways:

```markdown
Key points
- Use `initTestDbService()` for database tests
- Follow TDD workflow: tests first, implementation second
- Clean up resources in finally blocks
```

#### Canonical Prompt (Required)

Example system prompt showing ideal usage: