### 4. Regenerate Manifest

After creating or updating a doc:

```bash
deno run --allow-read --allow-write scripts/build_agents_index.ts
```

This updates `.copilot/manifest.json` and regenerates `.copilot/chunks/*.txt` files.

### 5. Build Embeddings (Optional but Recommended)

Generate embeddings for semantic search:

```bash
deno run --allow-read --allow-write scripts/build_agents_embeddings.ts --mode mock --dir .copilot/embeddings
```

Or use OpenAI embeddings (requires authentication, higher quality):

```bash
deno run --allow-read --allow-write --allow-net --allow-env scripts/build_agents_embeddings.ts --mode openai --dir .copilot/embeddings
```

**Mock mode** is recommended for most cases (deterministic, fast, no API costs).

### 6. Validate