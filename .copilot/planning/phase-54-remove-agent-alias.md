---
agent: claude
scope: dev
title: "Phase 54: Remove Deprecated 'agent' Aliases Introduced in Phase 53"
short_summary: "Hard-remove all Phase 53 backward-compatibility shims: the --agent CLI flag alias, the Blueprints/Agents/ fallback path, the deprecated agent: frontmatter key, the agent? field in IRequestFrontmatter and Zod schemas, the BLUEPRINT_AGENTS_DIR constant, and the agent field from flow schemas (FlowStepSchema, GateEvaluateSchema)."
version: "1.0"
topics: ["naming", "cleanup", "deprecation-removal", "cli", "blueprints", "identities", "flows", "breaking-change"]
---

## Status: � IN PROGRESS (Steps 1-4 complete)

## Prerequisites

**Phase 53 must be fully implemented and released** before this phase begins.
This phase removes the backward-compatibility shims that Phase 53 introduced.
Do not implement Phase 54 in the same release as Phase 53.

---

## Executive Summary

Phase 53 introduced the `Identity` rename for the agent blueprint layer while deliberately
preserving full backward compatibility: the `--agent` CLI flag, `Blueprints/Agents/` path
fallback, `agent:` request frontmatter key, and the deprecated `agent?` field in
`IRequestFrontmatter` and Zod schemas were all kept as aliases with deprecation warnings.
Phase 53 also introduced `identity` as the replacement for `agent` in `FlowStepSchema` and
`GateEvaluateSchema`, keeping `agent` as a deprecated optional field to allow a migration window.

This phase removes every one of those shims. After Phase 54:

- `--agent` is an unknown CLI flag and will produce a parse error
- `Blueprints/Agents/` is no longer scanned by `BlueprintLoader`
- `agent:` in request frontmatter is an unrecognised key and triggers a Zod validation error
- `IRequestFrontmatter.agent` field is gone from the TypeScript interface
- `BLUEPRINT_AGENTS_DIR` constant is removed
- `blueprint.legacy_path.used` journal event is no longer emitted
- `agent` field is removed from `FlowStepSchema` and `GateEvaluateSchema`
- `agent` parameter is removed from `define_flow.ts` step config type
- Runtime fallback logic (`identity ?? agent`) is removed from flow execution
- Flow YAML files must use `identity:` instead of `agent:` in step definitions

The goal is a clean, unambiguous codebase where every surface that was renamed in Phase 53
is enforced without fallback.

---

## Problem Statement

Deprecation aliases have a cost:

- **Dead code paths** increase cognitive overhead for contributors and LLM agents reading
  the codebase
- **Dual-path logic** in `BlueprintLoader` and `RequestParser` makes tests harder to reason
  about and coverage metrics misleading
- **Deprecated fields** in Zod schemas and TypeScript interfaces generate noise in type
  checks and IDE tooling
- **Deprecation warnings** in stderr accumulate in CI logs, reducing signal-to-noise ratio
- Keeping aliases indefinitely defeats the purpose of Phase 53's rename

Phase 54 enforces the Phase 53 rename as the only supported interface.

---

## Phase Goals

### Primary Goals

- [x] Remove `--agent` flag from `src/cli/request_commands.ts`
- [x] Remove `agent` alias subcommand from `src/cli/blueprint_commands.ts`
- [x] Remove `Blueprints/Agents/` legacy fallback path from `src/services/blueprint_loader.ts`
- [ ] Remove `BLUEPRINT_AGENTS_DIR` constant
- [x] Remove `agent?` field from `IRequestFrontmatter` interface in
  `src/services/request_processing/types.ts`
- [ ] Remove `agent` key from Zod schema in `src/schemas/request.ts`
- [ ] Remove `agent:` frontmatter parsing fallback from `src/services/request_processing/request_parser.ts`
- [ ] Remove `blueprint.legacy_path.used` journal event emission from `BlueprintLoader`
- [ ] Remove `agent` field from `FlowStepSchema` in `src/shared/schemas/flow.ts`
- [ ] Remove `agent` field from `GateEvaluateSchema` in `src/shared/schemas/flow.ts`
- [ ] Remove `agent` parameter from `define_flow.ts` step config type
- [ ] Remove runtime fallback logic `identity ?? agent` in `flow_runner.ts` / `flow_loader.ts`
- [ ] Migrate all `Blueprints/Flows/*.yaml` step definitions from `agent:` to `identity:`
- [ ] Update all tests that still use `--agent`, `agent:`, or `Blueprints/Agents/` to use
  the canonical `--identity`, `identity:`, and `Blueprints/Identities/` equivalents
- [ ] Confirm no remaining references to deprecated surfaces in source or tests

### Secondary Goals

- [ ] Update `CONTRIBUTING.md` migration note from Phase 53 to state removal is complete
- [ ] Update `CHANGELOG` / release notes to mark `--agent` as removed (breaking change)
- [x] Update MCP tool API: rename `agent` parameter of `exaix_create_request` to `identity`
  with a versioned MCP schema bump (see MCP section below)

**✅ IMPLEMENTED** — `src/mcp/domain_tools.ts`, `src/shared/schemas/mcp.ts`

### Non-Goals

- Renaming `agent_id` frontmatter field inside blueprint files — this stays unchanged forever
- Renaming `AgentRunner`, `agent_runner.ts`, or any runtime-layer identifiers
- Renaming journal event names (`agent.execution.started`, etc.)
- Renaming database columns
- Renaming `FlowStepType.AGENT` enum value (internal enum, not user-facing)

---

## Architecture

### Surfaces Being Removed

| Surface | Location | Introduced in | Removal Action |
| --- | --- | --- | --- |
| `--agent <id>` CLI flag | `src/cli/request_commands.ts` | Phase 53 | Delete option declaration and handler branch |
| `blueprint agent` subcommand alias | `src/cli/blueprint_commands.ts` | Phase 53 | Delete alias registration |
| `Blueprints/Agents/` fallback lookup | `src/services/blueprint_loader.ts` | Phase 53 | Delete fallback branch |
| `BLUEPRINT_AGENTS_DIR` constant | `src/services/blueprint_loader.ts` | Phase 53 | Delete constant |
| `blueprint.legacy_path.used` event | `src/services/blueprint_loader.ts` | Phase 53 | Delete event emission |
| `agent?` field | `src/services/request_processing/types.ts` | Phase 53 | Delete field |
| `agent:` Zod schema key | `src/schemas/request.ts` | Phase 53 | Delete schema key |
| `agent:` frontmatter parse fallback | `src/services/request_processing/request_parser.ts` | Phase 53 | Delete fallback branch |
| `agent` field | `src/shared/schemas/flow.ts` (FlowStepSchema) | Phase 53 | Delete field from schema |
| `agent` field | `src/shared/schemas/flow.ts` (GateEvaluateSchema) | Phase 53 | Rename to `identity` |
| `agent` parameter | `src/flows/define_flow.ts` step config type | Phase 53 | Delete parameter |
| `identity ?? agent` fallback | `src/flows/flow_runner.ts`, `flow_loader.ts` | Phase 53 | Delete fallback logic |
| `agent:` in flow YAML steps | `Blueprints/Flows/*.yaml` | Phase 53 | Migrate to `identity:` |

### MCP Schema Change (Breaking)

| Before | After | Notes |
| --- | --- | --- |
| `exaix_create_request` param: `agent` | `exaix_create_request` param: `identity` | MCP schema version bump required |

The MCP tool input schema in `src/mcp/tools.ts` / `src/mcp/domain_tools.ts` must be updated.
Because this is a breaking change to the public MCP API, the MCP schema version must be
incremented and the change documented in `docs/dev/Exaix_Technical_Spec.md`.

---

## Implementation Plan

### Step 1 — Remove `--agent` CLI flag

**`src/cli/request_commands.ts`:**

- Delete the `.option("--agent <id>", ...)` declaration entirely
- Delete the `opts.agent` reference and the deprecation warning branch
- The handler reads only `opts.identity`

**Success criteria:**

- [x] `exactl request "..." --agent senior-coder` prints an unknown-option error and exits non-zero
- [x] `exactl request "..." --identity senior-coder` continues to work
- [x] CLI help output no longer mentions `--agent`

**✅ IMPLEMENTED** — `src/cli/exactl.ts`, `src/cli/command_builders/request_actions.ts`

---

### Step 2 — Remove `blueprint agent` alias subcommand

**`src/cli/blueprint_commands.ts`:**

- Delete the `agent` alias registration for all subcommands (`list`, `create`, `validate`,
  `show`, `delete`)
- Only `identity` subcommand remains

**Success criteria:**

- [x] `exactl blueprint agent list` prints an unknown-command error and exits non-zero
- [x] `exactl blueprint identity list` continues to work
- [x] CLI help output no longer lists `agent` as a subcommand or alias

**✅ IMPLEMENTED** — `src/cli/exactl.ts`

---

### Step 3 — Remove legacy path fallback from `BlueprintLoader`

**`src/services/blueprint_loader.ts`:**

- Delete the secondary lookup branch for `{workspace}/Blueprints/Agents/{id}.md`
- Delete the `blueprint.legacy_path.used` journal event emission
- Delete the `BLUEPRINT_AGENTS_DIR` constant
- `BlueprintLoader` now resolves only from `Blueprints/Identities/`
- If an identity is not found, throw `IdentityNotFoundError` immediately (no fallback)

**Success criteria:**

- [x] Loading an identity from `Blueprints/Agents/` path no longer works
- [x] `BLUEPRINT_AGENTS_DIR` does not appear in source (`grep -r BLUEPRINT_AGENTS_DIR src/`)
- [x] `blueprint.legacy_path.used` does not appear in source
- [x] Unit test: loading a missing identity throws `IdentityNotFoundError` with a clear message
  referencing `Blueprints/Identities/`

**✅ IMPLEMENTED** — `src/services/blueprint_loader.ts`, 17/17 tests passing

---

### Step 4 — Remove deprecated `agent` field from types and Zod schema

**`src/services/request_processing/types.ts`:**

```typescript
// Before (Phase 53):
export interface IRequestFrontmatter {
  identity?: string;
  /** @deprecated Use identity */
  agent?: string;
}

// After (Phase 54):
export interface IRequestFrontmatter {
  identity?: string;
  // agent field removed
}
```

**`src/schemas/request.ts`:**

```typescript
// Before (Phase 53):
identity: z.string().optional(),
agent:    z.string().optional(), // deprecated

// After (Phase 54):
identity: z.string().optional(),
// agent key removed — Zod strict mode will reject unknown keys if configured
```

**`src/services/request_processing/request_parser.ts`:**

- Delete the `agent:` frontmatter fallback parsing branch
- Delete the deprecation log line for `agent:`
- `RequestParser` reads only `identity:` from frontmatter

**Success criteria:**

- [x] A request file with `agent: senior-coder` frontmatter produces a Zod validation warning
  or is silently ignored (the `identity` field will be `undefined` and the default identity
  will be used — consistent with any other unrecognised frontmatter key)
- [x] `IRequestFrontmatter` no longer has an `agent` property (TypeScript compilation confirms)
- [x] Zod schema no longer accepts `agent` as a known key
- [x] All schema unit tests pass

**✅ IMPLEMENTED** — `src/services/request_processing/types.ts`, 7/7 tests passing

---

### Step 5 — Update MCP tool API

**`src/mcp/tools.ts` and/or `src/mcp/domain_tools.ts`:**

- Rename the `agent` input parameter of the `exaix_create_request` tool to `identity`
- Update the tool's input schema description accordingly
- Bump the MCP schema version constant

**`src/mcp/server.ts` (or equivalent version field):**

- Increment the advertised MCP schema version to signal a breaking change to MCP clients

**`docs/dev/Exaix_Technical_Spec.md`:**

- Document the breaking MCP parameter rename under a dedicated migration note

**Success criteria:**

- [ ] `exaix_create_request` MCP tool accepts `identity` parameter and routes correctly
- [ ] `exaix_create_request` MCP tool rejects `agent` parameter (unknown field in schema)
- [ ] MCP schema version is incremented
- [ ] MCP integration tests updated and passing

---

### Step 6 — Remove `agent` field from FlowStepSchema

**`src/shared/schemas/flow.ts`:**

```typescript
// BEFORE
export const FlowStepSchema = z.object({
  id: z.string().min(1, "Step ID cannot be empty"),
  name: z.string().min(1, "Step name cannot be empty"),
  type: z.nativeEnum(FlowStepType).optional().default(FlowStepType.AGENT),
  /** @deprecated Use `identity` instead. Will be removed in Phase 55. */
  agent: z.string().optional(),
  identity: z.string().min(1, "Identity reference cannot be empty"),
  // ...
});

// AFTER
export const FlowStepSchema = z.object({
  id: z.string().min(1, "Step ID cannot be empty"),
  name: z.string().min(1, "Step name cannot be empty"),
  type: z.nativeEnum(FlowStepType).optional().default(FlowStepType.AGENT),
  identity: z.string().min(1, "Identity reference cannot be empty"),
  // ...
});
```

**Success criteria:**

- [ ] `FlowStepSchema` has no `agent` field
- [ ] TypeScript types `IFlowStep`, `IFlowStepInput` infer correctly
- [ ] Zod validation rejects flow YAML with `agent:` step key

---

### Step 7 — Update GateEvaluateSchema

**`src/shared/schemas/flow.ts`:**

```typescript
// BEFORE
export const GateEvaluateSchema = z.object({
  /** Judge agent ID */
  agent: z.string(),
  criteria: z.array(z.string()),
  // ...
});

// AFTER
export const GateEvaluateSchema = z.object({
  /** Judge identity ID */
  identity: z.string(),
  criteria: z.array(z.string()),
  // ...
});
```

**Success criteria:**

- [ ] `GateEvaluateSchema` uses `identity` for judge reference
- [ ] TypeScript type `IGateEvaluate` infers correctly
- [ ] Zod validation rejects gate evaluate block with `agent:` key

---

### Step 8 — Update `define_flow.ts` Parameter Type

**`src/flows/define_flow.ts`:**

```typescript
// BEFORE
steps: Array<{
  id: string;
  name: string;
  /** @deprecated Use `identity` */
  agent?: string;
  identity: string;
  dependsOn?: string[];
  // ...
}>;

// AFTER
steps: Array<{
  id: string;
  name: string;
  identity: string;
  dependsOn?: string[];
  // ...
}>;
```

**Success criteria:**

- [ ] No `agent` parameter in step config type
- [ ] TypeScript compilation succeeds
- [ ] All `defineFlow()` call sites pass `identity:` (not `agent:`)

---

### Step 9 — Remove Runtime Fallback Logic

**Files:** `src/flows/flow_runner.ts`, `src/flows/flow_loader.ts`

Search for all patterns of:

```typescript
// Patterns to remove
step.identity ?? step.agent
step.agent ?? step.identity
s.agent
config.agent
```

Replace with direct `step.identity` / `s.identity` access.

**Example:**

```typescript
// BEFORE
const identityId = step.identity ?? step.agent;
if (!identityId) throw new Error(`Step ${step.id} has no identity`);

// AFTER
const identityId = step.identity;
if (!identityId) throw new Error(`Step ${step.id} has no identity`);
```

**Success criteria:**

- [ ] No `step.agent` access in flow execution code
- [ ] Error messages reference "identity" not "agent"
- [ ] No silent fallback behavior remains

---

### Step 10 — Migrate Blueprints/Flows YAML Files

**Directory:** `Blueprints/Flows/`

For every `.yaml` file, replace step-level `agent:` keys with `identity:`:

```yaml
# BEFORE
steps:
  - id: analyze
    name: Analyze Code
    agent: code-reviewer     # ← deprecated
    skills: [code-analysis]

# AFTER
steps:
  - id: analyze
    name: Analyze Code
    identity: code-reviewer  # ← Phase 53 field
    skills: [code-analysis]
```

Also update gate `evaluate` blocks:

```yaml
# BEFORE
evaluate:
  agent: judge-identity
  criteria: [correctness, quality]

# AFTER
evaluate:
  identity: judge-identity
  criteria: [correctness, quality]
```

**Success criteria:**

- [ ] All YAML files in `Blueprints/Flows/` use `identity:` in steps
- [ ] No YAML file contains step-level `agent:` key
- [ ] YAML files pass `exactl flow validate` after migration

---

### Step 11 — Update all tests

Search for all test files still using deprecated surfaces and migrate them:

```bash
grep -r "\-\-agent"        tests/
grep -r '"agent"'          tests/
grep -r "agent:"           tests/
grep -r "Blueprints/Agents" tests/
grep -rn "\.agent\b"       tests/flows/ tests/shared/schemas/
```

For each match:

- Replace `--agent` with `--identity`
- Replace `agent: "..."` frontmatter with `identity: "..."`
- Replace `Blueprints/Agents/` paths with `Blueprints/Identities/`
- Replace step-level `agent:` with `identity:` in flow test fixtures
- Delete any test cases that specifically tested the deprecation warning behaviour
  (e.g., "emits deprecation warning when --agent is used" — these are now irrelevant)

Add negative test case to confirm `agent:` in flow step is rejected:

```typescript
// New negative test
it("should reject flow step with deprecated 'agent' field", () => {
  const result = FlowStepSchema.safeParse({
    id: "s1", name: "Step", agent: "old-agent"  // no identity
  });
  expect(result.success).toBe(false);
});
```

**Success criteria:**

- [ ] `grep -r "\-\-agent" tests/` returns zero results
- [ ] `grep -r "Blueprints/Agents" tests/` returns zero results
- [ ] All tests pass: `deno task test`

---

### Step 12 — Final audit and CI

```bash
# Confirm no deprecated surfaces remain in source
grep -r "\-\-agent"          src/
grep -r "BLUEPRINT_AGENTS"   src/
grep -r "legacy_path"        src/
grep -r "agent?:"            src/  # TypeScript optional field syntax
grep -r "agent:.*deprecated" src/
grep -rn "\.agent\b"         src/flows/ src/shared/schemas/flow.ts

# These are expected to remain — do NOT change:
grep -rn "agent_id" src/       # ✅ blueprint identifiers — keep
grep -rn "FlowStepType.AGENT"  # ✅ enum value — keep
grep -rn "agent_executor"      # ✅ execution service — keep

# Full pipeline
deno task fmt
deno task lint
deno task test
deno run -A scripts/ci.ts all
deno run -A scripts/verify_manifest_fresh.ts
```

**Success criteria:**

- [ ] All grep checks above return zero results (excluding `agent_id`, `FlowStepType.AGENT`, `agent_executor`)
- [ ] Zero test regressions
- [ ] CI pipeline green end-to-end
- [ ] `deno check src/` reports no TypeScript errors
- [ ] All `[regression]`-prefixed tests pass

---

## Breaking Changes Summary

This phase introduces the following **breaking changes** for users and integrators:

| Surface | Change | Migration |
| --- | --- | --- |
| `--agent <id>` CLI flag | Removed — unknown option error | Use `--identity <id>` |
| `exactl blueprint agent *` | Removed — unknown subcommand error | Use `exactl blueprint identity *` |
| `agent:` request frontmatter key | No longer parsed — identity will be `undefined` | Use `identity:` |
| `exaix_create_request` MCP `agent` param | Removed from schema | Use `identity` param |
| `Blueprints/Agents/` directory scan | No longer scanned | Move files to `Blueprints/Identities/` |
| `agent` field in `FlowStepSchema` | Removed from schema | Use `identity` in flow step definitions |
| `agent` field in `GateEvaluateSchema` | Renamed to `identity` | Use `identity` in gate evaluate blocks |
| `agent:` in flow YAML steps | No longer parsed — step will fail validation | Use `identity:` in `Blueprints/Flows/*.yaml` |

All of the above were announced as deprecated in Phase 53 with warnings. Users and integrators
have had one full release cycle to migrate.

---

## Notes

- No database migrations are required. No journal event names change.
- `agent_id` inside blueprint frontmatter remains unchanged forever.
- `AgentRunner` and all runtime-layer names remain unchanged.
- `FlowStepType.AGENT` enum value remains unchanged (internal enum, not user-facing).
- If any workspace still contains a `Blueprints/Agents/` directory after this phase, its
  contents will simply not be discovered by `BlueprintLoader`. Users must move their files
  manually to `Blueprints/Identities/`. A clear error message in `IdentityNotFoundError`
  should hint at this: `"Identity 'X' not found in Blueprints/Identities/. If you are
  migrating from a pre-Phase-53 workspace, move your blueprints from Blueprints/Agents/
  to Blueprints/Identities/."`
- Flow YAML files in `Blueprints/Flows/` using `agent:` in step definitions will fail
  Zod validation. Users must update their flow files to use `identity:` instead.
- All commit messages for this phase must follow the Phase 52 structured commit message
  format with `impact:` entries referencing `BlueprintLoader`, `CLI Layer`,
  `RequestParser`, `Zod Schemas`, `MCP Server`, and `Flow Layer`.
