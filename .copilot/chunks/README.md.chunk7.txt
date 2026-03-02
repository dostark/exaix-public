1. **Identify Learnings**: What was the root cause? specific architectural nuance? "Gotcha"?
1.
   - Ensure the relevant issue or documentation file is located within the `.copilot/` directory (e.g., move resolved issues to `.copilot/issues/resolved/`).
   - Run the embeddings generation script:
     ```bash
     deno run --allow-read --allow-write --allow-env scripts/build_agents_embeddings.ts --mode mock
     ```text
     *(Use `--mode openai` if configured with `OPENAI_API_KEY`)*
   - This script scans all `.md` files in `.copilot/` and regenerates the vector index in `.copilot/embeddings/`.
1.

## Linking to GitHub Issues

If the issue also exists on GitHub:

```markdown
---
github_issue: #123
---

See also: https://github.com/org/repo/issues/123
````text

## Searching Issues