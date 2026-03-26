---
agent: claude
scope: dev
title: "Phase 54: Remove Deprecated 'agent' Aliases Introduced in Phase 53"
short*summary: "Hard-remove all Phase 53 backward-compatibility shims: the --agent CLI flag alias, the Blueprints/Agents/ fallback path, the deprecated agent: frontmatter key, the agent? field in IRequestFrontmatter and Zod schemas, the BLUEPRINT*AGENTS_DIR constant, and the agent field from flow schemas (FlowStepSchema, GateEvaluateSchema)."
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
- `BLUEPRINT*AGENTS*DIR` constant is removed
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
- [ ] Remove `BLUEPRINT*AGENTS*DIR` constant
- [x] Remove `agent?` field from `IRequestFrontmatter` interface in
  `src/services/request_processing/types.ts`
- [ ] Remove `agent` key from Zod schema in `src/schemas/request.ts`
- [ ] Remove `agent:` frontmatter parsing fallback from `src/services/request*processing/request*parser.ts`
- [ ] Remove `blueprint.legacy_path.used` journal event emission from `BlueprintLoader`
- [ ] Remove `agent` field from `FlowStepSchema` in `src/shared/schemas/flow.ts`
- [ ] Remove `agent` field from `GateEvaluateSchema` in `src/shared/schemas/flow.ts`
- [ ] Remove `agent` parameter from `define_flow.ts` step config type
- [ ] Remove runtime fallback logic `identity ?? agent` in `flow*runner.ts` / `flow*loader.ts`
- [ ] Migrate all `Blueprints/Flows/*.yaml` step definitions from `agent:` to `identity:`
- [ ] Update all tests that still use `--agent`, `agent:`, or `Blueprints/Agents/` to use
  the canonical `--identity`, `identity:`, and `Blueprints/Identities/` equivalents
- [ ] Confirm no remaining references to deprecated surfaces in source or tests

### Secondary Goals

- [ ] Update `CONTRIBUTING.md` migration note from Phase 53 to state removal is complete
- [ ] Update `CHANGELOG` / release notes to mark `--agent` as removed (breaking change)
- [x] Update MCP tool API: rename `agent` parameter of `exaix*create*request` to `identity`
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
| `BLUEPRINT*AGENTS*DIR` constant | `src/services/blueprint_loader.ts` | Phase 53 | Delete constant |
| `blueprint.legacy*path.used` event | `src/services/blueprint*loader.ts` | Phase 53 | Delete event emission |
| `agent?` field | `src/services/request_processing/types.ts` | Phase 53 | Delete field |
| `agent:` Zod schema key | `src/schemas/request.ts` | Phase 53 | Delete schema key |
| `agent:` frontmatter parse fallback | `src/services/request*processing/request*parser.ts` | Phase 53 | Delete fallback branch |
| `agent` field | `src/shared/schemas/flow.ts` (FlowStepSchema) | Phase 53 | Delete field from schema |
| `agent` field | `src/shared/schemas/flow.ts` (GateEvaluateSchema) | Phase 53 | Rename to `identity` |
| `agent` parameter | `src/flows/define_flow.ts` step config type | Phase 53 | Delete parameter |
| `identity ?? agent` fallback | `src/flows/flow*runner.ts`, `flow*loader.ts` | Phase 53 | Delete fallback logic |
| `agent:` in flow YAML steps | `Blueprints/Flows/*.yaml` | Phase 53 | Migrate to `identity:` |

### MCP Schema Change (Breaking)

| Before | After | Notes |
| --- | --- | --- |
| `exaix*create*request` param: `agent` | `exaix*create*request` param: `identity` | MCP schema version bump required |

The MCP tool input schema in `src/mcp/tools.ts` / `src/mcp/domain_tools.ts` must be updated.
Because this is a breaking change to the public MCP API, the MCP schema version must be
incremented and the change documented in `docs/dev/Exaix*Technical*Spec.md`.

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

**✅ IMPLEMENTED** — `src/cli/exactl.ts`, `src/cli/command*builders/request*actions.ts`

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
- Delete the `BLUEPRINT*AGENTS*DIR` constant
- `BlueprintLoader` now resolves only from `Blueprints/Identities/`
- If an identity is not found, throw `IdentityNotFoundError` immediately (no fallback)

**Success criteria:**

- [x] Loading an identity from `Blueprints/Agents/` path no longer works
- [x] `BLUEPRINT*AGENTS*DIR` does not appear in source (`grep -r BLUEPRINT*AGENTS*DIR src/`)
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

**`src/services/request*processing/request*parser.ts`:**

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

- Rename the `agent` input parameter of the `exaix*create*request` tool to `identity`
- Update the tool's input schema description accordingly
- Bump the MCP schema version constant

**`src/mcp/server.ts` (or equivalent version field):**

- Increment the advertised MCP schema version to signal a breaking change to MCP clients

**`docs/dev/Exaix*Technical*Spec.md`:**

- Document the breaking MCP parameter rename under a dedicated migration note

**Success criteria:**

- [ ] `exaix*create*request` MCP tool accepts `identity` parameter and routes correctly
- [ ] `exaix*create*request` MCP tool rejects `agent` parameter (unknown field in schema)
- [ ] MCP schema version is incremented
- [ ] MCP integration tests updated and passing

---

### Step 6 — Remove `agent` field from FlowStepSchema

**`src/shared/schemas/flow.ts`:**

```typescript
// BEFORE (Phase 53)
export const FlowStepSchema = z.object({
  id: z.string().min(1, "Step ID cannot be empty"),
  name: z.string().min(1, "Step name cannot be empty"),
  type: z.nativeEnum(FlowStepType).optional().default(FlowStepType.AGENT),
  agent: z.string().min(1, "Agent reference cannot be empty"),
  // ...
});

// AFTER (Phase 54)
export const FlowStepSchema = z.object({
  id: z.string().min(1, "Step ID cannot be empty"),
  name: z.string().min(1, "Step name cannot be empty"),
  type: z.nativeEnum(FlowStepType).optional().default(FlowStepType.AGENT),
  identity: z.string().min(1, "Identity reference cannot be empty"),
  // ...
});
```

**Success criteria:**

- [x] `FlowStepSchema` has no `agent` field
- [x] TypeScript types `IFlowStep`, `IFlowStepInput` infer correctly
- [x] Zod validation rejects flow YAML with `agent:` step key

**✅ IMPLEMENTED** — `src/shared/schemas/flow.ts`, 14/14 tests passing

---

### Step 7 — Update GateEvaluateSchema

**`src/shared/schemas/flow.ts`:**

```typescript
// BEFORE (Phase 53)
export const GateEvaluateSchema = z.object({
  /** Judge agent ID */
  agent: z.string(),
  criteria: z.array(z.string()),
  // ...
});

// AFTER (Phase 54)
export const GateEvaluateSchema = z.object({
  /** Judge identity ID */
  identity: z.string(),
  criteria: z.array(z.string()),
  // ...
});
```

**Success criteria:**

- [x] `GateEvaluateSchema` uses `identity` for judge reference
- [x] TypeScript type `IGateEvaluate` infers correctly
- [x] Zod validation rejects gate evaluate block with `agent:` key

**✅ IMPLEMENTED** — `src/shared/schemas/flow.ts` (combined with Step 6)

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

**Files:** `src/flows/flow*runner.ts`, `src/flows/flow*loader.ts`

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

## 2. Phase 54 — Steps 10–16 (replace everything from `### Step 10` to end of file)

```markdown

## Status: 🔄 IN PROGRESS (Steps 1–9 complete)

> Steps 1–9 removed all public-surface "agent" aliases.
> Steps 10–16 fix the remaining internal mis-use of "agent" where the code
> should carry separate actor / agent / identity fields, as defined in
> GLOSSARY.md.  Read GLOSSARY.md § "Journal and Persistence" and
> § "Code Identifiers" before touching any file in these steps.

---

### Step 10 — Migrate `Blueprints/Flows/` YAML files

**What to do:**
Open every `.yaml` file in `Blueprints/Flows/`.
Find every occurrence of `agent:` inside a `steps:` block or an `evaluate:`
block.  Replace `agent:` with `identity:`.  Do not change anything else.

**Before:**
```yaml
steps:
  - id: analyze
    name: Analyze Code
    agent: code-reviewer
evaluate:
  agent: judge-identity
  criteria: [correctness, quality]
```

**After:**

```yaml
steps:
  - id: analyze
    name: Analyze Code
    identity: code-reviewer
evaluate:
  identity: judge-identity
  criteria: [correctness, quality]
```

**Verification:**

```bash

# Must return zero results:

grep -rn "^  agent:" Blueprints/Flows/

# Must work without errors:

```

**Success criteria:**

- [ ] Zero `agent:` keys remain in any `Blueprints/Flows/*.yaml` file
- [ ] `exactl flow validate` exits 0 for all flows

---

### Step 11 — Add `actor*type`, `agent*kind`, `identity_id` columns

**Why:**
The current `activity` table has `actor` and `agent*id` but no `actor*type`,
`agent*kind`, or `identity*id`.  The `agent_id` column is currently used to
store identity blueprint IDs, which is wrong per GLOSSARY.md.  This step adds
the missing columns and backfills `identity*id` from the old `agent*id` values.

**What to do:**
Create the file `migrations/002*actor*identity_fields.sql`:

```sql
-- up
-- Phase 54: add actor*type, agent*kind, identity_id to activity table
-- agent_id column is kept; it now means the runtime agent (AgentRunner, etc.)
-- identity_id is the new column for the LLM identity blueprint reference

ALTER TABLE activity ADD COLUMN actor_type TEXT;
ALTER TABLE activity ADD COLUMN agent_kind TEXT;
ALTER TABLE activity ADD COLUMN identity_id TEXT;

-- Backfill: before Phase 54, agent_id held identity references.
-- Copy those values into identity_id so historical data is not lost.
UPDATE activity SET identity*id = agent*id WHERE agent_id IS NOT NULL;

-- Add index for identity_id queries
CREATE INDEX IF NOT EXISTS idx*activity*identity ON activity(identity_id);
CREATE INDEX IF NOT EXISTS idx*activity*actor*type ON activity(actor*type);
```

Then register and run this migration.  Follow the same pattern as
`migrations/001_init.sql`.  Confirm the migration runner in
`src/services/db.ts` picks up `.sql` files from the `migrations/` folder
in filename order.

**Verification:**

```bash

# Run on a fresh database:


# Run on an existing populated database:


# Check columns exist:


# Expected output must contain: actor*type, agent*kind, identity_id


**Success criteria:**

- [ ] `migrations/002*actor*identity_fields.sql` exists
- [ ] `activity` table has columns `actor*type`, `agent*kind`, `identity_id`
- [ ] Existing `agent_id` column is still present and unchanged
- [ ] `identity*id` is backfilled from `agent*id` for all pre-migration rows
- [ ] Migration is idempotent (safe to run twice)

---

### Step 12 — Update `ActivityRecordSchema` and `LogEntry` in


**Why:**
`ActivityRecordSchema` is the Zod schema that validates rows read back from the
`activity` table.  `LogEntry` is the internal interface for writing rows.
Both must reflect the three new columns added in Step 11.

**What to do:**

Open `src/services/db.ts`.

**Change 1 — `LogEntry` interface** (add three new optional fields):

```typescript
// BEFORE
interface LogEntry {
  activityId: string;
  traceId: string;
  actor: string;
  agentId: string | null;
  actionType: string;
  target: string | null;
  payload: string;
  timestamp: string;
}

// AFTER
interface LogEntry {
  activityId: string;
  traceId: string;
  actor: string;
  actorType: string | null;   // NEW — category of actor (GLOSSARY: actor_type)
  agentId: string | null;     // KEPT — runtime agent id (NOT an identity id)
  agentKind: string | null;   // NEW — category of runtime agent (GLOSSARY: agent_kind)
  identityId: string | null;  // NEW — LLM identity blueprint id (GLOSSARY: identity_id)
  actionType: string;
  target: string | null;
  payload: string;
  timestamp: string;
}
```

**Change 2 — `ActivityRecordSchema`** (add three new nullable fields):

```typescript
// BEFORE
export const ActivityRecordSchema = z.object({
  id: z.string(),
  trace_id: z.string(),
  actor: z.string().nullable(),
  agent_id: z.string().nullable(),
  action_type: z.string(),
  target: z.string().nullable(),
  payload: z.string(),
  timestamp: z.string(),
  count: z.number().optional(),
});

// AFTER
export const ActivityRecordSchema = z.object({
  id: z.string(),
  trace_id: z.string(),
  actor: z.string().nullable(),
  actor_type: z.string().nullable(),    // NEW
  agent_id: z.string().nullable(),
  agent_kind: z.string().nullable(),    // NEW
  identity_id: z.string().nullable(),   // NEW
  action_type: z.string(),
  target: z.string().nullable(),
  payload: z.string(),
  timestamp: z.string(),
  count: z.number().optional(),
});
```

**Change 3 — INSERT statement** inside the method that writes to `activity`
(search for `INSERT INTO activity`):

```typescript
// BEFORE
await db.execute(
  `INSERT INTO activity
     (id, trace*id, actor, agent*id, action_type, target, payload, timestamp)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  [entry.activityId, entry.traceId, entry.actor, entry.agentId,
   entry.actionType, entry.target, entry.payload, entry.timestamp]
);

// AFTER
await db.execute(
  `INSERT INTO activity
     (id, trace*id, actor, actor*type, agent*id, agent*kind,
      identity*id, action*type, target, payload, timestamp)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [entry.activityId, entry.traceId, entry.actor, entry.actorType ?? null,
   entry.agentId, entry.agentKind ?? null, entry.identityId ?? null,
   entry.actionType, entry.target, entry.payload, entry.timestamp]
);
```

**Verification:**

```bash
deno check src/services/db.ts
deno task test -- --filter db
```

**Success criteria:**

- [ ] `LogEntry` has `actorType`, `agentKind`, `identityId` fields
- [ ] `ActivityRecordSchema` has `actor*type`, `agent*kind`, `identity_id` fields
- [ ] INSERT statement writes all new columns
- [ ] Zero TypeScript errors in this file

---

### Step 13 — Update `IActivity` and `LogActivityRequest` in

**Why:**
`IActivity` is the domain object returned by repository queries.
`LogActivityRequest` is what callers pass to write a journal record.
Both must expose the three new fields and stop conflating `agentId` with
identity blueprint references.

**What to do:**

Open `src/repositories/activity_repository.ts`.

**Change 1 — `IActivity` interface:**

```typescript
// BEFORE
export interface IActivity {
  id: string;
  traceId: string;
  actor: string | null;
  agentId: string | null;    // was used for both agent and identity — now agent only
  actionType: string;
  target: string | null;
  payload: Record<string, JSONValue>;
  timestamp: string;
}

// AFTER
export interface IActivity {
  id: string;
  traceId: string;
  /** Who performed the action. Format: "user:<email>", "service:<name>", etc. */
  actor: string | null;
  /** Category of actor: "user" | "service" | "mcp-client" | "identity" */
  actorType: string | null;
  /** Runtime agent that handled the execution, e.g. "agent-runner", "flow-runner" */
  agentId: string | null;
  /** Category of runtime agent: "agent-runner" | "flow-agent" | "tool-agent" | "request-router" */
  agentKind: string | null;
  /** LLM identity blueprint that was used, e.g. "senior-coder" */
  identityId: string | null;
  actionType: string;
  target: string | null;
  payload: Record<string, JSONValue>;
  timestamp: string;
}
```

**Change 2 — `LogActivityRequest` interface:**

```typescript
// BEFORE
export interface LogActivityRequest {
  actor: string;
  actionType: string;
  target: string | null;
  payload?: Record<string, JSONValue>;
  traceId?: string;
  agentId?: string | null;   // was used for both agent and identity — now agent only
}

// AFTER
export interface LogActivityRequest {
  /** Who initiated the action */
  actor: string;
  /** Category of actor: "user" | "service" | "mcp-client" | "identity" */
  actorType?: string;
  /** Runtime agent that handled execution — NOT an identity id */
  agentId?: string | null;
  /** Category of runtime agent */
  agentKind?: string | null;
  /** LLM identity blueprint that was used */
  identityId?: string | null;
  actionType: string;
  target: string | null;
  payload?: Record<string, JSONValue>;
  traceId?: string;
}
```

**Change 3 — mapping from `ActivityRecord` to `IActivity`:**
Find the function/method that maps a raw DB row (`ActivityRecord`) to an
`IActivity` object.  Add the three new fields:

```typescript
// Add these lines to the mapping:
actorType: row.actor_type ?? null,
agentKind: row.agent_kind ?? null,
identityId: row.identity_id ?? null,
```

**Verification:**

```bash
deno check src/repositories/activity_repository.ts
deno task test -- --filter activity
```

**Success criteria:**

- [ ] `IActivity` has `actorType`, `agentKind`, `identityId` fields
- [ ] `LogActivityRequest` has `actorType`, `agentKind`, `identityId` fields
- [ ] Mapping from DB row populates the three new fields
- [ ] Zero TypeScript errors in this file

---

### Step 14 — Update `ILogEvent` and `IServiceContext` in

**Why:**
`ILogEvent` is what every service passes to `EventLogger`.  It currently has a
single `agentId` field that is used to carry identity blueprint IDs, which is
wrong.  We split it into `agentId` (runtime agent) and `identityId` (LLM
blueprint).  `IServiceContext` has the same problem.

**What to do:**

Open `src/services/common/types.ts`.

**Change 1 — `ILogEvent`:**

```typescript
// BEFORE
export interface ILogEvent {
  action: string;
  target: string;
  payload?: Record<string, JSONValue>;
  actor?: Actor;
  traceId?: string;
  /** Agent ID for agent-specific events */
  agentId?: string;
  level?: LogLevel;
  icon?: string;
}

// AFTER
export interface ILogEvent {
  action: string;
  target: string;
  payload?: Record<string, JSONValue>;
  /** Who triggered this event — maps to journal actor field */
  actor?: Actor;
  /** Category of actor: "user" | "service" | "mcp-client" | "identity" */
  actorType?: string;
  traceId?: string;
  /** Runtime agent handling this event, e.g. "agent-runner" — NOT an identity id */
  agentId?: string;
  /** Category of runtime agent, e.g. "agent-runner" | "flow-agent" */
  agentKind?: string;
  /** LLM identity blueprint used for this event, e.g. "senior-coder" */
  identityId?: string;
  level?: LogLevel;
  icon?: string;
}
```

**Change 2 — `IServiceContext`:**

```typescript
// BEFORE
export interface IServiceContext {
  traceId?: string;
  agentId?: string;
  actor?: Actor;
}

// AFTER
export interface IServiceContext {
  traceId?: string;
  /** Who initiated the enclosing request */
  actor?: Actor;
  /** Category of actor */
  actorType?: string;
  /** Runtime agent handling this service call — NOT an identity id */
  agentId?: string;
  /** Category of runtime agent */
  agentKind?: string;
  /** LLM identity blueprint being executed */
  identityId?: string;
}
```

**Verification:**

```bash
deno check src/services/common/types.ts

# Find all callers that pass agentId and check they pass the right value:


# Any caller passing an identity slug into agentId must be moved to identityId.


**Success criteria:**

- [ ] `ILogEvent` has `agentId`, `agentKind`, `identityId`, `actorType` fields
- [ ] `IServiceContext` has `agentId`, `agentKind`, `identityId`, `actorType` fields
- [ ] No caller passes an identity blueprint slug into `agentId`
- [ ] Zero TypeScript errors

---

### Step 15 — Update `EventLogger` to write new fields to journal

**Why:**
`EventLogger` reads an `ILogEvent` and writes a `LogActivityRequest`.  It must
now forward the three new fields so they reach the database.

**What to do:**

Open `src/services/event_logger.ts`.

Find the place where `EventLogger` calls `activityRepo.logActivity(...)` or
constructs a `LogActivityRequest`.  Add the three new fields:

```typescript
// BEFORE
await this.activityRepo.logActivity({
  actor: event.actor ?? this.config.defaultActor ?? "system",
  actionType: event.action,
  target: event.target ?? null,
  payload: event.payload ?? {},
  traceId: event.traceId,
  agentId: event.agentId ?? null,
});

// AFTER
await this.activityRepo.logActivity({
  actor: event.actor ?? this.config.defaultActor ?? "system",
  actorType: event.actorType ?? null,
  actionType: event.action,
  target: event.target ?? null,
  payload: event.payload ?? {},
  traceId: event.traceId,
  agentId: event.agentId ?? null,          // runtime agent — NOT identity
  agentKind: event.agentKind ?? null,
  identityId: event.identityId ?? null,    // LLM blueprint id
});
```

**Verification:**

```bash
deno check src/services/event_logger.ts
deno task test -- --filter event_logger
```

**Success criteria:**

- [ ] `EventLogger` passes `actorType`, `agentKind`, `identityId` to
  `logActivity`
- [ ] No call to `logActivity` passes an identity slug into `agentId`
- [ ] Zero TypeScript errors in this file

---

### Step 16 — Fix callers that wrongly pass identity slugs into `agentId`

**Why:**
Before this phase, many services passed an identity blueprint id (e.g.
`"senior-coder"`) into `ILogEvent.agentId` because there was no `identityId`
field.  Now that `identityId` exists, every such call site must be corrected.

**What to do:**

Run this grep to find every call site that sets `agentId`:

```bash
grep -rn "agentId:" src/ --include="*.ts"
```

For each result, read the value being passed:

- If the value is an **identity blueprint slug** (e.g. `"senior-coder"`,
  `opts.identity`, `step.identity`, `blueprint.id`, `config.agentId` where
  `agentId` was previously set from frontmatter `identity:`) →
  **move it to `identityId`** and set `agentId` to the runtime agent name
  (e.g. `"agent-runner"`, `"flow-runner"`).

- If the value is a **runtime agent name** (e.g. `"agent-runner"`,
  `"flow-runner"`, `AgentRunner.id`, `this.agentId` where the class is
  `AgentRunner`) → **leave it in `agentId`** and add `agentKind` if known.

**Typical patterns to fix:**

```typescript
// PATTERN 1 — identity slug passed as agentId (wrong)
// Found in: AgentRunner, FlowRunner, RequestProcessor
// BEFORE
await this.logger.info("agent.execution.started", requestId, {}, {
  agentId: blueprint.id,   // ← blueprint.id is an identity slug
});
// AFTER
await this.logger.info("agent.execution.started", requestId, {}, {
  agentId: "agent-runner",       // runtime agent name
  agentKind: "agent-runner",
  identityId: blueprint.id,      // ← identity slug moved here
});

// PATTERN 2 — identity from request options passed as agentId (wrong)
// Found in: RequestProcessor, RequestRouter
// BEFORE
await this.logger.info("request.processing.started", requestId, {}, {
  actor: actor,
  agentId: opts.identity,   // ← opts.identity is an identity slug
});
// AFTER
await this.logger.info("request.processing.started", requestId, {}, {
  actor: actor,
  actorType: "user",
  agentId: "request-router",     // runtime agent name
  agentKind: "request-router",
  identityId: opts.identity,     // ← identity slug moved here
});
```

**Verification:**

```bash

# After fixing all call sites, this should show only runtime agent names,

grep -rn "agentId:" src/ --include="*.ts"

# identityId should now appear at every LLM call site:


deno check src/
deno task test
```

**Success criteria:**

- [ ] Every `agentId:` value in source is a runtime agent name string, not an
  identity slug
- [ ] Every place a blueprint id is logged uses `identityId:` instead
- [ ] `grep -rn "identityId:" src/` returns at least one result per LLM call
  site (`agent*runner.ts`, `flow*runner.ts`)
- [ ] Zero TypeScript errors
- [ ] All tests pass

---

### Step 17 — Fix enum values in `src/shared/enums.ts` that represent

**Why:**
Several enum values use the word `"agent"` but semantically mean either an
identity (LLM persona) or an actor (who initiated something).  Using `"agent"`
for these makes the enum inconsistent with GLOSSARY.md.

**What to do:**

Open `src/shared/enums.ts`.  Make exactly the following value renames.  Change
**only the value string** and the **member name**.  Do not rename the enum
itself unless stated.

| Enum | Old member | Old string value | New member | New string value | Reason |
| --- | --- | --- | --- | --- | --- |
| `ActivityActor` | `AGENT` | `"agent"` | `IDENTITY` | `"identity"` | An autonomous LLM identity is the actor, not the AgentRunner |
| `RequestKind` | `AGENT` | `"agent"` | `IDENTITY` | `"identity"` | A request dispatched to an identity blueprint |
| `GroupingMode` | `AGENT` | `"agent"` | `IDENTITY` | `"identity"` | Grouped by LLM identity, not runtime agent |
| `RequestGroupingMode` | `AGENT` | `"agent"` | `IDENTITY` | `"identity"` | Same |
| `LogGroupingMode` | `AGENT` | `"agent"` | `ACTOR` | `"actor"` | Grouped by who produced the log (actor concept) |
| `RequestDialogType` | `FILTER*AGENT` | `"filter-agent"` | `FILTER*IDENTITY` | `"filter-identity"` | Filter UI by identity |
| `MemoryBankSource` | `AGENT` | `"agent"` | `IDENTITY` | `"identity"` | Memory produced by an LLM identity execution |
| `TuiNodeType` | `AGENT` | `"agent"` | `IDENTITY` | `"identity"` | TUI tree node for an identity |
| `TuiIcon` | `AGENT` | `"🤖"` | `IDENTITY` | `"🤖"` | Icon represents identity persona |
| `AgentExecutionErrorType` | `AGENT*ERROR` | `"agent*error"` | `EXECUTION*ERROR` | `"execution*error"` | Generic execution failure, not agent-specific |

**Do NOT rename** these (they are correctly named runtime agent concepts):

- `AgentHealth` enum — keep as-is
- `AgentStatus` const — keep as-is
- `AgentExecutionErrorType` enum name — keep, only rename the `AGENT_ERROR`
  member above
- `FlowStepType.AGENT` — keep as-is (internal enum)

**After each rename, fix all call sites:**

```bash

# Find every usage of each old name, example for ActivityActor:


# Replace with ActivityActor.IDENTITY

# Repeat for every renamed member:

grep -rn "GroupingMode\.AGENT" src/ tests/
grep -rn "RequestGroupingMode\.AGENT" src/ tests/
grep -rn "LogGroupingMode\.AGENT" src/ tests/
grep -rn "FILTER_AGENT" src/ tests/
grep -rn "MemoryBankSource\.AGENT" src/ tests/
grep -rn "TuiNodeType\.AGENT" src/ tests/
grep -rn "TuiIcon\.AGENT" src/ tests/
grep -rn "AgentExecutionErrorType\.AGENT_ERROR" src/ tests/
```

**Verification:**

```bash
deno check src/
deno task test
```

**Success criteria:**

- [ ] All ten renames applied in `src/shared/enums.ts`
- [ ] Zero remaining usages of old member names (grep returns zero)
- [ ] Zero TypeScript errors
- [ ] All tests pass

---

### Step 18 — Update all tests

**What to do:**

Run each grep below.  For every match apply the fix shown.

```bash

# 1. Deprecated --agent flag in tests


# Fix: replace --agent with --identity

# 2. agent: frontmatter in test fixtures


# Fix: replace agent: with identity: in YAML frontmatter strings

# 3. Old Blueprints/Agents/ paths


# Fix: replace Blueprints/Agents/ with Blueprints/Identities/

# 4. Old enum members renamed in Step 17


# Fix: apply the same renames from Step 17

# 5. agentId in test assertions that should now be identityId


# Fix: if the value being asserted is an identity slug, change to identityId:


**Add one new positive test** to confirm the three journal fields are written
correctly.  Add it to the test file nearest to `EventLogger` or
`ActivityRepository`:

```typescript
it("journal row has actor, agentId and identityId as separate fields", async () => {
  // Arrange
  const traceId = crypto.randomUUID();
  await logger.info("test.event", "some-target", {}, {
    actor: "user:test@example.com",
    actorType: "user",
    agentId: "agent-runner",
    agentKind: "agent-runner",
    identityId: "senior-coder",
    traceId,
  });

  // Act
  const rows = await activityRepo.getActivitiesByTraceId(traceId);

  // Assert
  expect(rows).toHaveLength(1);
  expect(rows.actor).toBe("user:test@example.com");
  expect(rows.actorType).toBe("user");
  expect(rows.agentId).toBe("agent-runner");
  expect(rows.agentKind).toBe("agent-runner");
  expect(rows.identityId).toBe("senior-coder");
});
```

**Verification:**

```bash
deno task test
```

**Success criteria:**

- [ ] All five grep commands above return zero results (after fixes)
- [ ] New journal fields test passes
- [ ] Full test suite passes: `deno task test`

---

### Step 19 — Final audit and CI

Run all checks below.  Every "must be zero" check must return zero results
before this phase is considered complete.

```bash

# ── Must return ZERO results ──────────────────────────────────────────────

# Deprecated CLI flag


# Deprecated Agents directory reference


# Old enum member names (renamed in Step 17)

grep -rn "RequestGroupingMode\.AGENT\|LogGroupingMode\.AGENT\|FILTER_AGENT" src/ tests/
grep -rn "MemoryBankSource\.AGENT\|TuiNodeType\.AGENT\|TuiIcon\.AGENT" src/ tests/
grep -rn "AgentExecutionErrorType\.AGENT_ERROR" src/ tests/

# Identity slugs wrongly stored in agentId (spot-check known files)


# ── Must return NON-ZERO results (confirm kept names still exist) ─────────

grep -rn "AgentRunner\|AgentHealth\|AgentStatus" src/
grep -rn "FlowStepType\.AGENT" src/
grep -rn "identityId" src/repositories/ src/services/event_logger.ts
grep -rn "actor*type\|agent*kind\|identity_id" migrations/

# ── Full pipeline ─────────────────────────────────────────────────────────

deno task lint
deno check src/
deno task test
deno run -A scripts/ci.ts all
```

**Success criteria:**

- [ ] All "must be zero" greps return zero results
- [ ] All "must be non-zero" greps confirm kept names still exist
- [ ] `deno check src/` reports zero TypeScript errors
- [ ] `deno task test` reports zero failures
- [ ] CI pipeline green end-to-end

---

## Updated Breaking Changes Summary

| Surface | Change | Migration |
| --- | --- | --- |
| `--agent` CLI flag | Removed (Step 1) | Use `--identity` |
| `exactl blueprint agent *` | Removed (Step 2) | Use `exactl blueprint identity *` |
| `agent:` request frontmatter | No longer parsed (Step 4) | Use `identity:` |
| `exaix*create*request` MCP `agent` param | Removed (Step 5) | Use `identity` param |
| `Blueprints/Agents/` directory scan | Removed (Step 3) | Move files to `Blueprints/Identities/` |
| `agent:` in flow YAML steps and gates | Removed (Steps 6–10) | Use `identity:` |
| `activity.agent*id` semantics | Now means runtime agent only | Use `activity.identity*id` for LLM blueprint |
| `ILogEvent.agentId` semantics | Now means runtime agent only | Use `ILogEvent.identityId` for LLM blueprint |
| `ActivityActor.AGENT` enum member | Renamed to `IDENTITY` (Step 17) | Use `ActivityActor.IDENTITY` |
| `RequestKind.AGENT` | Renamed to `IDENTITY` (Step 17) | Use `RequestKind.IDENTITY` |
| `GroupingMode.AGENT` | Renamed to `IDENTITY` (Step 17) | Use ` |
