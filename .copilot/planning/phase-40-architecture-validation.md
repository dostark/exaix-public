# Phase 42: Automated Architecture Validation [COMPLETED]

**Status: COMPLETED (2026-02-17)**

Automate the enforcement of architectural grounding and module header standards to prevent documentation rot and ensure all code remains discoverable via `ARCHITECTURE.md`.

## Executive Summary

**Problem:**
Manual updates to `ARCHITECTURE.md` and module headers are prone to human error and omission. New files might be added without headers, or existing links might break as files are moved.

**Solution:**
Create a Deno script `scripts/validate_architecture.ts` that:

1. **Header Check**: Scans every `.ts` file in `src/` to ensure it starts with a standardized `@module` JSDoc header.
2. **Grounding Check**: Verifies that every file in `src/` is "grounded" by `ARCHITECTURE.md`. A file is grounded if:
   - It is explicitly listed in `ARCHITECTURE.md`.
   - OR it is listed as a `@related-file` or `@dependency` in the header of a file that is already grounded.
3. **Integration**: Add `deno task check:arch` and include it in GitHub Actions.

---

## Goals

- [x] Create `scripts/validate_architecture.ts` with comprehensive validation logic.
- [x] Implement `@module` header parsing and validation.
- [x] Implement `ARCHITECTURE.md` parsing for file path extraction.
- [x] Implement transitive grounding validation (Linked List/Graph traversal).
- [x] Add `check:arch` task to `deno.json`.
- [x] Integrate `deno task check:arch` into `.github/workflows/code-quality.yml`.

---

## Proposed Changes

### [NEW] [validate_architecture.ts](file:///home/dkasymov/git/ExoFrame/scripts/validate_architecture.ts)

The script will use the following logic:

1. Identify all source files in `src/**/*.ts`.
2. Extract explicit paths from `ARCHITECTURE.md` (Regex search for `src/` paths).
3. For each source file:
   - Verify standardized JSDoc header exists (`@module`, `@path`, `@description`, `@architectural-layer`).
   - Extract `@related-files` and `@dependencies`.
4. Perform a reachability analysis:
   - Root set = Files explicitly in `ARCHITECTURE.md`.
   - Traverse links (related-files, dependencies) to find all reachable files.
   - Flag any file in `src/` that is NOT reachable from the root set.

### [MODIFY] [deno.json](file:///home/dkasymov/git/ExoFrame/deno.json)

```json
"tasks": {
  "check:arch": "deno run --allow-read scripts/validate_architecture.ts"
}
```

### [MODIFY] [.github/workflows/code-quality.yml](file:///home/dkasymov/git/ExoFrame/.github/workflows/code-quality.yml)

Add a step to run the architecture validation.

---

## Verification Plan

### Automated Tests

- Run `deno task check:arch` and expect it to FAIL initially (since only 5 files have headers).
- Add headers to all core files and re-run until it passes.

### Manual Verification

- Move a file and verify the script detects the broken link in `ARCHITECTURE.md` or headers.
- Remove a header from a file and verify it's flagged.
