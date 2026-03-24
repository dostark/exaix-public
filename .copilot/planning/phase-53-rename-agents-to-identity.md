---
agent: claude
scope: dev
title: "Phase 53: Rename 'Agents' to 'Identities' for Conceptual Clarity"
short_summary: "Rename the Blueprint/Agents layer to Blueprint/Identities to accurately reflect that these definitions are LLM persona/identity definitions loaded by the AgentRunner runtime, not autonomous agents in the cognitive AI sense."
version: "1.0"
topics: ["naming", "semantic-clarity", "blueprints", "identities", "refactoring", "cli", "docs"]
---

## Status: 🔵 PLANNED

## Executive Summary

Exaix blueprint files under `Blueprints/Agents/` define an LLM model, a composed system prompt
(persona body + injected Skills), and metadata such as capabilities and default skills. At
runtime this definition is loaded by `AgentRunner` — the true agentic loop that adds memory
injection, reflexive critique, confidence scoring, and tool execution. The blueprint itself is
not an agent in the cognitive-AI or BDI sense; it is an **identity**: a stable, named
personality and behavioural contract that the runtime adopts when handling a request.

Calling these files "Agents" creates a semantic mismatch with frameworks such as LangGraph,
Letta, and the OpenAI Agents SDK, where "agent" implies a stateful runtime loop with dynamic
perception, tool selection, and memory management. Renaming the *definition layer* to
**Identity** clarifies the architecture: an Identity is *loaded into* `AgentRunner` to produce
an agent execution context. The term also preserves the existing `agent_id` field without
change, because "identity" is exactly what an `agent_id` names.

The rename is **surface-only**: no TypeScript interfaces, no database schemas, no journal event
names, and no internal service names change. Only the filesystem path, the CLI flag, the
frontmatter key `agent_id` comment in docs, and all human-facing documentation update.

---

## Problem Statement

**Current Confusion:**

- `Blueprints/Agents/senior-coder.md` is described as an "agent blueprint", implying the file
  itself is an agent with autonomous behaviour.
- Developers familiar with CrewAI, LangGraph, AutoGen, or Letta expect an "agent" to have a
  persistent runtime loop, dynamic tool selection, and its own memory. Exaix blueprints have
  none of these — they are prompt templates with metadata.
- The CLI flag `--agent senior-coder` reinforces the misconception that the user is selecting
  an autonomous agent, rather than a persona/identity that the runtime will adopt.
- Documentation refers to "creating an agent" when the user is in fact authoring an identity
  definition for the `AgentRunner` to load.

**Why "Identity" and not "Role" or "Persona":**

- **Role** implies a purely functional slot in a pipeline (e.g., "the reviewer role"). It
  loses the connotation of a stable, named entity with a consistent behavioural character
  across requests.
- **Persona** is accurate but has UX-tool connotations (chatbot personas) that may feel too
  informal for a developer platform.
- **Identity** maps naturally to `agent_id`: the field literally names *what identity* the
  runtime should adopt. It also aligns with the concept that an Identity can be versioned,
  audited, and traced — all first-class Exaix concerns. An Identity is a stable, auditable
  contract; `AgentRunner` is the agent that enacts it.

---

## Phase Goals

### Primary Goals

- [ ] Move `Blueprints/Agents/` → `Blueprints/Identities/` (rename directory)
- [ ] Move `Blueprints/Agents/examples/` → `Blueprints/Identities/examples/`
- [ ] Move `Blueprints/Agents/templates/` → `Blueprints/Identities/templates/`
- [ ] Update CLI flag: `--agent <id>` → `--identity <id>` (with `--agent` kept as a
  deprecated alias for one release cycle)
- [ ] Update all request frontmatter docs: `agent: senior-coder` → `identity: senior-coder`
  (with backward-compatible parsing of the legacy `agent:` key)
- [ ] Update `BlueprintLoader` path resolution to look in `Blueprints/Identities/`
- [ ] Update `exactl blueprint` subcommands: `blueprint agent` → `blueprint identity`
- [ ] Update `ARCHITECTURE.md`, `README.md`, `TOOLS.md`, `CLAUDE.md`, `.cursorrules`,
  `.agents`, `.copilot/` docs, and all phase planning docs that reference "agent blueprint"
- [ ] Update `Blueprints/Agents/README.md` → `Blueprints/Identities/README.md` with revised
  conceptual framing
- [ ] Add migration note to `CONTRIBUTING.md` explaining the rename rationale
- [ ] Regression tests: all existing `--agent` tests continue to pass via the alias

### Secondary Goals

- [ ] Update TUI Agent Status view label from "Agents" to "Identities"
- [ ] Update `exactl dashboard` Agent Status pane header
- [ ] Update `.copilot/planning/` cross-reference index if present

### Non-Goals

- Renaming `agent_id` frontmatter field in blueprint files (it stays `agent_id` — "identity"
  is what it names, so no semantic conflict)
- Renaming `AgentRunner`, `agent_runner.ts`, or any TypeScript interface/class (these are
  correct: they *run* identities)
- Renaming `agent_capabilities.ts` or capability enums
- Renaming journal event names (e.g., `agent.execution.started`) — these are internal audit
  identifiers and must remain stable for log parsers and compliance tooling
- Renaming the `--agent` flag in the external MCP tool API (breaking change deferred)
- Changing any database schema columns

---

## Architecture

### Filesystem Changes

| Before | After |
| --- | --- |
| `Blueprints/Agents/` | `Blueprints/Identities/` |
| `Blueprints/Agents/examples/` | `Blueprints/Identities/examples/` |
| `Blueprints/Agents/templates/` | `Blueprints/Identities/templates/` |
| `Blueprints/Agents/README.md` | `Blueprints/Identities/README.md` |
| `Blueprints/Agents/default.md` | `Blueprints/Identities/default.md` |
| `Blueprints/Agents/senior-coder.md` | `Blueprints/Identities/senior-coder.md` |
| `Blueprints/Agents/*.md` | `Blueprints/Identities/*.md` |

### CLI Changes

| Before | After | Notes |
| --- | --- | --- |
| `exactl request "..." --agent senior-coder` | `exactl request "..." --identity senior-coder` | `--agent` kept as deprecated alias |
| `exactl blueprint agent list` | `exactl blueprint identity list` |  |
| `exactl blueprint agent create` | `exactl blueprint identity create` |  |
| `exactl blueprint agent validate` | `exactl blueprint identity validate` |  |

### Request Frontmatter Changes

| Before | After | Notes |
| --- | --- | --- |
| `agent: senior-coder` | `identity: senior-coder` | Legacy `agent:` key parsed with deprecation warning |

### Source Files to Modify

| File | Change |
| --- | --- |
| `src/services/blueprint_loader.ts` | Update default path from `Blueprints/Agents/` to `Blueprints/Identities/`; retain fallback to legacy path with deprecation log |
| `src/cli/blueprint_commands.ts` | Rename `agent` subcommand → `identity`; add alias |
| `src/cli/request_commands.ts` | Add `--identity` flag; keep `--agent` as deprecated alias |
| `src/services/request_processing/request_parser.ts` | Parse `identity:` frontmatter key; fall back to `agent:` with warning |
| `src/services/request_processing/types.ts` | Add `identity?` field to `IRequestFrontmatter`; keep `agent?` as deprecated |
| `src/tui/*.ts` | Update "Agent Status" view label strings |

### Documentation Files to Update

| File | Change |
| --- | --- |
| `README.md` | Replace "agent blueprint" with "identity blueprint"; update Quick Start example |
| `ARCHITECTURE.md` | Update Blueprint Management System section; update terminology table |
| `TOOLS.md` | Update `--agent` flag docs to `--identity` with alias note |
| `CLAUDE.md` | Update agent workflow instructions |
| `.cursorrules` | Update agent blueprint references |
| `.agents` | Update agent-related descriptions |
| `Blueprints/Identities/README.md` | Rewrite with "Identity" framing and conceptual rationale |
| `docs/Exaix_User_Guide.md` | Update agent/blueprint sections |
| `docs/dev/Exaix_Technical_Spec.md` | Update terminology |
| `docs/dev/Building_with_AI_Agents.md` | Update blueprint authoring section |
| `.copilot/agents-cross-reference.md` | Update all `Blueprints/Agents/` path references |

---

Here is the Implementation Plan section as a single copyable block:

```markdown
## Implementation Plan

### Step 1 — Move filesystem: `Blueprints/Agents/` → `Blueprints/Identities/`

Use `git mv` to preserve full file history on all blueprint files.

```bash
git mv Blueprints/Agents Blueprints/Identities
```

**Success criteria:**

- [ ] `Blueprints/Identities/` exists with all prior contents intact
- [ ] `git log --follow Blueprints/Identities/senior-coder.md` shows full history
- [ ] No internal cross-file references inside blueprint `.md` bodies break
- [ ] `Blueprints/Identities/examples/` and `Blueprints/Identities/templates/` subdirectories present

---

### Step 2 — Update `BlueprintLoader` path resolution

Modify `src/services/blueprint_loader.ts`:

1. Primary lookup: `{workspace}/Blueprints/Identities/{id}.md`

   `blueprint.legacy_path.used` journal event and log a deprecation warning to stderr
1.
   existing path constants; retain `BLUEPRINT_AGENTS_DIR` as deprecated

**Success criteria:**

- [x] `BlueprintLoader` resolves identities from the new `Identities/` path
- [x] Legacy `Agents/` fallback resolves and logs a deprecation warning to stderr
- [x] Unit test: loading `senior-coder` from `Identities/` succeeds
- [x] Unit test: loading from legacy `Agents/` path succeeds with deprecation warning
- [x] Unit test: loading a non-existent identity returns a clear `IdentityNotFoundError`

**✅ IMPLEMENTED** — `src/services/blueprint_loader.ts`, 4/4 new tests passing

---

### Step 3 — Update CLI: `--agent` → `--identity`; blueprint subcommands

**`src/cli/request_commands.ts`:**

```typescript
.option("--identity <id>", "Identity blueprint to use for this request")
.option("--agent <id>",    "Deprecated: use --identity", { hidden: true })

// In handler:
const identityId = opts.identity ?? opts.agent;
if (opts.agent && !opts.identity) {
  console.warn("[deprecation] --agent is deprecated. Use --identity instead.");
}
```

**`src/cli/blueprint_commands.ts`:**

- Register `identity` as the canonical subcommand for all blueprint identity operations
- Register `agent` as a hidden alias with a deprecation notice printed on invocation
- Subcommands affected: `list`, `create`, `validate`, `show`, `delete`

**Success criteria:**

- [x] `exactl request "..." --identity senior-coder` works end-to-end
- [x] `exactl request "..." --agent senior-coder` works with deprecation warning on stderr
- [x] `exactl blueprint identity list` lists all identities from `Blueprints/Identities/`
- [x] `exactl blueprint agent list` resolves via alias with deprecation notice
- [x] `exactl blueprint identity create` scaffolds a new identity file in `Blueprints/Identities/`
- [x] All existing integration tests that use `--agent` continue to pass without modification

**✅ IMPLEMENTED** — `src/cli/exactl.ts`, `src/cli/command_builders/request_actions.ts`, `src/cli/commands/blueprint_commands.ts`

---

### Step 4 — Update request frontmatter parsing

**`src/services/request_processing/types.ts`:**

```typescript
export interface IRequestFrontmatter {
  identity?: string;     // canonical key
  /** @deprecated Use identity */
  agent?: string;
  // ... existing fields unchanged
}
```

**`src/services/request_processing/request_parser.ts`:**

- Parse `identity:` as the canonical frontmatter field for identity selection
- If only `agent:` is present, use its value and emit a deprecation log line:
  `[deprecation] Request frontmatter 'agent:' is deprecated. Use 'identity:' instead.`
- Resolved value available as `parsedRequest.identity` throughout the pipeline

**Zod schema update in `src/schemas/request.ts`:**

```typescript
identity: z.string().optional(),
agent:    z.string().optional(), // deprecated
```

**Success criteria:**

- [ ] Requests with `identity: senior-coder` frontmatter route to the correct identity
- [ ] Requests with `agent: senior-coder` frontmatter still work with a deprecation log entry
- [ ] Zod schema updated and validated by existing schema tests
- [ ] `RequestParser` unit tests cover both `identity:` and `agent:` keys
- [ ] Activity Journal records the `identity` field on all new requests

---

### Step 5 — Update documentation and `.copilot/` knowledge base

Update all files listed in the Documentation section of the Architecture tables above.

**Framing to apply consistently across all docs:**

> An **Identity** defines the persona, model, capabilities, and default skills that
> `AgentRunner` adopts when processing a request. The `agent_id` field in the blueprint
> frontmatter names this identity. `AgentRunner` is the runtime agent; the Identity
> blueprint is its behavioural specification loaded at execution time.

**Key replacements to apply globally:**

| Find | Replace |
| --- | --- |
| `Blueprints/Agents/` | `Blueprints/Identities/` |
| `agent blueprint` | `identity blueprint` |
| `agent blueprints` | `identity blueprints` |
| `--agent <id>` | `--identity <id>` |
| `agent: senior-coder` (frontmatter examples) | `identity: senior-coder` |

**Do NOT replace:** `agent_id`, `AgentRunner`, `agent_runner`, `agent_capabilities`,
or any journal event names such as `agent.execution.started`.

**Success criteria:**

- [ ] `grep -r "Blueprints/Agents" . --include="*.md"` returns zero results outside git history
- [ ] `grep -r '"--agent"' docs/ --include="*.md"` returns zero results
- [ ] `Blueprints/Identities/README.md` updated with Identity framing and rationale
- [ ] `ARCHITECTURE.md` Blueprint Management System section reflects new terminology
- [ ] `README.md` Quick Start examples use `--identity`
- [ ] `TOOLS.md` CLI reference updated
- [ ] `CLAUDE.md` and `.cursorrules` updated
- [ ] `.copilot/` manifest rebuilt via `scripts/build_agents_index.ts`
- [ ] `deno task lint` passes with no new warnings after doc updates

---

### Step 6 — Update TUI labels

In all relevant `src/tui/*.ts` files, update user-visible string literals only:

| Before | After |
| --- | --- |
| `"Agent Status"` | `"Identity Status"` |
| `"Agents"` (view tab label) | `"Identities"` |
| `"No agents configured"` | `"No identities configured"` |
| `"agent blueprint"` (any help text) | `"identity blueprint"` |

Internal view class names (`AgentStatusView`, etc.) are **not renamed** — only displayed
string literals change.

**Success criteria:**

- [ ] TUI dashboard renders `"Identities"` in the Agent Status view header
- [ ] All TUI mock service tests pass without modification
- [ ] `deno task test` passes for all TUI test suites

---

### Step 7 — Regression and CI

```bash
deno task fmt
deno task lint
deno task test
deno run -A scripts/ci.ts all
deno run -A scripts/verify_manifest_fresh.ts
```

**Success criteria:**

- [ ] Zero test regressions across all test suites
- [ ] CI pipeline green end-to-end
- [ ] `scripts/verify_manifest_fresh.ts` passes after manifest rebuild
- [ ] No TypeScript compilation errors (`deno check src/`)
- [ ] All `[regression]`-prefixed tests pass

---

## Backward Compatibility

| Surface | Strategy | Planned Removal |
| --- | --- | --- |
| `Blueprints/Agents/` directory path | Legacy path fallback in `BlueprintLoader`; emits deprecation journal event | Phase 55 |
| `--agent <id>` CLI flag | Hidden alias; deprecation warning on stderr | Phase 55 |
| `agent:` request frontmatter key | Parsed with deprecation log line | Phase 55 |
| `agent_id` blueprint frontmatter field | **Unchanged** — no migration needed | Never |
| Journal event names (`agent.*`) | **Unchanged** — audit trail stability required | Never |
| `AgentRunner`, `agent_runner.ts` | **Unchanged** — runtime layer, correctly named | Never |
| `agent_capabilities.ts`, capability enums | **Unchanged** | Never |
| Database columns | **Unchanged** | Never |
| MCP tool API (`exaix_create_request` `agent` param) | **Unchanged** in this phase — deferred to Phase 55+ | Phase 55+ |

---

## Future Considerations

- **Phase 55:** Remove deprecated `--agent` flag, `Blueprints/Agents/` fallback path, and
  `agent:` frontmatter key after one full release cycle.
- **MCP API alignment:** Update the `exaix_create_request` MCP tool's `agent` parameter to
  `identity` in a coordinated breaking-change release with a versioned MCP schema bump.
- **Conceptual documentation:** Consider adding `docs/dev/Exaix_Identity_vs_Agent.md` — a
  short explainer formally defining the distinction between an Identity blueprint (the
  behavioural specification) and `AgentRunner` (the cognitive runtime that enacts it).

---

## Notes

- The rename is intentionally **surface-only**. No database migrations, no TypeScript
  interface changes, and no journal event renames are required. Implementation risk is minimal.
- `agent_id` is preserved deliberately: the field answers "what identity does this blueprint
  represent?" Renaming it would be a breaking change with no semantic gain.
- The `.copilot/` knowledge base index must be rebuilt after documentation updates to ensure
  LLM agents consulting it receive accurate path and terminology information.
- All commit messages for this phase must follow the Phase 52 structured commit message
  format with `impact:` entries referencing `BlueprintLoader`, `CLI Layer`, and `Docs`.
- The term **Identity** was chosen over "Role" and "Persona" because it maps naturally to
  `agent_id` (the field names an identity), carries connotations of auditability and
  versioning that suit Exaix's compliance focus, and avoids the chatbot-UX associations of
  "Persona" and the purely functional slot connotations of "Role".
- Internal runtime names (`AgentRunner`, `agent_runner.ts`, `agent_capabilities.ts`) are
  deliberately left unchanged. These names describe the *execution layer* — which is correctly
  called "agent" because it implements the agentic loop (memory injection, reflexive critique,
  tool execution, confidence scoring). The rename targets only the *definition layer*.
