# Phase 43: TUI and Core Separation

## Status: IN_PROGESS

Decouple the TUI implementation from the ExoFrame core by enforcing a strict interface-driven boundary. This is a prerequisite for moving the TUI into a separate repository and integrating it as a Git submodule.

## Executive Summary

**Problem:**
Currently, the TUI codebase in `src/tui` has direct dependencies on various core services and internal utilities. This tight coupling makes it difficult to maintain the TUI as an independent project or to swap core implementations without breaking the TUI. It also complicates the migration to a Git submodule structure.

**Solution:**
Identify and formalize all interaction points between the TUI and the core. All core functionalities required by the TUI must be accessed through:
1. **Strictly defined Service Interfaces**: Centralized in a shared location (e.g., `src/services/interfaces/`).
2. **CLI Callbacks/Events**: For lifecycle management.
3. **Data Schemas**: Shared Zod schemas and TypeScript interfaces for data exchange.

By the end of this phase, the TUI should be able to run against any implementation of these interfaces, making it truly portable and ready for extraction.

---

## Goals

- [ ] Audit all direct imports from `src/` inside `src/tui`.
- [ ] Define shared service interfaces for all core capabilities:
    - [ ] `IRepositoryService` (Git operations)
    - [ ] `IRequestService` (Request lifecycle)
    - [ ] `IPlanService` (Plan lifecycle)
    - [ ] `IReviewService` (Review lifecycle)
    - [ ] `IMemoryService` (Memory Bank access)
    - [ ] `IAgentService` (Agent status and control)
    - [ ] `IConfigService` (Settings and configuration)
    - [ ] `IJournalService` (Activity journal access)
- [ ] Create `ServiceAdapters` in the core that implement these interfaces.
- [ ] Refactor `src/tui` to depend only on interfaces and shared schemas.
- [ ] Move shared interfaces and schemas to a stable, shared root (e.g., `src/shared/`).
- [ ] Ensure the TUI entry point is isolated and callable via a formal CLI registration.
- [ ] Verify that the TUI can be "mocked" or run against a fake service implementation for independent testing.

---

## Detailed Design

### 1. Interface Boundary Specification

The TUI will no longer import classes directly from `src/services/` or `src/cli/`. Instead, it will receive an "Application Context" or a set of service providers upon initialization.

| Category | Interaction Method | Example |
|---|---|---|
| **Data Fetching** | Shared Interfaces | `IRequestService.list()` |
| **Command Execution**| Shared Interfaces | `IPlanService.approve(id)` |
| **Configuration** | Shared Interfaces | `IConfigService.get('system.log_level')` |
| **State/Events** | EventEmitter / RxJS | Notifications, Status updates |
| **Data Types** | Shared Schemas | `IRequestEntry`, `PlanSchema` |

### 2. Service Adapter Pattern

We will implement "Adapters" that wrap existing core functionality into the new TUI-specific interfaces. This allows the core to evolve independently as long as it maintains the interface contract.

```typescript
// src/tui/services/request_service.ts
export interface IRequestService {
  list(): Promise<IRequestEntry[]>;
  show(id: string): Promise<IRequestShowResult>;
  create(desc: string, opts: any): Promise<IRequestEntry>;
}

// src/services/adapters/tui_request_adapter.ts
export class TuiRequestAdapter implements IRequestService {
  constructor(private coreCommands: RequestCommands) {}
  async list() {
    return await this.coreCommands.list();
  }
  // ...
}
```

### 3. Shared Directory Structure

To facilitate the submodule move, we need to clearly identify what constitutes "Shared" code (required by both Core and TUI).

```
src/
  shared/           <-- Will be mirrored or imported by TUI Repo
    interfaces/     <-- IRequestService, etc.
    schemas/        <-- z.PlanSchema, etc.
    types/          <-- IRequestEntry, etc.
    enums.ts        <-- Common enums
  core/             <-- Main engine logic
  tui/              <-- To be moved to submodule
```

---

## Refactoring Plan

### Step 1. Dependency Audit & Interface Definition
**Objective**: Catalog all current TUI-Core touchpoints and draft the initial interfaces.
- Run dependency analysis on `src/tui`.
- Define the `IApplicationContext` that will be passed to the TUI.

### Step 2. Establishing the Shared Root
**Objective**: Move common schemas and types to a neutral `src/shared` directory.
- Relocate `src/schemas/*` to `src/shared/schemas/*`.
- Relocate `src/enums.ts` to `src/shared/enums.ts`.
- Ensure imports across the entire project are updated.

### Step 3. Implementing Core Service Adapters
**Objective**: Create the bridge between core logic and the new interfaces.
- Implement adapters for all major services (Request, Plan, Review, etc.).
- These adapters should reside in `src/core/adapters/` (or similar).

### Step 4. TUI Refactoring (The Bulk Effort)
**Objective**: Update all TUI components to use interfaces instead of direct core imports.
- Inject service implementations into TUI views.
- Remove all direct imports from `src/services`, `src/cli/handlers`, etc.
- Verify everything still works.

### Step 5. Integration & Launch Logic
**Objective**: Formalize how `exoctl tui` launches the application.
- Update `TuiCommands` to instantiate the Application Context and pass it to the TUI entry point.
- Ensure the TUI has no knowledge of how its services are implemented.

---

## Backward Compatibility
- This is a structural refactoring; no file formats or user-facing CLI behavior should change.
- Existing TUI functionality must be preserved 100%.

## Out of Scope
- Actually moving the code to a new Git repository (this is the subject of Phase 44).
- Redesigning the TUI layout (covered under TUI Redesign Concept).
- Changing core business logic or algorithms.

---

## Verification Plan
- **Deno Check**: `deno check src/tui/**/*.ts` should pass without any imports pointing to internal core directories.
- **Unit Tests**: All TUI tests in `tests/tui/` should pass using Mock service implementations.
- **Integration Tests**: Running `exoctl tui` and performing basic entity management.
- **Complexity Check**: Ensure refactoring doesn't introduce complexity spikes in adapters.
