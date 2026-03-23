# Exaix — Auditable Agent Orchestration Platform

[![Deno](https://img.shields.io/badge/runtime-Deno-green.svg)](https://deno.land/) [![SQLite](https://img.shields.io/badge/storage-SQLite-blue.svg)](https://www.sqlite.org/) [![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)

Exaix is a secure, auditable platform for running autonomous agent workflows with human supervision. It focuses on reproducibility, security, and a permanent audit trail so teams can run complex, long-running agent tasks with confidence.

Core ideas

- Activity Journal: every plan, tool call, and file modification is recorded to a persistent SQLite-backed journal for full traceability.
- Human-in-the-loop: agents propose structured Plans which must be reviewed and approved before changes are applied.
- Files-as-API: workspaces are represented on disk (Requests, Plans, Changesets) so standard tools and CI can interact with agent outputs.

Where to find more detail

- User Guide: [./docs/Exaix_User_Guide.md](./docs/Exaix_User_Guide.md)
- Technical Spec: [./docs/dev/Exaix_Technical_Spec.md](./docs/dev/Exaix_Technical_Spec.md)
- White Paper: [./docs/dev/Exaix_White_Paper.md](./docs/dev/Exaix_White_Paper.md)
- Development & TDD: [./docs/dev/Building_with_AI_Agents.md](./docs/dev/Building_with_AI_Agents.md)

Quick start

```bash
# Clone
git clone https://github.com/dostark/exaix.git
cd exaix

# Deploy a runtime workspace (copies Memory/, Blueprints/, top-level docs; does not copy templates/)
./scripts/deploy_workspace.sh ~/MyExaixWorkspace

# Start the daemon inside the deployed workspace
cd ~/MyExaixWorkspace
deno task start
```

Core components & runtime layout

- `Workspace/` — Requests, Plans, and Changesets (primary user-facing area).
- `Portals/` — Symlinks to project repositories (multi-repo context).
- `Memory/` — Persistent memory banks (copied to deployed workspaces; used for search and recall).
- `Blueprints/` — Agent blueprints and templates (copied on deploy).
- `.exa/` — Runtime state (database, logs, pid files). This replaces the legacy `System/` folder.

Operator features

- TUI Dashboard (`exactl dashboard`) — review Plans, monitor agents, and approve changes.
- Least-privilege execution — Deno's permission model reduces blast radius for agent actions.
- Local-first operation — optional integrations to cloud LLMs, but data remains local by default.

## AI/LLM Configuration

Exaix supports multiple LLM providers with intelligent selection based on cost, performance, and task requirements.

### Quick Setup

Create `exa.config.toml` in your workspace:

```toml
[ai]
provider = "ollama"  # or "anthropic", "openai", "google"
model = "llama3.2"

[provider_strategy]
prefer_free = true
allow_local = true
max_daily_cost_usd = 5.00
```

### Multi-Provider Setup

Configure multiple providers with automatic fallback:

```toml
[models.default]
provider = "anthropic"
model = "claude-opus-4.5"

[models.fast]
provider = "openai"
model = "gpt-4o-mini"

[models.local]
provider = "ollama"
model = "llama3.2"

[provider_strategy]
prefer_free = true
allow_local = true
max_daily_cost_usd = 10.00

[provider_strategy.task_routing]
simple = ["ollama", "google-gemini-flash"]
complex = ["anthropic-claude-opus", "openai-gpt-5-pro"]
```

### Environment Variables

**API Keys** (required for cloud providers):

```bash
export ANTHROPIC_API_KEY="your-anthropic-key"
export OPENAI_API_KEY="your-openai-key"
export GOOGLE_API_KEY="your-google-key"
```

**Runtime Overrides** (optional): Exaix supports 4 environment variables for temporary configuration overrides:

```bash
# Override provider/model for a single command
EXA_LLM_PROVIDER=ollama EXA_LLM_MODEL=llama3.2 exactl request "..."

# Available overrides: EXA_LLM_PROVIDER, EXA_LLM_MODEL, EXA_LLM_BASE_URL, EXA_LLM_TIMEOUT_MS
```

> **Note:** All `EXA_LLM_*` variables are validated via Zod schema. Use `exa.config.toml` for persistent configuration.

See the [Provider Strategy Guide](./docs/Provider_Strategy_Guide.md) for advanced configuration options.

Testing & contributing

- Follow test helpers in `tests/` (use `createCliTestContext()` and `initTestDbService()` for deterministic tests).
- **Regression tests are mandatory for every bug fix** (prefix test names with `[regression]`).
- Run local CI: `deno run -A scripts/ci.ts all` (fmt, lint, tests, coverage, build).

License

- Proprietary © Exaix Development Team

# **End Exaix overview**

