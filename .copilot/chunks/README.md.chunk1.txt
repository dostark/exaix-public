- **`docs/`**: Source of truth for **human** users (Architecture, User Guide).
- **`.copilot/`**: Source of truth for **agents** (Context, Prompts, Schemas).
  - Agents should read `.copilot/` for coding instructions.
  - Agents may read `docs/` for high-level context but must not modify it unless explicitly asked.

## Schema

Each `.md` file should include YAML frontmatter with at least the following keys:

- `agent` (string) — e.g., `copilot`, `openai`
- `scope` (string) — e.g., `dev`, `ci`, `docs`
- `title` (string)
- `short_summary` (string) — one paragraph, 1–3 lines — used for quick ingestion
- `version` (string)
- `topics` (array of strings) — optional tags

## Maintenance