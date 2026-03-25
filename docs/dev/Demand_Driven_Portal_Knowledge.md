# Demand-Driven Portal Knowledge Model

---

## The Fundamental Shift

The current ExaIx Phase 46 model assumes that a portal's codebase should be fully analysed upfront and kept fresh via staleness checks. This is the wrong default for three reasons:

1. **Most requests are narrow.** A fix to a single function, a documentation update, a dependency bump — none of these benefit from having 50,000 files pre-indexed.

1.

The replacement is a **three-tier demand-driven model** where analysis depth is determined by what a specific request actually requires, not by the size of the codebase.

---

## Tier 1 — Bootstrap (All Editions, Always, On Mount)

**Trigger:** Portal mount or `exactl portal refresh`
**Runs:** Synchronously. Portal is not "ready" until Tier 1 completes.
**Cost:** Milliseconds. Zero LLM calls. Zero subprocess spawns.

Tier 1 runs only **strategies 1–3** from the existing pipeline:

- **Strategy 1 — Directory Census:** File count per extension → language zone map. Which languages are present and in what proportion. Which directories belong to which language.
- **Strategy 2 — Key File Identification:** Entry points, config files, README, Makefile — the structural skeleton of the portal.
- **Strategy 3 — Config File Parsing:** `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `deno.json` → dependency list, framework name, test runner, build tool, package manager. Per-language zone.

**Output — `knowledge.json` (summary card only):**

```json
{
  "portal": "my-api",
  "bootstrappedAt": "2026-03-25T11:00:00Z",
  "configFilesHash": "sha256:a3f9...",
  "techStack": {
    "primaryLanguage": "python",
    "languages": [
      {
        "language": "python",
        "coverage": 0.71,
        "role": "backend",
        "framework": "fastapi",
        "testFramework": "pytest",
        "buildTool": "uv",
        "rootPaths": ["backend/", "tests/"],
        "fileCount": 184
      },
      {
        "language": "typescript",
        "coverage": 0.22,
        "role": "frontend",
        "framework": "nextjs",
        "rootPaths": ["frontend/"],
        "fileCount": 57
      },
      {
        "language": "sql",
        "coverage": 0.04,
        "role": "data",
        "rootPaths": ["migrations/"],
        "fileCount": 11
      }
    ],
    "languageBoundaries": [
      {
        "from": "typescript",
        "to": "python",
        "mechanism": "rest_api",
        "evidence": ["openapi.json", "frontend/src/api/generated/"]
      }
    ]
  },
  "keyFiles": ["backend/main.py", "pyproject.toml", "openapi.json", "docker-compose.yml"]
}
```

**Invalidation:** Tier 1 re-runs only when config files change. This is detected by comparing a hash of config file contents (`configFilesHash`), not a full git SHA diff. Config files change infrequently — adding a dependency, changing a framework version. Day-to-day code changes do not touch config files and do not trigger Tier 1 re-runs.

**What is explicitly NOT done in Tier 1:**

- No symbol extraction
- No import graph construction
- No pattern detection
- No architecture inference
- No LLM calls

---

## Tier 2 — Demand-Driven Retrieval (All Editions, Per Request)

**Trigger:** Every request, driven by `IRequestAnalysis`
**Runs:** During `ContextLoader.loadPortalContext()`, before plan generation
**Cost:** Proportional to request scope, not codebase size. Typically 1–20 files parsed.

### How Scope Is Determined

`RequestAnalyzer` already produces `IRequestAnalysis` with `scope.include`, `scope.exclude`, goals, and complexity. Tier 2 reads this output to determine the retrieval scope without any additional LLM call:

```typescript
// src/services/portal_knowledge/demand_retriever.ts

export interface IRetrievalScope {
  files: string[]; // concrete resolved file paths
  importDepth: number; // how many import hops to follow (0–3)
  languages: string[]; // which language zones are relevant
  breadth: "file" | "module" | "subsystem" | "portal-wide";
  symbolsNeeded: boolean; // false for docs/config-only requests
}

export function resolveRetrievalScope(
  analysis: IRequestAnalysis,
  summary: IPortalKnowledgeSummary,
  portalPath: string,
): IRetrievalScope {
  // Explicit file references in request body or frontmatter scope
  const explicitFiles = analysis.scope?.include ?? [];

  // Mentioned symbol names → resolve to files via directory scan
  const mentionedFiles = resolveMentionedSymbolsToFiles(
    analysis.goals,
    summary,
    portalPath,
  );

  // Complexity + vocabulary → breadth heuristic
  const breadth = inferBreadth(analysis);

  // Import depth: file→0, module→1, subsystem→2, portal-wide→0 (no symbols)
  const importDepth = breadthToImportDepth(breadth);

  // Architecture / docs requests don't need symbol extraction
  const symbolsNeeded = !isStructuralRequest(analysis);

  return {
    files: deduplicate([...explicitFiles, ...mentionedFiles]),
    importDepth,
    languages: relevantLanguages(analysis, summary),
    breadth,
    symbolsNeeded,
  };
}
```

**Scope breadth rules:**

| Signal in `IRequestAnalysis`                               | Inferred breadth | Import depth | Symbols extracted        |
| ---------------------------------------------------------- | ---------------- | ------------ | ------------------------ |
| Explicit file path(s) in request                           | `file`           | 1 hop        | Yes                      |
| Directory reference, module name                           | `module`         | 1 hop        | Yes                      |
| "all endpoints", "every service", cross-cutting vocabulary | `subsystem`      | 2 hops       | Yes                      |
| "architecture", "overview", "explain the structure"        | `portal-wide`    | 0            | No — Tier 1 summary only |
| "README", "docs", "changelog"                              | `file`           | 0            | No                       |
| High complexity + no explicit scope                        | `subsystem`      | 2 hops       | Yes                      |

### Symbol Extraction (Tree-sitter WASM, In-Process)

For the resolved file list, Tier 2 runs tree-sitter WASM extraction per language zone — entirely in-process, no subprocess, no external toolchain required:

```typescript
// src/services/portal_knowledge/demand_retriever.ts

async function retrieveScopedContext(
  portalPath: string,
  scope: IRetrievalScope,
  summary: IPortalKnowledgeSummary,
): Promise<IScopedPortalContext> {
  if (!scope.symbolsNeeded) {
    return { summary, symbols: [], importEdges: [], dependencies: [] };
  }

  // Expand scope: follow import hops
  const allFiles = await expandByImports(
    portalPath,
    scope.files,
    scope.importDepth,
    scope.languages,
  );

  // Extract symbols in parallel across languages
  const symbolsByLanguage = await Promise.all(
    scope.languages.map(async (lang) => {
      const langFiles = allFiles.filter((f) => belongsToLanguage(f, lang, summary));
      const analyzer = analyzerRegistry.get(lang); // ILanguageAnalyzer
      return analyzer.extractSymbols(portalPath, langFiles);
    }),
  );

  // Import edges for the scoped file set (for refactoring scope awareness)
  const importEdges = await buildScopedImportMap(
    portalPath,
    scope.files,
    scope.languages,
  );

  return {
    summary, // Tier 1 summary card
    symbols: symbolsByLanguage.flat(), // Tier 2 fresh symbols
    importEdges,
    dependencies: summary.techStack.languages
      .filter((z) => scope.languages.includes(z.language))
      .flatMap((z) => z.keyDependencies),
  };
}
```

**Key properties of Tier 2:**

- **Always fresh:** Files are read from disk at request time. No stale data possible. No invalidation logic whatsoever.
- **No storage:** Results are not persisted. They are constructed in memory for the duration of one request and discarded.
- **Bounded cost:** `max_demand_files` config cap prevents runaway extraction on accidentally broad scopes.
- **Parallel:** Multiple language zones are extracted concurrently via `Promise.all`.

---

## Tier 3 — Full Codebase Index (Team+ / Enterprise, Opt-In Per Portal)

**Edition:** 🔵 Team+ and 🟣 Enterprise only
**Trigger:** Explicit per-portal opt-in in `exa.config.toml`. Enabled once after portal mount.
**Storage:** `.exa/symbols.db` — a dedicated SQLite database separate from `journal.db`
**Runs:** Asynchronously in background. Does not block portal mount or any request.

### Configuration

Tier 3 is **not enabled by default** for any portal, even in Team+ and Enterprise editions. It must be explicitly activated per portal:

```toml
[[portals]]
alias = "my-api"
path = "/home/user/projects/my-api"
default_branch = "main"

# Tier 3 — explicit opt-in (Team+ / Enterprise only)
[portals.symbol_index]
enabled = true                 # false by default
mode = "standard"              # quick | standard | deep
index_on_mount = true          # trigger indexing immediately after mount
reindex_on_push = false        # watch for git changes and reindex incrementally
background_priority = "low"    # low | normal
max_files = 5000               # safety cap on files indexed
```

If `symbol_index.enabled = false` (the default), Tier 3 does not exist for that portal. Tier 2 handles all requests regardless of scope. A `portal-wide` request on a non-indexed portal falls back to Tier 2 full-scan on-demand — same cost as current upfront analysis, but paid only when that broad request actually arrives.

### `.exa/symbols.db` Schema

Separate from `journal.db` to avoid polluting the Activity Journal with large binary/index data and to allow independent backup, deletion, and edition-gating:

```sql
-- Tracks indexing state per portal+language zone
CREATE TABLE portal_zones (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  portal_alias    TEXT    NOT NULL,
  language        TEXT    NOT NULL,
  file_count      INTEGER NOT NULL,
  indexed_at      TEXT    NOT NULL,
  head_sha        TEXT    NOT NULL,   -- git HEAD at last index
  index_mode      TEXT    NOT NULL,   -- quick|standard|deep
  status          TEXT    NOT NULL,   -- indexing|ready|partial|failed
  UNIQUE (portal_alias, language)
);

-- Full symbol index: one row per symbol per file
CREATE TABLE portal_symbols (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  portal_alias TEXT    NOT NULL,
  language     TEXT    NOT NULL,
  file_path    TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  kind         TEXT    NOT NULL,   -- function|class|interface|struct|enum|method|const|type
  signature    TEXT,
  return_type  TEXT,
  visibility   TEXT,
  line_start   INTEGER,
  line_end     INTEGER,
  doc_comment  TEXT,
  pagerank     REAL    DEFAULT 0.0,
  FOREIGN KEY (portal_alias, language)
    REFERENCES portal_zones (portal_alias, language) ON DELETE CASCADE
);

-- Import/dependency graph edges
CREATE TABLE portal_imports (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  portal_alias  TEXT NOT NULL,
  language      TEXT NOT NULL,
  source_file   TEXT NOT NULL,
  target_file   TEXT,           -- NULL if external package
  target_module TEXT            -- external package name
);

-- Cross-language boundary evidence
CREATE TABLE portal_boundaries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  portal_alias  TEXT NOT NULL,
  from_language TEXT NOT NULL,
  to_language   TEXT NOT NULL,
  mechanism     TEXT NOT NULL,
  evidence      TEXT NOT NULL   -- JSON array of file paths
);

-- Performance indexes
CREATE INDEX idx_sym_portal  ON portal_symbols (portal_alias);
CREATE INDEX idx_sym_lang    ON portal_symbols (portal_alias, language);
CREATE INDEX idx_sym_file    ON portal_symbols (portal_alias, file_path);
CREATE INDEX idx_sym_name    ON portal_symbols (name);
CREATE INDEX idx_sym_kind    ON portal_symbols (portal_alias, kind);
CREATE INDEX idx_imp_source  ON portal_imports (portal_alias, source_file);
CREATE INDEX idx_imp_target  ON portal_imports (portal_alias, target_file);
```

### Async Indexer

The background indexer runs as a low-priority coroutine within the ExaIx daemon. It does not block the event loop — it yields between file batches:

```typescript
// src/services/portal_knowledge/background_indexer.ts

export class BackgroundIndexer {
  private queue: Map<string, IndexJob> = new Map();
  private running = false;

  /** Enqueue a portal for indexing — non-blocking */
  enqueue(portalAlias: string, portalPath: string, config: ISymbolIndexConfig): void {
    this.queue.set(portalAlias, { portalAlias, portalPath, config });
    if (!this.running) this.runNext();
  }

  private async runNext(): Promise<void> {
    const job = this.queue.values().next().value;
    if (!job) {
      this.running = false;
      return;
    }

    this.running = true;
    this.queue.delete(job.portalAlias);

    try {
      await this.indexPortal(job);
    } catch (err) {
      await this.db.updateZoneStatus(job.portalAlias, "failed");
      this.eventLogger.warn("symbol_index.failed", job.portalAlias, { error: err.message });
    }

    // Yield to event loop before processing next job
    await new Promise((r) => setTimeout(r, 0));
    this.runNext();
  }

  private async indexPortal(job: IndexJob): Promise<void> {
    const zones = await languageZoneDetector.detect(job.portalPath);

    for (const zone of zones) {
      await this.db.upsertZone(job.portalAlias, zone, "indexing");

      // Process files in batches to avoid memory pressure
      const batches = chunk(zone.files, BATCH_SIZE); // default: 50 files

      for (const batch of batches) {
        const analyzer = analyzerRegistry.get(zone.language);
        const symbols = await analyzer.extractSymbols(job.portalPath, batch);
        const edges = await analyzer.buildImportEdgesForFiles(job.portalPath, batch);

        await this.db.insertSymbols(job.portalAlias, zone.language, symbols);
        await this.db.insertImportEdges(job.portalAlias, zone.language, edges);

        // Emit progress to notification service
        this.notifications.emit({
          type: "info",
          message: `Indexing ${job.portalAlias}: ${zone.language} — ${batch.length} files processed`,
          target: job.portalAlias,
        });

        // Yield to event loop between batches — keeps daemon responsive
        await new Promise((r) => setTimeout(r, 0));
      }

      // PageRank scoring after all files in zone are indexed
      await this.computePageRank(job.portalAlias, zone.language);

      await this.db.updateZoneStatus(job.portalAlias, zone.language, "ready");
      this.eventLogger.info("symbol_index.zone_ready", job.portalAlias, {
        language: zone.language,
        file_count: zone.files.length,
      });
    }

    // Detect cross-language boundaries once all zones are indexed
    const boundaries = await languageBoundaryDetector.detect(
      job.portalPath,
      zones,
    );
    await this.db.saveBoundaries(job.portalAlias, boundaries);
    this.eventLogger.info("symbol_index.portal_ready", job.portalAlias, {
      zones: zones.map((z) => z.language),
    });
  }
}
```

### Incremental Reindex on Git Push

When `reindex_on_push = true` is set in portal config, the existing `watcher.ts` (Deno file watcher) detects changes to portal files and triggers incremental reindex — only for changed files, not the full codebase:

```typescript
// In BackgroundIndexer

async reindexChangedFiles(
  portalAlias: string,
  portalPath: string,
  changedFiles: string[],
): Promise<void> {
  // Group changed files by language zone
  const byLanguage = groupByLanguage(changedFiles, summary);

  for (const [language, files] of Object.entries(byLanguage)) {
    // Delete stale rows for changed files only
    await this.db.deleteSymbolsForFiles(portalAlias, language, files);
    await this.db.deleteImportEdgesForFiles(portalAlias, language, files);

    // Re-extract symbols for changed files only
    const analyzer = analyzerRegistry.get(language);
    const symbols = await analyzer.extractSymbols(portalPath, files);
    const edges = await analyzer.buildImportEdgesForFiles(portalPath, files);

    await this.db.insertSymbols(portalAlias, language, symbols);
    await this.db.insertImportEdges(portalAlias, language, edges);
  }

  // Update head_sha
  const newSha = await getGitHeadSha(portalPath);
  await this.db.updateHeadSha(portalAlias, newSha);
}
```

---

### How `ContextLoader` Uses All Three Tiers Together

The `ContextLoader` is the single point that resolves which tier(s) contribute to a request's context. The logic is explicit and deterministic:

```typescript
// src/services/context_loader.ts

async loadPortalContext(
  portalAlias: string,
  portalPath: string,
  requestAnalysis: IRequestAnalysis,
): Promise<IPortalContext> {

  // Tier 1 is always available — instantaneous read from knowledge.json
  const summary = await this.knowledgeService.getSummary(portalAlias);

  // Resolve what this request needs
  const scope = resolveRetrievalScope(requestAnalysis, summary, portalPath);

  // Portal-wide structural requests: Tier 1 is sufficient
  if (scope.breadth === "portal-wide" || !scope.symbolsNeeded) {
    return { summary, symbols: [], importEdges: [], source: "tier1" };
  }

  // Check if Tier 3 index is available and ready for this portal
  const tier3Available =
    this.edition.supports("symbol_index") &&          // Team+ or Enterprise
    (await this.symbolDb.isReady(portalAlias));        // indexing completed

  if (tier3Available) {
    // Tier 3: query SQLite — fast, indexed, covers full codebase
    const symbols = await this.symbolDb.querySymbols(portalAlias, {
      language: scope.languages,
      filePathIn: scope.files.length > 0 ? scope.files : undefined,
      // For portal-wide queries: no file filter, full index
    });
    const importEdges = await this.symbolDb.queryImports(portalAlias, {
      sourceFileIn: scope.files,
      depth: scope.importDepth,
    });
    return { summary, symbols, importEdges, source: "tier3" };
  }

  // Tier 2: on-demand extraction for scoped files — fresh from disk
  const { symbols, importEdges } = await this.demandRetriever.retrieve(
    portalPath,
    scope,
    summary,
  );
  return { summary, symbols, importEdges, source: "tier2" };
}
```

The `source` field on `IPortalContext` is logged to the Activity Journal so users can observe which tier served each request — useful for deciding whether to enable Tier 3 for a portal.

---

### `IPortalContext` Interface

The unified context object passed downstream to `ContextCardGenerator`, `AgentRunner`, and `ReflexiveAgent`:

```typescript
export interface IPortalContext {
  /** Always present: Tier 1 zone summary, framework, dependencies, key files */
  summary: IPortalKnowledgeSummary;

  /** Symbols relevant to this request (empty for structural requests) */
  symbols: ISymbolEntry[];

  /** Import edges for scoped files (used for refactoring scope awareness) */
  importEdges: IImportEdge[];

  /** Which tier served this request — logged to Activity Journal */
  source: "tier1" | "tier2" | "tier3";

  /** Languages actually included in symbols */
  languages: string[];
}
```

---

### Edition Gating

The edition check is the only place where Tier 3 availability is enforced. Outside of `ContextLoader`, the rest of the codebase does not need to be edition-aware:

```typescript
// src/services/context_loader.ts

const tier3Available = this.edition.supports("symbol_index") && // 🔵 Team+ or 🟣 Enterprise
  config.portals
      .find((p) => p.alias === portalAlias)
      ?.symbol_index?.enabled === true && // explicit per-portal opt-in
  (await this.symbolDb.isReady(portalAlias)); // indexing has completed
```

If any condition is false, `ContextLoader` falls through to Tier 2 silently. The agent never knows or cares which tier served its context — it receives the same `IPortalContext` shape regardless.

---

### CLI Surface

```text
# Show which tier is active and index status for a portal
exactl portal status my-api

# Output:
# Portal: my-api
# Tier 1 (bootstrap):  ✅ ready  — bootstrapped 2026-03-25 09:14
# Tier 2 (on-demand):  ✅ always available
# Tier 3 (full index): 🔵 Team+ feature
#   Status: indexing (python: 184/184 ✅, typescript: 31/57 ⏳, sql: 0/11 ⏳)
#   Last head SHA: abc123...

# Trigger Tier 3 indexing manually (Team+ / Enterprise only)
exactl portal index my-api [--mode quick|standard|deep]

# Pause background indexing
exactl portal index my-api --pause

# Delete Tier 3 index for a portal (frees disk space)
exactl portal index my-api --drop

# Show symbols.db size and per-portal usage
exactl portal index --stats
```

---

### `.exa/` Directory Layout

```text
.exa/
  journal.db          ← Activity Journal (all editions)
  symbols.db          ← Tier 3 full symbol index (Team+ / Enterprise, created on first use)
  active/             ← Active plan files
  archive/            ← Archived executions
```

`symbols.db` is created on first Tier 3 index trigger. If no portal has `symbol_index.enabled = true`, the file is never created. `exactl portal index --drop` removes a portal's data from `symbols.db` but does not delete the file — `symbols.db` may serve multiple portals. `exactl system clean` removes `symbols.db` entirely if no portal has Tier 3 enabled.

---

## Complete Tier Comparison

| Dimension                       | Tier 1 — Bootstrap            | Tier 2 — On-Demand                 | Tier 3 — Full Index                   |
| ------------------------------- | ----------------------------- | ---------------------------------- | ------------------------------------- |
| **Edition**                     | 🟢 All                        | 🟢 All                             | 🔵 Team+ / 🟣 Enterprise              |
| **Opt-in required**             | No — automatic                | No — automatic                     | Yes — per-portal in config            |
| **Trigger**                     | Portal mount / config change  | Every request                      | Manual or post-mount                  |
| **Runs**                        | Synchronous (blocks mount)    | Synchronous (during request)       | Async background                      |
| **Cost**                        | Milliseconds, no LLM          | ms–seconds, proportional to scope  | Minutes for large codebases, one-time |
| **Storage**                     | `knowledge.json` (~10 KB)     | None (in-memory, discarded)        | `.exa/symbols.db` (persistent)        |
| **Freshness**                   | On config file change         | Always fresh (reads disk)          | Eventual — reindex on push optional   |
| **Stale data risk**             | None (config rarely changes)  | None (no cache)                    | Yes — mitigated by `reindex_on_push`  |
| **Scope**                       | Whole portal, structural only | Request-scoped files + import hops | Full portal, all languages            |
| **Symbol extraction**           | None                          | Tree-sitter WASM for scoped files  | Tree-sitter WASM, all files           |
| **Invalidation logic**          | Config file hash check        | None needed                        | git SHA diff, incremental by file     |
| **Scales to 50K+ files**        | ✅                            | ✅ (scope-limited)                 | ✅ (async, batched)                   |
| **Fallback for broad requests** | Directory structure only      | Full on-demand scan                | Full indexed query                    |

---

## What Disappears From the Existing System

Adopting this model eliminates several components that existed solely to support the upfront full-analysis approach:

| Current component                                | Status         | Reason                                                 |
| ------------------------------------------------ | -------------- | ------------------------------------------------------ |
| `staleness_hours` config                         | **Removed**    | Tier 2 is always fresh; Tier 3 uses `reindex_on_push`  |
| Time-based re-analysis scheduler                 | **Removed**    | No timed invalidation in any tier                      |
| Full `symbols[]` array in `knowledge.json`       | **Removed**    | Tier 1 is summary-only; symbols live in Tier 2/3       |
| `rebuildIndices()` on git SHA change             | **Removed**    | Tier 2 needs no index; Tier 3 does incremental reindex |
| `portal.analyzed` journal event on every request | **Simplified** | Only emitted on Tier 1 bootstrap and Tier 3 completion |
| W11 (time-based invalidation weakness)           | **Eliminated** | The problem cannot occur in the demand-driven model    |
