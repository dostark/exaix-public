# Phase 39: Architecture Knowledge Base & Grounding

> [!NOTE]
> **Status: Completed**
> This phase transforms the static `docs/dev/ExoFrame_Architecture.md` into a living, discoverable `ARCHITECTURE.md` at the project root, designed specifically to serve as a ground-truth knowledge base for AI agents.

## Executive Summary

**Problem:**
AI agents (and new developers) struggle to map abstract architectural concepts (e.g., "Request Processor") to concrete source files. The architecture documentation is buried in `docs/dev/` and lacks direct links to code. When an agent is asked to "modify the request flow", it has to search blindly for relevant files.

**Solution:**

1. **Elevate**: Move architecture docs to `/ARCHITECTURE.md` (Root) for immediate discovery.

1.

---

## Goals

- [x] Rename `docs/dev/ExoFrame_Architecture.md` to `ARCHITECTURE.md` and move to root.
- [x] Update all references (CLAUDE.md, CONTRIBUTING.md, etc.) to point to new location.
- [x] **Enrich Architecture Doc**: Add relative file paths to all component descriptions and diagrams.
- [x] **Establish Module Header Standard**: Define a strict format for file-level comments.
- [x] **Link Validation**: Create a test/script to ensure all paths in `ARCHITECTURE.md` actually exist.

---

## Proposed Changes

### 1. File Structure

```diff

- docs/dev/ExoFrame_Architecture.md
+ ARCHITECTURE.md

### 2. Architecture Document Grounding

The `ARCHITECTURE.md` will be updated to include source paths.

**Before:**

> The **Request Processor** validates incoming requests...

**After:**

> The **Request Processor** (`src/services/request_processor.ts`) validates incoming requests...

**Diagrams:**
Mermaid diagrams will be annotated or accompanied by a lookup table:

| Component         | Source Path                         | Description                    |
| :---------------- | :---------------------------------- | :----------------------------- |
| Request Processor | `src/services/request_processor.ts` | Orchestrates request lifecycle |
| Plan Executor     | `src/services/plan_executor.ts`     | Executes steps via MCP         |

### 3. Module Header Standard (Additional Idea 2)

We will enforce a standardized JSDoc header for all core modules. This allows agents to understand a file's purpose immediately upon opening it.

**Format:**

```typescript
/**
 * @module RequestProcessor
 * @path src/services/request_processor.ts
 * @description Orchestrates the processing of incoming requests, routing them to FlowRunner or AgentRunner.
 * @architectural-layer Core System
 * @dependencies [InputValidator, RequestRouter, DatabaseService]
 * @related-files [src/services/request_router.ts]
 */
```

---

## Implementation Plan

### Step 1: Move and Rename

- [x] Move `docs/dev/ExoFrame_Architecture.md` to `/ARCHITECTURE.md`.
- [x] Update `CLAUDE.md` to reference `ARCHITECTURE.md` as primary context.
- [x] Update `CONTRIBUTING.md` (if exists).

### Step 2: Content Enrichment (Grounding)

- [x] Review `ARCHITECTURE.md` section by section.
- [x] For every mentioned component (Services, Core, CLI Commands), identify the source file.
- [x] Insert the file path (`src/...`) next to the component name.
- [x] Create a "Component Map" table at the end of the document for quick lookup.

### Step 3: Module Header Pilot

- [x] Define the header format in `ARCHITECTURE.md`.
- [x] Apply the header to 5 critical files as a pilot:
  1. `src/main.ts`
  1.
  1.
  1.
  1.

### Step 4: Verification

- [x] Run a script to grep all paths in `ARCHITECTURE.md` and verify they exist on disk.
- [x] Verify `deno check` passes (headers are just comments, so safe).

---

## Success Criteria

- [x] `ARCHITECTURE.md` exists at root.
- [x] `CLAUDE.md` links to `ARCHITECTURE.md`.
- [x] An agent reading `ARCHITECTURE.md` can find the file for "Request Router" without searching.
- [x] Pilot modules contain standardized headers.
- [x] No broken links in documentation.

## Risks

- **Drift**: Hardcoded paths in `ARCHITECTURE.md` might rot if files are moved.
  - _Mitigation_: Depending on Phase 38's `deno_task`, we could add a `docs:check` task that validates these paths.

---

## Next Steps

1. All Phase 39 objectives completed.
