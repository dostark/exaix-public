- Use `scripts/validate_agents_docs.ts` to validate frontmatter and safety rules.
- Update the manifest with `scripts/build_agents_index.ts` if new docs are added.

## Regenerating manifest & chunks

If you add or update files under `.copilot/`, regenerate the manifest and pre-chunk artifacts with:

```bash
deno run --allow-read --allow-write scripts/build_agents_index.ts
```

To verify the manifest is fresh (useful for CI):

```bash
deno run --allow-read scripts/verify_manifest_fresh.ts
```

## Building embeddings

Precompute and import embeddings with `scripts/build_agents_embeddings.ts`. For precomputed embeddings, drop JSON files that follow the example template into `.copilot/embeddings/` and then run: