# Phase 41: TypeScript Safety Refactoring

**Status: DRAFT**

Refactor the ExoFrame codebase to enforce strict TypeScript typing, improving maintainability and developer experience by eliminating `any` types and ensuring safe data flow.

## Executive Summary

**Problem:**
ExoFrame's codebase currently utilizes loose typing (`any`) in critical areas such as database interactions, external service responses, and configuration parsing. This leads to runtime errors that could be caught at compile time and reduces the effectiveness of IDE tooling.

**Solution:**
Implement a comprehensive refactoring strategy based on an "Onion Architecture" approach:
1.  **Configuration**: Enforce strict TypeScript compiler options.
2.  **Core Domain**: Define strict Zod schemas and types for all core entities.
3.  **Services**: Refactor service interfaces to use dependency injection with strictly typed checks.
4.  **Boundaries**: Ensure all IO (Database, API, CLI) is validated at the edge.

---

## Goals

- [ ] Enable `strict: true` in `deno.json`.
- [ ] Eliminate all usage of `any` and improper `unknown` in `src/` (per `CONTRIBUTING.md` §1.5).
- [ ] Define strict return types for all `IDatabaseService` methods.
- [ ] Refactor `ExecutionLoop` and `PlanExecutor` to use fully typed interfaces.
- [ ] Ensure all LLM provider responses are validated against Zod schemas.
- [ ] Update all test mocks to implement full interfaces without `as any` casting.
- [ ] Create `scripts/check_type_safety.ts` CI script that enforces zero `any`/`unknown` usage across `src/`.
- [ ] Integrate the new script as `deno task check:types` in `deno.json` and in `scripts/ci.ts`.

---

## Refactoring Plan

### 1. Assessment & Configuration (The Foundation)
**Objective**: Ensure the compiler helps us by enforcing strictness.

*   **Step 1.1**: Audit `deno.json`. Ensure `strict: true` is enabled (implies `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`).
*   **Step 1.2**: Run `deno check src/**/*.ts` to baseline errors.
*   **Step 1.3**: Identify "Hotspots" of `any` and improper `unknown` usage.

### 1.4 Guided by Standards
Refer to `CONTRIBUTING.md` (Section 1.5 Strict Type Safety) and `README.md` for explicit guidelines.
-   **No `any`**: Explicit or implicit.
-   **No `as any` casting**.
-   **No `unknown` as stored type**: Only allowed in `catch(e)` or transient type guards.
-   **No `deno-lint-ignore no-explicit-any`**.

### 2. The "Onion Architecture" Strategy

#### Phase A: Core Domain Models (The Center)
**Objective**: Define strict shapes for data flowing through the system.

*   **Step A.1**: Audit `src/schemas/` and `src/enums.ts`.
*   **Step A.2**: Ensure `Plan`, `Flow`, `Artifact`, `LogEntry` have single sources of truth.
*   **Step A.3**: Replace loose interfaces with internal Zod schema inference for runtime validation.

**Success Criteria**:
-   All core entities have a corresponding Zod schema.
-   No `interface` definitions for core models exist without a backing schema (except for pure type utilities).

**Planned Tests**:
-   `deno check src/schemas/*.ts`: Verify schema definitions are valid.
-   Create `tests/schemas/domain_models_test.ts`: Verify that inferred types match expected shapes.

#### Phase B: Service Interfaces (The Business Logic)
**Objective**: Ensure services interact safely via Dependency Injection.

*   **Step B.1**: Complete `IDatabaseService` interface adoption.
*   **Step B.2**: Refactor `PlanExecutor`, `GitService`, `EventLogger` to implementing interfaces.
*   **Step B.3**: Define strict generic Result Types for `db.query<T>()`.

**Success Criteria**:
-   All service classes implement an exported interface (e.g., `class GitService implements IGitService`).
-   Constructors accept interfaces, not concrete classes.

**Planned Tests**:
-   `deno check src/services/*.ts`: Verify interface implementation.
-   Update `tests/services/*_test.ts`: Ensure mocks implement the full interface.

#### Phase C: The Boundaries (IO & External Systems)
**Objective**: Validate data at the edges.

*   **Step C.1**: Wrap raw SQL results in Zod parsers.
*   **Step C.2**: Validate LLM responses against schemas (e.g., `PlanValidator`).
*   **Step C.3**: Strictly type CLI inputs (yargs/Cliffy).

**Success Criteria**:
-   Database queries return `Result<T>` or similar strictly typed wrappers, not `any`.
-   CLI `args` are strictly typed via inferred Zod schemas or Cliffy types.

**Planned Tests**:
-   `deno check src/db/*.ts` and `src/cli/*.ts`.
-   `tests/integration/boundary_validation_test.ts`: Test that invalid external data (DB, API) throws validation errors at the boundary.

#### Phase D: CI Enforcement Script
**Objective**: Prevent regressions — make it impossible to merge code that re-introduces `any` or improper `unknown`.

*   **Step D.1**: Create `scripts/check_type_safety.ts` that:
    -   Scans every `.ts` file under `src/`.
    -   Greps for explicit `: any`, `as any`, `<any>`, `// deno-lint-ignore no-explicit-any`, and `unknown` used outside `catch` clauses or narrowing guards.
    -   Reports violations with file path and line number.
    -   Returns exit code `1` if any violations are found.
*   **Step D.2**: Register as `deno task check:types` in `deno.json`.
*   **Step D.3**: Add `{ cmd: ["deno", "task", "check:types"], desc: "Type Safety Audit" }` to the parallel checks in `scripts/ci.ts` (both the `checkCommand` and the `allCommand` Phase 1 block).

**Success Criteria**:
-   `deno task check:types` exits with `0` after all source files are refactored.
-   The script is executed as part of pre-commit hooks and CI.

**Planned Tests**:
-   `tests/scripts/check_type_safety_test.ts`: Unit-test the scanner with fixture files containing known violations and clean files.
-   `deno task check:types` itself acts as the integration assertion.

---

### 3. Execution Batches

1.  **Batch 1 (Read-Only Data)**: Typed raw DB rows and Config mapping.
2.  **Batch 2 (Core Services)**: Refactor `ExecutionLoop`, `PlanExecutor`, `GitService` signatures.
3.  **Batch 3 (Edges)**: CLI Commands and TUI View Models.
4.  **Batch 4 (Tests)**: Update mocks and test helpers.
5.  **Batch 5 (CI Guard)**: Implement `check_type_safety.ts`, register task, integrate into `ci.ts` and pre-commit hook.

---

## Verification Plan

### Automated Tests
- Run `deno check` on all modified files.
- Run `deno test --allow-all` to ensure no regression.
- Create specific type-check tests if necessary (e.g., `dtslint` style, though `deno check` covers most).

### Manual Verification
- Verify successful compilation with `strict: true`.
- Spot check critical flows (Plan Execution, TUI rendering) to ensure runtime behavior matches types.
