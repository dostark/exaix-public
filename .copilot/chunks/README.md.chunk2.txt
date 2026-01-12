```bash
deno run --allow-read scripts/verify_manifest_fresh.ts
```

## Building embeddings

Precompute and import embeddings with `scripts/build_agents_embeddings.ts`. For precomputed embeddings, drop JSON files that follow the example template into `.copilot/embeddings/` and then run:

```bash
deno run --allow-read --allow-write --unstable scripts/build_agents_embeddings.ts --mode precomputed --dir .copilot/embeddings
```

See `.copilot/embeddings/example_precomputed_template.json` for a minimal, valid template to create precomputed embedding files.

## How to Add a New Agent Doc

Follow this workflow to create a new agent documentation file:

### 1. Create File in Appropriate Subfolder

Choose the right location based on content: