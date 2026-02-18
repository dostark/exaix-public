# 🤖 CLAUDE.md — REQUIRED READING FOR ALL AI AGENTS

> **⚠️ CRITICAL:** This document and `.copilot/` are **MANDATORY** context for all code tasks.
>
> **Violation of these guidelines will result in rejected or incorrect implementations.**

---

## ⚠️ START HERE — Mandatory Pre-Task Checklist

**Before beginning ANY code modification task, you MUST:**

- [ ] Read this `CLAUDE.md` file completely
- [ ] Check `.copilot/cross-reference.md` for task-specific guidance
- [ ] Read at least one relevant `.copilot/` document matching your task type
- [ ] **Acknowledge** which `.copilot/` docs guided your approach in your implementation plan

**Example acknowledgment format:**

> "I consulted `.copilot/tests/testing.md` for test patterns and `.copilot/source/exoframe.md` for service architecture before implementing this feature."

**Failure to consult `.copilot/` documentation is considered a violation of project standards.**

---

## Quick Reference

| Need                 | Location                                                         |
| -------------------- | ---------------------------------------------------------------- |
| Task → Doc mapping   | [.copilot/cross-reference.md](.copilot/cross-reference.md)       |
| Source patterns      | [.copilot/source/exoframe.md](.copilot/source/exoframe.md)       |
| Testing patterns     | [.copilot/tests/testing.md](.copilot/tests/testing.md)           |
| Documentation guide  | [.copilot/docs/documentation.md](.copilot/docs/documentation.md) |
| Planning documents   | [.copilot/planning/](.copilot/planning/)                         |
| All agent docs index | [.copilot/manifest.json](.copilot/manifest.json)                 |

## Project Overview

**ExoFrame** is an AI agent orchestration framework built with **Deno** and **TypeScript**.

### Runtime & Tooling

- **Runtime:** Deno (strict TypeScript)
- **Config:** `deno.json` (tasks, imports)
- **Pre-commit:** Auto-runs `fmt:check`, `lint`, `check:docs`

### Key Commands

```bash
deno task test              # Run all tests
deno task test:cov          # Run with coverage
deno task fmt               # Format code
deno task lint              # Lint code
deno task check:docs        # Verify .copilot/manifest.json is fresh
```

## Development Workflow

### TDD-First (MANDATORY)

1. Write failing tests first
2. Implement minimal code to pass
3. Refactor with tests green
4. Verify coverage maintained

### Coding Standards

- **Strict Type Safety:** Every variable, parameter, return value, and data structure **must** have an explicit type annotation. Implicit `any` (from missing annotations) and explicit `any` are both forbidden.
  - **No `any`:** Never use `any` as a type. Use generic types (`<T>`), proper interfaces, or Zod-inferred types.
  - **No `as any` casting:** Never use `value as any` to bypass type checking. This defeats TypeScript's type safety and hides real issues. Use proper type guards, narrowing, or define the correct type.
  - **No `unknown` as a fallback:** `unknown` is not a substitute for a real type. If the shape is truly dynamic, define a named interface or type alias that describes it. Use `unknown` only as a *transient* type inside a narrowing guard (e.g., `catch (e: unknown)`) — never as a stored type or parameter type.
  - **No double casting:** Never use `... as unknown as ...`. This bypasses type safety. Use proper narrowing or structural typing.
  - **Always name it:** If a type does not exist yet, create one. Prefer specific interfaces over structural `Record<string, ...>` when the keys are known.
- **Top-Level Imports:** All imports must be at the top of the file. Dynamic imports are discouraged.
- **No Magic Values:** No hardcoded numbers or strings. Use constants/enums.


### Before Committing

- Run `deno task test` — all tests must pass
- Run `deno task fmt` — code must be formatted
- Pre-commit hooks enforce: `fmt:check`, `lint`, `check:docs`

### CI Verification (MANDATORY)

**Before claiming any task is complete, you MUST verify all CI checks pass locally.**

#### Quick CI Verification

Run the unified CI script to verify all checks:

```bash
# Full CI pipeline (recommended before PR)
deno run -A scripts/ci.ts all

# Individual checks
deno run -A scripts/ci.ts check    # Static analysis
deno run -A scripts/ci.ts test     # Test suite
deno run -A scripts/ci.ts coverage # Coverage verification
```

#### Manual CI Workflow Verification

To replicate exact CI behavior, run the workflows locally:

**1. Code Quality Gates** (`.github/workflows/code-quality.yml`):
```bash
# Format check
deno fmt --check

# Lint check
deno lint

# Code duplication check
deno run --allow-run --allow-read --allow-write scripts/measure_duplication.ts --threshold 2.0

# Complexity check
deno run --allow-read --allow-net scripts/measure_complexity.ts --threshold 15 --json > complexity.json
deno run --allow-read scripts/check_complexity_breaches.ts

# Test & Coverage
deno run --allow-run --allow-read --allow-write scripts/measure_coverage.ts

# Build verification
deno check src/main.ts

# Architecture validation
deno task check:arch
```

**2. PR Validation** (`.github/workflows/pr-validation.yml`):
```bash
# Configure git identity (if needed)
git config user.email "dev@example.com"
git config user.name "Developer"

# Run checks
deno run -A scripts/ci.ts check

# Run tests
deno run -A scripts/ci.ts test --quick
```

#### CI Failure Response Protocol

**If CI fails:**

1. **DO NOT** claim the task is complete
2. **DO** run the failing check locally to reproduce
3. **DO** fix the issue and re-verify all checks pass
4. **DO** commit the fix with a clear message explaining what was fixed
5. **DO** re-run full CI verification before claiming completion

**Common CI Failures:**

- **Test failures**: Run `deno test --allow-all` and fix failing tests
- **Complexity breaches**: Refactor complex functions (see complexity check output)
- **Duplication**: Extract common code into shared utilities
- **Coverage drops**: Add tests for uncovered code paths
- **Lint errors**: Fix code style issues
- **Type errors**: Resolve TypeScript compilation errors

#### CI Success Criteria

A task is only complete when:

- ✅ All tests pass (`deno test --allow-all`)
- ✅ No complexity breaches (threshold: 15)
- ✅ Code duplication < 2%
- ✅ Coverage thresholds met (Line: 60%, Branch: 50%)
- ✅ No lint errors
- ✅ No type errors
- ✅ Architecture validation passes
- ✅ Pre-commit hooks pass

## Project Structure

```
src/
├── ai/          # LLM provider implementations
├── cli/         # CLI commands (exoctl)
├── config/      # Configuration schemas
├── parsers/     # File parsers (frontmatter)
├── schemas/     # Zod validation schemas
├── services/    # Core business logic
├── tui/         # Terminal UI components
└── main.ts      # Entry point

tests/           # Mirror of src/ structure
.copilot/          # AI assistant guidance (see below)
tests/           # Mirror of src/ structure
.copilot/          # AI assistant guidance (see below)
docs/            # User documentation (Architecture moved to /ARCHITECTURE.md)
ARCHITECTURE.md  # System Architecture & Knowledge Base

```

## .copilot/ Directory — Your Knowledge Base

The `.copilot/` folder contains **machine-readable guidance** for AI assistants:

### Structure

```
.copilot/
├── manifest.json       # Index of all agent docs (auto-generated)
├── cross-reference.md  # Task → Document quick reference
├── source/             # Source code development patterns
├── tests/              # Testing patterns and helpers
├── docs/               # Documentation maintenance
├── process/            # Development processes
├── prompts/            # Example prompts for various tasks
├── providers/          # Provider-specific guidance (Claude, OpenAI, etc.)
├── planning/           # Phase planning documents
└── chunks/             # Pre-chunked docs for RAG (auto-generated)
```

### When to Consult .copilot/

| Task                  | Consult                                                     |
| --------------------- | ----------------------------------------------------------- |
| Writing tests         | `.copilot/tests/testing.md`                                 |
| Adding features       | `.copilot/source/exoframe.md` + `.copilot/tests/testing.md` |
| Refactoring           | `.copilot/source/exoframe.md`                               |
| Documentation         | `.copilot/docs/documentation.md`                            |
| Planning/roadmap      | `.copilot/planning/*.md`                                    |
| Finding the right doc | `.copilot/cross-reference.md`                               |

## Key Patterns & Constraints

### Service Pattern

- Constructor-based DI: pass `config`, `db`, `provider`
- Keep side effects out of constructors

### File System as Database

- `Workspace/Active`, `Workspace/Requests`, `Workspace/Plans` are the "database"
- Use atomic file operations (write + rename)
- All side-effects MUST log to Activity Journal via `EventLogger`

### Security Modes

- **Sandboxed:** No network, no file access (default)
- **Hybrid:** Read-only access to Portal paths
- Always use `PathResolver` to validate paths

### TUI Tests (Important)

- Use `sanitizeOps: false, sanitizeResources: false` for timer-based tests
- Skip `setTimeout` in test mode to avoid timer leaks
- Pattern: `if (Deno.env.get("DENO_TEST") !== "1") setTimeout(...)`

## Test Helpers

```typescript
// Database + tempdir setup
const { db, tempDir, cleanup } = await initTestDbService();

// CLI test context
const ctx = await createCliTestContext();

// Full integration environment
const env = await TestEnvironment.create();

// Temporary env vars
await withEnv({ MY_VAR: "value" }, async () => { ... });
```

## Current Project Status

### Completed Phases

- **Phase 12:** Obsidian Retirement, Memory Banks v2
- **Phase 13:** TUI Enhancement & Unification (656 tests)
  - All 7 TUI views enhanced with consistent patterns
  - Split view system with layout presets
  - Comprehensive keyboard shortcuts

### Planning Documents

Check `.copilot/planning/` for:

- `phase-12-obsidian-retirement.md`
- `phase-12.5-memory-bank-enhanced.md`
- `phase-13-tui-enhancement.md` ✅ COMPLETED

## Common Workflows

### "Add a new feature"

1. Check `.copilot/planning/` for relevant phase
2. Follow TDD from `.copilot/source/exoframe.md`
3. Use test helpers from `.copilot/tests/testing.md`
4. Update docs per `.copilot/docs/documentation.md`

### "Fix a bug"

1. Write failing test first
2. Fix code following patterns in `.copilot/source/exoframe.md`
3. Verify all tests pass

### "Update agent docs"

After adding/changing files in `.copilot/`:

```bash
deno run --allow-read --allow-write scripts/build_agents_index.ts
```

## Mandatory Requirements & Violations

### ⚠️ MANDATORY Requirements

These are **REQUIRED** for all code tasks:

- **MUST** follow TDD (tests first, always)
- **MUST** consult `.copilot/cross-reference.md` to find relevant docs before implementation
- **MUST** read matching `.copilot/` docs and cite them in your plan
- **MUST** use established test helpers (`initTestDbService`, `createCliTestContext`, etc.)
- **MUST** keep Problems tab clean (fix TS errors before completing)
- **MUST** run `deno task test` before committing
- **MUST** verify all CI checks pass locally before claiming task completion (see CI Verification section)

### 🚫 Violations (Will Result in Rejection)

These actions are **PROHIBITED**:

- ❌ **Skipping tests** — All code must have tests
- ❌ **Proceeding without consulting `.copilot/` docs** — This is a standards violation
- ❌ **Using raw SQL table creation** — Use test helpers
- ❌ **Ignoring pre-commit hook failures** — All checks must pass
- ❌ **Guessing at patterns** — Always check `.copilot/` docs first
- ❌ **Introducing magic numbers/strings** — See `CONTRIBUTING.md`
- ❌ **Placing imports anywhere other than the top of the file** — All imports must be at the top level
