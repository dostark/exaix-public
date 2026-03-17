# Phase 46: Portal Codebase Knowledge Gathering

## Version: 1.1

## Status: PLANNING

Introduce a `PortalKnowledgeService` that deeply analyzes mounted portal codebases — extracting architecture, patterns, conventions, and key file maps — and persists the results in `Memory/Projects/{portal}/` for consumption by all downstream services (request analysis, agent execution, quality evaluation).

## Executive Summary

**Problem:**
When a portal is mounted, ExoFrame captures only minimal metadata: alias, path, and a shallow tech-stack guess (via `ContextCardGenerator`). The `buildPortalContextBlock()` in `prompt_context.ts` injects the alias, root path, and an optional flat file list into agent prompts. No component performs deep codebase analysis — no architecture extraction, no pattern detection, no convention mapping, no key-file identification.

This means:

- **Agents hallucinate** about portal structure (documented in `.copilot/issues/code-analyst-ignores-portal-context.md` — fixed with shallow file list, but deep understanding is still missing).
- **Request understanding is blind** — Phase 45's `RequestAnalyzer` and Phase 47's `RequestQualityGate` cannot assess whether a request references real components, follows portal conventions, or is feasible given the codebase architecture.
- **Quality evaluation is generic** — evaluators cannot check whether agent output aligns with the portal's actual patterns and conventions.
- **Memory Bank has structure but no automated population** — `Memory/Projects/{portal}/` supports overview, patterns, decisions, and references, but only `overview.md` (a basic context card) is populated at mount time. Patterns, decisions, and references are only populated post-execution by `MissionReporter` — meaning the first execution against a new portal has zero knowledge.

**Solution:**
Add a `PortalKnowledgeService` that performs deep codebase analysis — either as a post-mount activity or as an on-demand pre-execution step — and persists structured knowledge into `Memory/Projects/{portal}/`. This knowledge becomes available to `RequestAnalyzer`, `RequestQualityGate`, `AgentRunner`, and all quality evaluation components.

---

## Current State Analysis

### Portal Mounting Creates Minimal Context

`ContextCardGenerator.generate()` writes a basic portal card:

```markdown
# Portal: {alias}

- **Path**: `{path}`
- **Tech Stack**: typescript, deno

Add your notes here...
```

This is stored as `Memory/Projects/{alias}/portal.md`. No other files in the project directory are auto-created.

### Memory Bank Has the Right Structure, but It's Empty

`Memory/Projects/{portal}/` supports:

| File | Content | Auto-populated? |
| ------ | --------- | ----------------- |
| `portal.md` | Basic alias/path/tech-stack card | ✅ At mount time |
| `overview.md` | High-level project summary | ❌ Only after first `MissionReporter` run |
| `patterns.md` | Code patterns and conventions | ❌ Only after `MissionReporter` learns them |
| `decisions.md` | Architectural decisions | ❌ Only after `MissionReporter` records them |
| `references.md` | Key files, docs, APIs | ❌ Never auto-populated |

### Agent Prompts Get Shallow File Lists

`buildPortalContextBlock()` in `src/services/prompt_context.ts` provides:

- Portal alias and root path
- Optional flat file list (no hierarchy, no file contents, no significance ranking)
- No architecture overview, no pattern descriptions, no key-file highlights

### First Execution Is Knowledge-Free

The `MissionReporter` updates `Memory/Projects/` after execution, recording patterns it discovered and decisions it made. But the **first execution** against a newly mounted portal has none of this — it operates blind. This creates a bootstrapping problem: the first execution is the least informed, yet it's the one that sets the pattern for future work.

### `code-analyst` Agent Has the Right Capabilities

The `code-analyst` blueprint (`Blueprints/Agents/code-analyst.md`) can:

- `read_file` — read source files
- `list_directory` — enumerate directory contents
- `grep_search` — search for patterns across files

This agent (or its capabilities) could be leveraged for automated codebase analysis.

---

## Goals

- [ ] Define `IPortalKnowledge` schema extending beyond `IProjectMemory` with architecture, conventions, key files, and dependency information.
- [ ] Implement `PortalKnowledgeService` with two trigger modes: post-mount (automatic) and on-demand (pre-execution).
- [ ] Implement codebase analysis strategies: directory structure analysis, config file parsing, pattern detection, dependency extraction, architecture inference.
- [ ] Persist gathered knowledge in `Memory/Projects/{portal}/` using existing `MemoryBankService` APIs.
- [ ] Make knowledge available to `RequestAnalyzer` (Phase 45), `RequestQualityGate` (Phase 47), and `AgentRunner`.
- [ ] Implement incremental knowledge updates (don't re-analyze everything on each request).
- [ ] Add CLI command: `exoctl portal analyze <alias>` for manual triggering.
- [ ] Write tests for knowledge extraction, persistence, staleness detection, and integration.

---

## Detailed Design

### 1. `IPortalKnowledge` Schema

```typescript
export interface IFileSignificance {
  /** File path relative to portal root */
  path: string;
  /** Why this file is significant */
  role: "entrypoint" | "config" | "schema" | "test-helper" | "core-service" | "routing" | "types" | "migration" | "build";
  /** Brief description of what this file does */
  description: string;
  /** Approximate lines of code */
  lineCount?: number;
}

export interface IArchitectureLayer {
  /** Layer name (e.g., "services", "controllers", "models") */
  name: string;
  /** Directory path(s) for this layer */
  paths: string[];
  /** Description of the layer's responsibility */
  responsibility: string;
  /** Key files in this layer */
  keyFiles: string[];
}

export interface ICodeConvention {
  /** Convention name */
  name: string;
  /** Description of the convention */
  description: string;
  /** Example file paths demonstrating this convention */
  examples: string[];
  /** Category */
  category: "naming" | "structure" | "testing" | "imports" | "error-handling" | "typing" | "other";
  /** Number of files or patterns that provide evidence for this convention */
  evidenceCount: number;
  /** Confidence level based on evidence strength: low = 1–2, medium = 3–9, high = 10+ */
  confidence: "low" | "medium" | "high";
}

export interface IMonorepoPackage {
  /** Package name (from package.json "name" field or directory name) */
  name: string;
  /** Package path relative to portal root */
  path: string;
  /** Primary language for this package (from dominant file extension within sub-tree) */
  primaryLanguage: string;
  /** Detected framework for this package */
  framework?: string;
  /** Architecture layers local to this package */
  layers: IArchitectureLayer[];
  /** Conventions specific to this package (may differ from root conventions) */
  conventions: ICodeConvention[];
}

export interface IDependencyInfo {
  /** Package manager used */
  packageManager: "npm" | "deno" | "pip" | "cargo" | "go" | "maven" | "other";
  /** Config file path (package.json, deno.json, etc.) */
  configFile: string;
  /** Key dependencies (frameworks, major libraries) */
  keyDependencies: Array<{ name: string; version?: string; purpose?: string }>;
}

export interface IPortalKnowledge {
  /** Portal alias */
  portal: string;
  /** When this knowledge was gathered */
  gatheredAt: string;
  /** Knowledge version (incremented on re-analysis) */
  version: number;

  /** High-level architecture overview (Markdown) */
  architectureOverview: string;
  /** Detected architecture layers */
  layers: IArchitectureLayer[];
  /** Significant files with roles */
  keyFiles: IFileSignificance[];
  /** Detected code conventions */
  conventions: ICodeConvention[];
  /** Dependency information */
  dependencies: IDependencyInfo[];

  /** Per-package breakdown for monorepos; empty array for single-project portals */
  packages?: IMonorepoPackage[];

  /** Language/framework detected */
  techStack: {
    primaryLanguage: string;
    framework?: string;
    testFramework?: string;
    buildTool?: string;
  };

  /**
   * Top-N exported symbols ranked by connectivity (populated in `standard`/`deep` modes).
   * Populated by Strategy 6 (`deno doc --json` for TS/Deno portals; tree-sitter WASM for
   * other languages in Team/Enterprise edition). Empty array in `quick` mode.
   */
  symbolMap: ISymbolEntry[];

  /** Project statistics */
  stats: {
    totalFiles: number;
    totalDirectories: number;
    totalLinesOfCode?: number;
    /** File extension distribution (e.g., { ".ts": 120, ".md": 15 }) */
    extensionDistribution: Record<string, number>;
  };

  /** Analysis metadata */
  metadata: {
    /** Duration of analysis */
    durationMs: number;
    /** Analysis mode used */
    mode: "quick" | "standard" | "deep";
    /** Files scanned */
    filesScanned: number;
    /** Files read (content analyzed) */
    filesRead: number;
  };
}

export interface ISymbolEntry {
  /** Symbol name (function, class, interface, const, type) */
  name: string;
  /** Symbol kind */
  kind: "function" | "class" | "interface" | "const" | "type" | "enum";
  /** File path relative to portal root */
  file: string;
  /** Full TypeScript/language signature (no body) */
  signature: string;
  /** JSDoc summary line, if present */
  doc?: string;
  /** PageRank-like connectivity score — higher = referenced by more files */
  pageRankScore?: number;
}
```

### 2. `PortalKnowledgeService`

```typescript
export interface IPortalKnowledgeConfig {
  /** Whether to auto-analyze after portal mount */
  autoAnalyzeOnMount: boolean;
  /** Analysis depth */
  defaultMode: "quick" | "standard" | "deep";
  /** Maximum files to scan in quick mode */
  quickScanLimit: number;     // default: 200
  /** Maximum files to read content for */
  maxFilesToRead: number;     // default: 50
  /** File patterns to ignore */
  ignorePatterns: string[];   // default: ["node_modules", ".git", "dist", "build", ...]
  /** How long before knowledge is considered stale (hours) */
  staleness: number;          // default: 168 (1 week)
  /** Whether to use LLM for architecture inference */
  useLlmInference: boolean;   // default: true
}

export class PortalKnowledgeService {
  constructor(
    private config: IPortalKnowledgeConfig,
    private memoryBank: IMemoryBankService,
    private modelProvider?: IModelProvider,
  ) {}

  /** Full analysis of a portal codebase */
  async analyze(portalAlias: string, portalPath: string, mode?: "quick" | "standard" | "deep"): Promise<IPortalKnowledge>;

  /** Check if existing knowledge is stale */
  async isStale(portalAlias: string): Promise<boolean>;

  /** Get cached knowledge, or analyze if missing/stale */
  async getOrAnalyze(portalAlias: string, portalPath: string): Promise<IPortalKnowledge>;

  /** Incremental update — re-analyze only changed areas */
  async updateKnowledge(portalAlias: string, portalPath: string, changedFiles?: string[]): Promise<IPortalKnowledge>;
}
```

### 3. Analysis Strategies

The service uses a layered analysis pipeline, with each strategy contributing to the `IPortalKnowledge` structure:

#### Strategy 1: Directory Structure Analysis (No LLM)

- Walk the file tree, respecting `ignorePatterns`
- Build extension distribution and statistics
- Identify architecture layers from directory naming conventions:
  - `src/`, `lib/`, `app/` → source root
  - `tests/`, `test/`, `__tests__/`, `spec/` → test layer
  - `src/services/`, `src/controllers/`, `src/models/`, `src/routes/` → architecture layers
  - `migrations/`, `scripts/`, `docs/` → supporting layers
- Detect monorepo vs. single-project structure; when detected, populate `packages[]` with one `IMonorepoPackage` entry per detected sub-package (each with its own `name`, `path`, `primaryLanguage`, `layers`, `conventions`); root-level `layers` and `conventions` reflect the workspace root only

#### Strategy 2: Config File Parsing (No LLM)

- Parse known config files to extract factual data:
  - `package.json` / `deno.json` → dependencies, scripts, name, version
  - `tsconfig.json` / `jsconfig.json` → compiler options, path aliases
  - `Cargo.toml` / `go.mod` / `pyproject.toml` → language-specific deps
  - `.eslintrc` / `biome.json` / `deno.json` → linting conventions
  - `Dockerfile` / `docker-compose.yml` → deployment patterns
  - `CI config` (`.github/workflows/`, `.gitlab-ci.yml`) → build/test commands
- This strategy produces reliable, deterministic output.

#### Strategy 3: Key File Identification (No LLM)

- Identify significant files by name/path heuristics:
  - Entrypoints: `main.ts`, `index.ts`, `app.ts`, `server.ts`, `mod.ts`
  - Configs: `*.config.*`, `*.toml`, `*.yaml`, `*.yml`
  - Schemas: `schema.*`, `types.*`, `interfaces.*`
  - Test helpers: `test_helpers.*`, `fixtures.*`, `conftest.py`
  - Routing: `routes.*`, `router.*`
  - Migrations: `migrations/`

#### Strategy 4: Pattern Detection (Hybrid — Heuristic + Optional LLM)

- **Heuristic pass**: Detect patterns from file naming and structure
  - Files named `*_service.ts` → service pattern
  - Files named `*_repository.ts` → repository pattern
  - `__tests__/` alongside source → co-located tests
  - `tests/` mirroring `src/` → mirror test layout
  - `*.test.ts` / `*.spec.ts` → test naming convention
  - Import patterns (barrel exports, path aliases)
- **LLM pass** (optional, `deep` mode): Read a sample of key files and infer higher-level patterns:
  - Dependency injection style
  - Error handling conventions
  - Logging patterns
  - API design patterns (REST, GraphQL, RPC)

#### Strategy 5: Architecture Inference (LLM — `standard` and `deep` modes)

Feed the directory tree, key file list, config file contents, and detected patterns to an LLM:

```text
You are an expert software architect analyzing a codebase.

## Directory Structure
{tree_output}

## Key Configuration Files
{config_contents}

## Detected Patterns
{patterns_list}

## Task
Produce a concise architecture overview including:

1. Overall architecture style (monolith, microservices, layered, etc.)

1.
1.

Format as Markdown suitable for a developer onboarding document.
```

#### Strategy 6: Symbol Extraction (No LLM — `standard` and `deep` modes)

For **TypeScript / Deno portals**, run `deno doc --json <entrypoint>` as a subprocess to extract all exported symbols — functions, classes, interfaces, constants, and types — along with their signatures, JSDoc, and re-export chains. This produces a precise, compiler-verified symbol catalogue without any LLM call.

- **Language detection gate:** only runs when `techStack.primaryLanguage` is `"typescript"` or `"javascript"` (determined by Strategy 1); silently skipped for other languages
- **Input:** portal entrypoint(s) detected by Strategy 3 (`main.ts`, `mod.ts`, `index.ts`, etc.)
- **Output:** `symbolMap[]` populated with top-N symbols; PageRank score computed from cross-file reference count (how many other files import each symbol)
- **Ranking:** symbols sorted by `pageRankScore` descending; cap at `DEFAULT_SYMBOL_MAP_LIMIT` (default: 100) entries
- **Multi-language portals (future — Team/Enterprise):** for non-TS languages, a tree-sitter WASM driver (see Phase 60) provides the same symbol extraction capability. Phase 46 outputs an empty `symbolMap` for non-TS portals with a `metadata.symbolExtractionSkipped: true` flag.
- **Fallback:** if `deno doc` subprocess fails or times out, `symbolMap` is set to `[]` without blocking analysis

> **Why this replaces pure heuristics for TS portals:** `deno doc` uses the TypeScript compiler's type checker, so it sees path aliases, re-exports, and generics correctly. Name heuristics (Strategy 3) miss re-exported symbols entirely and produce false positives on test helper files named `*_service.ts`.

### 4. Analysis Mode Comparison

| Mode | LLM Calls | Files Read | Duration | Use Case |
| ------ | ----------- | ------------ | ---------- | ---------- |
| `quick` | 0 | 0 (structure + configs only) | <5s | Post-mount default; **basic structural orientation only** (file tree, dependency list, naming patterns — does not produce architectural understanding; run `exoctl portal analyze` before first agent use for full analysis — addresses Gap 14) |
| `standard` | 1 | Up to 20 key files | ~15s | Pre-execution default; architecture inference + symbol extraction (TS/Deno portals get `symbolMap` via `deno doc --json`, no extra LLM call) |
| `deep` | 2-3 | Up to 50 files | ~60s | Manual `exoctl portal analyze`; full convention mapping + complete symbol index + multi-language support |

### 5. Persistence in Memory Bank

Knowledge is persisted using existing `MemoryBankService` APIs, augmented with a new knowledge-specific file:

```text
Memory/Projects/{portal}/
  ├── portal.md            ← Existing: basic context card (ContextCardGenerator)
  ├── overview.md          ← Updated: replaced with architectureOverview from analysis
  ├── patterns.md          ← Updated: populated with detected conventions and patterns
  ├── decisions.md         ← Existing: only from MissionReporter (not auto-populated)
  ├── references.md        ← Untouched: owned exclusively by `MissionReporter`; `knowledge.json` is the sole source for architectural reference data (see Gap 5)
  └── knowledge.json       ← NEW: full IPortalKnowledge for programmatic access
```

Mapping from `IPortalKnowledge` to `IProjectMemory`:

| IPortalKnowledge Field | IProjectMemory Target | Transformation |
| ------------------------ | ----------------------- | ---------------- |
| `architectureOverview` | `overview` | Direct Markdown |
| `conventions` | `patterns[]` | Map to `IPattern` (name, description, examples, tags) |
| `keyFiles` | `knowledge.json` only | Stored in `IPortalKnowledge.keyFiles`; not mapped to `references.md` — see Gap 5 |
| `dependencies[].keyDependencies` | `knowledge.json` only | Stored in `IPortalKnowledge.dependencies`; not mapped to `references.md` — see Gap 5 |

The `knowledge.json` file stores the complete `IPortalKnowledge` object for programmatic access by other services.

### 6. Trigger Points

#### Post-Mount (Automatic)

In `portal_commands.ts` `add()`, after `ContextCardGenerator.generate()`:

```typescript
// Existing
await contextCardGenerator.generate({ alias, path: resolvedPath, techStack });

// NEW: Trigger knowledge gathering (async, non-blocking for quick mode)
if (portalKnowledgeConfig.autoAnalyzeOnMount) {
  await portalKnowledgeService.analyze(alias, resolvedPath, "quick");
}
```

Quick mode runs synchronously (fast, no LLM) so the user gets immediate value.

#### Pre-Execution (On-Demand)

In `RequestProcessor.processAgentRequest()`, before agent execution:

```typescript
// If request targets a portal and knowledge is missing/stale
const portalAlias = metadata.portal;
if (portalAlias) {
  const knowledge = await portalKnowledgeService.getOrAnalyze(portalAlias, portalPath);
  // Inject knowledge into request context for agent and evaluators
  parsedRequest.context.portalKnowledge = knowledge;
}
```

Standard mode runs here (one LLM call for architecture inference) — justified because the execution will use many more LLM calls anyway.

#### Manual CLI Trigger

```bash
# Analyze a portal (deep mode)
exoctl portal analyze my-project --mode deep

# View gathered knowledge
exoctl portal knowledge my-project

# Force re-analysis (ignore staleness)
exoctl portal analyze my-project --force
```

### 7. Integration with Other Phases

#### Phase 45 (Request Intent Analysis)

`RequestAnalyzer` can use portal knowledge to:

- Validate file references in the request against real codebase files
- Inform complexity classification (e.g., request touching core architecture layers → higher complexity)
- Detect requests that conflict with established patterns or conventions

```typescript
// In RequestAnalyzer.analyze():
const knowledge = parsedRequest.context.portalKnowledge;
if (knowledge) {
  // Cross-reference request file mentions with keyFiles
  // Adjust complexity based on layers touched
  // Flag requests that seem to contradict established conventions
}
```

#### Phase 47 (Request Quality Gate & Q&A Loop)

Portal knowledge informs the planning agent's questions:

- If the request mentions a vague component, the planning agent can ask "Did you mean {specific service from keyFiles}?"
- If the request implies a pattern change, the agent can ask "The codebase currently uses {convention}. Are you intentionally changing this?"
- Auto-enrichment can inject relevant architectural context.

#### Phase 48 (Acceptance Criteria Propagation)

Portal knowledge enables convention-aware criteria:

- "Output must follow the existing {naming convention} pattern"
- "New code must integrate with the {architecture layer} structure"

#### Phase 49 (Quality Pipeline Hardening)

Portal knowledge feeds into enhanced reflexive agent critique:

- "Response creates files in `/src/utils/` but the project uses `/src/helpers/` for utility code"
- "Response adds a direct database call but the project follows the repository pattern"

### 8. Staleness and Incremental Updates

Knowledge becomes stale when:

- Time exceeds `staleness` threshold (default: 1 week)
- User force-triggers re-analysis via `exoctl portal analyze --force`

> **Note (Gap 6 resolution):** `MissionReporter`-triggered invalidation has no implementation path in Phase 46 and has been removed. Staleness in this phase is time-based only. `MissionReporter` integration may be added in a later phase.

Incremental updates:

- Track `gatheredAt` timestamp and `version` number
- On re-analysis, compare directory tree with previous `stats` — only re-scan changed areas
- Merge new patterns/conventions with existing ones rather than replacing

---

## Step-by-Step Implementation Plan

### Step 1: Define `IPortalKnowledge` Zod Schema & Types ✅ IMPLEMENTED

**What:** Create the Zod schema and inferred TypeScript types for portal knowledge output in `src/shared/schemas/portal_knowledge.ts`. Register the export in `src/shared/schemas/mod.ts`.

**Files to create/modify:**

- `src/shared/schemas/portal_knowledge.ts` (NEW)
- `src/shared/schemas/mod.ts` (add export)

**Architecture notes:**

- Follow project schema convention: `XxxSchema` naming, `z.infer<typeof XxxSchema>` for types
- Sub-schemas: `FileSignificanceSchema`, `ArchitectureLayerSchema`, `CodeConventionSchema`, `MonorepoPackageSchema`, `DependencyInfoSchema`, `SymbolEntrySchema`, `PortalKnowledgeSchema`
- Enum values (`role`, `category`, `mode`) as Zod native enums
- `CodeConventionSchema` includes `evidenceCount` (positive integer) and `confidence` (`"low" | "medium" | "high"` Zod native enum) — addresses Gap 11
- `MonorepoPackageSchema` added with per-package `layers` and `conventions`; `PortalKnowledgeSchema` includes optional `packages` field (`z.array(MonorepoPackageSchema).optional()`) — addresses Gap 8
- `SymbolEntrySchema` for `ISymbolEntry` with `kind` as Zod native enum; `PortalKnowledgeSchema` includes `symbolMap: z.array(SymbolEntrySchema)` (default `[]`)
- `gatheredAt` as ISO string, `version` as positive integer
- Export both schemas and inferred types (`IPortalKnowledge`, `IFileSignificance`, `IArchitectureLayer`, `ICodeConvention`, `IMonorepoPackage`, `IDependencyInfo`, `ISymbolEntry`)

**Success criteria:**

- [x] `PortalKnowledgeSchema.safeParse(validData)` returns `{ success: true }`
- [x] `PortalKnowledgeSchema.safeParse(invalidData)` returns `{ success: false }` with meaningful errors
- [x] All sub-schemas parseable independently
- [x] Schema re-exported through `src/shared/schemas/mod.ts` barrel
- [x] No lint or type errors

**Planned tests** (`tests/shared/schemas/portal_knowledge_test.ts`):

- [x] `[PortalKnowledgeSchema] validates complete valid knowledge object`
- [x] `[PortalKnowledgeSchema] rejects missing required fields`
- [x] `[PortalKnowledgeSchema] validates version as positive integer`
- [x] `[PortalKnowledgeSchema] validates gatheredAt as ISO string`
- [x] `[FileSignificanceSchema] validates all role enum values`
- [x] `[CodeConventionSchema] validates all category enum values`
- [x] `[DependencyInfoSchema] validates packageManager enum values`
- [x] `[PortalKnowledgeSchema] validates metadata mode enum values`
- [x] `[PortalKnowledgeSchema] validates stats extensionDistribution as Record`

---

### Step 2: Define `IPortalKnowledgeService` Interface ✅ IMPLEMENTED

**What:** Create the service interface in `src/shared/interfaces/i_portal_knowledge_service.ts`. Register in interface barrel `src/shared/interfaces/mod.ts`.

**Files to create/modify:**

- `src/shared/interfaces/i_portal_knowledge_service.ts` (NEW)
- `src/shared/interfaces/mod.ts` (add export)

**Architecture notes:**

- Follow interface naming convention: `IPortalKnowledgeService` with method signatures only
- Co-locate `IPortalKnowledgeConfig` in the same file (matches project pattern)
- Methods: `analyze(portalAlias, portalPath, mode?) → Promise<IPortalKnowledge>`, `getOrAnalyze(portalAlias, portalPath) → Promise<IPortalKnowledge>`, `isStale(portalAlias) → Promise<boolean>`, `updateKnowledge(portalAlias, portalPath, changedFiles?) → Promise<IPortalKnowledge>` (**CLI-only** in Phase 46 — no automatic runtime trigger; serves `exoctl portal analyze [--force]`; `changedFiles` parameter reserved for a future automatic-integration phase — addresses Gap 13)
- Config: `autoAnalyzeOnMount`, `defaultMode`, `quickScanLimit`, `maxFilesToRead`, `ignorePatterns`, `staleness`, `useLlmInference`

**Success criteria:**

- [x] Interface exported through barrel `src/shared/interfaces/mod.ts`
- [x] Interface depends only on types from `src/shared/schemas/` (no concrete service imports)
- [x] TypeScript compiles with `deno check`

**Planned tests:** None (interface-only; validated by type system at compile time).

---

### Step 3: Add Portal Knowledge Constants ✅ IMPLEMENTED

**What:** Add portal knowledge constants to `src/shared/constants.ts` and any new enum values to `src/shared/enums.ts`.

**Files to modify:**

- `src/shared/constants.ts` (add new section)
- `src/shared/enums.ts` (add enums if not already Zod-native)

**Architecture notes:**

- Follow existing sectioned pattern in `constants.ts` (header comment + grouped constants)
- Constants: `DEFAULT_QUICK_SCAN_LIMIT = 200`, `DEFAULT_MAX_FILES_TO_READ = 50`, `DEFAULT_KNOWLEDGE_STALENESS_HOURS = 168`, `DEFAULT_PORTAL_KNOWLEDGE_MODE = "quick"`, `DEFAULT_IGNORE_PATTERNS` (array of common ignore dirs), entrypoint file names, config file names and extensions, architecture-layer directory name mappings, role keyword maps
- **New constants (addresses Gaps §7, §9, §12):**
  - `PORTAL_KNOWLEDGE_PRIORITY_PATTERNS` — file name/path patterns always included before the scan cap applies (entrypoints, root-level configs); used by `DirectoryAnalyzer` for priority-first traversal (Gap 7)
  - `ARCHITECTURE_INFERRER_TOKEN_BUDGET = 8_000` — max total assembled prompt tokens sent to LLM in `ArchitectureInferrer` (Gap 9)
  - `ARCHITECTURE_INFERRER_MAX_FILE_TOKENS = 200` — max lines per file before truncation in prompt assembly (Gap 9)
  - `PORTAL_KNOWLEDGE_PROMPT_MAX_LINES = 60` — max lines for the `PORTAL_KNOWLEDGE_KEY` Markdown summary injected into agent prompts (Gap 12)
  - `DEFAULT_SYMBOL_MAP_LIMIT = 100` — max `ISymbolEntry` records stored in `symbolMap`
  - `DENO_DOC_TIMEOUT_MS = 15_000` — subprocess timeout for `deno doc --json` call
- No magic numbers in strategy or service code — all from constants

**Success criteria:**

- [x] All heuristic thresholds/pattern-lists referenced from constants, not inline
- [x] Constants grouped under `// === Portal Knowledge ===` section header
- [x] No duplicate constant definitions

**Planned tests:** None (constants are validated through usage in Step 4–8 tests).

---

### Step 4: Implement Directory Structure Analyzer (Strategy 1) ✅ IMPLEMENTED

**What:** Create `src/services/portal_knowledge/directory_analyzer.ts` — a standalone module that walks the file tree, builds statistics, and detects architecture layers from directory naming conventions.

**Files to create:**

- `src/services/portal_knowledge/directory_analyzer.ts` (NEW)

**Architecture notes:**

- Pure function module, no class — export `analyzeDirectory(portalPath, ignorePatterns, scanLimit) → Partial<IPortalKnowledge>`
- Zero LLM/provider/network dependencies — sandboxed-safe
- Implements: recursive directory walk (respecting `ignorePatterns`), extension distribution tally, total file/directory counts, architecture layer detection from well-known directory names (`src/services/`, `src/controllers/`, `tests/`, `migrations/`, etc.), monorepo detection (multiple `package.json`/`deno.json` at non-root)
- Returns partial knowledge: `stats`, `layers`, `packages[]` (if monorepo detected), partial `techStack.primaryLanguage` (from dominant extension)
- **Priority-first traversal (addresses Gap 7):** files matching `PORTAL_KNOWLEDGE_PRIORITY_PATTERNS` (root configs, entrypoints) are collected first regardless of `scanLimit`; remaining quota filled via BFS of `src/` and equivalent source roots — avoids biased samples that miss architecturally significant files
- Respects `scanLimit` with priority-first budget: priority files counted toward cap; BFS halts when cap is reached

**Success criteria:**

- [x] Walks directory tree and collects file statistics
- [x] Respects `ignorePatterns` (skips `node_modules/`, `.git/`, etc.)
- [x] Respects `scanLimit` with priority-first traversal: priority files (configs, entrypoints) collected first, then BFS fills remaining quota
- [x] Builds `extensionDistribution` correctly
- [x] Detects architecture layers from standard directory names
- [x] Detects monorepo vs. single-project structure and populates `packages[]` with per-package entries
- [x] Identifies `primaryLanguage` from dominant file extension
- [x] Handles empty directories gracefully
- [x] Handles symlinks safely (no infinite loops)
- [x] Completes in <5s for typical mid-size projects

**Planned tests** (`tests/services/portal_knowledge/directory_analyzer_test.ts`):

- [x] `[DirectoryAnalyzer] counts files and directories correctly`
- [x] `[DirectoryAnalyzer] builds extension distribution`
- [x] `[DirectoryAnalyzer] respects ignorePatterns`
- [x] `[DirectoryAnalyzer] respects scanLimit`
- [x] `[DirectoryAnalyzer] detects architecture layers from standard directories`
- [x] `[DirectoryAnalyzer] detects primary language from extension distribution`
- [x] `[DirectoryAnalyzer] detects monorepo structure and populates packages[] entries`
- [x] `[DirectoryAnalyzer] handles empty directory`
- [x] `[DirectoryAnalyzer] handles missing directory gracefully`

---

### Step 5: Implement Config File Parser (Strategy 2) ✅ IMPLEMENTED

**What:** Create `src/services/portal_knowledge/config_parser.ts` — a module that reads and parses known config files to extract dependencies, scripts, and conventions.

**Files to create:**

- `src/services/portal_knowledge/config_parser.ts` (NEW)

**Architecture notes:**

- Pure function module: export `parseConfigFiles(portalPath, fileList) → Partial<IPortalKnowledge>`
- Zero LLM dependencies — deterministic, reliable output
- Parses: `package.json`/`deno.json` (JSON), `tsconfig.json`/`jsconfig.json` (JSON), `Cargo.toml`/`pyproject.toml` (TOML), `Dockerfile` (presence detection + base image), CI configs (`.github/workflows/*.yml`) — YAML parse for build/test commands
- Extracts `IDependencyInfo` per config file, key dependencies with purpose heuristic (e.g., "express" → "web framework"), tech stack fields (`framework`, `testFramework`, `buildTool`)
- **Also reads `.gitignore`** from the portal root (if present) and merges its patterns into `ignorePatterns` to avoid analyzing generated/vendor files
- Handles parse errors gracefully (skip unparseable files, log warning)

**Success criteria:**

- [x] Parses `package.json` extracting name, dependencies, devDependencies, scripts
- [x] Parses `deno.json` extracting imports, tasks
- [x] Parses `tsconfig.json` extracting compiler options and path aliases
- [x] Detects test framework from dependencies (jest, vitest, deno test)
- [x] Detects build tool from scripts/tasks (vite, webpack, tsc, esbuild)
- [x] Detects web framework from dependencies (express, fastify, hono, oak)
- [x] Reads `.gitignore` and merges its patterns into `ignorePatterns`
- [x] Gracefully skips files that fail to parse
- [x] Returns empty result for directories with no recognized config files

**Planned tests** (`tests/services/portal_knowledge/config_parser_test.ts`):

- [x] `[ConfigParser] parses package.json dependencies`
- [x] `[ConfigParser] parses deno.json imports and tasks`
- [x] `[ConfigParser] parses tsconfig.json compiler options`
- [x] `[ConfigParser] detects test framework from dependencies`
- [x] `[ConfigParser] detects web framework from dependencies`
- [x] `[ConfigParser] detects build tool from scripts`
- [x] `[ConfigParser] reads .gitignore and adds patterns to ignorePatterns`
- [x] `[ConfigParser] handles malformed JSON gracefully`
- [x] `[ConfigParser] returns empty for directory with no config files`
- [x] `[ConfigParser] extracts key dependencies with purpose heuristic`

---

### Step 6: Implement Key File Identifier (Strategy 3) ✅ IMPLEMENTED

**What:** Create `src/services/portal_knowledge/key_file_identifier.ts` — a module that identifies significant files by name/path heuristics and assigns roles.

**Files to create:**

- `src/services/portal_knowledge/key_file_identifier.ts` (NEW)

**Architecture notes:**

- Pure function module: export `identifyKeyFiles(portalPath, fileList) → IFileSignificance[]`
- Zero LLM dependencies — purely heuristic
- Matches files against role-specific patterns from constants (Step 3): entrypoints (`main.ts`, `index.ts`, `app.ts`, `server.ts`, `mod.ts`), configs (`*.config.*`, `*.toml`, `*.yaml`), schemas (`schema.*`, `types.*`, `interfaces.*`), test helpers (`test_helpers.*`, `fixtures.*`, `conftest.py`), routing (`routes.*`, `router.*`), migrations (`migrations/`), build files (`Makefile`, `Dockerfile`, `Jenkinsfile`)
- Sorts by significance (entrypoints and configs first)
- Caps output at a configurable limit to avoid overwhelming downstream consumers

**Success criteria:**

- [x] Identifies standard entrypoints and assigns `entrypoint` role
- [x] Identifies config files and assigns `config` role
- [x] Identifies schema/type files and assigns `schema`/`types` role
- [x] Identifies test helper files and assigns `test-helper` role
- [x] Identifies routing files and assigns `routing` role
- [x] Provides brief description for each identified file
- [x] Sorts by role significance (entrypoints first)
- [x] Handles case where no significant files found

**Planned tests** (`tests/services/portal_knowledge/key_file_identifier_test.ts`):

- [x] `[KeyFileIdentifier] identifies entrypoint files`
- [x] `[KeyFileIdentifier] identifies config files`
- [x] `[KeyFileIdentifier] identifies schema/types files`
- [x] `[KeyFileIdentifier] identifies test helper files`
- [x] `[KeyFileIdentifier] identifies routing files`
- [x] `[KeyFileIdentifier] assigns correct roles`
- [x] `[KeyFileIdentifier] sorts by significance`
- [x] `[KeyFileIdentifier] handles no significant files`
- [x] `[KeyFileIdentifier] respects output cap limit`

---

### Step 7: Implement Pattern Detector (Strategy 4 — Heuristic Pass)

**What:** Create `src/services/portal_knowledge/pattern_detector.ts` — a module that detects code patterns and conventions from file naming, structure, and optionally file contents.

**Files to create:**

- `src/services/portal_knowledge/pattern_detector.ts` (NEW)

**Architecture notes:**

- Export `detectPatterns(portalPath, fileList, keyFiles, readFileContents?) → ICodeConvention[]`
- Heuristic pass (no LLM): detects patterns from file naming and structure: `*_service.ts` → service pattern, `*_repository.ts` → repository pattern, `__tests__/` alongside source → co-located tests, `tests/` mirroring `src/` → mirror test layout, `*.test.ts`/`*.spec.ts` → test naming convention, barrel index files (`mod.ts`, `index.ts`) → barrel exports pattern
- Optional content-based detection: when `readFileContents` callback is provided and mode is `standard`/`deep`, read a sample of key files to detect import patterns (relative vs. alias), DI style (constructor vs. parameter), error handling (try/catch, Result type, custom errors)
- Each convention includes `examples` (file paths demonstrating the pattern) and `category`

**Success criteria:**

- [x] Detects service pattern from `*_service.ts` naming
- [x] Detects test layout pattern (co-located vs. mirror)
- [x] Detects test naming convention (`*.test.ts` vs. `*_test.ts` vs. `*.spec.ts`)
- [x] Detects barrel export pattern from `mod.ts`/`index.ts`
- [x] Provides example file paths for each detected convention
- [x] Assigns correct category to each convention
- [x] Works without `readFileContents` (heuristic only)
- [x] Enhanced detection when `readFileContents` provided

**✅ IMPLEMENTED** — `src/services/portal_knowledge/pattern_detector.ts`, 13/13 tests passing

**Planned tests** (`tests/services/portal_knowledge/pattern_detector_test.ts`):

- ✅ `[PatternDetector] detects service naming pattern`
- ✅ `[PatternDetector] detects repository naming pattern`
- ✅ `[PatternDetector] detects co-located test layout`
- ✅ `[PatternDetector] detects mirror test layout`
- ✅ `[PatternDetector] detects test file naming convention`
- ✅ `[PatternDetector] detects barrel export pattern`
- ✅ `[PatternDetector] provides examples for each convention`
- ✅ `[PatternDetector] assigns correct categories`
- ✅ `[PatternDetector] works in heuristic-only mode`
- ✅ `[PatternDetector] detects import patterns when reading file contents`
- ✅ `[PatternDetector] sets evidenceCount to number of matching files per convention`
- ✅ `[PatternDetector] assigns confidence low for 1-2 evidence files`
- ✅ `[PatternDetector] assigns confidence high for 10+ evidence files`

---

### Step 8: Implement Architecture Inferrer (Strategy 5 — LLM)

**What:** Create `src/services/portal_knowledge/architecture_inferrer.ts` — a module that uses an LLM to produce a high-level architecture overview from the combined strategy outputs.

**Files to create:**

- `src/services/portal_knowledge/architecture_inferrer.ts` (NEW)

**Architecture notes:**

- Class `ArchitectureInferrer` with constructor DI: `constructor(provider: IModelProvider, validator: OutputValidator)`
- Uses `OutputValidator.validate()` to parse LLM response
- Input: directory tree string, key files list, config contents, detected patterns, dependency info
- Output: `architectureOverview` (Markdown string) **only** — `layers` are populated exclusively by Strategy 1 (heuristic directory analysis) and are never overwritten by LLM output; this avoids requiring the LLM to emit structured JSON alongside Markdown in a single call (see Gap 3)
- Prompt template as a private constant (matches `ReflexiveAgent` pattern)
- Only runs in `standard` and `deep` modes (never in `quick`)
- Falls back to empty overview on LLM failure
- **Token budget (addresses Gap 9):** per-file content truncated to `ARCHITECTURE_INFERRER_MAX_FILE_TOKENS` (200) lines before inclusion; directory tree capped at 200 paths; total assembled prompt must not exceed `ARCHITECTURE_INFERRER_TOKEN_BUDGET` (8,000) tokens — files exceeding the remaining budget are omitted in priority order (low-significance files first). Constants defined in Step 3.

**Success criteria:**

- [x] Calls `provider.generate()` with structured architecture analysis prompt
- [x] Validates LLM response with expected output format
- [x] Returns Markdown architecture overview
- [x] Does **not** override `layers` populated by heuristic Strategy 1 pass
- [x] Falls back to empty overview on LLM failure
- [x] Prompt includes all input signals (tree, key files, configs, patterns, deps)
- [x] Truncates per-file content to `ARCHITECTURE_INFERRER_MAX_FILE_TOKENS` (200) lines before prompt assembly
- [x] Caps total assembled prompt at `ARCHITECTURE_INFERRER_TOKEN_BUDGET` (8,000) tokens; omits low-significance files when over budget
- [x] Uses `temperature: 0` for deterministic output

**✅ IMPLEMENTED** — `src/services/portal_knowledge/architecture_inferrer.ts`, 8/8 tests passing

**Tests** (`tests/services/portal_knowledge/architecture_inferrer_test.ts`):

- ✅ `[ArchitectureInferrer] generates architecture overview from mock LLM response`
- ✅ `[ArchitectureInferrer] passes directory tree in prompt`
- ✅ `[ArchitectureInferrer] passes key files and patterns in prompt`
- ✅ `[ArchitectureInferrer] handles LLM failure gracefully`
- ✅ `[ArchitectureInferrer] returns empty overview on invalid LLM output`
- ✅ `[ArchitectureInferrer] uses OutputValidator for response parsing`
- ✅ `[ArchitectureInferrer] truncates long files to ARCHITECTURE_INFERRER_MAX_FILE_TOKENS lines`
- ✅ `[ArchitectureInferrer] stays within ARCHITECTURE_INFERRER_TOKEN_BUDGET on large input sets`

---

### Step 8b: Implement Symbol Extractor (Strategy 6 — `deno doc --json`)

**What:** Create `src/services/portal_knowledge/symbol_extractor.ts` — a module that runs `deno doc --json` as a subprocess on detected entrypoints to extract an accurate symbol index for TypeScript/Deno portals. For non-TS portals the module silently returns an empty result; multi-language support via tree-sitter WASM is reserved for Team/Enterprise (Phase 60).

**Files to create:**

- `src/services/portal_knowledge/symbol_extractor.ts` (NEW)

**Architecture notes:**

- Export `extractSymbols(portalPath, entrypoints, options) → Promise<ISymbolEntry[]>`
- Language detection input: `techStack.primaryLanguage` from Strategy 1 result; if not `"typescript"` or `"javascript"`, return `[]` immediately with no subprocess call
- Subprocess call: `new Deno.Command("deno", { args: ["doc", "--json", entrypoint], cwd: portalPath, timeout: DENO_DOC_TIMEOUT_MS })` — parse stdout as JSON
- Map `deno doc` JSON nodes to `ISymbolEntry`: kind enum mapping, signature reconstruction from `functionDef`/`classDef`/`interfaceDef`, first JSDoc line as `doc`
- PageRank scoring: count how many other files import each symbol (from Strategy 1 file list + Strategy 2 path-alias map); `pageRankScore = importerCount / totalFiles`
- Sort descending by `pageRankScore`, cap at `DEFAULT_SYMBOL_MAP_LIMIT`
- Fallback: if subprocess fails or times out, return `[]` without throwing
- `metadata.symbolExtractionSkipped = true` when language is not TS/JS

**Success criteria:**

- [x] Returns empty array for non-TypeScript portals without spawning subprocess
- [x] Calls `deno doc --json` on detected entrypoints
- [x] Maps `deno doc` output nodes to `ISymbolEntry[]`
- [x] Populates `kind`, `name`, `file`, `signature`, `doc` for each symbol
- [x] Computes `pageRankScore` from cross-file import count
- [x] Sorts by `pageRankScore` descending and caps at `DEFAULT_SYMBOL_MAP_LIMIT`
- [x] Returns empty array on subprocess failure without throwing
- [x] Respects `DENO_DOC_TIMEOUT_MS` timeout

**✅ IMPLEMENTED** — `src/services/portal_knowledge/symbol_extractor.ts`, 10/10 tests passing

**Tests** (`tests/services/portal_knowledge/symbol_extractor_test.ts`):

- ✅ `[SymbolExtractor] returns empty array for non-TypeScript portal`
- ✅ `[SymbolExtractor] maps deno doc JSON nodes to ISymbolEntry`
- ✅ `[SymbolExtractor] assigns correct kind for function/class/interface/const/type`
- ✅ `[SymbolExtractor] populates signature from functionDef`
- ✅ `[SymbolExtractor] extracts JSDoc summary as doc field`
- ✅ `[SymbolExtractor] computes pageRankScore from import count`
- ✅ `[SymbolExtractor] sorts by pageRankScore descending`
- ✅ `[SymbolExtractor] caps output at DEFAULT_SYMBOL_MAP_LIMIT`
- ✅ `[SymbolExtractor] returns empty array on subprocess failure`
- ✅ `[SymbolExtractor] returns empty array when runner returns null`

---

### Step 9: Implement `PortalKnowledgeService` (Orchestrator) ✅ IMPLEMENTED

**What:** Create `src/services/portal_knowledge/portal_knowledge_service.ts` — the main service that orchestrates all **six** analysis strategies based on configured mode, merges results, and manages staleness.

**Files to create/modify:**

- `src/services/portal_knowledge/portal_knowledge_service.ts` (NEW)
- `src/services/portal_knowledge/mod.ts` (NEW — barrel export)

**Architecture notes:**

- Class `PortalKnowledgeService` implements `IPortalKnowledgeService`
- Constructor DI: `constructor(config: IPortalKnowledgeConfig, memoryBank: IMemoryBankService, provider?: IModelProvider, validator?: OutputValidator, db?: IDatabaseService)`
- Mode determines which strategies run:
  - `quick`: Strategies 1–3 only (directory, config, key files) — no LLM, no symbol extraction
  - `standard`: All 6 strategies with `maxFilesToRead` cap — 1 LLM call + `deno doc --json` for TS portals
  - `deep`: All 6 strategies with higher file read cap — 2–3 LLM calls + full symbol index
- Merges results from all strategies into a single `IPortalKnowledge` object
- `isStale()`: compares `gatheredAt` against `staleness` threshold
- **`getOrAnalyze()` three code paths (addresses Gap 10):** (1) fresh cache → return immediately; (2) stale cache → return stale knowledge **immediately** then fire async background re-analysis (updates cache when complete, never blocks the request); (3) no cache → analyze synchronously before returning. Prevents user-visible latency spikes after each staleness window.
- **`updateKnowledge()` is CLI-only in Phase 46 (addresses Gap 13):** invoked by `exoctl portal analyze [--force]`; performs a full `analyze()` call with `defaultMode`; **no automatic runtime trigger** — all runtime staleness is handled by `getOrAnalyze()` async background path; `changedFiles` parameter reserved for a future automatic-integration phase
- Logs `portal.analyzed` activity to journal via `db.logActivity()`
- Populates `metadata.durationMs`, `metadata.filesScanned`, `metadata.filesRead`

**Success criteria:**

- [x] `quick` mode runs only Strategies 1–3 (no LLM calls, no symbol extraction)
- [x] `standard` mode runs all 6 strategies with 1 LLM call (+`deno doc` for TS)
- [x] `deep` mode runs all 6 strategies with higher caps
- [x] `standard` mode runs Strategy 6 (symbol extractor) for TS portals
- [x] `quick` mode skips Strategy 6 symbol extraction
- [x] Results merged into a single valid `IPortalKnowledge`
- [x] `isStale()` correctly compares timestamps against threshold
- [x] `getOrAnalyze()` returns cached knowledge when fresh
- [x] `getOrAnalyze()` returns stale knowledge immediately when stale, fires async background re-analysis
- [x] `getOrAnalyze()` analyzes synchronously when knowledge is entirely missing
- [x] Logs `portal.analyzed` to activity journal
- [x] Populates all metadata fields accurately
- [x] Implements `IPortalKnowledgeService` interface contract
- [x] Exported through `src/services/portal_knowledge/mod.ts` barrel

**Planned tests** (`tests/services/portal_knowledge/portal_knowledge_service_test.ts`):

- ✅ `[PortalKnowledgeService] quick mode avoids LLM calls`
- ✅ `[PortalKnowledgeService] standard mode includes LLM architecture inference`
- ✅ `[PortalKnowledgeService] deep mode uses higher file read caps`
- ✅ `[PortalKnowledgeService] merges all strategy results correctly`
- ✅ `[PortalKnowledgeService] isStale returns true beyond threshold`
- ✅ `[PortalKnowledgeService] isStale returns false within threshold`
- ✅ `[PortalKnowledgeService] getOrAnalyze returns cached when fresh`
- ✅ `[PortalKnowledgeService] getOrAnalyze returns stale knowledge immediately without blocking`
- ✅ `[PortalKnowledgeService] getOrAnalyze triggers async background re-analysis when stale`
- ✅ `[PortalKnowledgeService] getOrAnalyze analyzes synchronously when missing`
- ✅ `[PortalKnowledgeService] logs portal.analyzed activity`
- ✅ `[PortalKnowledgeService] populates metadata.durationMs`
- ✅ `[PortalKnowledgeService] handles LLM failure in standard mode gracefully`

---

### Step 10: Implement Knowledge Persistence (Memory Bank Mapping) ✅ IMPLEMENTED

**What:** Add persistence for `IPortalKnowledge` — both as `knowledge.json` for programmatic access and as Markdown updates to existing `Memory/Projects/{portal}/` files (`overview.md`, `patterns.md`, `references.md`).

**Files to create/modify:**

- `src/services/portal_knowledge/knowledge_persistence.ts` (NEW)
- `src/services/portal_knowledge/mod.ts` (update barrel)

**Architecture notes:**

- Export functions: `saveKnowledge(portalAlias, knowledge, memoryBank)` and `loadKnowledge(portalAlias, memoryBank) → IPortalKnowledge | null`
- `saveKnowledge` performs two operations:
  1. **Atomic write of `knowledge.json`**: serialize full `IPortalKnowledge` to a `.tmp` file then rename — `knowledge.json` is the sole source for all architectural reference data
  1. **Conditional Markdown updates via `MemoryBankService`**: update `overview.md` (from `architectureOverview`) and `patterns.md` (from `conventions[]`) **only if** those files do not already contain the `<!-- mission-reported -->` sentinel header; skip any file where the sentinel is present to avoid overwriting `MissionReporter`-produced content. `references.md` is **never written** by `PortalKnowledgeService` — that file is exclusively owned by `MissionReporter` (see Gap 5)
- `loadKnowledge` reads `knowledge.json`, validates against `PortalKnowledgeSchema`
- Uses `MemoryBankService` APIs for Markdown file updates (avoids direct file writes)
- Atomic write for `knowledge.json` (write to `.tmp` then rename)

**Success criteria:**

- [x] Writes `knowledge.json` atomically under `Memory/Projects/{portal}/`
- [x] Maps `architectureOverview` to `overview.md` via `MemoryBankService` (when no sentinel)
- [x] Maps `conventions` to `IPattern` entries in `patterns.md` (when no sentinel)
- [x] Checks for `<!-- mission-reported -->` sentinel header before any Markdown write
- [x] Skips Markdown file update when sentinel header is present
- [x] Never writes to `references.md` (owned by `MissionReporter` only)
- [x] `loadKnowledge` validates against `PortalKnowledgeSchema`
- [x] Returns `null` for missing or invalid `knowledge.json`
- [x] Does not overwrite `decisions.md` (only `MissionReporter` writes there)

**Planned tests** (`tests/services/portal_knowledge/knowledge_persistence_test.ts`):

- ✅ `[KnowledgePersistence] saves knowledge.json atomically`
- ✅ `[KnowledgePersistence] loads previously saved knowledge`
- ✅ `[KnowledgePersistence] returns null for missing knowledge`
- ✅ `[KnowledgePersistence] returns null for corrupted knowledge`
- ✅ `[KnowledgePersistence] maps architectureOverview to overview.md`
- ✅ `[KnowledgePersistence] maps conventions to patterns.md`
- ✅ `[KnowledgePersistence] does not write references.md`
- ✅ `[KnowledgePersistence] does not overwrite decisions.md`
- ✅ `[KnowledgePersistence] skips overview update when sentinel is present`

**✅ IMPLEMENTED** — `src/services/portal_knowledge/knowledge_persistence.ts`, 9/9 tests passing

---

### Step 11: Wire Post-Mount Trigger in `portal_commands.ts` ✅ IMPLEMENTED

**What:** Add automatic knowledge gathering after portal mount in `portal_commands.ts`, running `quick` mode analysis synchronously.

**Files to modify:**

- `src/cli/commands/portal_commands.ts` (add analysis call after `ContextCardGenerator.generate()`)

**Architecture notes:**

- After existing `contextCardGenerator.generate()` call in the `add()` command
- Conditional on `portalKnowledgeConfig.autoAnalyzeOnMount`
- Calls `portalKnowledgeService.analyze(alias, resolvedPath, "quick")`
- Quick mode is synchronous and fast (no LLM, <5s) — acceptable in CLI flow
- Persists result via `saveKnowledge()` from Step 10
- Log success/failure; never block portal mount on analysis failure

**Success criteria:**

- [x] Quick analysis runs after portal mount when `autoAnalyzeOnMount` is true
- [x] Analysis is skipped when `autoAnalyzeOnMount` is false
- [x] Analysis failure does not block portal mount
- [x] Result persisted to `Memory/Projects/{portal}/knowledge.json`
- [ ] User sees brief log message about analysis completion

**Planned tests** (`tests/cli/commands/portal_mount_knowledge_test.ts`):

- ✅ `[portal add] triggers quick analysis on mount when enabled`
- ✅ `[portal add] skips analysis when autoAnalyzeOnMount is false`
- ✅ `[portal add] mount succeeds even if analysis fails`
- ✅ `[portal add] persists knowledge.json after analysis`

---

### Step 12: Wire Pre-Execution Trigger in `RequestProcessor`

**What:** Add portal knowledge resolution in `RequestProcessor.process()` before the agent/flow routing split, so both execution paths have access to portal knowledge.

**Files to modify:**

- `src/services/request_processor.ts` (extend `IRequestProcessingContext` with `portalKnowledge?` field; resolve in `process()` alongside `analysis`; inject into agent prompt context via `PORTAL_KNOWLEDGE_KEY`; **add `PortalKnowledgeService` as a new optional constructor parameter and update all instantiation sites** — addresses Gap 2)
- `src/flows/flow_runner.ts` (add `portalKnowledge?: IPortalKnowledge` to `IFlowRunner.execute()` request params and internal type — see Flow Request Coverage section below)

**Architecture notes:**

- Resolve knowledge in `process()` immediately after the `analysis` resolution block, before `pipeline.execute()` — mirrors the existing pattern exactly
- Before calling `getOrAnalyze()`, resolve `portalPath` inline: `const portalPath = this.config.portals?.find(p => p.alias === portal)?.path` — `RequestProcessor` already holds `config`; no new shared utility is needed (addresses Gap 1). Skip knowledge resolution if `portalPath` is undefined.
- If `frontmatter.portal` is set and `portalPath` is resolved, call `portalKnowledgeService.getOrAnalyze(portal, portalPath)` wrapped in `.catch(() => undefined)`
- Add `portalKnowledge?: IPortalKnowledge` to `IRequestProcessingContext` (parallel to `analysis?: IRequestAnalysis`); store result there
- Pass `portalKnowledge` as a parameter to `processAgentRequest()` and `processFlowRequest()` (parallel to `analysis`)
- **Do not** attempt to add `IPortalKnowledge` to `IParsedRequest.context` (`IRequestContextContext`) — that type is a string/primitive record and cannot hold the schema. Instead, inject a Markdown-formatted summary string under `PORTAL_KNOWLEDGE_KEY` constant (following the `PORTAL_CONTEXT_KEY` pattern in `agent_runner.ts`) for prompt injection; the full object lives on `IRequestProcessingContext`
- **`PORTAL_KNOWLEDGE_KEY` summary format (addresses Gap 12):** cap at `PORTAL_KNOWLEDGE_PROMPT_MAX_LINES` (60) lines ≈ 800 tokens; include in order: (1) architecture overview first 20 lines, (2) top-5 key files sorted by role significance, (3) top-5 conventions sorted by `evidenceCount` descending; exclude stats, full dependency list, and monorepo package details. Constant defined in Step 3.
- `getOrAnalyze()` returns **stale knowledge immediately** and fires async background re-analysis when stale; analyzes synchronously when missing (addresses Gap 10)
- Non-blocking for execution: if knowledge gathering fails, proceed without it

**Success criteria:**

- [x] Portal knowledge resolved for portal-bound requests
- [x] `IRequestProcessingContext.portalKnowledge` populated when available
- [x] Both agent and flow paths receive knowledge
- [x] Agent prompts receive a Markdown summary via `PORTAL_KNOWLEDGE_KEY` in `IParsedRequest.context`
- [x] Uses cached knowledge when fresh (no re-analysis overhead)
- [x] Returns stale knowledge immediately; async background re-analysis fires without blocking the request
- [x] `PORTAL_KNOWLEDGE_KEY` summary capped at `PORTAL_KNOWLEDGE_PROMPT_MAX_LINES` lines
- [x] Summary includes architecture overview (20 lines) + top-5 key files + top-5 conventions only
- [x] Proceeds without knowledge on failure

**Planned tests** (`tests/services/request_processor_knowledge_test.ts`):

- ✅ `[RequestProcessor] resolves portal knowledge for portal-bound requests`
- ✅ `[RequestProcessor] populates IRequestProcessingContext.portalKnowledge`
- ✅ `[RequestProcessor] injects knowledge Markdown summary into IParsedRequest.context via PORTAL_KNOWLEDGE_KEY`
- ✅ `[RequestProcessor] skips knowledge for requests without portal`
- ✅ `[RequestProcessor] uses cached knowledge when fresh`
- ✅ `[RequestProcessor] proceeds without knowledge on failure`
- ✅ `[RequestProcessor] passes knowledge to flow processing path`
- ✅ `[RequestProcessor] clamps PORTAL_KNOWLEDGE_KEY summary to PORTAL_KNOWLEDGE_PROMPT_MAX_LINES`
- ✅ `[RequestProcessor] returns stale knowledge immediately without blocking on re-analysis`
- ✅ `[RequestProcessor] buildPortalKnowledgeSummary includes architecture overview`
- ✅ `[RequestProcessor] buildPortalKnowledgeSummary includes top-5 key files`

✅ IMPLEMENTED — 11/11 tests pass

---

### Step 13: Add Portal Knowledge to TUI Data Path

**What:** Extend the portal service layer so TUI can load and display portal knowledge data.

**Files to modify:**

- `src/shared/interfaces/i_portal_service.ts` (add `getKnowledge` method)
- `src/services/portal_service.ts` (implement `getKnowledge`)

**Architecture notes:**

- Add `getKnowledge(portalAlias: string): Promise<IPortalKnowledge | null>` to the portal service interface
- Implementation reads from `knowledge.json` via `loadKnowledge()` from Step 10
- Exposes knowledge data to both CLI and TUI consumers through existing service interface

**Success criteria:**

- [x] `getKnowledge()` defined in portal service interface
- [x] Implementation loads from `knowledge.json`
- [x] Returns `null` when no knowledge exists
- [x] Cached knowledge served without re-analysis

**Planned tests** (`tests/services/portal_knowledge_data_path_test.ts`):

- ✅ `[PortalService] getKnowledge returns knowledge for analyzed portal`
- ✅ `[PortalService] getKnowledge returns null for unanalyzed portal`

**✅ IMPLEMENTED** — `src/services/portal.ts`, `src/shared/interfaces/i_portal_service.ts`, 2/2 tests passing

---

### Step 14: Add Portal Knowledge Display to TUI

**What:** Enhance the portal TUI view to display portal knowledge data — architecture overview, key files, conventions, and dependencies.

**Files to modify:**

- `src/tui/portal_manager_view.ts` (extend with knowledge rendering section and `a` keybinding)

**Architecture notes:**

- Follow existing detail rendering pattern in the TUI
- Add knowledge section with subsections: Architecture Overview (Markdown rendered), Key Files (table: path, role, description), Conventions (grouped by category), Dependencies (key deps with purpose), Stats (file count, extension distribution)
- Lazy-load knowledge via `service.getKnowledge()` when detail view opens
- Show "No analysis available — run `exoctl portal analyze`" when knowledge is missing
- Add keybinding `a` to trigger re-analysis from within the TUI view

**Success criteria:**

- [ ] TUI shows architecture overview when knowledge exists
- [ ] Key files displayed as a table with roles
- [ ] Conventions grouped by category
- [ ] Dependencies listed with purpose
- [ ] Stats section shows file/directory counts and extension distribution
- [ ] Gracefully shows "no analysis" message when knowledge is missing
- [ ] `a` keybinding triggers re-analysis

**Planned tests** (`tests/tui/portal_knowledge_view_test.ts`):

- `[PortalKnowledgeView] displays architecture overview`
- `[PortalKnowledgeView] displays key files table`
- `[PortalKnowledgeView] displays conventions by category`
- `[PortalKnowledgeView] displays dependencies with purpose`
- `[PortalKnowledgeView] shows no-analysis message when missing`
- [x] `[PortalKnowledgeView] keybinding a triggers re-analysis`
- [x] `[regression] CLI wiring: portal analyze and knowledge commands are registered`
- [x] `[regression] CLI: portal analyze and knowledge commands are recognized`

---

### Step 15: Add CLI Commands: `exoctl portal analyze` and `exoctl portal knowledge` [COMPLETED]

**What:** Add two CLI subcommands for manual knowledge management: `analyze` for triggering analysis and `knowledge` for viewing results.

**Files to modify:**

- [x] `src/cli/commands/portal_commands.ts` (add `analyze` and `knowledge` subcommands)
- [x] `src/cli/exoctl.ts` (wire subcommands to CLI tree)

**Architecture notes:**

- `exoctl portal analyze <alias> [--mode quick|standard|deep] [--force]`
  - Loads portal path from database, runs `PortalKnowledgeService.analyze()`
  - `--force` re-analyzes even when fresh knowledge exists
  - Displays analysis summary on completion (duration, files scanned, mode)
- `exoctl portal knowledge <alias> [--json]`
  - Loads `knowledge.json` via `loadKnowledge()`
  - Default: formatted Markdown output (overview, key files, conventions)
  - `--json`: raw JSON output for scripting
- Both commands follow existing portal subcommand patterns in the codebase

**Success criteria:**

- [x] `exoctl portal analyze` triggers analysis and displays summary
- [x] `--mode` flag controls analysis depth
- [x] `--force` flag re-analyzes regardless of staleness
- [x] `exoctl portal knowledge` displays formatted knowledge
- [x] `--json` flag outputs raw JSON
- [x] Both commands handle missing portal gracefully

**Planned tests** (`tests/cli/commands/portal_knowledge_cli_test.ts`):

- ✅ `[portal analyze] triggers analysis and displays summary`
- ✅ `[portal analyze] uses specified mode`
- ✅ `[portal analyze] force re-analyzes fresh knowledge`
- ✅ `[portal knowledge] displays formatted knowledge`
- ✅ `[portal knowledge] outputs raw JSON with --json flag`
- ✅ `[portal knowledge] handles missing portal gracefully`
- ✅ `[portal knowledge] handles unanalyzed portal gracefully`

**✅ IMPLEMENTED** — `src/cli/commands/portal_commands.ts`, 7/7 tests passing

---

### Step 16: Add TOML Configuration for Portal Knowledge

**What:** Add `[portal_knowledge]` section to `templates/exo.config.sample.toml` schema so users can configure knowledge gathering globally.

**Files to modify:**

- `src/shared/schemas/config.ts` (extend `ConfigSchema`)
- `templates/exo.config.sample.toml` (add default section)

**Architecture notes:**

- New TOML section:

  ```toml
  [portal_knowledge]
  auto_analyze_on_mount = true
  default_mode = "quick"
  quick_scan_limit = 200
  max_files_to_read = 50
  staleness_hours = 168
  use_llm_inference = true
  ignore_patterns = ["node_modules", ".git", "dist", "build", "coverage", "__pycache__"]
  ```

- `PortalKnowledgeService` constructor reads config from `Config.portal_knowledge` to construct `IPortalKnowledgeConfig`
- All fields optional with defaults from constants (Step 3)

**Success criteria:**

- [x] Config schema validates new `[portal_knowledge]` section
- [x] All fields are optional with sensible defaults
- [ ] `PortalKnowledgeService` uses config values when constructing analyzer *(wiring deferred to Phase 48; service already accepts `IPortalKnowledgeConfig` DI)*
- [x] Invalid config values produce clear validation errors
- [x] TOML file includes commented example section (`templates/exo.config.sample.toml` + `exo.config.toml`)

**Planned tests** (`tests/schemas/config_portal_knowledge_test.ts`):

- ✅ `[ConfigSchema] validates portal_knowledge section`
- ✅ `[ConfigSchema] uses defaults when portal_knowledge is absent`
- ✅ `[ConfigSchema] rejects invalid default_mode value`
- ✅ `[ConfigSchema] rejects negative quick_scan_limit`
- ✅ `[ConfigSchema] rejects non-array ignore_patterns`

**✅ IMPLEMENTED** — src/shared/schemas/config.ts + exo.config.toml, 5/5 tests passing

---

### Step 17: End-to-End Integration Test

**What:** Create an integration test that verifies the full pipeline from portal mount to knowledge gathering to downstream consumption.

**Files to create:**

- `tests/integration/portal_knowledge_e2e_test.ts` (NEW)

**Architecture notes:**

- Uses `TestEnvironment.create()` for full workspace setup
- Creates a mock portal directory with known structure (files, configs, typical layout)
- Runs through portal mount → `PortalKnowledgeService.analyze()` → persistence → retrieval
- Verifies: `knowledge.json` created, `IProjectMemory` files updated, knowledge available in `IParsedRequest.context` during request processing
- Tests both `quick` and `standard` modes

**Success criteria:**

- [x] Full pipeline: mount portal → analyze → persist → retrieve
- [x] `knowledge.json` contains valid `IPortalKnowledge`
- [x] `overview.md` updated with architecture overview
- [x] `patterns.md` populated with detected conventions
- [ ] `references.md` populated with key files and dependencies
- [x] Knowledge available in `IParsedRequest.context.portalKnowledge` during request processing
- [x] Pipeline degrades gracefully when LLM is unavailable (quick fallback)

**Planned tests:**

- ✅ `[E2E] portal knowledge pipeline with quick mode`
- ✅ `[E2E] portal knowledge pipeline with standard mode (mock LLM)`
- ✅ `[E2E] knowledge persisted as knowledge.json`
- ✅ `[E2E] knowledge mapped to IProjectMemory files`
- ✅ `[E2E] knowledge available in request processing context`
- ✅ `[E2E] stale knowledge re-analyzed on request processing`

**✅ IMPLEMENTED** — tests/integration/32_portal_knowledge_e2e_test.ts, 6/6 tests passing

---

### Step 18: Update `ARCHITECTURE.md`

**What:** Update the project architecture document to reflect the new Portal Knowledge layer, data flow, and activity journal events.

**Files to modify:**

- `ARCHITECTURE.md`

**Sections to update:**

1. **"Portal Management"** — Document the knowledge gathering pipeline: post-mount trigger → strategy pipeline → persistence. Add diagram:

   ```text
   Portal Mount
     → ContextCardGenerator.generate()  (existing)
     → PortalKnowledgeService.analyze() (NEW — quick mode)
   ```

1.

   ```text
   Request File (.md)
     → RequestParser.parse()
     → RequestAnalyzer.analyze()              ← Phase 45
     → PortalKnowledgeService.getOrAnalyze()  ← Phase 46 (NEW)
     → RequestRouter (agent or flow)
   ```

1.

1.

1.
   - Six analysis strategies with LLM/no-LLM breakdown (note Strategy 6 language gate)
   - Three modes comparison table (quick/standard/deep)
   - Persistence model (`knowledge.json` + `IProjectMemory` mapping)
   - Staleness detection and incremental updates
   - Configuration (`[portal_knowledge]` TOML section)

1.

1.

**Success criteria:**

- [x] Portal knowledge pipeline documented with diagram
- [x] Six strategies described with mode matrix (including Strategy 6 `deno doc` language gate)
- [x] `PortalKnowledgeSchema` listed in schema layer section
- [x] `portal.analyzed` event documented
- [x] Memory Bank section updated with knowledge.json
- [x] All internal links use relative paths

**Planned tests:** None (documentation-only; validated by `deno task check:docs` and manual review).

**✅ IMPLEMENTED** — commit: `24b2657`

---

### Step 19: Update User-Facing Documentation in `docs/`

**What:** Update user guide, technical spec, and developer-facing docs to cover portal knowledge gathering.

**Files to modify:**

- `docs/ExoFrame_User_Guide.md`
- `docs/dev/ExoFrame_Technical_Spec.md`
- `docs/dev/ExoFrame_Testing_and_CI_Strategy.md`

**Updates per file:**

1. **`docs/ExoFrame_User_Guide.md`:**
   - Add section explaining portal knowledge: what it does, when it runs, modes
   - Document `exoctl portal analyze <alias>` command with flags
   - Document `exoctl portal knowledge <alias>` command
   - Explain `[portal_knowledge]` config section with TOML examples
   - Describe `knowledge.json` in `Memory/Projects/`

1.
   - Add `IPortalKnowledge` schema specification (all sub-schemas: `IFileSignificance`, `IArchitectureLayer`, `ICodeConvention`, `IDependencyInfo`, `ISymbolEntry`, `IMonorepoPackage`)
   - Document `PortalKnowledgeService` API (modes, strategies, config interface `IPortalKnowledgeConfig`)
   - Document the **six** analysis strategy pipeline with inputs/outputs
   - Note Strategy 6 language gate (TS/JS → `deno doc`; non-TS → empty, future tree-sitter in Phase 60)
   - Add `knowledge.json` to the file format specifications section

1.
   - Add portal knowledge test categories to the test strategy matrix
   - Document strategy tests, service tests, persistence tests, and integration test locations
   - Note new test file locations under `tests/services/portal_knowledge/`

**Success criteria:**

- [x] User guide explains portal knowledge in user-accessible language
- [x] CLI commands documented with usage examples
- [x] `[portal_knowledge]` config section documented
- [x] Technical spec includes schema definitions
- [x] Test strategy doc covers new test categories
- [x] No broken internal links

**Planned tests:** None (documentation-only; validated by manual review and link checker).

**✅ IMPLEMENTED** — commit: `0d0e578`: Update `.copilot/` Agent Documentation

**What:** Update AI agent guidance docs to reflect the new portal knowledge components.

**Files to modify:**

- `.copilot/source/exoframe.md` (add PortalKnowledgeService to service catalog)
- `.copilot/cross-reference.md` (add portal-knowledge task mapping)
- `.copilot/manifest.json` (regenerate via build script)

**Updates:**

1. **`.copilot/source/exoframe.md`:**
   - Add `PortalKnowledgeService` to services section: purpose, location (`src/services/portal_knowledge/`), config interface, strategy list, modes
   - Add `PortalKnowledgeSchema` to schemas section
   - Document the `src/services/portal_knowledge/` directory structure (mod.ts, directory_analyzer.ts, config_parser.ts, key_file_identifier.ts, pattern_detector.ts, architecture_inferrer.ts, portal_knowledge_service.ts, knowledge_persistence.ts)
   - Update portal management section to include knowledge gathering

1.
   - Add row: `portal knowledge / codebase analysis` → `source/exoframe.md` + `planning/phase-46-portal-knowledge-gathering.md`
   - Add topic index entries: `portal-knowledge`, `codebase-analysis`, `architecture-inference`

1.
   - Regenerate via `deno run --allow-read --allow-write scripts/build_agents_index.ts`

**Success criteria:**

- [x] `.copilot/source/exoframe.md` lists `PortalKnowledgeService` in service catalog
- [x] `.copilot/cross-reference.md` has `portal knowledge` task row
- [x] `manifest.json` is fresh (passes `deno task check:docs`)
- [x] Future agents can find portal knowledge guidance via cross-reference

**Planned tests:** `deno task check:docs` passes (verifies manifest freshness).

**✅ IMPLEMENTED** — commit: `83fbccf`

---

### Implementation Order & Dependencies

```text
Step  1: Schema & types              ← foundation, no dependencies
Step  2: Interface                   ← depends on Step 1 (types)
Step  3: Constants & enums           ← can parallel with Steps 1-2
Step  4: Directory analyzer          ← depends on Steps 1, 3
Step  5: Config file parser          ← depends on Steps 1, 3
Step  6: Key file identifier         ← depends on Steps 1, 3
Step  7: Pattern detector            ← depends on Steps 1, 3, 6
Step  8: Architecture inferrer       ← depends on Steps 1, 4, 5, 6, 7
Step 8b: Symbol extractor            ← depends on Steps 1, 3, 5 (entrypoints from config), 6
Step  9: Portal knowledge service    ← depends on Steps 2, 4, 5, 6, 7, 8, 8b
Step 10: Knowledge persistence       ← depends on Steps 1, 9
Step 11: Post-mount trigger          ← depends on Steps 9, 10
Step 12: Pre-execution trigger       ← depends on Steps 9, 10
Step 13: TUI data path               ← depends on Step 10
Step 14: TUI view                    ← depends on Step 13
Step 15: CLI commands                ← depends on Steps 9, 10
Step 16: TOML config                 ← depends on Step 9
Step 17: E2E test                    ← depends on all above
Step 18: ARCHITECTURE.md             ← depends on Steps 11, 12, 14 (needs final design)
Step 19: User & dev docs             ← depends on Steps 15, 16 (needs CLI & config)
Step 20: .copilot/ agent docs        ← depends on Step 18 (needs architecture)
```

**Parallel waves:**

| Wave | Steps | Description |
| ------ | ------- | ------------- |
| 1 | 1, 2, 3 | Types, interfaces, constants (no runtime code) |
| 2 | 4, 5, 6 | Independent heuristic strategies (parallel) |
| 3 | 7, 8, 8b | Pattern detector + architecture inferrer + symbol extractor (all depend on previous; 8 and 8b are independent of each other) |
| 4 | 9, 10 | Orchestrator service + persistence |
| 5 | 11, 12, 15, 16 | Pipeline triggers + CLI + config (parallel) |
| 6 | 13, 14 | TUI integration (depends on data path) |
| 7 | 17 | E2E validation |
| 8 | 18, 19, 20 | Documentation (after implementation stabilizes) |

---

## Methodology: Specification-Driven Development

In SDD, specifications written in a vacuum — without understanding the target codebase — produce feasibility gaps and convention violations. This phase addresses SDD's **grounding** requirement: the specification must be informed by the reality of the codebase. Portal knowledge feeds into the Q&A loop (Phase 47), enabling the planning agent to ask architecture-aware questions and produce specifications that are feasible and convention-aligned.

See `.copilot/process/specification-driven-development.md` for the full SDD analysis.

---

## Dependencies

- `src/services/context_card_generator.ts` — Existing portal card generation (complement, don't replace)
- `src/services/memory_bank.ts` — Persistence via `IProjectMemory` + new `knowledge.json`
- `src/services/prompt_context.ts` — Enhanced context block with architecture knowledge
- `src/cli/commands/portal_commands.ts` — Post-mount trigger point
- `src/services/request_processor.ts` — Pre-execution trigger point
- `src/services/agent_runner.ts` — Portal knowledge injection into `IParsedRequest.context`
- **Phase 45** — `RequestAnalyzer` consumes portal knowledge for file validation and complexity assessment
- **Phase 47** — `RequestQualityGate` and planning agent use portal knowledge for smarter questions and auto-enrichment
- `Blueprints/Agents/code-analyst.md` — Capabilities (read_file, list_directory, grep_search) as reference for analysis strategies

## Risks & Mitigations

| Risk | Mitigation |
| ------ | ----------- |
| Analysis is slow for large codebases | `quick` mode (no LLM, structure-only) is default post-mount; `ignorePatterns` exclude heavy directories; file caps per mode |
| LLM-based architecture inference is inaccurate | Heuristic strategies provide a factual baseline; LLM only augments, doesn't replace; patterns flagged with confidence |
| Knowledge goes stale after codebase changes | Time-based staleness detection (`staleness` threshold, default 1 week); manual re-analysis via `exoctl portal analyze --force`; `MissionReporter` integration deferred to a later phase (see Gap 6) |
| Storage overhead for large portals | `knowledge.json` is a single file; `IProjectMemory` files are Markdown; total overhead is negligible |
| Over-analysis of trivial portals | Configurable mode; `quick` is lightweight; `autoAnalyzeOnMount` can be disabled |
| Privacy: reading portal source code | Already within ExoFrame's security model — portals are explicitly mounted by the user; analysis respects `PathResolver` and sandbox modes |

## Resolved Design Decisions

The following questions were raised during design and have been resolved:

| Question | Decision | Rationale |
| -------- | --------- | --------- |
| Use `code-analyst` blueprint (via `AgentRunner`) or standalone pipeline? | **Standalone pipeline** (`PortalKnowledgeService` + strategy modules) | Lower coupling; avoids recursive agent spawning; synchronous control flow; no blueprint execution overhead for background analysis |
| Should `knowledge.json` be Zod-validated? | **Yes** — `PortalKnowledgeSchema` in `src/shared/schemas/portal_knowledge.ts` (Step 1) | Consistent with all other data schemas in the project; enables safe deserialization in `loadKnowledge()` |
| TUI view for portal knowledge? | **Yes** — extend `src/tui/portal_manager_view.ts` (Step 14) | Surfacing knowledge in TUI closes the feedback loop for users post-mount |
| Complement or replace `code-analyst.md` blueprint? | **Complement** | `code-analyst` blueprint remains for user-triggered interactive deep dives; `PortalKnowledgeService` handles automated background analysis at mount/pre-execution only |
| `portal diff` command (changed since last analysis)? | **Out of scope for Phase 46** | Staleness detection via timestamp covers the core need; a diff command can be introduced in a later phase once knowledge is proven useful |
| Respect `.gitignore` in portal codebase? | **Yes** — `config_parser.ts` (Step 5) reads `.gitignore` from the portal root and merges its patterns into `ignorePatterns`; documented as a success criterion in Step 5 | Avoids analyzing generated/vendor files that the portal itself excludes |

---

## Flow Request Coverage

**Gap identified:** The pre-execution trigger in `RequestProcessor.processAgentRequest()` injects portal knowledge into `parsedRequest.context.portalKnowledge`. But `processFlowRequest()` never builds an `IParsedRequest` and `FlowRunner` receives no portal context.

### Required Changes for Flow Requests

1. **Move portal knowledge resolution before the agent/flow split.** Like request analysis (Phase 45), portal knowledge should be resolved in `RequestProcessor.process()` before `processRequestByKind()`, so both paths have access. (Already reflected in Step 12 above.)

1.

   ```typescript
   async execute(
     flow: IFlow,
     request: {
       userPrompt: string;
       traceId?: string;
       requestId?: string;
       specification?: IRequestSpecification;  // Phase 47
       requestAnalysis?: IRequestAnalysis;     // Phase 45
       portalKnowledge?: IPortalKnowledge;     // Phase 46 (NEW)
     },
   ): Promise<IFlowResult>;
   ```

   Update the internal `FlowRunner.execute()` implementation and the inline object type at the top of `flow_runner.ts` to match.

1.

1.

---

## Gap Analysis & Critique

> **Status:** Identified — to be addressed in subsequent rounds before implementation begins.
> Critical architectural gaps (§1–§6) must be resolved before coding starts; they cause compile errors or data corruption. Feasibility and conceptual gaps (§7–§14) can be addressed incrementally but §10, §12, and §13 should be resolved in their respective steps.

---

### Critical Architectural Gaps

#### Gap 1: Portal path resolution is missing in Step 12

Step 12 calls `portalKnowledgeService.getOrAnalyze(portal, portalPath)` from `RequestProcessor.process()`, but `portalPath` is not available there. The alias → filesystem path mapping lives in `RequestRouter.buildPortalContext()`, which reads `this.config.portals`. This lookup needs to be extracted to a shared utility and called explicitly in `process()`. It is a straightforward fix but will be a blocking compile error if overlooked.

> **✅ Addressed in [Step 12](#step-12-wire-pre-execution-trigger-in-requestprocessor):** `RequestProcessor` already holds `config`; portal path resolved inline via `this.config.portals?.find(p => p.alias === portal)?.path` — no shared utility needed. Added to Step 12 architecture notes.

#### Gap 2: `RequestProcessor` constructor DI is not addressed in Step 12

Step 12 lists two files to modify but does not mention that `PortalKnowledgeService` must be injected into `RequestProcessor`'s constructor (currently: `config, db, processorConfig, testProvider?, costTracker?, testAnalyzer?`). The instantiation site(s) also need updating. This should be called out explicitly in Step 12's "Files to modify" and architecture notes.

> **✅ Addressed in [Step 12](#step-12-wire-pre-execution-trigger-in-requestprocessor):** Constructor DI for `PortalKnowledgeService` and instantiation site updates now explicitly called out in Step 12's files list and architecture notes.

#### Gap 3: `ArchitectureInferrer` produces two incompatible output types from one LLM call

Step 8 says the LLM returns both an `architectureOverview` (Markdown string) and a refined `layers` array (`IArchitectureLayer[]`). The prompt template only asks for Markdown. Getting structured `IArchitectureLayer[]` from a Markdown-producing prompt requires either: (a) a second LLM call, (b) asking the LLM to produce JSON with an embedded Markdown field, or (c) post-processing regex on the Markdown. None of these are specified. `OutputValidator` cannot help without a defined output schema. **Simplest fix:** have `ArchitectureInferrer` produce only `architectureOverview` (Markdown) and leave `layers` as-is from the heuristic pass.

> **✅ Addressed in [Step 8](#step-8-implement-architecture-inferrer-strategy-5--llm):** Step 8 now specifies Markdown-only LLM output for `architectureOverview`; `layers` remain from the Strategy 1 heuristic pass and are never overwritten. Reflected in Step 8 architecture notes and success criteria.

#### Gap 4: Concurrent write races on `IProjectMemory` files

`saveKnowledge()` writes to `overview.md`, `patterns.md`, and `references.md`. `MissionReporter` also writes to these same files after execution. If a request triggers both a `getOrAnalyze()` re-analysis and a `MissionReporter` update in overlapping timing, the writes race. The plan specifies atomic writes for `knowledge.json` but says nothing about the Markdown files. **Simplest mitigation:** `saveKnowledge()` checks for a sentinel header marker before writing and skips a file if mission-reported content is already present; document this in Step 10.

> **✅ Addressed in [Step 10](#step-10-implement-knowledge-persistence-memory-bank-mapping--implemented):** `saveKnowledge()` now specified to check for `<!-- mission-reported -->` sentinel header before writing `overview.md` or `patterns.md`; skips write if sentinel is present. Added to Step 10 architecture notes and success criteria.

#### Gap 5: `references.md` ownership conflict is a data integrity problem

The plan maps `keyFiles` + key dependencies to `references.md` via `MemoryBankService`. But `MissionReporter` also writes references (files consulted during a mission). These are semantically different categories: architectural significance vs. mission-specific context. Overwriting `references.md` on every knowledge refresh destroys mission history. **Two options:** (a) separate namespacing within the file (e.g., `## Architecture` section vs. `## Mission History` section), or (b) keep `knowledge.json` as the sole source for architectural references and never touch `references.md`. Option (b) is simpler and avoids all ownership ambiguity.

> **✅ Addressed in [Step 10](#step-10-implement-knowledge-persistence-memory-bank-mapping--implemented):** Option (b) adopted — `PortalKnowledgeService` never writes to `references.md`; architectural references live exclusively in `knowledge.json`. Reflected in Step 10 architecture notes, success criteria, and the persistence mapping table in [§5 Persistence in Memory Bank](#5-persistence-in-memory-bank).

#### Gap 6: `MissionReporter` → `PortalKnowledgeService` staleness trigger has no implementation path

The Risks section and Staleness section both state "MissionReporter triggers incremental updates." But `MissionReporter` has no reference to `PortalKnowledgeService`, and no event/hook/observer mechanism is described anywhere in the plan. Either this is dead text (staleness is time-based only), or the coupling needs a concrete mechanism (event bus, callback, or direct injection). **Resolution:** remove the claim from Risks/Staleness and replace with "staleness is time-based; `MissionReporter` may trigger an explicit `updateKnowledge()` call if that integration is added in a later phase."

> **✅ Addressed in [§8 Staleness and Incremental Updates](#8-staleness-and-incremental-updates) and [Risks & Mitigations](#risks--mitigations):** `MissionReporter` trigger claim removed from both sections. Phase 46 staleness is time-based only; `MissionReporter` integration explicitly deferred to a later phase.

---

### Feasibility Gaps for Large and Complex Codebases

#### Gap 7: `quickScanLimit = 200` produces a biased, non-reproducible sample

A mid-size Node.js or Rails project has 500–2,000 source files. Scanning only 200 means traversal order determines what is analyzed. BFS from root hits config files first (good), but DFS may stop mid-way through `src/controllers/` (bad). The plan does not specify traversal order, making the 200-file cap non-reproducible across runs. **Fix:** the cap should apply *after* heuristic prioritization — scan root configs and Strategy-3-pattern files first, then fill remaining capacity with a BFS of `src/`.

> **✅ Addressed in [Step 4](#step-4-implement-directory-structure-analyzer-strategy-1--implemented) and [Step 3](#step-3-add-portal-knowledge-constants--implemented):** Priority-first traversal specified in Step 4 architecture notes and success criteria; `PORTAL_KNOWLEDGE_PRIORITY_PATTERNS` constant for pre-selection added to Step 3.

#### Gap 8: Monorepo architecture is incompatible with the flat `IPortalKnowledge` schema

`IPortalKnowledge` has a single `techStack.primaryLanguage`, single `layers[]`, and single `conventions[]`. A 20-package monorepo (Nx, Turborepo, Lerna) has per-package languages, layers, and conventions. The plan notes "detects monorepo vs single-project structure" in Strategy 1 but never defines what `IPortalKnowledge` contains when it IS a monorepo. **Two options:** (a) add an optional `packages: IMonorepoPackage[]` field where each package has its own `layers` and `conventions`, with the top-level fields reflecting the root workspace; or (b) explicitly scope Phase 46 to single-project portals only and document the limitation.

> **✅ Addressed in [Detailed Design §1](#1-iportalknowledge-schema) and [Step 1](#step-1-define-iportalknowledge-zod-schema--types--implemented):** Option (a) adopted — `IMonorepoPackage` interface added to the schema with per-package `layers`, `conventions`, `primaryLanguage`, and `framework?`; `IPortalKnowledge.packages?: IMonorepoPackage[]` field added; `MonorepoPackageSchema` added to Step 1; Step 4 (DirectoryAnalyzer) updated to populate `packages[]` on monorepo detection.

#### Gap 9: LLM context window is not budgeted

`standard` mode reads "up to 20 key files" and sends a directory tree string + config file contents + patterns to the LLM. For a large codebase: 20 files × avg 200 lines × ~4 tokens/line = ~16,000 tokens for file content alone, plus ~1,500 tokens for a 200-directory tree, plus config files and boilerplate. This can approach or exceed 20,000 tokens — beyond many models' effective context and expensive on all of them. No file-length capping, chunking, or content summarization strategy is described. `ArchitectureInferrer` needs an explicit token budget (e.g., 8,000 tokens max input) with per-file truncation logic.

> **✅ Addressed in [Step 8](#step-8-implement-architecture-inferrer-strategy-5--llm) and [Step 3](#step-3-add-portal-knowledge-constants--implemented):** `ARCHITECTURE_INFERRER_TOKEN_BUDGET = 8_000` and `ARCHITECTURE_INFERRER_MAX_FILE_TOKENS = 200` constants added to Step 3; Step 8 architecture notes, success criteria, and planned tests now specify per-file truncation and total prompt cap; low-significance files omitted first when over budget.

#### Gap 10: Standard mode re-analysis blocks the first request after each staleness window

Default staleness is 168 hours (1 week). The first request every week on a stale portal triggers `standard` mode re-analysis: 1 LLM call + reading 20 files, estimated ~15 seconds of user-visible latency before the agent starts. The plan says "Non-blocking for execution: if knowledge gathering fails, proceed without it" — but does not define whether `getOrAnalyze()` blocks until re-analysis completes or returns stale knowledge immediately. **Recommended resolution:** `getOrAnalyze()` returns stale (but available) knowledge immediately and fires re-analysis asynchronously, updating the cache in the background. Must be specified explicitly in Step 9 (`getOrAnalyze()` design) and Step 12.

> **✅ Addressed in [Step 9](#step-9-implement-portalknowledgeservice-orchestrator--implemented) and [Step 12](#step-12-wire-pre-execution-trigger-in-requestprocessor):** `getOrAnalyze()` now specifies three explicit code paths — stale cache returns knowledge immediately and fires async background re-analysis; Steps 9 and 12 architecture notes, success criteria, and planned tests all updated.

---

### Conceptual Gaps

#### Gap 11: Naming-pattern heuristics are not architectural conventions — missing confidence signal

Detecting `*_service.ts` files confirms a naming *convention*, not an architectural pattern. An agent told "this project uses the service pattern" may interpret that as constructor injection, functional services, singleton services, or something else. The `ICodeConvention` structure has no way to distinguish "3 files named this way" from "300 files named this way." **Missing fields:** add `evidenceCount: number` and `confidence: "low" | "medium" | "high"` to `ICodeConvention`. This lets downstream consumers (Phase 47 Q&A, Phase 49 critique) calibrate how strongly to enforce a convention and avoids surfacing noise as fact.

> **✅ Addressed in [Detailed Design §1](#1-iportalknowledge-schema), [Step 1](#step-1-define-iportalknowledge-zod-schema--types--implemented), and [Step 7](#step-7-implement-pattern-detector-strategy-4--heuristic-pass):** `evidenceCount: number` and `confidence: "low" | "medium" | "high"` added to `ICodeConvention` interface and `CodeConventionSchema`; Step 7 architecture notes, success criteria, and planned tests fully updated.

#### Gap 12: The Markdown summary injected into agent prompts has no defined format or token cap

Step 12 says "inject a Markdown-formatted summary string under `PORTAL_KNOWLEDGE_KEY`", following the `PORTAL_CONTEXT_KEY` pattern. But `PORTAL_CONTEXT_KEY` injects a short string (alias + path). A full portal knowledge summary — architecture overview + key files + conventions + dependencies — can be 3,000–8,000 tokens, added to *every* portal-bound agent prompt. No summarization logic, section-inclusion criteria, or token cap is defined. This is the most likely source of regression (token cost spikes, context pollution). Step 12 must specify: maximum token budget for the summary, which sections to include (architecture overview only? top-N key files?), and whether the format is configurable.

> **✅ Addressed in [Step 12](#step-12-wire-pre-execution-trigger-in-requestprocessor) and [Step 3](#step-3-add-portal-knowledge-constants--implemented):** `PORTAL_KNOWLEDGE_PROMPT_MAX_LINES = 60` constant added to Step 3; Step 12 architecture notes specify: architecture overview (first 20 lines) + top-5 key files by role + top-5 conventions by `evidenceCount`; summary format and token cap added to success criteria and planned tests.

#### Gap 13: Incremental update has no trigger mechanism — documentation contradicts reality

The `updateKnowledge()` method "compares directory tree with previous stats — only re-scans changed areas." But detecting what changed requires walking the current directory tree, which is essentially a full scan anyway (O(N) on file count regardless). And as noted in Gap 6, the trigger is undefined: `MissionReporter` coupling is asserted but unimplemented. In practice, incremental updates can only fire via explicit CLI call (`--force`) or the time-based staleness check. The plan should stop describing incremental updates as a runtime feature and either (a) remove `updateKnowledge()` from the public interface (it can be a future enhancement), or (b) document it as CLI-only with no automatic trigger in Phase 46.

> **✅ Addressed in [Step 2](#step-2-define-iportalknowledgeservice-interface--implemented) and [Step 9](#step-9-implement-portalknowledgeservice-orchestrator--implemented):** Option (b) adopted — `updateKnowledge()` scoped as CLI-only in both the interface description and Step 9 architecture notes; `changedFiles` parameter reserved for a future automatic-integration phase; all runtime staleness handled by `getOrAnalyze()` async background path.

#### Gap 14: `quick` mode post-mount does not actually solve the bootstrapping problem

The plan claims to solve "first execution is knowledge-free." But `quick` mode (no LLM, structure + configs only) gives agents a file tree, dependency list, and naming pattern hints — marginally better than the current empty state, but not architectural understanding. An agent asked to "add a new API endpoint" still does not know the routing convention, middleware stack, response format, or where controllers live. The real bootstrapping value comes from `standard` mode LLM inference, which only runs pre-execution (not at mount time). **Recommendation:** scope the Executive Summary's claim to "basic structural orientation" for `quick` mode, and call out that `standard` mode pre-execution analysis provides the architectural understanding needed before the first agent run.

> **✅ Addressed in [Analysis Mode Comparison](#4-analysis-mode-comparison):** `quick` mode description updated to "basic structural orientation only — does not produce architectural understanding"; explicit note to run `exoctl portal analyze` (standard mode) before first agent use added to the mode table.

---

### Overall Feasibility Assessment

The approach is **feasible for small-to-medium single-language projects** (under ~1,000 source files, standard layout). The heuristic strategies produce reliable deterministic value; `standard` mode LLM inference is meaningful at that scale.

For large or complex codebases, three changes are necessary before the design is viable:

1. **Schema extension for monorepos** (Gap 8) — `IMonorepoPackage` sub-structure or explicit scope limitation

1.

The six critical architectural gaps (1–6) must be resolved before coding starts; they cause compile errors or data corruption. Gaps 10, 12, and 13 must be addressed in the design of their respective steps (Step 9, Step 12) before those steps are written.
