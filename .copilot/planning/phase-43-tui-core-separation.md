# Phase 43: TUI and Core Separation

## Status: NOT_STARTED

Decouple the TUI implementation from the ExoFrame core by enforcing a strict interface-driven boundary. This is a prerequisite for moving the TUI into a separate Git repository (Phase 44).

## Executive Summary

**Problem:**
The TUI codebase (`src/tui/`, 46 files) has deep, direct imports into core modules — CLI command classes, service implementations, database layers, helpers, enums, and domain-specific status modules. This tight coupling prevents the TUI from being developed, tested, or versioned independently.

**Solution:**
Define formal service interfaces that the TUI consumes, implement adapter classes in the core that satisfy those interfaces, and refactor all TUI files to depend **only** on:
1. **Service Interfaces** (e.g., `IRequestService`, `IPlanService`).
2. **Shared Data Types** (schemas, enums, constants).
3. **TUI-owned Utilities** (helpers that are purely TUI concerns).

The result: `src/tui/` has zero imports pointing to `src/cli/`, `src/services/`, or `src/config/`. Only imports from `src/shared/` (the interface + schema layer) and within `src/tui/` itself are permitted.

---

## Current Dependency Audit

The following is a complete inventory of all imports from `src/tui/**/*.ts` that reach outside `src/tui/`.

### Category 1: CLI Command Classes (4 imports, 3 modules)

These are the most architecturally problematic — the TUI imports **concrete classes** from the CLI layer.

| TUI File | Imports | Source Module |
|---|---|---|
| `plan_reviewer_view.ts` | `IPlanMetadata`, `PlanCommands` | `cli/commands/plan_commands.ts` |
| `portal_manager_view.ts` | `IPortalDetails`, `IPortalInfo` | `cli/commands/portal_commands.ts` |
| `request_manager_view.ts` | `RequestCommands` | `cli/commands/request_commands.ts` |
| `tui_dashboard.ts` | `IPortalInfo` | `cli/commands/portal_commands.ts` |

### Category 2: Core Services (15 imports, 6 modules)

Direct dependencies on service implementations and database abstractions.

| TUI File | Imports | Source Module |
|---|---|---|
| `monitor_view.ts` | `ActivityRecord`, `JournalFilterOptions` | `services/db.ts` |
| `memory_view.ts` | `DatabaseService` | `services/db.ts` |
| `tui_dashboard.ts` | `IDatabaseService` | `services/db.ts` |
| `tui_dashboard_mocks.ts` | `JournalFilterOptions` | `services/db.ts` |
| `memory_view.ts` | `MemoryBankService` (+ 3 types) | `services/memory_bank.ts` |
| `memory_view.ts` | `MemoryExtractorService` | `services/memory_extractor.ts` |
| `memory_view.ts` | `MemoryEmbeddingService` | `services/memory_embedding.ts` |
| `tui_dashboard.ts` | `INotificationService`, `IMemoryNotification` | `services/notification.ts` |
| `structured_log_service.ts` | `IStructuredLogEntry`, `StructuredLogger` | `services/structured_logger.ts` |
| `structured_log_viewer.ts` | `IStructuredLogEntry`, `IStructuredLogger` | `services/structured_logger.ts` |
| `tui_dashboard_mocks.ts` | `IStructuredLogEntry`, `IStructuredLogger` | `services/structured_logger.ts` |
| `log_renderer.ts` | `IStructuredLogEntry` | `services/structured_logger.ts` |
| `tui_log_output.ts` | `ILogOutput`, `IStructuredLogEntry` | `services/structured_logger.ts` |
| `log_stream.ts` | `IStructuredLogEntry` | `services/structured_logger.ts` |

### Category 3: Shared Helpers (30+ imports, 10 modules)

Utilities used by the TUI for rendering, dialogs, keyboard, and tree-view mechanics. **Some of these are TUI-specific and should move with the TUI; others are truly shared.**

| Module | Used By (count) | Classification |
|---|---|---|
| `helpers/tree_view.ts` | 7 files | **TUI-owned** (move with TUI) |
| `helpers/dialog_base.ts` | 6 files | **TUI-owned** |
| `helpers/keyboard.ts` | 8 files | **TUI-owned** |
| `helpers/help_renderer.ts` | 5 files | **TUI-owned** |
| `helpers/constants.ts` | 4 files | **Split** (some TUI, some core) |
| `helpers/spinner.ts` | 2 files | **TUI-owned** |
| `helpers/colors.ts` | 1 file | **TUI-owned** |
| `helpers/layout_rendering.ts` | 1 file | **TUI-owned** |
| `helpers/markdown_renderer.ts` | 1 file | **TUI-owned** |
| `helpers/status_bar.ts` | indirect | **TUI-owned** |

### Category 4: Enums (15 imports, 1 module)

| Enums Used | Used By (count) |
|---|---|
| `DialogStatus` | 6 files |
| `MessageType` | 5 files |
| `LogLevel` | 3 files |
| `TuiIcon`, `TuiGroupBy`, `TuiNodeType` | 2 files |
| `AgentHealth`, `PortalStatus` | 1 file each |
| `RequestPriority`, `RequestDialogType` | 1 file each |
| `MemorySource`, `SkillStatus` | 1 file each |

### Category 5: Config & Schemas (3 + 1 imports)

| TUI File | Imports | Source Module |
|---|---|---|
| `agent_status_view.ts` | `DEFAULT_QUERY_LIMIT` | `config/constants.ts` |
| `memory_view.ts` | `Config` (type) | `config/schema.ts` |
| `log_renderer.ts` | Constants | `config/constants.ts` |
| `memory_view.ts` | Schema types | `schemas/memory_bank.ts` |

### Category 6: Domain Types & Status Modules (5 imports)

| TUI File | Imports | Source Module |
|---|---|---|
| `request_manager_view.ts` | `RequestStatus`, `RequestStatusType`, `isRequestStatus` | `requests/request_status.ts` |
| `tui_dashboard_mocks.ts` | `RequestStatus`, `RequestStatusType` | `requests/request_status.ts` |
| `plan_reviewer_view.ts` | `PlanStatus`, `PlanStatusType`, `coercePlanStatus` | `plans/plan_status.ts` |
| `tui_dashboard_mocks.ts` | `MemoryStatus` | `memory/memory_status.ts` |

### Category 7: Core Types (4 imports)

| TUI File | Imports | Source Module |
|---|---|---|
| `monitor_view.ts` | `JSONObject` | `types.ts` |
| `plan_reviewer_view.ts` | `JSONObject` | `types.ts` |
| `log_stream.ts` | `JSONObject` | `types.ts` |
| `tui_dashboard_mocks.ts` | `JSONValue` | `types.ts` |

---

## Refactoring Plan

### Step 1: Create `src/shared/` Directory Structure

**Objective**: Establish a neutral, stable directory for types, interfaces, enums, and schemas that both the core and TUI can depend on. This directory becomes the **only allowed cross-boundary import path**.

**Files to create/move:**

```
src/shared/
  interfaces/
    request_service.ts     [NEW] IRequestService interface
    plan_service.ts        [NEW] IPlanService interface
    portal_service.ts      [NEW] IPortalService interface
    memory_service.ts      [NEW] IMemoryService interface
    journal_service.ts     [NEW] IJournalService interface
    log_service.ts         [NEW] ILogService interface
    notification_service.ts [NEW] INotificationService interface (re-export)
    daemon_service.ts      [NEW] IDaemonService interface
    config_service.ts      [NEW] IConfigService interface
    mod.ts                 [NEW] Barrel export
  types/
    json.ts                [MOVE from src/types.ts — JSONObject, JSONValue]
    mod.ts                 [NEW] Barrel export
  enums.ts                 [MOVE from src/enums.ts]
  schemas/
    memory_bank.ts         [MOVE from src/schemas/memory_bank.ts]
    plan_schema.ts         [MOVE from src/schemas/plan_schema.ts]
    mod.ts                 [NEW] Barrel export
  status/
    request_status.ts      [MOVE from src/requests/request_status.ts]
    plan_status.ts         [MOVE from src/plans/plan_status.ts]
    memory_status.ts       [MOVE from src/memory/memory_status.ts]
    mod.ts                 [NEW] Barrel export
  constants.ts             [MOVE from src/config/constants.ts]
```

**Success Criteria:**
- `deno check src/shared/**/*.ts` passes.
- All existing imports from `src/enums.ts`, `src/types.ts`, `src/schemas/`, `src/requests/request_status.ts`, `src/plans/plan_status.ts`, `src/memory/memory_status.ts`, and `src/config/constants.ts` are updated project-wide to point to `src/shared/`.
- All existing tests pass unchanged.

**Planned Tests:**
- `deno test --allow-all` — Full regression.
- Verify zero import errors with `deno check src/ tests/`.

---

### Step 2: Define Service Interfaces

**Objective**: For each core capability the TUI consumes, define a TypeScript interface in `src/shared/interfaces/`.

**Interfaces to define:**

#### `IRequestService`
```typescript
export interface IRequestService {
  list(): Promise<IRequestEntry[]>;
  show(id: string): Promise<IRequestShowResult>;
  create(description: string, options: IRequestCreateOptions): Promise<void>;
  delete(id: string): Promise<void>;
  approve(id: string): Promise<void>;
}
```

#### `IPlanService`
```typescript
export interface IPlanService {
  list(): Promise<IPlanMetadata[]>;
  show(id: string): Promise<IPlanShowResult>;
  approve(id: string, options?: { skills?: string[] }): Promise<void>;
  reject(id: string, reason: string): Promise<void>;
  execute(id: string): Promise<void>;
}
```

#### `IPortalService`
```typescript
export interface IPortalService {
  list(): Promise<IPortalInfo[]>;
  show(alias: string): Promise<IPortalDetails>;
  add(options: IPortalAddOptions): Promise<void>;
  remove(alias: string): Promise<void>;
  refreshContext(alias: string): Promise<void>;
  verifyIntegrity(alias: string): Promise<IPortalVerifyResult>;
}
```

#### `IMemoryService`
```typescript
export interface IMemoryService {
  listPending(): Promise<IMemoryUpdateProposal[]>;
  approve(id: string): Promise<void>;
  reject(id: string, reason: string): Promise<void>;
  listLearnings(scope: MemoryScope, project?: string): Promise<ILearning[]>;
  listSkills(): Promise<ISkill[]>;
  searchAdvanced(options: IAdvancedSearchOptions): Promise<IMemorySearchResult[]>;
  listExecutionHistory(portal?: string): Promise<IExecutionMemory[]>;
  getProjectMemory(portal: string): Promise<IProjectMemory>;
}
```

#### `IJournalService`
```typescript
export interface IJournalService {
  query(filters: JournalFilterOptions): Promise<ActivityRecord[]>;
  getDistinctValues(field: string): Promise<string[]>;
}
```

#### `ILogService`
```typescript
export interface ILogService {
  readEntries(options: ILogReadOptions): Promise<IStructuredLogEntry[]>;
  tail(callback: (entry: IStructuredLogEntry) => void): ILogSubscription;
}
```

#### `INotificationService` (already partially exists)
```typescript
// Re-export existing INotificationService from src/services/notification.ts
// Move the interface definition to src/shared/interfaces/notification_service.ts
```

#### `IDaemonService`
```typescript
export interface IDaemonService {
  status(): Promise<IDaemonStatus>;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  readLogs(lines: number): Promise<string[]>;
}
```

#### `IConfigService`
```typescript
export interface IConfigService {
  get<T>(key: string): T;
  getAll(): Config;
}
```

**Success Criteria:**
- All 9 interface files compile with `deno check`.
- Interfaces cover **every method** the TUI currently calls on concrete command/service classes.
- Each interface uses only types from `src/shared/` — no circular imports.

**Planned Tests:**
- `deno check src/shared/interfaces/*.ts` — Type-check only (interfaces have no runtime behavior).

---

### Step 3: Implement Service Adapters in Core

**Objective**: Create adapter classes in `src/services/adapters/` that implement the `src/shared/interfaces/` and delegate to existing core logic.

**Files to create:**

| Adapter File | Implements | Delegates To |
|---|---|---|
| `src/services/adapters/request_adapter.ts` | `IRequestService` | `RequestCommands` |
| `src/services/adapters/plan_adapter.ts` | `IPlanService` | `PlanCommands` |
| `src/services/adapters/portal_adapter.ts` | `IPortalService` | `PortalCommands` |
| `src/services/adapters/memory_adapter.ts` | `IMemoryService` | `MemoryBankService`, `MemoryExtractorService`, `MemoryEmbeddingService` |
| `src/services/adapters/journal_adapter.ts` | `IJournalService` | `DatabaseService` |
| `src/services/adapters/log_adapter.ts` | `ILogService` | `StructuredLogger` |
| `src/services/adapters/daemon_adapter.ts` | `IDaemonService` | `DaemonService` |
| `src/services/adapters/config_adapter.ts` | `IConfigService` | `loadConfig()` |
| `src/services/adapters/mod.ts` | Barrel | All adapters |

**Example:**
```typescript
// src/services/adapters/request_adapter.ts
import type { IRequestService } from "../../shared/interfaces/request_service.ts";
import { RequestCommands } from "../../cli/commands/request_commands.ts";

export class RequestServiceAdapter implements IRequestService {
  constructor(private commands: RequestCommands) {}
  async list() { return await this.commands.list(); }
  async show(id: string) { return await this.commands.show(id); }
  // ...
}
```

**Success Criteria:**
- Each adapter passes `deno check`.
- Each adapter correctly delegates all interface methods to the existing core implementations.
- Adapters live in `src/services/adapters/` (core-side, not TUI-side).

**Planned Tests:**
- `tests/services/adapters/request_adapter_test.ts` — Unit test: mock `RequestCommands`, call adapter methods, verify delegation.
- `tests/services/adapters/plan_adapter_test.ts` — Same pattern.
- `tests/services/adapters/portal_adapter_test.ts` — Same pattern.
- `tests/services/adapters/memory_adapter_test.ts` — Same pattern.
- `tests/services/adapters/journal_adapter_test.ts` — Same pattern.
- `tests/services/adapters/log_adapter_test.ts` — Same pattern.

---

### Step 4: Move TUI-Owned Helpers into `src/tui/`

**Objective**: Relocate helpers that are exclusively used by the TUI from `src/helpers/` into `src/tui/helpers/`, eliminating cross-boundary imports.

**Files to move:**

| Current Path | New Path | Justification |
|---|---|---|
| `src/helpers/tree_view.ts` | `src/tui/helpers/tree_view.ts` | Used only by TUI views |
| `src/helpers/dialog_base.ts` | `src/tui/helpers/dialog_base.ts` | Used only by TUI views |
| `src/helpers/keyboard.ts` | `src/tui/helpers/keyboard.ts` | Used only by TUI views |
| `src/helpers/help_renderer.ts` | `src/tui/helpers/help_renderer.ts` | Used only by TUI views |
| `src/helpers/spinner.ts` | `src/tui/helpers/spinner.ts` | Used only by TUI views |
| `src/helpers/colors.ts` | `src/tui/helpers/colors.ts` | Used only by TUI views |
| `src/helpers/layout_rendering.ts` | `src/tui/helpers/layout_rendering.ts` | Used only by TUI views |
| `src/helpers/markdown_renderer.ts` | `src/tui/helpers/markdown_renderer.ts` | Used only by TUI views |
| `src/helpers/status_bar.ts` | `src/tui/helpers/status_bar.ts` | Used only by TUI views |
| `src/helpers/constants.ts` | **Split** | TUI constants → `src/tui/helpers/constants.ts`; core constants stay |

**Pre-Condition Check**: Before moving, verify each helper is **not** imported by any file outside `src/tui/`. If a helper is shared, it stays in `src/helpers/` or moves to `src/shared/`.

**Success Criteria:**
- All moved files compile under their new paths.
- All TUI imports updated to relative `./helpers/` paths.
- No file outside `src/tui/` imports from `src/tui/helpers/`.
- `deno check src/ tests/` passes.
- All tests pass.

**Planned Tests:**
- `deno test --allow-all` — Full regression.
- `grep -rn 'from ".*tui/helpers' src/ --include="*.ts" | grep -v src/tui/` — Must return empty (no cross-boundary leaks).

---

### Step 5: Refactor TUI Files to Use Interfaces

**Objective**: Replace all direct imports of CLI command classes and core service implementations in `src/tui/` with the corresponding service interfaces. Inject implementations via constructor parameters or an Application Context object.

**Approach**: Define a `TuiApplicationContext` that bundles all service interfaces:

```typescript
// src/tui/tui_context.ts
export interface ITuiApplicationContext {
  requests: IRequestService;
  plans: IPlanService;
  portals: IPortalService;
  memory: IMemoryService;
  journal: IJournalService;
  logs: ILogService;
  notifications: INotificationService;
  daemon: IDaemonService;
  config: IConfigService;
}
```

**Files to modify (by dependency category):**

| TUI File | Remove Import Of | Replace With |
|---|---|---|
| `request_manager_view.ts` | `RequestCommands` | `ITuiApplicationContext.requests` |
| `plan_reviewer_view.ts` | `PlanCommands`, `IPlanMetadata` | `ITuiApplicationContext.plans` |
| `portal_manager_view.ts` | `IPortalDetails`, `IPortalInfo` | `ITuiApplicationContext.portals` |
| `tui_dashboard.ts` | `IPortalInfo`, `IDatabaseService` | `ITuiApplicationContext.portals`, `.journal` |
| `monitor_view.ts` | `ActivityRecord`, `JournalFilterOptions` | `ITuiApplicationContext.journal` |
| `memory_view.ts` | `DatabaseService`, `MemoryBankService`, `MemoryExtractorService`, `MemoryEmbeddingService` | `ITuiApplicationContext.memory` |
| `structured_log_service.ts` | `StructuredLogger` | `ITuiApplicationContext.logs` |
| `structured_log_viewer.ts` | `IStructuredLogger` | `ITuiApplicationContext.logs` |

**Remaining allowed imports from `src/shared/`:**
- `src/shared/enums.ts` — Enum values.
- `src/shared/interfaces/*` — Service interfaces.
- `src/shared/schemas/*` — Data type definitions.
- `src/shared/status/*` — Status enums and coercion helpers.
- `src/shared/types/*` — `JSONObject`, `JSONValue`.
- `src/shared/constants.ts` — Shared constant values.

**Success Criteria:**
- Zero imports from `src/cli/` in any `src/tui/` file.
- Zero imports from `src/services/` (concrete classes) in any `src/tui/` file.
- Zero imports from `src/config/` in any `src/tui/` file.
- Only `src/shared/` and `src/tui/` paths appear in TUI imports.
- `deno check src/tui/**/*.ts` passes.
- All TUI tests pass.

**Planned Tests:**
- `deno test tests/tui/ --allow-all` — All TUI tests pass.
- **Boundary Validation Script** (new `scripts/validate_tui_boundary.sh`):
  ```bash
  #!/bin/bash
  # Fail if any TUI file imports from forbidden core paths
  VIOLATIONS=$(grep -rn 'from "\.\./cli/' src/tui/ --include="*.ts")
  VIOLATIONS+=$(grep -rn 'from "\.\./services/' src/tui/ --include="*.ts")
  VIOLATIONS+=$(grep -rn 'from "\.\./config/' src/tui/ --include="*.ts")
  if [ -n "$VIOLATIONS" ]; then
    echo "❌ TUI boundary violations found:"
    echo "$VIOLATIONS"
    exit 1
  fi
  echo "✅ TUI boundary clean"
  ```

---

### Step 6: Update TUI Entry Point and Launch Logic

**Objective**: Ensure `exoctl tui` constructs the `TuiApplicationContext` with real adapter instances and passes it to the TUI entry point.

**Files to modify:**

- `src/cli/commands/tui_commands.ts` — Instantiate all adapters, create `TuiApplicationContext`, pass to `TuiDashboard`.
- `src/tui/tui_dashboard.ts` — Accept `ITuiApplicationContext` instead of individual service references.

**Success Criteria:**
- `exoctl tui` launches with no errors.
- All TUI functionality works identically to before.
- TUI Dashboard constructor signature uses `ITuiApplicationContext` only.

**Planned Tests:**
- Manual: `exoctl tui` → navigate all views → verify no regressions.
- `deno test tests/tui/tui_dashboard*` — Dashboard tests pass.

---

### Step 7: Add CI Boundary Guard

**Objective**: Prevent future regressions by adding a CI check that fails if any `src/tui/` file imports from forbidden paths.

**Files to create:**
- `scripts/validate_tui_boundary.sh` — The script from Step 5.

**Files to modify:**
- `.github/workflows/ci.yml` (or equivalent) — Add step: `bash scripts/validate_tui_boundary.sh`.
- `deno.json` tasks — Add `"validate:tui-boundary": "bash scripts/validate_tui_boundary.sh"`.

**Success Criteria:**
- CI passes with the new boundary check.
- Introducing a direct `src/services/` import in a TUI file causes CI to fail.

**Planned Tests:**
- Intentionally add a forbidden import, verify CI fails, then revert.

---

## Execution Batches

| Batch | Steps | Scope | Risk |
|---|---|---|---|
| **1 — Foundation** | Step 1 (shared directory) | Infrastructure | Low — pure file moves |
| **2 — Contracts** | Step 2 (interfaces) | Architecture | Low — new files only |
| **3 — Bridges** | Step 3 (adapters) | Architecture | Medium — must match runtime behavior |
| **4 — Consolidation** | Step 4 (helper moves) | Refactoring | Medium — many import updates |
| **5 — Migration** | Step 5 (TUI refactoring) | The bulk effort | High — touches all 46 TUI files |
| **6 — Integration** | Step 6 (launch logic) | Integration | Medium — end-to-end validation |
| **7 — Guard** | Step 7 (CI check) | CI/CD | Low — script + config |

---

## Backward Compatibility

- This is a **pure structural refactoring**. No file formats, CLI commands, or user-facing behavior change.
- The `src/shared/` directory re-exports everything that was previously in `src/enums.ts`, `src/types.ts`, etc. Old import paths can be maintained temporarily via re-export stubs if needed.
- Existing TUI functionality is preserved 100%.

## Out of Scope

- Moving the TUI code to a separate Git repository (Phase 44).
- Redesigning the TUI layout or views (TUI Redesign Concept).
- Changing core business logic, algorithms, or data formats.
- Adding new TUI features.

---

## Verification Plan

### Automated Tests

| Command | Purpose |
|---|---|
| `deno check src/` | Full type-safety verification |
| `deno check src/tui/**/*.ts` | TUI-specific type check |
| `deno test tests/tui/ --allow-all` | All TUI unit/integration tests |
| `deno test --allow-all` | Full regression suite |
| `bash scripts/validate_tui_boundary.sh` | Import boundary enforcement |

### Manual Verification

1. Run `exoctl tui` and navigate through all views: Request Manager, Plan Reviewer, Portal Manager, Memory View, Agent Status, Monitor, Daemon Control, Structured Logs, Skills Manager.
2. Perform a create → approve → execute cycle through the TUI.
3. Verify notification toasts and status bar updates work.
4. Verify the Memory View sub-tabs (Pending, Projects, Executions, Global, Skills) all load correctly.
