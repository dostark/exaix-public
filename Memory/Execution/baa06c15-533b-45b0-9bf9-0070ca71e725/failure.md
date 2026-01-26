# Failure Report

**Trace ID:** baa06c15-533b-45b0-9bf9-0070ca71e725
**Request ID:** request-baa06c15
**Agent:** daemon
**Error:** Git command failed (1): 🔍 Running Pre-commit Gates...
[0m[32mTask[0m [0m[36mfmt:check[0m deno fmt --check src/ tests/ docs/
Checked 408 files
[0m[32mTask[0m [0m[36mlint[0m deno lint src/ tests/
Checked 383 files
[0m[32mTask[0m [0m[36mcheck:docs[0m deno run --allow-all scripts/verify_manifest_fresh.ts
.copilot/manifest.json is out of date with current .copilot/ sources. Run scripts/build_agents_index.ts and commit the updated manifest.
❌ Error: Documentation manifest is out of date. Run 'deno run -A scripts/verify_manifest_fresh.ts' to update.

**Summary:** Execution failed for request: request-baa06c15
**Reasoning:** Plan execution failed: Git command failed (1): 🔍 Running Pre-commit Gates...
[0m[32mTask[0m [0m[36mfmt:check[0m deno fmt --check src/ tests/ docs/
Checked 408 files
[0m[32mTask[0m [0m[36mlint[0m deno lint src/ tests/
Checked 383 files
[0m[32mTask[0m [0m[36mcheck:docs[0m deno run --allow-all scripts/verify_manifest_fresh.ts
.copilot/manifest.json is out of date with current .copilot/ sources. Run scripts/build_agents_index.ts and commit the updated manifest.
❌ Error: Documentation manifest is out of date. Run 'deno run -A scripts/verify_manifest_fresh.ts' to update.

Generated at 2026-01-26T09:59:36.770Z