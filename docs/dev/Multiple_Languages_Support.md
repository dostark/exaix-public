# Multi-Language Portal Support — Revised Approach

## The Core Mental Model: Language Zones, Not Primary Language

A portal is not a Python project or a TypeScript project. It is a **filesystem with multiple coexisting language zones**, each contributing to the whole. The analysis unit must shift from:

````text
portal → one language → one analysis
```text
to:
```text
portal → N detected language zones → N parallel analyses → merged IPortalKnowledge
```text

The existing `IConfigParseResult.techStack.primaryLanguage` field reflects the old thinking — a single string. This must be replaced with a structured **language composition map**.

***

### 1. Language Zone Detection (Strategy 1 Enhancement)

`DirectoryAnalyzer` already produces an extension census (file count per extension). Rather than collapsing this into one `primaryLanguage`, extend it to produce a `ILanguageZoneMap`:

```typescript
// src/services/portal_knowledge/language_zone_detector.ts

export interface ILanguageZone {
  /** Canonical language id: "typescript" | "python" | "go" | "rust" | "java" | "sql" | ... */
  language: string;
  /** File extensions belonging to this zone */
  extensions: string[];
  /** Relative file paths in this zone */
  files: string[];
  /** Fraction of all source files */
  coverage: number;          // 0.0–1.0
  /** Directories where this language is dominant */
  rootPaths: string[];
  /** Role inferred from directory names and file patterns */
  role: "backend" | "frontend" | "infra" | "data" | "scripts" | "tests" | "docs" | "mixed";
  /** Whether a toolchain for symbol extraction is available at runtime */
  toolchainAvailable: boolean;
}

export type ILanguageZoneMap = Map<string, ILanguageZone>;
```text

**Detection algorithm** — runs as a pure, zero-LLM pass over the directory census:

```typescript
export async function detectLanguageZones(
  portalPath: string,
  fileList: string[],
): Promise<ILanguageZoneMap> {
  // 1. Group files by extension → language via EXTENSION_TO_LANGUAGE table
  // 2. Compute coverage per language (files / total source files)
  // 3. Skip below MIN_COVERAGE_THRESHOLD (default: 0.01 — at least 1% of files)
  // 4. For each language zone, identify root directories where it clusters
  // 5. Infer role from directory names: scripts/→scripts, tests/→tests,
  //    frontend/|web/|ui/→frontend, infra/|terraform/|helm/→infra, etc.
  // 6. Probe toolchain availability via SafeSubprocess (python --version,
  //    go version, rustc --version, etc.) — cached for session duration
}
```text

**Extension-to-language table** (extensible at runtime via config):

```typescript
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".ts": "typescript",  ".tsx": "typescript",
  ".js": "javascript",  ".jsx": "javascript",  ".mjs": "javascript",
  ".py": "python",      ".pyi": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",      ".kt": "kotlin",       ".kts": "kotlin",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".ex": "elixir",      ".exs": "elixir",
  ".hs": "haskell",
  ".sql": "sql",
  ".sh": "shell",       ".bash": "shell",      ".zsh": "shell",
  ".ps1": "powershell",
  ".tf": "terraform",   ".tfvars": "terraform",
  ".proto": "protobuf",
  ".yaml": "config",    ".yml": "config",
  ".toml": "config",    ".json": "config",
  ".dockerfile": "docker", // + filename "Dockerfile"
  ".md": "docs",        ".rst": "docs",
  ".c": "c",            ".h": "c",
  ".cpp": "cpp",        ".hpp": "cpp",
};
```text

Special filename patterns also feed zone detection: `Dockerfile*` → `docker`, `Makefile` → `make`, `*.proto` → `protobuf`, `*.sql` → `sql`, `*.tf` → `terraform`.

***

### 2. Composite Analysis Architecture

Replace the single-language assumption in `PortalKnowledgeService` with a **composite analysis pipeline** that runs all six strategies across all detected language zones, then merges results:

```text
DirectoryAnalyzer (Strategy 1)
        ↓
LanguageZoneDetector     ← NEW: produces ILanguageZoneMap
        ↓
┌───────────────────────────────────────────────────────┐
│  For each ILanguageZone in parallel:                  │
│                                                       │
│  ILanguageAnalyzer (zone)                             │
│  ├── parseConfigFiles()    → IDependencyInfo[]        │
│  ├── identifyKeyFiles()    → IKeyFile[]               │
│  ├── buildImportMap()      → Record<string,string[]>  │
│  ├── extractSymbols()      → ISymbolEntry[]           │
│  └── detectPatterns()      → IPattern[]               │
└───────────────────────────────────────────────────────┘
        ↓
CompositeArchitectureInferrer   ← NEW: cross-language layer inference
        ↓
KnowledgeMerger                 ← NEW: merge all zone results
        ↓
IPortalKnowledge (updated schema)
```text

The key insight: **most strategies can run per-zone independently**. Architecture inference is the one strategy that benefits from seeing the full cross-zone picture — it is the only one that runs after all zones are processed.

***

### 3. Updated `IPortalKnowledge` Schema

The current schema has a single `techStack.primaryLanguage: string`. Replace with:

```typescript
// src/shared/schemas/portal_knowledge.ts — additions

export interface ILanguageZoneSummary {
  language: string;
  coverage: number;           // 0.0–1.0
  fileCount: number;
  role: string;
  rootPaths: string[];
  framework?: string;
  testFramework?: string;
  buildTool?: string;
  packageManager?: string;
  keyDependencies: IDependencyInfo[];
  symbols: ISymbolEntry[];    // populated if toolchain available
  patterns: IPattern[];
}

export interface IPortalTechStack {
  /** All detected languages, ordered by coverage descending */
  languages: ILanguageZoneSummary[];
  /** Convenience: language with highest source file coverage */
  primaryLanguage: string;
  /** All unique frameworks across all zones */
  frameworks: string[];
  /** Cross-language architecture layers */
  architectureLayers: IArchitectureLayer[];
  /** Detected inter-language boundaries (e.g. TS→Python via REST, Go→SQL via ORM) */
  languageBoundaries: ILanguageBoundary[];
}

export interface ILanguageBoundary {
  from: string;    // language id
  to: string;      // language id
  mechanism: "rest_api" | "grpc" | "ffi" | "subprocess" | "shared_db" | "message_queue" | "file" | "unknown";
  evidence: string[];  // file paths or patterns that suggest this boundary
}
```text

`primaryLanguage` is now a **computed convenience field** derived from `languages[0].language` — it remains for backward compatibility with existing blueprint prompts and skills, but all deep analysis uses the full `languages` array.

***

### 4. `ILanguageAnalyzer` Interface (replacing `ILanguageAdapter`)

Instead of a single per-portal adapter, each language registers an `ILanguageAnalyzer` that operates on a **zone** (a subset of portal files):

```typescript
// src/services/portal_knowledge/language_analyzers/i_language_analyzer.ts

export interface ILanguageAnalyzer {
  readonly language: string;
  readonly sourceExtensions: string[];
  readonly configFileNames: string[];

  /** Parse config/manifest files for dependency and tech-stack info */
  parseConfigFiles(
    portalPath: string,
    zoneFiles: string[],
  ): Promise<IConfigParseResult>;

  /** Identify entry points, API surfaces, main modules */
  identifyKeyFiles(
    portalPath: string,
    zoneFiles: string[],
  ): Promise<string[]>;

  /** Build intra-zone import/dependency graph */
  buildImportMap(
    portalPath: string,
    zoneFiles: string[],
  ): Promise<Record<string, string[]>>;

  /** Extract public symbols (functions, classes, types, interfaces) */
  extractSymbols(
    portalPath: string,
    zoneFiles: string[],
    importMap: Record<string, string[]>,
  ): Promise<ISymbolEntry[]>;

  /** Detect naming conventions and code patterns */
  detectPatterns(
    portalPath: string,
    zoneFiles: string[],
  ): Promise<IPattern[]>;
}
```text

A **GenericLanguageAnalyzer** (fallback) implements this interface using only:

- File extension counting (directory analyzer output)
- `ctags --output-format=json` for symbols (supports 40+ languages with one binary)
- Regex-based import parsing as a last resort

***

### 5. Cross-Language Architecture Inference

The `CompositeArchitectureInferrer` receives the merged results from all zone analyzers and performs the cross-cutting analysis that only makes sense with the full picture:

```typescript
// src/services/portal_knowledge/composite_architecture_inferrer.ts

export class CompositeArchitectureInferrer {
  infer(
    portalPath: string,
    zones: ILanguageZoneSummary[],
    allImportMaps: Record<string, Record<string, string[]>>, // language → importMap
  ): ICompositeArchitecture {

    const layers = this.inferLayers(zones);
    const boundaries = this.detectLanguageBoundaries(portalPath, zones);
    const patterns = this.detectCrossLanguagePatterns(zones, boundaries);

    return { layers, boundaries, patterns };
  }
}
```text

# Layer inference by zone role and cross-language evidence:

| Pattern detected | Inferred boundary mechanism | Example |
| --- | --- | --- |
| `openapi.yaml` or `swagger.json` + TypeScript + Python zones | `rest_api` | TS frontend → Python FastAPI backend |
| `*.proto` files + Go zone + any other zone | `grpc` | Go service ↔ Java service via protobuf |
| SQL zone + Python/Go/Java zone with ORM deps | `shared_db` | Multiple services share a DB schema |
| Python zone with `subprocess` imports + shell zone | `subprocess` | Python orchestrates shell scripts |
| `Dockerfile` + any language zone | Container boundary → deployment layer |
| `*.tf` (Terraform) + any language zone | Infra zone |

***

### 6. Blueprint Identity Changes for Multi-Language Portals

The current built-in identities have system prompts written entirely from a TypeScript/Node.js perspective. With multi-language support, the prompt construction must inject language-aware context dynamically from `IPortalKnowledge`.

# Approach: language context blocks injected by `ContextLoader`

Rather than creating one identity per language, `ContextLoader` constructs a **language context block** from `IPortalKnowledge.techStack.languages` and injects it between the system prompt and the request:

```typescript
// src/services/context_loader.ts — new method

function buildLanguageContextBlock(techStack: IPortalTechStack): string {
  const lines: string[] = [
    "## Portal Tech Stack",
    `Primary language: ${techStack.primaryLanguage}`,
    "",
    "### Language Zones",
  ];

  for (const zone of techStack.languages) {
    lines.push(`**${zone.language}** (${Math.round(zone.coverage * 100)}% of source files)`);
    lines.push(`  Role: ${zone.role}`);
    if (zone.framework) lines.push(`  Framework: ${zone.framework}`);
    if (zone.testFramework) lines.push(`  Test runner: ${zone.testFramework}`);
    if (zone.buildTool) lines.push(`  Build: ${zone.buildTool}`);
    if (zone.rootPaths.length) lines.push(`  Directories: ${zone.rootPaths.slice(0, 3).join(", ")}`);
    lines.push("");
  }

  if (techStack.languageBoundaries.length) {
    lines.push("### Cross-Language Boundaries");
    for (const b of techStack.languageBoundaries) {
      lines.push(`  ${b.from} → ${b.to} via ${b.mechanism} (${b.evidence[0] ?? ""})`);
    }
  }

  return lines.join("\n");
}
```text

The agent therefore receives accurate multi-language context without needing language-specific blueprint variants. A `senior-coder` identity working on a Python+TypeScript portal sees both zones described, knows which directories belong to which language, knows the inter-language boundary mechanism, and can make changes respecting both language conventions.

**Specialized blueprints remain optional** for teams that want fine-grained per-language behaviour:

```yaml

# Blueprints/Identities/python-specialist.md

model: anthropic:claude-sonnet-4
capabilities: [read, write, test]
language_filter: ["python"]     # NEW: only inject Python zone context
---
You are a Python specialist. Follow PEP 8, use type hints, prefer dataclasses...
```text

The `language_filter` field in the blueprint instructs `ContextLoader` to inject only the zones matching the filter — useful when you deliberately want an identity that refuses to touch TypeScript files in a mixed-language portal.

***

### 7. Symbol Extraction: Universal Fallback Chain

For every language zone, symbol extraction follows a **toolchain availability cascade**:

```text
Language-native tool           → highest fidelity
  (deno doc, go doc, pyright, javadoc, cargo doc)
        ↓ not available
Universal ctags                → good fidelity, 40+ languages, single binary
  SafeSubprocess → ctags --output-format=json --fields=+n <files>
        ↓ not available
Tree-sitter via WASM            → good fidelity, no native binary needed
  (tree-sitter grammars available as WASM, run in Deno via WASM import)
        ↓ not available
Regex pattern scan             → minimal fidelity, always available
  Language-specific regexes per analyzer:
  Python:  /^(async\s+)?def\s+(\w+)/, /^class\s+(\w+)/
  Go:      /^func\s+(\w+)/, /^type\s+(\w+)\s+(struct|interface)/
  Rust:    /^pub\s+(fn|struct|enum|trait)\s+(\w+)/
  Java:    /^public\s+(class|interface|enum)\s+(\w+)/
  SQL:     /^CREATE\s+(TABLE|VIEW|FUNCTION|PROCEDURE)\s+(\w+)/i
```text

**Tree-sitter via WASM** is the most strategic addition — Deno supports WASM natively, and the tree-sitter project publishes pre-compiled WASM grammars for Python, Go, Rust

***

## Multi-Language Portal Support — Completed Design + Implementation Plan

### Completing the Symbol Extraction Fallback Chain

**Tree-sitter via WASM** is the most strategic addition for universal language support. Deno supports WASM natively via `WebAssembly.instantiate()`, and tree-sitter publishes pre-compiled grammars for 40+ languages. This gives ExaIx language-aware symbol extraction with no native binary requirements beyond the Deno runtime itself — the WASM files ship as assets alongside ExaIx:

```text
ExaIx/assets/grammars/
  tree-sitter-python.wasm
  tree-sitter-go.wasm
  tree-sitter-rust.wasm
  tree-sitter-java.wasm
  tree-sitter-ruby.wasm
  tree-sitter-c.wasm
  tree-sitter-cpp.wasm
```text

```typescript
// src/services/portal_knowledge/symbol_extraction/tree_sitter_extractor.ts
export class TreeSitterExtractor {
  async extractSymbols(
    language: string,
    sourceFiles: string[],
    portalPath: string,
  ): Promise<ISymbolEntry[]> {
    const grammarPath = join(ASSETS_DIR, `tree-sitter-${language}.wasm`);
    if (!await exists(grammarPath)) return [];  // grammar not bundled → fall through to regex

    const parser = await loadTreeSitterParser(grammarPath);
    const symbols: ISymbolEntry[] = [];

    for (const file of sourceFiles.slice(0, MAX_SYMBOL_FILES)) {
      const source = await Deno.readTextFile(join(portalPath, file));
      const tree = parser.parse(source);
      symbols.push(...querySymbols(tree, language, file));
    }
    return symbols;
  }
}
```text

Each language has a **query file** (`queries/python-symbols.scm`, `queries/go-symbols.scm`) with tree-sitter S-expression queries for function/class/type definitions — the same query format used by Neovim's treesitter integration. This means queries are community-maintained and ExaIx can reuse them directly.

# Complete fallback chain per language zone:

```text

1. Language-native toolchain CLI   (deno doc, go doc -json, pyright, cargo doc)
   → best fidelity, typed, call-graph aware
1.
   → good fidelity, fast, no language runtime needed
1.
   → good fidelity, syntax-accurate, runs anywhere Deno runs
1.
   → minimal fidelity, catches top-level definitions only
```text

The `SymbolExtractor` tries each level in order and returns the result of the first one that succeeds. `toolchainAvailable` on `ILanguageZone` is populated during zone detection by probing level 1, so level 1 is only attempted when the binary is confirmed present.

***

### Completing the Agent Blueprint Picture

The final missing piece is how **multi-language context flows into the request-to-execution pipeline** when an agent is asked to make changes in a mixed-language portal. Three scenarios require different handling:

**Scenario A — Single-zone task** ("fix the Python API endpoint")
→ `ContextLoader` detects the task targets Python files only (via `IRequestAnalysis.scope`), injects only the Python zone context block. Symbols from Go/TypeScript zones are omitted to preserve context budget (W7 from the weakness analysis directly applies here).

**Scenario B — Cross-zone task** ("update the REST API contract and sync the TypeScript client")
→ `ContextLoader` injects both zones + the `ILanguageBoundary` describing the REST API connection between them. The agent receives the OpenAPI spec location, both zone entry points, and boundary evidence.

**Scenario C — Infrastructure task** ("add a Dockerfile for the Python service")
→ `ContextLoader` injects the Python zone + the existing `docker` zone (if present) + the `terraform` zone if it exists. The agent understands the existing infra patterns before writing new ones.

This zone-scoped context injection is the mechanism that makes multi-language support practical: the agent never receives the full knowledge of all zones simultaneously unless the task explicitly spans all of them, keeping prompts within budget.

***

## High-Level Implementation Plan

### Phase 1 — Foundation: Language Zone Detection


| Task | File(s) changed | Effort |
| --- | --- | --- |
| Define `ILanguageZone`, `ILanguageZoneMap`, `ILanguageBoundary` types | `src/shared/schemas/portal_knowledge.ts` | S |
| Extend `IPortalTechStack` — add `languages[]`, keep `primaryLanguage` for compat | `src/shared/schemas/portal_knowledge.ts` | S |
| Implement `LanguageZoneDetector` — extension census → zone map | `src/services/portal_knowledge/language_zone_detector.ts` (new) | M |
| Build `EXTENSION_TO_LANGUAGE` table covering 25+ extensions | `src/services/portal_knowledge/language_zone_detector.ts` | S |
| Add toolchain availability probe (cached per session) | `src/services/portal_knowledge/toolchain_probe.ts` (new) | S |
| Wire into `PortalKnowledgeService` after Strategy 1 | `src/services/portal_knowledge/portal_knowledge_service.ts` | S |
| Update `knowledge.json` schema + `KnowledgePersistence` | `src/services/portal_knowledge/knowledge_persistence.ts` | S |
| Tests: zone detection for TS-only, Python+TS, Python+Go+SQL portals | `tests/unit/portal_knowledge/language_zone_detector_test.ts` | M |

**Milestone:** `exactl portal analyze` correctly maps all language zones. `knowledge.json` contains `languages[]` array. `primaryLanguage` still correct as before.

***

### Phase 2 — Analyzer Interface + TypeScript Refactor


| Task | File(s) changed | Effort |
| --- | --- | --- |
| Define `ILanguageAnalyzer` interface | `src/services/portal_knowledge/language_analyzers/i_language_analyzer.ts` (new) | S |
| Define `LanguageAnalyzerRegistry` with `register()` and `detect()` | `src/services/portal_knowledge/language_analyzers/analyzer_registry.ts` (new) | S |
| Refactor `config_parser.ts` → `TypeScriptLanguageAnalyzer.parseConfigFiles()` | `src/services/portal_knowledge/language_analyzers/typescript_analyzer.ts` (new) | M |
| Refactor `symbol_extractor.ts` → `TypeScriptLanguageAnalyzer.extractSymbols()` | same file | S |
| Refactor `key_file_identifier.ts` → `TypeScriptLanguageAnalyzer.identifyKeyFiles()` | same file | S |
| Refactor `pattern_detector.ts` → `TypeScriptLanguageAnalyzer.detectPatterns()` | same file | S |
| Implement `GenericLanguageAnalyzer` (ctags + regex fallbacks) | `src/services/portal_knowledge/language_analyzers/generic_analyzer.ts` (new) | M |
| Register TypeScript + Generic in `PortalKnowledgeService` constructor | `portal_knowledge_service.ts` | S |
| Parallel zone analysis loop in `PortalKnowledgeService` | `portal_knowledge_service.ts` | M |
| Update `CompositeArchitectureInferrer` to accept multi-zone input | `src/services/portal_knowledge/architecture_inferrer.ts` | M |
| Update `KnowledgeMerger` to merge per-zone results into `IPortalKnowledge` | `src/services/portal_knowledge/knowledge_merger.ts` (new) | M |
| Regression tests: TypeScript portal analysis identical to pre-refactor | `tests/` | M |

**Milestone:** All existing portal analysis behaviour preserved. Architecture is now open for new language analyzers via `registry.register()` — adding a language is a single file + registration call.

***

### Phase 3 — Tree-sitter WASM Fallback


| Task | File(s) changed | Effort |
| --- | --- | --- |
| Add tree-sitter WASM loader | `src/services/portal_knowledge/symbol_extraction/tree_sitter_loader.ts` (new) | M |
| Bundle WASM grammars for top 8 languages (Python, Go, Rust, Java, Ruby, C, C++, SQL) | `assets/grammars/*.wasm` + deno.json asset config | M |
| Write S-expression query files per language | `assets/queries/*.scm` (adapt from nvim-treesitter community queries) | M |
| Implement `TreeSitterExtractor` | `src/services/portal_knowledge/symbol_extraction/tree_sitter_extractor.ts` (new) | M |
| Integrate into `GenericLanguageAnalyzer` fallback chain (after ctags, before regex) | `generic_analyzer.ts` | S |
| Tests: symbol extraction for Python file, Go file without native toolchain | `tests/unit/` | M |

**Milestone:** Any portal with Python, Go, Rust, Java, Ruby, C, C++ gets symbol extraction with no toolchain installation. Regex fallback covers remaining languages.

***

### Phase 4 — Language-Specific Analyzers (Priority Order)


Each analyzer is an isolated deliverable. Implement in priority order based on your user base:

| Language | Config files parsed | Native symbol tool | Framework detection | Effort |
| --- | --- | --- | --- | --- |
| **Python** | `pyproject.toml`, `requirements.txt`, `Pipfile`, `setup.cfg` | `pyright --outputjson` or `python -c ast` | Django, FastAPI, Flask, Starlette | L |
| **Go** | `go.mod`, `go.sum` | `go list -json ./...` | Gin, Echo, Fiber, Chi | M |
| **Rust** | `Cargo.toml` | `cargo metadata --format-version 1` | Axum, Actix-web, Rocket | M |
| **Java/Kotlin** | `pom.xml`, `build.gradle(.kts)` | `javap -p` or ctags | Spring Boot, Quarkus, Ktor, Micronaut | L |
| **SQL** | `*.sql`, `migrations/` | Regex only (no toolchain) | Detect migration frameworks (Flyway, Liquibase, Alembic, golang-migrate) | S |
| **Shell** | `Makefile`, `*.sh` | Regex only | Detect tool invocations (docker, kubectl, terraform) | S |
| **Terraform/HCL** | `*.tf`, `terraform.tfvars` | `terraform providers schema` | Detect cloud provider (aws, google, azurerm) | S |
| **Protobuf** | `*.proto` | `protoc --descriptor_set_out` | Detect service definitions, RPC methods | S |
| **Ruby** | `Gemfile`, `Gemfile.lock` | `rdoc --ri` | Rails, Sinatra, Hanami | M |
| **C#** | `*.csproj`, `*.sln`, `NuGet.config` | `dotnet list package --json` | ASP.NET Core, Blazor, MAUI | M |

Each implementation follows the same template: implement `ILanguageAnalyzer`, register in `AnalyzerRegistry`, add tests with a real-world fixture project for that language.

***

### Phase 5 — Cross-Language Boundary Detection


| Task | File(s) changed | Effort |
| --- | --- | --- |
| Implement `LanguageBoundaryDetector` — evidence-based pattern matching | `src/services/portal_knowledge/language_boundary_detector.ts` (new) | M |
| REST boundary: detect OpenAPI/Swagger specs + client generation config | same | S |
| gRPC boundary: detect `*.proto` files shared between zones | same | S |
| Shared DB boundary: detect ORM models in multiple zones referencing same tables | same | M |
| Subprocess boundary: detect `subprocess`, `os.exec`, `Command::new()` in zone files | same | S |
| Integrate boundary detection into `CompositeArchitectureInferrer` | `architecture_inferrer.ts` | S |
| Persist boundaries in `knowledge.json` under `techStack.languageBoundaries` | schema + persistence | S |
| Tests: Python+TypeScript REST portal, Go+Protobuf portal | `tests/` | M |

**Milestone:** `exactl portal knowledge` output shows detected inter-language boundaries with evidence. Agents receive boundary context when tasks span zones.

***

### Phase 6 — Context-Aware Prompt Injection


| Task | File(s) changed | Effort |
| --- | --- | --- |
| Implement `buildLanguageContextBlock()` — formats `IPortalTechStack` for prompt | `src/services/context_loader.ts` | S |
| Implement zone-scope filtering from `IRequestAnalysis.scope` | `src/services/context_loader.ts` | M |
| Add `language_filter` field to blueprint frontmatter schema | `src/shared/schemas/portal_knowledge.ts` + `blueprint_loader.ts` | S |
| Integrate with `PromptBudgetAllocator` (from W7 weakness fix) — allocate zone context budget | `src/services/prompt_budget_allocator.ts` | M |
| Add language-zone awareness to `SessionMemoryService` search scope | `src/services/session_memory.ts` | S |
| Add language-zone context to `ReflexiveAgent` critique prompt | `src/services/reflexive_agent.ts` | S |
| Tests: context block generation for mono-language + multi-language portal | `tests/` | M |

**Milestone:** Agents working on Python+TypeScript portals receive appropriately scoped context. Language boundary context injected for cross-zone tasks.

***

### Phase 7 — Language-Aware Identities and Skills


| Task | File(s) changed | Effort |
| --- | --- | --- |
| Add `python-specialist.md` identity with Python conventions system prompt | `Blueprints/Identities/python-specialist.md` | S |
| Add `go-specialist.md`, `rust-specialist.md` identities | `Blueprints/Identities/` | S |
| Add language-convention skills: `python-conventions.md`, `go-conventions.md` | `Blueprints/Skills/` | M |
| Update `exactl blueprint create` to suggest language-appropriate template | `src/cli/blueprint_commands.ts` | S |
| Implement `language_filter` enforcement in `ContextLoader` | already covered in Phase 6 | — |
| `exactl portal knowledge --show-zones` CLI command | `src/cli/portal_commands.ts` | S |
| TUI Memory View update: show language zone breakdown | `src/tui/` | M |

***

### Summary Timeline and Dependencies

```text
Phase 1 — Foundation: Language Zone Detection
  ↓  (no external dependencies — pure schema + detection logic)
Phase 2 — Analyzer Interface + TypeScript Refactor
  ↓  (depends on Phase 1 zone map; existing TS behaviour preserved as regression baseline)
Phase 3 — Tree-sitter WASM Fallback
  ↓  (depends on Phase 2 ILanguageAnalyzer interface; plugs into GenericAnalyzer)
  │
  ├──→ Phase 4 — Language-Specific Analyzers     (depends on Phase 2; each language
  │              (Python, Go, Rust, SQL, ...)      is independent of the others;
  │              delivered incrementally           can be parallelised across contributors)
  │
  └──→ Phase 5 — Cross-Language Boundary Detection
         ↓  (depends on Phase 2 zone map + Phase 4 for accurate zone content)
Phase 6 — Context-Aware Prompt Injection
  ↓  (depends on Phase 1 schema + Phase 5 boundaries; plugs into existing ContextLoader)
Phase 7 — Language-Aware Identities and Skills
     (depends on Phase 6; purely additive — new blueprint files + CLI changes)
```text

**Critical path:** Phase 1 → Phase 2 → Phase 6. Everything else is parallel enrichment that improves quality but does not block the core multi-language context flow from reaching agents.

***

### Phase Sizing and Team Allocation

| Phase | Core deliverable | New files | Files modified | Estimated effort |
| --- | --- | --- | --- | --- |
| 1 | Zone detection + schema | 2 | 3 | 1 week, 1 dev |
| 2 | Analyzer interface + TS refactor | 4 | 5 | 2 weeks, 1 dev |
| 3 | Tree-sitter WASM fallback | 3 + 8 assets | 1 | 1 week, 1 dev |
| 4a | Python analyzer | 1 | 1 | 3 days, 1 dev |
| 4b | Go analyzer | 1 | 1 | 2 days, 1 dev |
| 4c | Rust analyzer | 1 | 1 | 2 days, 1 dev |
| 4d | SQL/Shell/Terraform/Proto | 4 | 1 | 1 week, 1 dev |
| 4e | Java/Kotlin, Ruby, C# | 3 | 1 | 1 week, 1 dev |
| 5 | Boundary detection | 1 | 2 | 1 week, 1 dev |
| 6 | Context injection + budget | 1 | 3 | 1 week, 1 dev |
| 7 | Identities + skills + CLI | 8 blueprints | 2 | 3 days, 1 dev |

**Total critical path (P1→P2→P6):** ~4 weeks.
**Full feature completeness (all phases, sequential):** ~10 weeks.
**With parallel Phase 4 delivery (multiple contributors):** ~6–7 weeks.

***

### Backward Compatibility Guarantees

Every phase is designed to be non-breaking for existing TS portals:

| Concern | Guarantee | Mechanism |
| --- | --- | --- |
| Existing `knowledge.json` files | Continue to load without error | Schema migration: `languages[]` defaults to `[{language: "typescript", coverage: 1.0, ...}]` if field absent |
| `primaryLanguage` field consumers | Still populated | Computed as `languages[0].language` |
| TypeScript portal analysis quality | Identical or better | Refactor wraps existing logic with zero behavioural change |
| Blueprint system prompts | No change required | Language context injected by `ContextLoader` between system prompt and request — existing identities receive it automatically |
| `exa.config.toml` format | Backward compatible | `language` field on portals is optional; auto-detected if absent |
| Activity Journal events | Extended, not replaced | New `portal.zone.detected` event added; existing `portal.analyzed` preserved |
| `exactl portal analyze` CLI | Same flags, richer output | `--show-zones` flag added optionally; default output unchanged |

***

### Key Design Decisions Summary

| Decision | Rationale |
| --- | --- |
| **Language zones, not primary language** | Reflects reality of multi-language repos; removes the false assumption that one language dominates |
| **`ILanguageAnalyzer` per zone, not per portal** | Enables concurrent analysis of all zones; adding a new language is one file + one registration call |
| **Parallel zone analysis** | All six strategies run concurrently across zones; `CompositeArchitectureInferrer` runs last with full picture |
| **Fallback chain for symbol extraction** | No hard runtime dependency on any external toolchain; ExaIx works on any machine regardless of what is installed |
| **Tree-sitter WASM bundled** | Universal language parsing with no installation requirement; WASM runs natively in Deno |
| **Language boundaries as first-class data** | Cross-language integration points are often the hardest parts for agents to understand; surfacing them explicitly improves agent decision quality for cross-zone tasks |
| **Zone-scoped context injection** | Prevents context window overflow (W7) by only injecting zones relevant to the current task's declared scope |
| **`language_filter` on blueprints** | Optional opt-in for specialist identities that should only ever touch one language's files; guards against accidental cross-zone modifications |
| **`primaryLanguage` kept for compat** | Avoids breaking existing blueprint prompts, skills triggers, and third-party integrations that reference this field |
| **Phases 4a–4e are independent** | Each language analyzer can be contributed by separate developers without conflict; perfect for community contribution model |

## How Multi-Language Support Improves Agent Result Quality

The improvements are concrete and traceable to specific pipeline components. Each category below describes what currently goes wrong, why it goes wrong, and what specifically changes after multi-language support is implemented.

***

### 1. Correct Code Style and Conventions Per File

# Current failure mode:


# After multi-language support:


```text
Python zone patterns:

- Naming: snake_case functions, PascalCase classes
- Type hints: required (mypy strict mode detected)
- Test runner: pytest — tests in tests/ directory
- Import style: isort-compatible (isort detected in pyproject.toml)


The agent now writes code that matches the project's actual Python conventions without the developer having to specify any of this in the request.

***

### 2. Correct Dependency Usage — No Hallucinated Libraries

# Current failure mode:


# After multi-language support:


```text
Python dependencies:

- fastapi 0.115.0 (web framework)
- pydantic 2.6.0 (schema validation)
- sqlalchemy 2.0.28 (ORM)
- pytest 8.1.0 (test framework)
- httpx 0.27.0 (HTTP client)


The agent now knows `httpx` is available, `requests` is not, and that `pydantic v2` syntax applies. It generates the correct import and the correct API call patterns for the pinned version. Version-specific API differences (Pydantic v1 `validator` vs v2 `field_validator`, SQLAlchemy 1.x `session.query()` vs 2.x `session.execute(select(...))`) are handled correctly.

***

### 3. Cross-Language Boundary Awareness — No Broken Contracts

# Current failure mode:


# After multi-language support:


```text
Cross-language boundaries:

- python → typescript via rest_api
  Evidence: openapi.json, frontend/src/api/generated/userApi.ts
  Note: TypeScript client is code-generated from OpenAPI spec
```text

The agent now knows it must either update the OpenAPI spec (which triggers client regeneration) or update both files manually. It produces a plan that touches `backend/models/user.py` **and** `openapi.json`, and the `TypeScriptLanguageAnalyzer` identifies the generated client as a downstream file that needs regeneration. The change is complete and consistent.

***

### 4. Correct Test Generation for the Right Test Framework

# Current failure mode:


# After multi-language support:


```text
Python test patterns:

- Framework: pytest
- Style: function-based (no TestCase classes detected)
- Fixtures: used in conftest.py (3 fixture definitions found)
- Location: tests/ directory, mirrors src/ structure
- Naming: test_{module_name}.py


The agent writes `def test_add_user_role(user_factory):` using the `user_factory` fixture it can see documented in the symbols extracted from `conftest.py`, placed in `tests/test_models.py` to mirror `src/models.py`. The test is immediately runnable with no adaptation needed.

***

### 5. Correct SQL Awareness in ORM-Using Code

# Current failure mode:


# After multi-language support:


```text
SQL zone (12% of source files, role: data):

- Migration tool: Alembic (detected in pyproject.toml)
- Existing tables: users, roles, user_roles, sessions (from latest migration)
- Recent migration: 2024_03_add_oauth_providers.py
  Added columns: users.oauth_provider, users.oauth_id
```text

The agent now generates a new Alembic migration file with the correct `def upgrade()` / `def downgrade()` structure, referencing the existing `users` table, and not re-adding any existing columns. It also sets the correct `down_revision` chain. The migration is immediately applicable.

***

### 6. Infrastructure Code That Reflects Actual Runtime

# Current failure mode:


# After multi-language support:


```text
Infra zone:

- Existing docker-compose.yml: postgres:16 service on port 5432
- Network: app-network (bridge)

Python zone build context:

- Package manager: uv (uv.lock present)
- ASGI server: uvicorn (detected in dependencies)
- Standard port: 8000 (from main.py uvicorn.run() call)


The agent generates:
```dockerfile
FROM python:3.11-slim
RUN pip install uv
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```text

It also suggests adding the service to the existing `docker-compose.yml` with the correct `app-network` reference and `postgres` dependency — because the boundary evidence showed that dependency already.

***

### 7. Accurate Refactoring Scope — No Missed Callsites

# Current failure mode:


- The Python callsite in `backend/routers/users.py`
- The TypeScript client mock in `frontend/tests/mocks/userApi.ts` that references the endpoint name derived from the function name
- The `openapi.json` `operationId` which may be `getUserUser` by FastAPI convention

# After multi-language support:


1. Rename definition in `user_service.py`
1.
1.
1.

The refactoring is complete across all zones. No callsites missed because the import map is per-zone and the boundary flags cross-zone impact.

***

### 8. Memory Bank Learnings Become Language-Aware

# Current failure mode:


# After multi-language support:


Over time, the memory bank develops distinct, language-specific knowledge clusters that improve in quality as agents accumulate learnings per language — the cross-contamination problem disappears by construction.

***

### 9. Gate Evaluation and Confidence Scoring Become Language-Sensitive

# Current failure mode:


# After multi-language support:


```text
For Python zone:
  - "Type hints present on all public functions" (weight: 1.5)
  - "No bare except clauses" (weight: 1.0)
  - "Test uses pytest fixtures pattern" (weight: 1.5)

For Go zone:
  - "All error returns checked" (weight: 2.0)
  - "Context parameter passed through call chain" (weight: 1.5)

For SQL zone:
  - "Migration has matching downgrade function" (weight: 2.0)
  - "No raw string interpolation in queries" (weight: 2.5)
```text

The `ReflexiveAgent` critique prompt also receives language-specific requirements. The judge evaluates code in the context of its language's idioms — a Python file that passes all criteria is genuinely correct Python, not just text that contains no obvious syntax errors.

***

### Impact Summary

| Quality dimension | Without multi-language | With multi-language |
| --- | --- | --- |
| Convention adherence | TS conventions applied universally | Per-zone language patterns injected |
| Dependency accuracy | Hallucinated libraries common | Pinned versions from manifest |
| Cross-zone consistency | Changes break downstream consumers | Boundary-aware plans cover all zones |
| Test generation | Wrong framework and style | Correct framework, pattern, location |
| SQL/migration changes | Schema-unaware, collision-prone | Full schema context, correct migration chain |
| Infrastructure code | Generic templates miss runtime details | Port, package manager, service graph aware |
| Refactoring completeness | Single-zone rename, broken callsites | Import-map-driven, all callsites found |
| Memory bank relevance | Cross-language contamination | Language-scoped pattern retrieval |
| Gate evaluation | Language-agnostic rubric | Language-calibrated dynamic criteria |

The compounding effect is significant: each layer of language-specific knowledge reduces the probability of the agent producing an artefact that requires human correction. Individually, correct dependency usage eliminates one class of failures; combined with correct test framework, correct migration structure, and correct cross-zone awareness, the probability of a plan being approvable without revision increases substantially — directly reducing the human review burden that is ExaIx's primary bottleneck.

## Deno's Native WASM Support and Multi-Language ExaIx

The connection is direct and fundamental. It answers the question: **how does ExaIx parse and understand source code in languages like Python, Go, Rust, Java, Ruby — without spawning a Python interpreter, Go toolchain, or any other native binary on the host machine?**

The answer is tree-sitter compiled to WASM, executed inside Deno's native WASM runtime.

***

### What the Problem Actually Is

Symbol extraction — identifying functions, classes, types, interfaces, and their relationships in source code — requires **syntactic understanding** of the source language. There are three ways to achieve it:

1. **Native toolchain CLI**: run `python -m ast`, `go list -json`, `deno doc --json`. Requires the language runtime installed. Fails silently on machines without it. ExaIx is deployed on developer machines that may only have the language they are currently developing in.

1.

1.

***

### What Tree-sitter Is

Tree-sitter is a **parser generator and incremental parsing library**. It compiles language grammars into a C library that produces a concrete syntax tree (CST) from source code. It is used by Neovim, GitHub's code search, Zed editor, and many others precisely because it is fast, correct, and available for 40+ languages.

The key property: **tree-sitter can be compiled to WebAssembly**. The output is a `.wasm` file — a portable binary that runs inside any WASM host, including Deno's V8-based runtime, with no native OS dependencies.

The project publishes ready-to-use WASM builds:

- `tree-sitter-python.wasm`
- `tree-sitter-go.wasm`
- `tree-sitter-rust.wasm`
- `tree-sitter-java.wasm`
- `tree-sitter-ruby.wasm`
- `tree-sitter-c.wasm`
- `tree-sitter-cpp.wasm`
- and more

***

### How Deno Executes WASM

Deno exposes the standard WebAssembly Web API (`WebAssembly.instantiate`, `WebAssembly.compile`, `WebAssembly.Memory`) as a first-class runtime feature — not via a polyfill, but natively in V8:

```typescript
// Deno loads and runs WASM with zero external dependencies
const wasmBytes = await Deno.readFile("assets/grammars/tree-sitter-python.wasm");
const module = await WebAssembly.compile(wasmBytes);
const instance = await WebAssembly.instantiate(module, {
  // import object — memory, imported functions
});
```text

This means `tree-sitter-python.wasm` runs **inside the ExaIx process itself**, in the same V8 sandbox, with no subprocess spawn, no OS process, no Python interpreter. Deno's permission model (`--allow-read`) covers reading the `.wasm` file from disk — no new permission type is needed.

The tree-sitter JavaScript/TypeScript bindings (`npm:web-tree-sitter`, importable via Deno's `npm:` specifier) wrap this into a clean API:

```typescript
import Parser from "npm:web-tree-sitter";

await Parser.init();
const Python = await Parser.Language.load(
  "assets/grammars/tree-sitter-python.wasm"
);
const parser = new Parser();
parser.setLanguage(Python);

const source = await Deno.readTextFile("backend/services/user_service.py");
const tree = parser.parse(source);

// Query for all function definitions using S-expression syntax
const query = Python.query(`
  (function_definition
    name: (identifier) @name
    parameters: (parameters) @params
    return_type: (type) @return_type ?)
`);

const matches = query.matches(tree.rootNode);
// → [{name: "get_user", params: "(user_id: int)", return_type: "User | None"}, ...]
```text

This is deterministic, purely in-process, and produces typed syntax-tree node matches — far more reliable than regex.

***

### Concrete ExaIx Usage: What Gets Extracted

For each language zone, the tree-sitter extractor runs S-expression queries (`.scm` files, the same format used by Neovim's nvim-treesitter) against every source file in the zone. What it extracts populates `ISymbolEntry[]`:

**Python** (`queries/python-symbols.scm`):
```scheme
; Function definitions
(function_definition
  name: (identifier) @name
  parameters: (parameters) @params
  return_type: (_) @return_type ?)

; Class definitions
(class_definition
  name: (identifier) @name
  superclasses: (argument_list) @bases ?)

; Async functions
(decorated_definition
  (function_definition name: (identifier) @name))
```text
→ Extracts: `get_user(user_id: int) -> User | None`, `class UserService(BaseService)`, `async def create_session(...)`

**Go** (`queries/go-symbols.scm`):
```scheme
; Function declarations
(function_declaration
  name: (identifier) @name
  parameters: (parameter_list) @params
  result: (_) @return_type ?)

; Method declarations
(method_declaration
  receiver: (parameter_list) @receiver
  name: (field_identifier) @name)

; Interface types
(type_declaration
  name: (type_identifier) @name
  type_value: (interface_type))

; Struct types
(type_declaration
  name: (type_identifier) @name
  type_value: (struct_type))
```text
→ Extracts: `func (s *UserService) GetUser(id int) (*User, error)`, `type UserRepository interface`, `type User struct`

**Rust** (`queries/rust-symbols.scm`):
```scheme
; Public functions
(function_item
  visibility_modifier: (visibility_modifier) @vis
  name: (identifier) @name
  parameters: (parameters) @params
  return_type: (_) @return_type ?)

; Structs, enums, traits
(struct_item name: (type_identifier) @name)
(enum_item name: (type_identifier) @name)
(trait_item name: (type_identifier) @name)

; Impl blocks
(impl_item
  type: (type_identifier) @type
  trait: (_) @trait ?)
```text
→ Extracts: `pub async fn create_user(pool: &PgPool, req: CreateUserRequest) -> Result<User, AppError>`, `pub struct User`, `impl UserRepository for PgUserRepository`

**SQL** (`queries/sql-symbols.scm`):
```scheme
; Table definitions
(create_table_statement
  (object_reference name: (identifier) @name))

; View definitions
(create_view_statement
  (object_reference name: (identifier) @name))

; Function/procedure definitions
(create_function_statement
  name: (identifier) @name)
```text
→ Extracts: `TABLE users`, `TABLE roles`, `TABLE user_roles`, `VIEW active_sessions`

***

### Why This Matters Specifically for ExaIx Quality

The connection to agent output quality is through three pipeline stages:

# 1. Symbol index → Context injection


```text
Python symbols (user_service.py):
  - get_user(user_id: int) -> User | None
  - create_user(data: UserCreate) -> User
  - update_user_role(user_id: int, role: Role) -> User
  - class UserService(BaseService)
```text

The agent can now write code that calls the correct function signature with the correct parameter types — without hallucinating parameter names or return types.

# 2. Import map → Refactoring scope


# 3. Language boundary detection → Cross-zone awareness


***

### The Sandboxing Alignment

Deno's permission model and WASM execution align particularly well here. `PortalKnowledgeService` runs analysis during portal mount — a moment when ExaIx has `--allow-read` for the portal path. The tree-sitter WASM module:

- Reads `.wasm` grammar files from ExaIx's own `assets/` directory (`--allow-read=assets/`)
- Reads source files from the portal path (`--allow-read={portalPath}`)
- Performs all parsing **in-process** — no `--allow-net`, no `--allow-run`, no subprocess

This means the analysis of a Python portal's source code never requires `--allow-run` for a Python interpreter. An ExaIx instance running with minimal permissions (read-only portal access) can still extract full symbol information from any language whose grammar is bundled. The security boundary is preserved — a malicious source file cannot escape the WASM sandbox even if it contains carefully crafted input designed to exploit a parser.

***

### Summary

| Without WASM | With Deno + tree-sitter WASM |
| --- | --- |
| Symbol extraction requires language toolchain installed | Symbol extraction works anywhere Deno runs |
| Python analysis needs `python` binary | Python analysis needs only `tree-sitter-python.wasm` |
| Go analysis needs `go` toolchain | Go analysis needs only `tree-sitter-go.wasm` |
| `--allow-run` permission required | Only `--allow-read` required |
| Analysis fails silently if toolchain absent | Analysis degrades gracefully (WASM → regex fallback) |
| Subprocess timing and timeout risks | In-process, bounded, deterministic |
| Platform-specific binary behaviour | Identical behaviour on all platforms Deno supports |
| 40+ languages need 40+ installed tools | 40+ languages need 40 `.wasm` files bundled at build time |

Deno's native WASM support is therefore not a convenience — it is the mechanism that makes language-universal portal analysis **deployable** in ExaIx's sandboxed, permission-constrained runtime model, where spawning arbitrary native binaries is both a security concern and an operational burden.
````
