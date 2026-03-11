# Phase 46: Portal Codebase Knowledge Gathering

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

  /** Language/framework detected */
  techStack: {
    primaryLanguage: string;
    framework?: string;
    testFramework?: string;
    buildTool?: string;
  };

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
- Detect monorepo vs. single-project structure

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
1.

Format as Markdown suitable for a developer onboarding document.
```

### 4. Analysis Mode Comparison

| Mode | LLM Calls | Files Read | Duration | Use Case |
| ------ | ----------- | ------------ | ---------- | ---------- |
| `quick` | 0 | 0 (structure + configs only) | <5s | Post-mount default; basic orientation |
| `standard` | 1 | Up to 20 key files | ~15s | Pre-execution default; architecture inference |
| `deep` | 2-3 | Up to 50 files | ~60s | Manual `exoctl portal analyze`; full convention mapping |

### 5. Persistence in Memory Bank

Knowledge is persisted using existing `MemoryBankService` APIs, augmented with a new knowledge-specific file:

```text
Memory/Projects/{portal}/
  ├── portal.md            ← Existing: basic context card (ContextCardGenerator)
  ├── overview.md          ← Updated: replaced with architectureOverview from analysis
  ├── patterns.md          ← Updated: populated with detected conventions and patterns
  ├── decisions.md         ← Existing: only from MissionReporter (not auto-populated)
  ├── references.md        ← Updated: populated with key files and dependencies
  └── knowledge.json       ← NEW: full IPortalKnowledge for programmatic access
```

Mapping from `IPortalKnowledge` to `IProjectMemory`:

| IPortalKnowledge Field | IProjectMemory Target | Transformation |
| ------------------------ | ----------------------- | ---------------- |
| `architectureOverview` | `overview` | Direct Markdown |
| `conventions` | `patterns[]` | Map to `IPattern` (name, description, examples, tags) |
| `keyFiles` | `references[]` | Map to `IReference` (type=FILE, path, description) |
| `dependencies[].keyDependencies` | `references[]` | Map to `IReference` (type=LIBRARY, name, purpose) |

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
- A `MissionReporter` records significant changes to portal files
- User force-triggers re-analysis

Incremental updates:

- Track `gatheredAt` timestamp and `version` number
- On re-analysis, compare directory tree with previous `stats` — only re-scan changed areas
- Merge new patterns/conventions with existing ones rather than replacing

---

## Step-by-Step Implementation Plan

### Step 1: Define `IPortalKnowledge` Zod Schema & Types

**What:** Create the Zod schema and inferred TypeScript types for portal knowledge output in `src/shared/schemas/portal_knowledge.ts`. Register the export in `src/shared/schemas/mod.ts`.

**Files to create/modify:**

- `src/shared/schemas/portal_knowledge.ts` (NEW)
- `src/shared/schemas/mod.ts` (add export)

**Architecture notes:**

- Follow project schema convention: `XxxSchema` naming, `z.infer<typeof XxxSchema>` for types
- Sub-schemas: `FileSignificanceSchema`, `ArchitectureLayerSchema`, `CodeConventionSchema`, `DependencyInfoSchema`, `PortalKnowledgeSchema`
- Enum values (`role`, `category`, `mode`) as Zod native enums
- `gatheredAt` as ISO string, `version` as positive integer
- Export both schemas and inferred types (`IPortalKnowledge`, `IFileSignificance`, `IArchitectureLayer`, `ICodeConvention`, `IDependencyInfo`)

**Success criteria:**

- [ ] `PortalKnowledgeSchema.safeParse(validData)` returns `{ success: true }`
- [ ] `PortalKnowledgeSchema.safeParse(invalidData)` returns `{ success: false }` with meaningful errors
- [ ] All sub-schemas parseable independently
- [ ] Schema re-exported through `src/shared/schemas/mod.ts` barrel
- [ ] No lint or type errors

**Planned tests** (`tests/shared/schemas/portal_knowledge_test.ts`):

- `[PortalKnowledgeSchema] validates complete valid knowledge object`
- `[PortalKnowledgeSchema] rejects missing required fields`
- `[PortalKnowledgeSchema] validates version as positive integer`
- `[PortalKnowledgeSchema] validates gatheredAt as ISO string`
- `[FileSignificanceSchema] validates all role enum values`
- `[CodeConventionSchema] validates all category enum values`
- `[DependencyInfoSchema] validates packageManager enum values`
- `[PortalKnowledgeSchema] validates metadata mode enum values`
- `[PortalKnowledgeSchema] validates stats extensionDistribution as Record`

---

### Step 2: Define `IPortalKnowledgeService` Interface

**What:** Create the service interface in `src/shared/interfaces/i_portal_knowledge_service.ts`. Register in interface barrel `src/shared/interfaces/mod.ts`.

**Files to create/modify:**

- `src/shared/interfaces/i_portal_knowledge_service.ts` (NEW)
- `src/shared/interfaces/mod.ts` (add export)

**Architecture notes:**

- Follow interface naming convention: `IPortalKnowledgeService` with method signatures only
- Co-locate `IPortalKnowledgeConfig` in the same file (matches project pattern)
- Methods: `analyze(portalAlias, portalPath, mode?) → Promise<IPortalKnowledge>`, `getOrAnalyze(portalAlias, portalPath) → Promise<IPortalKnowledge>`, `isStale(portalAlias) → Promise<boolean>`, `updateKnowledge(portalAlias, portalPath, changedFiles?) → Promise<IPortalKnowledge>`
- Config: `autoAnalyzeOnMount`, `defaultMode`, `quickScanLimit`, `maxFilesToRead`, `ignorePatterns`, `staleness`, `useLlmInference`

**Success criteria:**

- [ ] Interface exported through barrel `src/shared/interfaces/mod.ts`
- [ ] Interface depends only on types from `src/shared/schemas/` (no concrete service imports)
- [ ] TypeScript compiles with `deno check`

**Planned tests:** None (interface-only; validated by type system at compile time).

---

### Step 3: Add Portal Knowledge Constants

**What:** Add portal knowledge constants to `src/shared/constants.ts` and any new enum values to `src/shared/enums.ts`.

**Files to modify:**

- `src/shared/constants.ts` (add new section)
- `src/shared/enums.ts` (add enums if not already Zod-native)

**Architecture notes:**

- Follow existing sectioned pattern in `constants.ts` (header comment + grouped constants)
- Constants: `DEFAULT_QUICK_SCAN_LIMIT = 200`, `DEFAULT_MAX_FILES_TO_READ = 50`, `DEFAULT_KNOWLEDGE_STALENESS_HOURS = 168`, `DEFAULT_PORTAL_KNOWLEDGE_MODE = "quick"`, `DEFAULT_IGNORE_PATTERNS` (array of common ignore dirs), entrypoint file names, config file names and extensions, architecture-layer directory name mappings, role keyword maps
- No magic numbers in strategy or service code — all from constants

**Success criteria:**

- [ ] All heuristic thresholds/pattern-lists referenced from constants, not inline
- [ ] Constants grouped under `// === Portal Knowledge ===` section header
- [ ] No duplicate constant definitions

**Planned tests:** None (constants are validated through usage in Step 4–8 tests).

---

### Step 4: Implement Directory Structure Analyzer (Strategy 1)

**What:** Create `src/services/portal_knowledge/directory_analyzer.ts` — a standalone module that walks the file tree, builds statistics, and detects architecture layers from directory naming conventions.

**Files to create:**

- `src/services/portal_knowledge/directory_analyzer.ts` (NEW)

**Architecture notes:**

- Pure function module, no class — export `analyzeDirectory(portalPath, ignorePatterns, scanLimit) → Partial<IPortalKnowledge>`
- Zero LLM/provider/network dependencies — sandboxed-safe
- Implements: recursive directory walk (respecting `ignorePatterns`), extension distribution tally, total file/directory counts, architecture layer detection from well-known directory names (`src/services/`, `src/controllers/`, `tests/`, `migrations/`, etc.), monorepo detection (multiple `package.json`/`deno.json` at non-root)
- Returns partial knowledge: `stats`, `layers`, partial `techStack.primaryLanguage` (from dominant extension)
- Respects `scanLimit` by capping files scanned

**Success criteria:**

- [ ] Walks directory tree and collects file statistics
- [ ] Respects `ignorePatterns` (skips `node_modules/`, `.git/`, etc.)
- [ ] Respects `scanLimit` — stops scanning after limit reached
- [ ] Builds `extensionDistribution` correctly
- [ ] Detects architecture layers from standard directory names
- [ ] Detects monorepo vs. single-project structure
- [ ] Identifies `primaryLanguage` from dominant file extension
- [ ] Handles empty directories gracefully
- [ ] Handles symlinks safely (no infinite loops)
- [ ] Completes in <5s for typical mid-size projects

**Planned tests** (`tests/services/portal_knowledge/directory_analyzer_test.ts`):

- `[DirectoryAnalyzer] counts files and directories correctly`
- `[DirectoryAnalyzer] builds extension distribution`
- `[DirectoryAnalyzer] respects ignorePatterns`
- `[DirectoryAnalyzer] respects scanLimit`
- `[DirectoryAnalyzer] detects architecture layers from standard directories`
- `[DirectoryAnalyzer] detects primary language from extension distribution`
- `[DirectoryAnalyzer] detects monorepo structure`
- `[DirectoryAnalyzer] handles empty directory`
- `[DirectoryAnalyzer] handles missing directory gracefully`

---

### Step 5: Implement Config File Parser (Strategy 2)

**What:** Create `src/services/portal_knowledge/config_parser.ts` — a module that reads and parses known config files to extract dependencies, scripts, and conventions.

**Files to create:**

- `src/services/portal_knowledge/config_parser.ts` (NEW)

**Architecture notes:**

- Pure function module: export `parseConfigFiles(portalPath, fileList) → Partial<IPortalKnowledge>`
- Zero LLM dependencies — deterministic, reliable output
- Parses: `package.json`/`deno.json` (JSON), `tsconfig.json`/`jsconfig.json` (JSON), `Cargo.toml`/`pyproject.toml` (TOML), `Dockerfile` (presence detection + base image), CI configs (`.github/workflows/*.yml`) — YAML parse for build/test commands
- Extracts `IDependencyInfo` per config file, key dependencies with purpose heuristic (e.g., "express" → "web framework"), tech stack fields (`framework`, `testFramework`, `buildTool`)
- Handles parse errors gracefully (skip unparseable files, log warning)

**Success criteria:**

- [ ] Parses `package.json` extracting name, dependencies, devDependencies, scripts
- [ ] Parses `deno.json` extracting imports, tasks
- [ ] Parses `tsconfig.json` extracting compiler options and path aliases
- [ ] Detects test framework from dependencies (jest, vitest, deno test)
- [ ] Detects build tool from scripts/tasks (vite, webpack, tsc, esbuild)
- [ ] Detects web framework from dependencies (express, fastify, hono, oak)
- [ ] Gracefully skips files that fail to parse
- [ ] Returns empty result for directories with no recognized config files

**Planned tests** (`tests/services/portal_knowledge/config_parser_test.ts`):

- `[ConfigParser] parses package.json dependencies`
- `[ConfigParser] parses deno.json imports and tasks`
- `[ConfigParser] parses tsconfig.json compiler options`
- `[ConfigParser] detects test framework from dependencies`
- `[ConfigParser] detects web framework from dependencies`
- `[ConfigParser] detects build tool from scripts`
- `[ConfigParser] handles malformed JSON gracefully`
- `[ConfigParser] returns empty for directory with no config files`
- `[ConfigParser] extracts key dependencies with purpose heuristic`

---

### Step 6: Implement Key File Identifier (Strategy 3)

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

- [ ] Identifies standard entrypoints and assigns `entrypoint` role
- [ ] Identifies config files and assigns `config` role
- [ ] Identifies schema/type files and assigns `schema`/`types` role
- [ ] Identifies test helper files and assigns `test-helper` role
- [ ] Identifies routing files and assigns `routing` role
- [ ] Provides brief description for each identified file
- [ ] Sorts by role significance (entrypoints first)
- [ ] Handles case where no significant files found

**Planned tests** (`tests/services/portal_knowledge/key_file_identifier_test.ts`):

- `[KeyFileIdentifier] identifies entrypoint files`
- `[KeyFileIdentifier] identifies config files`
- `[KeyFileIdentifier] identifies schema/types files`
- `[KeyFileIdentifier] identifies test helper files`
- `[KeyFileIdentifier] identifies routing files`
- `[KeyFileIdentifier] assigns correct roles`
- `[KeyFileIdentifier] sorts by significance`
- `[KeyFileIdentifier] handles no significant files`
- `[KeyFileIdentifier] respects output cap limit`

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

- [ ] Detects service pattern from `*_service.ts` naming
- [ ] Detects test layout pattern (co-located vs. mirror)
- [ ] Detects test naming convention (`*.test.ts` vs. `*_test.ts` vs. `*.spec.ts`)
- [ ] Detects barrel export pattern from `mod.ts`/`index.ts`
- [ ] Provides example file paths for each detected convention
- [ ] Assigns correct category to each convention
- [ ] Works without `readFileContents` (heuristic only)
- [ ] Enhanced detection when `readFileContents` provided

**Planned tests** (`tests/services/portal_knowledge/pattern_detector_test.ts`):

- `[PatternDetector] detects service naming pattern`
- `[PatternDetector] detects repository naming pattern`
- `[PatternDetector] detects co-located test layout`
- `[PatternDetector] detects mirror test layout`
- `[PatternDetector] detects test file naming convention`
- `[PatternDetector] detects barrel export pattern`
- `[PatternDetector] provides examples for each convention`
- `[PatternDetector] assigns correct categories`
- `[PatternDetector] works in heuristic-only mode`
- `[PatternDetector] detects import patterns when reading file contents`

---

### Step 8: Implement Architecture Inferrer (Strategy 5 — LLM)

**What:** Create `src/services/portal_knowledge/architecture_inferrer.ts` — a module that uses an LLM to produce a high-level architecture overview from the combined strategy outputs.

**Files to create:**

- `src/services/portal_knowledge/architecture_inferrer.ts` (NEW)

**Architecture notes:**

- Class `ArchitectureInferrer` with constructor DI: `constructor(provider: IModelProvider, validator: OutputValidator)`
- Uses `OutputValidator.validate()` to parse LLM response
- Input: directory tree string, key files list, config contents, detected patterns, dependency info
- Output: `architectureOverview` (Markdown string), refined `layers` array
- Prompt template as a private constant (matches `ReflexiveAgent` pattern)
- Only runs in `standard` and `deep` modes (never in `quick`)
- Falls back to empty overview on LLM failure

**Success criteria:**

- [ ] Calls `provider.generate()` with structured architecture analysis prompt
- [ ] Validates LLM response with expected output format
- [ ] Returns Markdown architecture overview
- [ ] Returns refined architecture layers
- [ ] Falls back to empty overview on LLM failure
- [ ] Prompt includes all input signals (tree, key files, configs, patterns, deps)
- [ ] Uses reasonable token budget (`temperature: 0`)

**Planned tests** (`tests/services/portal_knowledge/architecture_inferrer_test.ts`):

- `[ArchitectureInferrer] generates architecture overview from mock LLM response`
- `[ArchitectureInferrer] passes directory tree in prompt`
- `[ArchitectureInferrer] passes key files and patterns in prompt`
- `[ArchitectureInferrer] handles LLM failure gracefully`
- `[ArchitectureInferrer] returns empty overview on invalid LLM output`
- `[ArchitectureInferrer] uses OutputValidator for response parsing`

---

### Step 9: Implement `PortalKnowledgeService` (Orchestrator)

**What:** Create `src/services/portal_knowledge/portal_knowledge_service.ts` — the main service that orchestrates all five analysis strategies based on configured mode, merges results, and manages staleness.

**Files to create/modify:**

- `src/services/portal_knowledge/portal_knowledge_service.ts` (NEW)
- `src/services/portal_knowledge/mod.ts` (NEW — barrel export)

**Architecture notes:**

- Class `PortalKnowledgeService` implements `IPortalKnowledgeService`
- Constructor DI: `constructor(config: IPortalKnowledgeConfig, memoryBank: IMemoryBankService, provider?: IModelProvider, validator?: OutputValidator, db?: IDatabaseService)`
- Mode determines which strategies run:
  - `quick`: Strategies 1–3 only (directory, config, key files) — no LLM
  - `standard`: All 5 strategies with `maxFilesToRead` cap — 1 LLM call
  - `deep`: All 5 strategies with higher file read cap — 2–3 LLM calls
- Merges results from all strategies into a single `IPortalKnowledge` object
- `isStale()`: compares `gatheredAt` against `staleness` threshold
- `getOrAnalyze()`: loads cached knowledge, re-analyzes if stale or missing
- `updateKnowledge()`: incremental — compare file tree with previous stats, only re-scan changed areas
- Logs `portal.analyzed` activity to journal via `db.logActivity()`
- Populates `metadata.durationMs`, `metadata.filesScanned`, `metadata.filesRead`

**Success criteria:**

- [ ] `quick` mode runs only Strategies 1–3 (no LLM calls)
- [ ] `standard` mode runs all 5 strategies with 1 LLM call
- [ ] `deep` mode runs all 5 strategies with higher caps
- [ ] Results merged into a single valid `IPortalKnowledge`
- [ ] `isStale()` correctly compares timestamps against threshold
- [ ] `getOrAnalyze()` returns cached knowledge when fresh
- [ ] `getOrAnalyze()` re-analyzes when stale or missing
- [ ] Logs `portal.analyzed` to activity journal
- [ ] Populates all metadata fields accurately
- [ ] Implements `IPortalKnowledgeService` interface contract
- [ ] Exported through `src/services/portal_knowledge/mod.ts` barrel

**Planned tests** (`tests/services/portal_knowledge/portal_knowledge_service_test.ts`):

- `[PortalKnowledgeService] quick mode avoids LLM calls`
- `[PortalKnowledgeService] standard mode includes LLM architecture inference`
- `[PortalKnowledgeService] deep mode uses higher file read caps`
- `[PortalKnowledgeService] merges all strategy results correctly`
- `[PortalKnowledgeService] isStale returns true beyond threshold`
- `[PortalKnowledgeService] isStale returns false within threshold`
- `[PortalKnowledgeService] getOrAnalyze returns cached when fresh`
- `[PortalKnowledgeService] getOrAnalyze re-analyzes when stale`
- `[PortalKnowledgeService] getOrAnalyze analyzes when missing`
- `[PortalKnowledgeService] logs portal.analyzed activity`
- `[PortalKnowledgeService] populates metadata.durationMs`
- `[PortalKnowledgeService] handles LLM failure in standard mode gracefully`

---

### Step 10: Implement Knowledge Persistence (Memory Bank Mapping)

**What:** Add persistence for `IPortalKnowledge` — both as `knowledge.json` for programmatic access and as Markdown updates to existing `Memory/Projects/{portal}/` files (`overview.md`, `patterns.md`, `references.md`).

**Files to create/modify:**

- `src/services/portal_knowledge/knowledge_persistence.ts` (NEW)
- `src/services/portal_knowledge/mod.ts` (update barrel)

**Architecture notes:**

- Export functions: `saveKnowledge(portalAlias, knowledge, memoryBank)` and `loadKnowledge(portalAlias, memoryBank) → IPortalKnowledge | null`
- `saveKnowledge` performs two operations:
  1. Write `knowledge.json` (full `IPortalKnowledge` serialized, atomic write)
  1.
- `loadKnowledge` reads `knowledge.json`, validates against `PortalKnowledgeSchema`
- Uses `MemoryBankService` APIs for Markdown file updates (avoids direct file writes)
- Atomic write for `knowledge.json` (write to `.tmp` then rename)

**Success criteria:**

- [ ] Writes `knowledge.json` atomically under `Memory/Projects/{portal}/`
- [ ] Maps `architectureOverview` to `overview.md` via `MemoryBankService`
- [ ] Maps `conventions` to `IPattern` entries in `patterns.md`
- [ ] Maps `keyFiles` and key dependencies to `IReference` entries in `references.md`
- [ ] `loadKnowledge` validates against `PortalKnowledgeSchema`
- [ ] Returns `null` for missing or invalid `knowledge.json`
- [ ] Does not overwrite `decisions.md` (only `MissionReporter` writes there)

**Planned tests** (`tests/services/portal_knowledge/knowledge_persistence_test.ts`):

- `[KnowledgePersistence] saves knowledge.json atomically`
- `[KnowledgePersistence] loads previously saved knowledge`
- `[KnowledgePersistence] returns null for missing knowledge`
- `[KnowledgePersistence] returns null for corrupted knowledge`
- `[KnowledgePersistence] maps architectureOverview to overview.md`
- `[KnowledgePersistence] maps conventions to patterns.md`
- `[KnowledgePersistence] maps keyFiles to references.md`
- `[KnowledgePersistence] does not overwrite decisions.md`

---

### Step 11: Wire Post-Mount Trigger in `portal_commands.ts`

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

- [ ] Quick analysis runs after portal mount when `autoAnalyzeOnMount` is true
- [ ] Analysis is skipped when `autoAnalyzeOnMount` is false
- [ ] Analysis failure does not block portal mount
- [ ] Result persisted to `Memory/Projects/{portal}/knowledge.json`
- [ ] User sees brief log message about analysis completion

**Planned tests** (`tests/cli/commands/portal_mount_knowledge_test.ts`):

- `[portal add] triggers quick analysis on mount when enabled`
- `[portal add] skips analysis when autoAnalyzeOnMount is false`
- `[portal add] mount succeeds even if analysis fails`
- `[portal add] persists knowledge.json after analysis`

---

### Step 12: Wire Pre-Execution Trigger in `RequestProcessor`

**What:** Add portal knowledge resolution in `RequestProcessor.process()` before the agent/flow routing split, so both execution paths have access to portal knowledge.

**Files to modify:**

- `src/services/request_processor.ts` (add knowledge resolution)
- `src/services/request_common.ts` (extend `buildParsedRequest` to accept portal knowledge)

**Architecture notes:**

- After `RequestParser.parse()` and before `processRequestByKind()` — same location as Phase 45 analysis integration
- If request has a `portal` field, call `portalKnowledgeService.getOrAnalyze()`
- Inject `IPortalKnowledge` into `IParsedRequest.context.portalKnowledge`
- Also available on `IRequestProcessingContext` for flow path
- `getOrAnalyze()` returns cached knowledge when fresh, re-analyzes with `standard` mode if stale
- Non-blocking for execution: if knowledge gathering fails, proceed without it

**Success criteria:**

- [ ] Portal knowledge resolved for portal-bound requests
- [ ] Knowledge available in `IParsedRequest.context.portalKnowledge`
- [ ] Both agent and flow paths receive knowledge
- [ ] Uses cached knowledge when fresh (no re-analysis overhead)
- [ ] Re-analyzes with `standard` mode when stale
- [ ] Proceeds without knowledge on failure

**Planned tests** (`tests/services/request_processor_knowledge_test.ts`):

- `[RequestProcessor] resolves portal knowledge for portal-bound requests`
- `[RequestProcessor] injects knowledge into IParsedRequest.context`
- `[RequestProcessor] skips knowledge for requests without portal`
- `[RequestProcessor] uses cached knowledge when fresh`
- `[RequestProcessor] proceeds without knowledge on failure`
- `[RequestProcessor] passes knowledge to flow processing path`

---

### Step 13: Add Portal Knowledge to TUI Data Path

**What:** Extend the portal/request service layer so TUI can load and display portal knowledge data.

**Files to modify:**

- `src/shared/interfaces/i_portal_service.ts` or equivalent (add `getKnowledge` method)
- Portal service implementation (implement `getKnowledge`)

**Architecture notes:**

- Add `getKnowledge(portalAlias: string): Promise<IPortalKnowledge | null>` to the portal service interface
- Implementation reads from `knowledge.json` via `loadKnowledge()` from Step 10
- Exposes knowledge data to both CLI and TUI consumers through existing service interface

**Success criteria:**

- [ ] `getKnowledge()` defined in portal service interface
- [ ] Implementation loads from `knowledge.json`
- [ ] Returns `null` when no knowledge exists
- [ ] Cached knowledge served without re-analysis

**Planned tests** (`tests/services/portal_knowledge_data_path_test.ts`):

- `[PortalService] getKnowledge returns knowledge for analyzed portal`
- `[PortalService] getKnowledge returns null for unanalyzed portal`

---

### Step 14: Add Portal Knowledge Display to TUI

**What:** Enhance the portal-related TUI view to display portal knowledge data — architecture overview, key files, conventions, and dependencies.

**Files to modify:**

- Portal detail view in TUI (extend with knowledge rendering)

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
- `[PortalKnowledgeView] keybinding a triggers re-analysis`

---

### Step 15: Add CLI Commands: `exoctl portal analyze` and `exoctl portal knowledge`

**What:** Add two CLI subcommands for manual knowledge management: `analyze` for triggering analysis and `knowledge` for viewing results.

**Files to modify:**

- `src/cli/commands/portal_commands.ts` (add `analyze` and `knowledge` subcommands)

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

- [ ] `exoctl portal analyze` triggers analysis and displays summary
- [ ] `--mode` flag controls analysis depth
- [ ] `--force` flag re-analyzes regardless of staleness
- [ ] `exoctl portal knowledge` displays formatted knowledge
- [ ] `--json` flag outputs raw JSON
- [ ] Both commands handle missing portal gracefully

**Planned tests** (`tests/cli/commands/portal_knowledge_cli_test.ts`):

- `[portal analyze] triggers analysis and displays summary`
- `[portal analyze] uses specified mode`
- `[portal analyze] force re-analyzes fresh knowledge`
- `[portal knowledge] displays formatted knowledge`
- `[portal knowledge] outputs raw JSON with --json flag`
- `[portal knowledge] handles missing portal gracefully`
- `[portal knowledge] handles unanalyzed portal gracefully`

---

### Step 16: Add TOML Configuration for Portal Knowledge

**What:** Add `[portal_knowledge]` section to `exo.config.toml` schema so users can configure knowledge gathering globally.

**Files to modify:**

- `src/shared/schemas/config.ts` (extend `ConfigSchema`)
- `exo.config.toml` (add default section)

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

- [ ] Config schema validates new `[portal_knowledge]` section
- [ ] All fields are optional with sensible defaults
- [ ] `PortalKnowledgeService` uses config values when constructing analyzer
- [ ] Invalid config values produce clear validation errors
- [ ] TOML file includes commented example section

**Planned tests** (`tests/shared/schemas/config_portal_knowledge_test.ts`):

- `[ConfigSchema] validates portal_knowledge section`
- `[ConfigSchema] uses defaults when portal_knowledge is absent`
- `[ConfigSchema] rejects invalid default_mode value`
- `[ConfigSchema] rejects negative quick_scan_limit`
- `[ConfigSchema] rejects non-array ignore_patterns`

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

- [ ] Full pipeline: mount portal → analyze → persist → retrieve
- [ ] `knowledge.json` contains valid `IPortalKnowledge`
- [ ] `overview.md` updated with architecture overview
- [ ] `patterns.md` populated with detected conventions
- [ ] `references.md` populated with key files and dependencies
- [ ] Knowledge available in `IParsedRequest.context.portalKnowledge` during request processing
- [ ] Pipeline degrades gracefully when LLM is unavailable (quick fallback)

**Planned tests:**

- `[E2E] portal knowledge pipeline with quick mode`
- `[E2E] portal knowledge pipeline with standard mode (mock LLM)`
- `[E2E] knowledge persisted as knowledge.json`
- `[E2E] knowledge mapped to IProjectMemory files`
- `[E2E] knowledge available in request processing context`
- `[E2E] stale knowledge re-analyzed on request processing`

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
     → RequestAnalyzer.analyze()           ← Phase 45
     → PortalKnowledgeService.getOrAnalyze() ← Phase 46 (NEW)
     → RequestRouter (agent or flow)
   ```

1.

1.

1.
   - Five analysis strategies with LLM/no-LLM breakdown
   - Three modes comparison table (quick/standard/deep)
   - Persistence model (knowledge.json + IProjectMemory mapping)
   - Staleness detection and incremental updates
   - Configuration (`[portal_knowledge]` TOML section)

1.

1.

**Success criteria:**

- [ ] Portal knowledge pipeline documented with diagram
- [ ] Five strategies described with mode matrix
- [ ] `PortalKnowledgeSchema` listed in schema layer section
- [ ] `portal.analyzed` event documented
- [ ] Memory Bank section updated with knowledge.json
- [ ] All internal links use relative paths

**Planned tests:** None (documentation-only; validated by `deno task check:docs` and manual review).

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
   - Add `IPortalKnowledge` schema specification
   - Document `PortalKnowledgeService` API (modes, strategies, config)
   - Document analysis strategy pipeline
   - Add `knowledge.json` to file format specifications

1.
   - Add portal knowledge test categories to the test strategy matrix
   - Document strategy tests, service tests, persistence tests, integration tests
   - Note new test file locations (`tests/services/portal_knowledge/`)

**Success criteria:**

- [ ] User guide explains portal knowledge in user-accessible language
- [ ] CLI commands documented with usage examples
- [ ] `[portal_knowledge]` config section documented
- [ ] Technical spec includes schema definitions
- [ ] Test strategy doc covers new test categories
- [ ] No broken internal links

**Planned tests:** None (documentation-only; validated by manual review and link checker).

---

### Step 20: Update `.copilot/` Agent Documentation

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

- [ ] `.copilot/source/exoframe.md` lists `PortalKnowledgeService` in service catalog
- [ ] `.copilot/cross-reference.md` has `portal knowledge` task row
- [ ] `manifest.json` is fresh (passes `deno task check:docs`)
- [ ] Future agents can find portal knowledge guidance via cross-reference

**Planned tests:** `deno task check:docs` passes (verifies manifest freshness).

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
Step  9: Portal knowledge service    ← depends on Steps 2, 4, 5, 6, 7, 8
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
| 3 | 7, 8 | Pattern detector + architecture inferrer (depend on previous) |
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
| Knowledge goes stale after codebase changes | Staleness detection; `MissionReporter` triggers incremental updates; manual re-analysis via CLI |
| Storage overhead for large portals | `knowledge.json` is a single file; `IProjectMemory` files are Markdown; total overhead is negligible |
| Over-analysis of trivial portals | Configurable mode; `quick` is lightweight; `autoAnalyzeOnMount` can be disabled |
| Privacy: reading portal source code | Already within ExoFrame's security model — portals are explicitly mounted by the user; analysis respects `PathResolver` and sandbox modes |

## Open Questions

- Should deep analysis use the `code-analyst` agent blueprint (via `AgentRunner`) or a standalone analysis pipeline?
- Should `knowledge.json` be a Zod-validated schema in `src/shared/schemas/`?
- Should the TUI have a "Portal Knowledge" view showing architecture overview, patterns, and key files?
- How should this interact with the existing `code-analyst.md` blueprint's read-only analysis capabilities — complement or replace?
- Should there be a `portal diff` command that shows what changed since last analysis?
- Should knowledge gathering respect `.gitignore` patterns in the portal codebase?

---

## Flow Request Coverage

**Gap identified:** The pre-execution trigger in `RequestProcessor.processAgentRequest()` injects portal knowledge into `parsedRequest.context.portalKnowledge`. But `processFlowRequest()` never builds an `IParsedRequest` and `FlowRunner` receives no portal context.

### Required Changes for Flow Requests

1. **Move portal knowledge resolution before the agent/flow split.** Like request analysis (Phase 45), portal knowledge should be resolved in `RequestProcessor.process()` before `processRequestByKind()`, so both paths have access.

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
    portalKnowledge?: IPortalKnowledge;     // Phase 46
  },
): Promise<IFlowResult>;
```

1.

1.
