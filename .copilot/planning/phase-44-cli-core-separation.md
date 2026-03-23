# Phase 44: CLI and Core Separation

## Status: COMPLETED ✅

## Progress Snapshot

- ✅ Completed: Steps 1, 2, 3, 4, 5, 6, 7, and 8

Decouple the CLI implementation from the Exaix core by enforcing a strict interface-driven boundary. This mirrors Phase 43 (TUI/Core separation) and is a prerequisite for moving the CLI into a separate Git repository in a future phase.

## Executive Summary

**Problem:**

The CLI codebase (`src/cli/`, ~30 files) has direct imports into core service implementations, the config layer, the AI layer, helpers, and parsers. Command files import concrete classes (`MemoryBankService`, `ContextCardGenerator`, `FlowValidatorImpl`, `ConfigService`, `ArchiveService`, `GitService`, etc.) rather than the interfaces those classes satisfy. This tight coupling prevents the CLI from being developed, tested, or versioned independently from the core runtime.

**Solution:**

Mirror the Phase 43 approach. Define formal service interfaces in `src/shared/interfaces/` for every core capability the CLI consumes, implement adapter classes in `src/services/adapters/` that satisfy those interfaces, and refactor all CLI command/handler/formatter files to depend **only** on:

1. **Service Interfaces** from `src/shared/interfaces/`.

1.
1.

The result: `src/cli/commands/`, `src/cli/handlers/`, `src/cli/formatters/`, and `src/cli/command_builders/` have zero imports pointing to `src/services/` (concrete classes), `src/config/service.ts`, or `src/ai/` (beyond the already-abstract `IModelProvider` interface).

---

## Current Dependency Audit

### Category 1: CLI Base Layer (2 imports)

The base context type for all commands imports concrete service types directly.

| File              | Imports            | Source Module              |
| ----------------- | ------------------ | -------------------------- |
| `src/cli/base.ts` | `IDatabaseService` | `services/db.ts`           |
| `src/cli/base.ts` | `EventLogger`      | `services/event_logger.ts` |

### Category 2: Core Service Implementations (15 imports, 9 modules)

Direct dependencies on concrete service classes inside command/handler/formatter files.

| CLI File                              | Imports                     | Source Module                        |
| ------------------------------------- | --------------------------- | ------------------------------------ |
| `commands/memory_commands.ts`         | `IDatabaseService`          | `services/db.ts`                     |
| `commands/memory_commands.ts`         | `MemoryBankService`         | `services/memory_bank.ts`            |
| `commands/memory_commands.ts`         | `MemoryExtractorService`    | `services/memory_extractor.ts`       |
| `commands/memory_commands.ts`         | `MemoryEmbeddingService`    | `services/memory_embedding.ts`       |
| `commands/memory_commands.ts`         | `SkillsService`             | `services/skills.ts`                 |
| `commands/portal_commands.ts`         | `IDatabaseService`          | `services/db.ts`                     |
| `commands/portal_commands.ts`         | `ContextCardGenerator`      | `services/context_card_generator.ts` |
| `commands/portal_commands.ts`         | `EventLogger`               | `services/event_logger.ts`           |
| `commands/flow_commands.ts`           | `FlowValidatorImpl`         | `services/flow_validator.ts`         |
| `commands/flow_commands.ts`           | `EventLogger`               | `services/event_logger.ts`           |
| `commands/flow_commands.ts`           | `IDatabaseService`          | `services/db.ts`                     |
| `commands/review_commands.ts`         | `GitService`, `IGitService` | `services/git_service.ts`            |
| `commands/archive_commands.ts`        | `ArchiveService`            | `services/archive_service.ts`        |
| `formatters/journal_formatter.ts`     | `ActivityRecord`            | `services/db.ts`                     |
| `command_builders/plan_actions.ts`    | `EventLogger`               | `services/event_logger.ts`           |
| `command_builders/request_actions.ts` | `EventLogger`               | `services/event_logger.ts`           |

### Category 3: Config Layer (2 imports in non-root files)

| CLI File                      | Imports         | Source Module       |
| ----------------------------- | --------------- | ------------------- |
| `commands/portal_commands.ts` | `ConfigService` | `config/service.ts` |
| `commands/daemon_commands.ts` | `ConfigService` | `config/service.ts` |
| `init.ts`                     | `ConfigService` | `config/service.ts` |

### Category 4: AI Layer (1 import in non-root files)

| CLI File                    | Imports                             | Source Module                           |
| --------------------------- | ----------------------------------- | --------------------------------------- |
| `commands/flow_commands.ts` | `IModelProvider`                    | `ai/types.ts`                           |
| `init.ts`                   | `IModelProvider`, `ProviderFactory` | `ai/types.ts`, `ai/provider_factory.ts` |

> **Note:** `IModelProvider` is already an interface. It is permitted until `src/ai/types.ts` is relocated to `src/shared/` in a future phase.

### Category 5: Shared Helpers (4 imports, 3 modules)

Utilities currently in `src/helpers/` that may be CLI-exclusive.

| Module                         | Used By                                                                  |
| ------------------------------ | ------------------------------------------------------------------------ |
| `helpers/command_utils.ts`     | `plan_commands.ts`, `blueprint_commands.ts`, `request_create_handler.ts` |
| `helpers/request_enricher.ts`  | `plan_commands.ts`                                                       |
| `helpers/subject_generator.ts` | `request_create_handler.ts`                                              |

### Category 6: Parsers (1 import)

| CLI File                    | Imports             | Source Module         |
| --------------------------- | ------------------- | --------------------- |
| `commands/plan_commands.ts` | `FrontmatterParser` | `parsers/markdown.ts` |

> **Note:** `FrontmatterParser` is a cross-cutting infrastructure concern (like `@std/path`). It is treated as an allowed import and is not a boundary violation.

---

## Refactoring Plan

### Step 1: Audit & Classify Helpers

**Objective**: Determine which `src/helpers/` files are CLI-exclusive vs. shared with core/services.

**Actions:**

For each of `command_utils.ts`, `request_enricher.ts`, `subject_generator.ts`: run:

```bash
grep -rn 'from.*helpers/command_utils\|request_enricher\|subject_generator' src/ --include="*.ts" | grep -v src/cli/
```

**Success Criteria:**

- Every helper is classified as: (a) migrate to `src/cli/helpers/`, (b) stay in `src/helpers/`, or (c) move to `src/shared/`.
- `deno check src/` still passes (classification only — no moves yet).

---

### Step 2: Move CLI-Owned Helpers into `src/cli/helpers/`

**Objective**: Relocate helpers that are exclusively used by the CLI from `src/helpers/` to `src/cli/helpers/`, eliminating cross-boundary imports (mirrors Phase 43 Step 4).

**Expected moves (pending Step 1 confirmation):**

| Current Path                       | New Path                               |
| ---------------------------------- | -------------------------------------- |
| `src/helpers/command_utils.ts`     | `src/cli/helpers/command_utils.ts`     |
| `src/helpers/request_enricher.ts`  | `src/cli/helpers/request_enricher.ts`  |
| `src/helpers/subject_generator.ts` | `src/cli/helpers/subject_generator.ts` |

**Actions:**

1. Move each file.

1.

**Success Criteria:**

- `deno check src/ tests/` passes with zero errors.
- `grep -rn 'from.*cli/helpers' src/ --include="*.ts" | grep -v src/cli/` returns empty.
- All tests pass.

---

### Step 3: Define Missing Service Interfaces in `src/shared/interfaces/`

**Objective**: For each core service capability the CLI consumes that does not yet have an interface in `src/shared/interfaces/`, define one.

**Interfaces to add:**

#### `IFlowValidatorService`

```typescript
export interface IFlowValidatorService {
  validate(flow: unknown): Promise<IFlowValidationResult>;
  validateFile(path: string): Promise<IFlowValidationResult>;
}
```

#### `IArchiveService`

```typescript
export interface IArchiveService {
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  list(): Promise<IArchiveEntry[]>;
}
```

#### `IContextCardGeneratorService`

```typescript
export interface IContextCardGeneratorService {
  generate(portal: string, options?: IContextCardOptions): Promise<string>;
}
```

#### `ISkillsService`

```typescript
export interface ISkillsService {
  list(): Promise<ISkillEntry[]>;
  get(id: string): Promise<ISkillEntry>;
}
```

#### `IDisplayService` (wraps `EventLogger`)

```typescript
export interface IDisplayService {
  info(action: string, entity: string, data?: JSONObject): void;
  error(action: string, entity: string, data?: JSONObject): void;
  warn(action: string, entity: string, data?: JSONObject): void;
  debug(action: string, entity: string, data?: JSONObject): void;
}
```

#### `IConfigService`

- Check whether `src/shared/interfaces/i_config_service.ts` already exists from Phase 43.
- If not, create it exposing `get<T>(key: string): T` and `getAll(): Config`.

**Rules for all interfaces:**

- Use only types from `src/shared/` — no circular imports.
- Every new interface file must be re-exported from `src/shared/interfaces/mod.ts`.

**Success Criteria:**

- `deno check src/shared/interfaces/*.ts` passes.
- All interfaces use only `src/shared/` types.
- `src/shared/interfaces/mod.ts` barrel is updated.

---

### Step 4: Implement Service Adapters in `src/services/adapters/`

**Objective**: Create adapter classes that implement the new interfaces and delegate to existing concrete service implementations. These live core-side so no CLI command file ever needs to import a concrete service.

**New adapters to create:**

| Adapter File                                      | Implements                     | Delegates To                           |
| ------------------------------------------------- | ------------------------------ | -------------------------------------- |
| `src/services/adapters/flow_validator_adapter.ts` | `IFlowValidatorService`        | `FlowValidatorImpl`                    |
| `src/services/adapters/archive_adapter.ts`        | `IArchiveService`              | `ArchiveService`                       |
| `src/services/adapters/context_card_adapter.ts`   | `IContextCardGeneratorService` | `ContextCardGenerator`                 |
| `src/services/adapters/skills_adapter.ts`         | `ISkillsService`               | `SkillsService`                        |
| `src/services/adapters/display_adapter.ts`        | `IDisplayService`              | `EventLogger`                          |
| `src/services/adapters/config_adapter.ts`         | `IConfigService`               | `ConfigService` (if not from Phase 43) |
| `src/services/adapters/mod.ts`                    | Barrel                         | Add new adapters                       |

**Example pattern (consistent with Phase 43):**

```typescript
// src/services/adapters/flow_validator_adapter.ts
import type { IFlowValidatorService } from "../../shared/interfaces/i_flow_validator_service.ts";
import { FlowValidatorImpl } from "../flow_validator.ts";

export class FlowValidatorAdapter implements IFlowValidatorService {
  constructor(private inner: FlowValidatorImpl) {}
  async validate(flow: unknown) {
    return await this.inner.validate(flow);
  }
  async validateFile(path: string) {
    return await this.inner.validateFile(path);
  }
}
```

**Success Criteria:**

- Each adapter compiles via `deno check`.
- Each adapter correctly delegates all interface methods.
- `src/services/adapters/mod.ts` exports all new adapters.

**Planned Tests:**

| Test File                                                | Pattern                                                   |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `tests/services/adapters/flow_validator_adapter_test.ts` | Mock `FlowValidatorImpl`, call adapter, verify delegation |
| `tests/services/adapters/archive_adapter_test.ts`        | Mock `ArchiveService`, call adapter, verify delegation    |
| `tests/services/adapters/context_card_adapter_test.ts`   | Mock `ContextCardGenerator`, verify delegation            |
| `tests/services/adapters/skills_adapter_test.ts`         | Mock `SkillsService`, verify delegation                   |
| `tests/services/adapters/display_adapter_test.ts`        | Mock `EventLogger`, verify delegation                     |

---

### Step 5: Define `ICliApplicationContext`

**Objective**: Create a typed context bundle analogous to Phase 43's `ITuiApplicationContext`, used by all CLI command/handler/formatter files.

**File to create:** `src/cli/cli_context.ts`

```typescript
// src/cli/cli_context.ts
import type { IDatabaseService } from "../shared/interfaces/i_database_service.ts";
import type { IModelProvider } from "../ai/types.ts";
import type { IGitService } from "../shared/interfaces/i_git_service.ts";
import type { IDisplayService } from "../shared/interfaces/i_display_service.ts";
import type { IConfigService } from "../shared/interfaces/i_config_service.ts";
import type { IMemoryService } from "../shared/interfaces/i_memory_service.ts";
import type { IArchiveService } from "../shared/interfaces/i_archive_service.ts";
import type { IFlowValidatorService } from "../shared/interfaces/i_flow_validator_service.ts";
import type { IContextCardGeneratorService } from "../shared/interfaces/i_context_card_generator_service.ts";
import type { ISkillsService } from "../shared/interfaces/i_skills_service.ts";
import type { IPortalService } from "../shared/interfaces/i_portal_service.ts";
import type { IRequestService } from "../shared/interfaces/i_request_service.ts";
import type { IPlanService } from "../shared/interfaces/i_plan_service.ts";

export interface ICliApplicationContext {
  db: IDatabaseService;
  provider: IModelProvider;
  git: IGitService;
  display: IDisplayService;
  config: IConfigService;
  memory: IMemoryService;
  archive: IArchiveService;
  flowValidator: IFlowValidatorService;
  contextCards: IContextCardGeneratorService;
  skills: ISkillsService;
  portals: IPortalService;
  requests: IRequestService;
  plans: IPlanService;
}
```

**Files to modify:**

- `src/cli/base.ts` — Replace `ICommandContext` with `ICliApplicationContext`, or have `ICommandContext` extend it. Replace the direct `EventLogger` reference with `IDisplayService`.

**Success Criteria:**

- `ICliApplicationContext` uses only `src/shared/interfaces/` types (plus `src/ai/types.ts` for `IModelProvider`).
- `src/cli/base.ts` compiles using the updated context type.
- All command constructors that receive `ICommandContext` still compile.

---

### Step 6: Refactor CLI Commands, Handlers, Formatters, and Action Builders

**Objective**: Replace all direct imports of concrete service classes and the config/AI layer inside `src/cli/commands/`, `src/cli/handlers/`, `src/cli/formatters/`, and `src/cli/command_builders/`.

**Files to modify:**

| File                                  | Remove                                                                                                       | Replace With (via `ICliApplicationContext`)                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `commands/memory_commands.ts`         | `MemoryBankService`, `MemoryExtractorService`, `MemoryEmbeddingService`, `SkillsService`, `IDatabaseService` | `ctx.memory`, `ctx.skills`, `ctx.db`                         |
| `commands/portal_commands.ts`         | `ContextCardGenerator`, `ConfigService`, `IDatabaseService`, `EventLogger`                                   | `ctx.contextCards`, `ctx.config`, `ctx.db`, `ctx.display`    |
| `commands/flow_commands.ts`           | `FlowValidatorImpl`, `EventLogger`, `IDatabaseService`, `IModelProvider`                                     | `ctx.flowValidator`, `ctx.display`, `ctx.db`, `ctx.provider` |
| `commands/daemon_commands.ts`         | `ConfigService`                                                                                              | `ctx.config`                                                 |
| `commands/archive_commands.ts`        | `ArchiveService`                                                                                             | `ctx.archive`                                                |
| `commands/review_commands.ts`         | `GitService`, `IGitService`                                                                                  | `ctx.git`                                                    |
| `commands/plan_commands.ts`           | `CommandUtils`, `enrichWithRequest` (if moved)                                                               | `src/cli/helpers/` equivalents                               |
| `commands/blueprint_commands.ts`      | `CommandUtils` (if moved)                                                                                    | `src/cli/helpers/` equivalent                                |
| `handlers/request_create_handler.ts`  | `CommandUtils`, `resolveSubject` (if moved)                                                                  | `src/cli/helpers/` equivalents                               |
| `formatters/journal_formatter.ts`     | `ActivityRecord` from `services/db.ts`                                                                       | type from `src/shared/types/database.ts`                     |
| `command_builders/plan_actions.ts`    | `EventLogger`                                                                                                | `IDisplayService` from shared                                |
| `command_builders/request_actions.ts` | `EventLogger`                                                                                                | `IDisplayService` from shared                                |

**Remaining allowed cross-boundary imports in non-root CLI files:**

- `src/shared/**` — interfaces, types, enums, constants, schemas, status.
- `src/cli/**` — internal helpers, context definition, base class.
- `src/parsers/markdown.ts` — cross-cutting infrastructure; permitted.
- `src/ai/types.ts` — `IModelProvider` is an interface; permitted until moved to `src/shared/`.

**Success Criteria:**

- Zero imports from `src/services/` (concrete) in `commands/`, `handlers/`, `formatters/`, `command_builders/`.
- Zero imports from `src/config/service.ts` in those directories.
- `deno check src/cli/**/*.ts` passes.
- All CLI tests pass.

**Boundary Quick-Check:**

```bash
# Both must return empty after this step
grep -rn 'from ".*\.\./services/' src/cli/commands/ src/cli/handlers/ src/cli/formatters/ src/cli/command_builders/
grep -rn 'from ".*\.\./config/service' src/cli/commands/ src/cli/handlers/ src/cli/formatters/ src/cli/command_builders/
```

---

### Step 7: Update Composition Root (`init.ts` / `exactl.ts`)

**Objective**: Ensure `src/cli/init.ts` builds a fully-formed `ICliApplicationContext` using real adapter instances, and `src/cli/exactl.ts` passes that bundle to command constructors.

**Files to modify:**

- `src/cli/init.ts` — Instantiate all adapters; return `ICliApplicationContext` from `initializeServices()`. This file **remains allowed** to import concrete implementations — it is the composition root.
- `src/cli/exactl.ts` — Accept `ICliApplicationContext` from `init.ts` and pass it to each command constructor instead of scattering individual raw services.

**Success Criteria:**

- `deno task cli request list`, `plan list`, `portal list`, `memory list`, `daemon status` all function correctly.
- `deno check src/cli/exactl.ts` passes.
- All existing CLI integration tests pass.

---

### Step 8: Add CI Boundary Guard

**Objective**: Prevent future regressions by extending the checks in `scripts/check_code_style.ts` (established in Phase 43 for TUI) to cover the CLI boundary.

**Files to modify:**

- `scripts/check_code_style.ts` — Add rules:
  - `[cli-boundary-services]`: Fail if `src/cli/commands/**`, `src/cli/handlers/**`, `src/cli/formatters/**`, or `src/cli/command_builders/**` import from `../../services/` except via `../../services/adapters/`.
  - `[cli-boundary-config]`: Fail if those directories import from `../../config/service`.
  - `[core-boundary-cli-helpers]`: Fail if any file **outside** `src/cli/` imports from `src/cli/helpers/`.
- `CODE_STYLE.md` — Add §8 "CLI Isolation" (or extend §7) documenting the new rules as an architectural requirement.

**Success Criteria:**

- Pre-commit checks catch a forbidden `../../services/MemoryBankService` import introduced into any command file.
- `deno run -A scripts/check_code_style.ts` reports zero violations on clean code.

---

## Execution Batches

| Batch                 | Steps                           | Scope           | Status     |
| --------------------- | ------------------------------- | --------------- | ---------- |
| **1 — Discovery**     | Step 1 (classify helpers)       | Research        | ✅ DONE    |
| **2 — Consolidation** | Step 2 (move helpers)           | Refactoring     | ✅ DONE    |
| **3 — Contracts**     | Step 3 (interfaces)             | Architecture    | ✅ DONE    |
| **4 — Bridges**       | Step 4 (adapters + tests)       | Architecture    | ✅ DONE    |
| **5 — Context**       | Step 5 (ICliApplicationContext) | Architecture    | ✅ DONE    |
| **6 — Migration**     | Step 6 (command refactoring)    | The bulk effort | ✅ DONE    |
| **7 — Integration**   | Step 7 (composition root)       | Integration     | ✅ DONE    |
| **8 — Guard**         | Step 8 (CI check)               | CI/CD           | ✅ DONE    |

---

## Architectural Decisions

- **Reuse Phase 43 adapters**: `RequestServiceAdapter`, `PlanServiceAdapter`, `PortalServiceAdapter`, `DaemonServiceAdapter`, and `AgentServiceAdapter` already exist in `src/services/adapters/` and are reused as-is. Only the five new adapters (Step 4) need to be created.
- **Composition root exception**: `src/cli/init.ts` and `src/cli/exactl.ts` remain explicitly allowed to import concrete implementations — they are the wiring layer and must construct and assemble all adapters.
- **`FrontmatterParser` is infrastructure**: `src/parsers/markdown.ts` is treated like `@std/path` — a cross-cutting parsing utility with no service-layer concerns. CLI files may import it directly; it is not a boundary violation.
- **`IModelProvider` is already abstract**: `src/ai/types.ts` exposes only an interface. CLI files may continue importing it until `src/ai/types.ts` is relocated to `src/shared/` in a dedicated future phase.
- **`IDisplayService` wraps `EventLogger`**: Rather than leaking the concrete `EventLogger` into commands, all display/logging calls go through the narrow `IDisplayService` interface. The `DisplayAdapter` in core satisfies the contract.
- **No changes to public API**: Every CLI command (`request`, `plan`, `portal`, `memory`, `daemon`, etc.) retains identical flags, arguments, and output formats throughout this refactoring.

---

## Backward Compatibility

- This is a **pure structural refactoring**. No CLI commands, flags, output formats, or user-facing behaviour change.
- The composition root (`init.ts`, `exactl.ts`) continues to wire real implementations — runtime behaviour is unchanged.
- Existing tests remain valid; new adapter unit tests supplement coverage.

## Out of Scope

- Moving `src/cli/` to a separate Git repository (future phase).
- Redesigning CLI output formatting or UX.
- Changing core business logic or data formats.
- Moving `src/ai/types.ts` to `src/shared/` (separate refactoring phase).

---

## Verification Plan

### Automated Tests

| Command                                   | Purpose                       |
| ----------------------------------------- | ----------------------------- |
| `deno check src/`                         | Full type-safety verification |
| `deno check src/cli/**/*.ts`              | CLI-specific type check       |
| `deno test tests/ --allow-all`            | Full regression suite         |
| `deno run -A scripts/check_code_style.ts` | Boundary enforcement          |

### Boundary Validation

```bash
# Must all return empty after Step 6
grep -rn 'from ".*\.\./services/' src/cli/commands/ src/cli/handlers/ src/cli/formatters/ src/cli/command_builders/
grep -rn 'from ".*\.\./config/service' src/cli/commands/ src/cli/handlers/ src/cli/formatters/ src/cli/command_builders/
grep -rn 'from ".*cli/helpers' src/ --include="*.ts" | grep -v src/cli/
```

### Manual Smoke Tests

`deno task cli request list` — Request listing works.
