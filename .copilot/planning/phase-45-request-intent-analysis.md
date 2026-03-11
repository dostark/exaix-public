# Phase 45: Request Intent Analysis & Pre-Processing

## Status: IN PROGRESS

Introduce a `RequestAnalyzer` service that extracts structured intent, requirements, and constraints from raw request text before agent execution — closing the largest gap in ExoFrame's quality pipeline.

## Executive Summary

**Problem:**
Today, the request body flows through the pipeline as an opaque string. `RequestParser` extracts YAML frontmatter metadata, `buildParsedRequest()` passes `body.trim()` as-is into `userPrompt`, and no component analyzes *what the user is actually asking for*. This means:

- Downstream quality measures (quality gates, confidence scorer, reflexive agent) evaluate generic criteria but have **no structured understanding of the specific request goals**.
- The `classifyTaskComplexity()` method in `RequestProcessor` ignores request content entirely — it classifies based solely on agent ID substrings (e.g., `agentId.includes("coder")`).
- Vague, ambiguous, or underspecified requests receive the same treatment as well-structured ones.
- There is no mechanism to detect missing requirements, conflicting constraints, or implicit assumptions before committing LLM tokens to execution.

**Solution:**
Add a `RequestAnalyzer` service that runs between `RequestParser` and agent execution, producing a structured `IRequestAnalysis` object containing extracted goals, requirements, constraints, acceptance criteria, ambiguities, and an actionability score.

---

## Current State Analysis

### Request Processing Pipeline (As-Is)

```text
Request File (.md)
  → RequestParser.parse()          — Extracts YAML frontmatter + raw body
  → buildParsedRequest()           — Wraps body as userPrompt, adds priority/source
  → classifyTaskComplexity()       — Agent-name-based (ignores request content)
  → AgentRunner.run()              — Sends raw body to LLM
  → PlanWriter.writePlan()         — Writes plan to disk
```

### Key Files Involved

| File | Role | Gap |
| ------ | ------ | ----- |
| `src/services/request_processing/request_parser.ts` | YAML frontmatter + body extraction | No content analysis |
| `src/services/request_common.ts` (`buildParsedRequest`) | Wraps body into `IParsedRequest` | Only adds `priority`, `source` as context |
| `src/services/request_processor.ts` (`classifyTaskComplexity`) | Provider selection | Uses agent ID substrings, ignores `_request` param |
| `src/services/request_processor.ts` (`processAgentRequest`) | Main agent processing | No pre-analysis step |
| `src/services/agent_runner.ts` (`IParsedRequest`) | Request interface | Has `taskType`, `tags`, `filePaths` fields — all unused by RequestProcessor |

### Unused Potential in `IParsedRequest`

The `IParsedRequest` interface already has fields that *should* carry structured analysis, but are never populated:

```typescript
export interface IParsedRequest {
  userPrompt: string;
  context: IRequestContextContext;      // Only has priority, source, traceId, requestId
  filePaths?: string[];                 // Never set by RequestProcessor
  taskType?: string;                    // Never set by RequestProcessor
  tags?: string[];                      // Never set by RequestProcessor
  skills?: string[];                    // Set only from frontmatter
  skipSkills?: string[];
}
```

---

## Goals

- [ ] Define `IRequestAnalysis` schema with structured fields for goals, requirements, constraints, acceptance criteria, and ambiguities.
- [ ] Implement `RequestAnalyzer` service that produces `IRequestAnalysis` from raw request text.
- [ ] Integrate `RequestAnalyzer` into `RequestProcessor.processAgentRequest()` between parsing and agent execution.
- [ ] Populate `IParsedRequest.taskType`, `tags`, and `context` with analysis results.
- [ ] Replace `classifyTaskComplexity()` with content-aware classification using analysis results.
- [ ] Add analysis results to plan metadata for downstream quality evaluation.
- [ ] Write comprehensive tests for requirement extraction, ambiguity detection, and complexity classification.

---

## Step-by-Step Implementation Plan

### Step 1: Define `IRequestAnalysis` Zod Schema & Types

**What:** Create the Zod schema and inferred TypeScript types for request analysis output in `src/shared/schemas/request_analysis.ts`. Register the export in `src/shared/schemas/mod.ts`.

**Files to create/modify:**

- `src/shared/schemas/request_analysis.ts` (NEW)
- `src/shared/schemas/mod.ts` (add export)

**Architecture notes:**

- Follow project schema convention: `XxxSchema` naming, `z.infer<typeof XxxSchema>` for types
- Define enums as Zod native enums matching `src/shared/enums.ts` pattern
- Export both the schema and the inferred type (`IRequestAnalysis`, `IRequestGoal`, `IRequirement`, `IAmbiguity`)

**Success criteria:**

- [x] `RequestAnalysisSchema.safeParse(validData)` returns `{ success: true }`
- [x] `RequestAnalysisSchema.safeParse(invalidData)` returns `{ success: false }` with meaningful errors
- [x] All sub-schemas (`RequestGoalSchema`, `RequirementSchema`, `AmbiguitySchema`) parseable independently
- [x] Schema re-exported through `src/shared/schemas/mod.ts` barrel
- [x] No lint or type errors

**Implemented tests** (`tests/schemas/request_analysis_test.ts`) — 21/21 passing:

- [x] `[RequestAnalysisSchema] validates complete valid analysis`
- [x] `[RequestAnalysisSchema] rejects missing required fields`
- [x] `[RequestAnalysisSchema] validates actionabilityScore range 0-100`
- [x] `[RequestAnalysisSchema] validates all complexity enum values`
- [x] `[RequestAnalysisSchema] rejects invalid complexity value`
- [x] `[RequestAnalysisSchema] validates all taskType enum values`
- [x] `[RequestAnalysisSchema] rejects actionabilityScore out of range`
- [x] `[RequestAnalysisSchema] allows empty arrays for optional list fields`
- [x] `[RequestAnalysisSchema] validates metadata fields`
- [x] `[RequestAnalysisSchema] validates all analyzer mode values`
- [x] `[RequestGoalSchema] validates explicit goal`
- [x] `[RequestGoalSchema] validates inferred goal (explicit: false)`
- [x] `[RequestGoalSchema] rejects missing description`
- [x] `[RequestGoalSchema] rejects invalid priority (zero)`
- [x] `[RequirementSchema] validates confidence range 0.0–1.0`
- [x] `[RequirementSchema] rejects confidence above 1.0`
- [x] `[RequirementSchema] rejects confidence below 0.0`
- [x] `[RequirementSchema] rejects missing description`
- [x] `[AmbiguitySchema] validates all impact enum values`
- [x] `[AmbiguitySchema] rejects invalid impact value`
- [x] `[AmbiguitySchema] rejects missing impact`

---

### Step 2: Define `IRequestAnalyzerService` Interface

**What:** Create the service interface in `src/shared/interfaces/i_request_analyzer_service.ts`. Register in interface barrel `src/shared/interfaces/mod.ts`.

**Files to create/modify:**

- `src/shared/interfaces/i_request_analyzer_service.ts` (NEW)
- `src/shared/interfaces/mod.ts` (add export)

**Architecture notes:**

- Follow interface naming convention: `IRequestAnalyzerService` with method signatures only
- Define `IRequestAnalyzerConfig` in the same file (matches project pattern where configs are co-located with interfaces)
- Methods: `analyze(requestText, context?) → Promise<IRequestAnalysis>` and `analyzeQuick(requestText) → Partial<IRequestAnalysis>`
- Config: `mode: "heuristic" | "llm" | "hybrid"`, `actionabilityThreshold?: number`, `inferAcceptanceCriteria?: boolean`

**Success criteria:**

- [x] Interface exported through barrel `src/shared/interfaces/mod.ts`
- [x] Interface depends only on types from `src/shared/schemas/` (no concrete service imports)
- [x] TypeScript compiles with `deno check`

**Planned tests:** None (interface-only; validated by type system at compile time). ✅ (`deno check` passes)

---

### Step 3: Implement Heuristic Analysis Strategy

**What:** Create `src/services/request_analysis/heuristic_analyzer.ts` — a standalone module implementing zero-cost heuristic text analysis. This handles the `heuristic` mode without any LLM dependency.

**Files to create:**

- `src/services/request_analysis/heuristic_analyzer.ts` (NEW)

**Architecture notes:**

- Pure function module, no class — a single `analyzeHeuristic(requestText: string): Partial<IRequestAnalysis>` export
- Separation of concern: this module has zero LLM/provider/network dependencies
- Implements: file reference detection (regex for `src/`, extensions), keyword extraction (action verbs), complexity signals (bullet count, file refs, body length, "and" chains), ambiguity signals (question marks, hedging language, unresolved pronouns), task type classification from action verbs
- Returns `Partial<IRequestAnalysis>` — not all fields can be populated without LLM

**Success criteria:**

- [x] Detects file paths like `src/services/foo.ts`, `tests/bar_test.ts`
- [x] Extracts keywords from action verbs: implement, fix, refactor, add, remove, test, document
- [x] Classifies complexity: simple (short, ≤2 bullets, ≤1 file), medium (default), complex (>10 bullets, >5 files, >3000 chars), epic (multi-phase keywords)
- [x] Detects ambiguity signals: question marks in body, hedging ("maybe", "possibly"), vague pronouns ("it should", "make that work")
- [x] Task type from verbs: feature/bugfix/refactor/test/docs/analysis
- [x] Zero external dependencies (can run in sandboxed mode)
- [x] Completes in <5ms for typical requests

**Implemented tests** (`tests/services/request_analysis/heuristic_analyzer_test.ts`) — 18/18 passing:

- [x] `[HeuristicAnalyzer] detects file references in request text`
- [x] `[HeuristicAnalyzer] detects unquoted file paths with extensions`
- [x] `[HeuristicAnalyzer] returns empty referencedFiles when none present`
- [x] `[HeuristicAnalyzer] extracts action verbs as tags`
- [x] `[HeuristicAnalyzer] classifies simple single-line request`
- [x] `[HeuristicAnalyzer] classifies medium multi-step request (default)`
- [x] `[HeuristicAnalyzer] classifies complex multi-requirement request`
- [x] `[HeuristicAnalyzer] classifies epic multi-phase request`
- [x] `[HeuristicAnalyzer] detects ambiguity signals in vague requests`
- [x] `[HeuristicAnalyzer] detects question marks as ambiguity signals`
- [x] `[HeuristicAnalyzer] detects no ambiguity in well-specified requests`
- [x] `[HeuristicAnalyzer] classifies task type from 'fix' verb as bugfix`
- [x] `[HeuristicAnalyzer] classifies task type from 'refactor' verb`
- [x] `[HeuristicAnalyzer] classifies task type from 'add tests' as test`
- [x] `[HeuristicAnalyzer] classifies task type from 'document' as docs`
- [x] `[HeuristicAnalyzer] classifies task type from 'implement' as feature`
- [x] `[HeuristicAnalyzer] handles empty request text gracefully`
- [x] `[HeuristicAnalyzer] handles Unicode and special characters`

---

### Step 4: Implement LLM Analysis Strategy

**What:** Create `src/services/request_analysis/llm_analyzer.ts` — a module that uses an LLM provider to produce a full `IRequestAnalysis` from request text.

**Files to create:**

- `src/services/request_analysis/llm_analyzer.ts` (NEW)

**Architecture notes:**

- Class `LlmAnalyzer` with constructor DI: `constructor(provider: IModelProvider, validator: OutputValidator)`
- Uses `OutputValidator.validate()` with `RequestAnalysisSchema` to parse LLM JSON output (matches `OutputValidator` pattern from existing codebase)
- Prompt template is a private constant string, not a file (matches `ReflexiveAgent` pattern)
- Depends on `IModelProvider` interface, not any concrete provider
- Returns full `IRequestAnalysis`; falls back to empty/default on validation failure

**Success criteria:**

- [x] Calls `provider.generate()` with structured analysis prompt
- [x] Validates LLM response against `RequestAnalysisSchema` via `OutputValidator`
- [x] Returns successfully parsed `IRequestAnalysis` on valid LLM output
- [x] Returns a safe fallback (minimal analysis) when LLM output fails validation
- [x] Prompt includes all schema fields with clear instructions
- [x] LLM call uses reasonable token budget (`max_tokens`, `temperature: 0`)

**Implemented tests** (`tests/services/request_analysis/llm_analyzer_test.ts`) — 9/9 passing:

- [x] `[LlmAnalyzer] parses valid LLM JSON response into IRequestAnalysis`
- [x] `[LlmAnalyzer] handles LLM returning invalid JSON gracefully`
- [x] `[LlmAnalyzer] handles LLM returning partial fields`
- [x] `[LlmAnalyzer] passes request text in prompt`
- [x] `[LlmAnalyzer] passes optional context in prompt when provided`
- [x] `[LlmAnalyzer] uses OutputValidator for schema validation`
- [x] `[LlmAnalyzer] returns fallback analysis on validation failure`
- [x] `[LlmAnalyzer] populates metadata.durationMs`
- [x] `[LlmAnalyzer] includes high-impact ambiguity in prompt for ambiguous requests`

---

### Step 5: Implement `RequestAnalyzer` Service (Orchestrator)

**What:** Create `src/services/request_analysis/request_analyzer.ts` — the main service that orchestrates heuristic and LLM strategies based on configured mode.

**Files to create/modify:**

- `src/services/request_analysis/request_analyzer.ts` (NEW)
- `src/services/request_analysis/mod.ts` (NEW — barrel export)

**Architecture notes:**

- Class `RequestAnalyzer` implements `IRequestAnalyzerService`
- Constructor DI: `constructor(config: IRequestAnalyzerConfig, provider?: IModelProvider, validator?: OutputValidator, db?: IDatabaseService)`
- Delegates to `analyzeHeuristic()` or `LlmAnalyzer` based on `config.mode`
- Hybrid mode: run heuristic first, check `actionabilityScore`; call LLM only if below threshold
- Merges heuristic and LLM results (LLM fields override heuristic when both present)
- Logs analysis activity to `ActivityJournal` via `db.logActivity()` (matches project logging pattern)
- Adds timing metadata (`durationMs`, `analyzedAt`)

**Success criteria:**

- [x] `mode: "heuristic"` — calls only `analyzeHeuristic()`, never touches LLM
- [x] `mode: "llm"` — calls `LlmAnalyzer`, augments with heuristic for file references
- [x] `mode: "hybrid"` — heuristic first, LLM only when `actionabilityScore < actionabilityThreshold`
- [x] Logs `request.analyzed` activity to journal when `db` is provided
- [x] Populates `metadata.durationMs` accurately
- [x] Implements `IRequestAnalyzerService` interface contract
- [x] Exported through `src/services/request_analysis/mod.ts` barrel

**Implemented tests** (`tests/services/request_analysis/request_analyzer_test.ts`) — 11/11 passing:

- [x] `[RequestAnalyzer] analyzes in heuristic mode without provider`
- [x] `[RequestAnalyzer] heuristic mode never calls provider`
- [x] `[RequestAnalyzer] analyzes in LLM mode with mock provider`
- [x] `[RequestAnalyzer] hybrid mode skips LLM for high-actionability requests`
- [x] `[RequestAnalyzer] hybrid mode calls LLM for low-actionability requests`
- [x] `[RequestAnalyzer] records durationMs in metadata`
- [x] `[RequestAnalyzer] populates analyzedAt timestamp`
- [x] `[RequestAnalyzer] logs activity to database when db provided`
- [x] `[RequestAnalyzer] works without db (no logging, no error)`
- [x] `[RequestAnalyzer] merges heuristic file refs into LLM results`
- [x] `[RequestAnalyzer] handles LLM failure gracefully in hybrid mode (falls back to heuristic)`

---

### Step 6: Add Analysis Constants & Enums

**What:** Add request analysis constants to `src/shared/constants.ts` and any new enum values to `src/shared/enums.ts`.

**Files to modify:**

- `src/shared/constants.ts` (add new section)
- `src/shared/enums.ts` (add enums if not already Zod-native)

**Architecture notes:**

- Follow existing sectioned pattern in `constants.ts` (header comment + grouped constants)
- Constants: `DEFAULT_ACTIONABILITY_THRESHOLD = 60`, `DEFAULT_ANALYZER_MODE = "hybrid"`, analysis prompt version string, file reference regex pattern, action verb lists, hedging word lists, complexity thresholds
- No magic numbers in service or strategy code — all from constants

**Success criteria:**

- [x] All heuristic thresholds/word-lists referenced from constants, not inline
- [x] Constants grouped under `// === Request Analysis ===` section header
- [x] No duplicate constant definitions

**Planned tests:** None (constants are validated through usage in Step 3/4/5 tests). ✅

---

### Step 7: Persist Analysis as `_analysis.json`

**What:** Add persistence for `IRequestAnalysis` alongside the request file (e.g., `my-request_analysis.json`) so analysis survives restarts and is available to downstream phases.

**Files to create/modify:**

- `src/services/request_analysis/analysis_persistence.ts` (NEW)
- `src/services/request_analysis/mod.ts` (update barrel)

**Architecture notes:**

- Pure module with functions: `saveAnalysis(requestFilePath, analysis)` and `loadAnalysis(requestFilePath): IRequestAnalysis | null`
- Derives `_analysis.json` path from request `.md` path (matches `_clarification.json` pattern from Phase 47)
- Uses atomic write (write to `.tmp` then rename) matching project file-as-database pattern
- Validates loaded JSON against `RequestAnalysisSchema` before returning

**Success criteria:**

- [x] Writes `_analysis.json` atomically (temp file + rename)
- [x] Loads and validates against schema on read
- [x] Returns `null` for missing or invalid `_analysis.json`
- [x] Derives correct path: `Workspace/Requests/req.md` → `Workspace/Requests/req_analysis.json`

**Implemented tests** (`tests/services/request_analysis/analysis_persistence_test.ts`) — 8/8 passing:

- [x] `[AnalysisPersistence] derives correct _analysis.json path from .md path`
- [x] `[AnalysisPersistence] saves analysis as JSON sibling file`
- [x] `[AnalysisPersistence] loads previously saved analysis`
- [x] `[AnalysisPersistence] analysis data round-trips without loss`
- [x] `[AnalysisPersistence] returns null for missing analysis file`
- [x] `[AnalysisPersistence] returns null for corrupted analysis file`
- [x] `[AnalysisPersistence] returns null for JSON not matching schema`
- [x] `[AnalysisPersistence] uses atomic write (temp file then rename)`

---

### Step 8: Integrate into `RequestProcessor` Pipeline

**What:** Wire `RequestAnalyzer` into `RequestProcessor.process()` so analysis runs before the agent/flow routing split.

**Files to modify:**

- `src/services/request_processor.ts` (add analyzer call)
- `src/services/request_common.ts` (extend `buildParsedRequest` with analysis enrichment)

**Architecture notes:**

- `RequestProcessor` constructor receives `IRequestAnalyzerConfig` (or uses defaults from config)
- `RequestProcessor` creates `RequestAnalyzer` in constructor (follows existing pattern where sub-services are instantiated in constructor with injected deps)
- Call `analyzer.analyze()` in `process()` after `RequestParser.parse()` but before `processRequestByKind()` — so both agent and flow paths receive analysis
- Store analysis on `IRequestProcessingContext` (add `analysis?: IRequestAnalysis` field)
- In `processAgentRequest()`: pass analysis to `buildParsedRequest()` to populate `taskType`, `tags`, `filePaths`
- In `processFlowRequest()`: pass analysis to flow execution (prepare for Phase 48 flow gate integration)
- Persist analysis via `saveAnalysis()` after successful analysis

**Success criteria:**

- [x] Analysis runs for every request (both agent and flow kinds)
- [x] `IParsedRequest.taskType` populated from `analysis.taskType`
- [x] `IParsedRequest.tags` populated from `analysis.tags`
- [x] `IParsedRequest.filePaths` populated from `analysis.referencedFiles`
- [x] `IRequestProcessingContext` carries `analysis` field
- [x] Analysis saved as `_analysis.json` alongside request file
- [x] Pipeline still works when analyzer returns minimal/fallback analysis
- [x] No breaking changes to existing request processing

**Implemented tests** (`tests/services/request_processor_analysis_test.ts`) — 10/10 passing:

- [x] `[RequestProcessor] runs analysis before agent execution` (Wiring verification)
- [x] `[RequestProcessor] populates IParsedRequest.taskType from analysis`
- [x] `[RequestProcessor] populates IParsedRequest.tags from analysis`
- [x] `[RequestProcessor] populates IParsedRequest.filePaths from analysis`
- [x] `[RequestProcessor] populates request.context.analysis for downstream usage` (Context enrichment)
- [x] `[RequestProcessor] persists analysis as _analysis.json`
- [x] `[RequestProcessor] handles analyzer failure gracefully (continues without analysis)`
- [x] `[RequestProcessor] passes analysis to flow processing path`
- [x] `[RequestProcessor] plan metadata contains request analysis` (Plan integration)
- [x] `[RequestProcessor] skips analysis if request status is already PLANNED/COMPLETED` (Optimization)

---

### Step 9: Enhance `classifyTaskComplexity()` with Analysis

**What:** Replace the naive agent-ID-based complexity classification with content-aware classification using `IRequestAnalysis`.

**Files to modify:**

- `src/services/request_processor.ts` (rewrite `classifyTaskComplexity()`)

**Architecture notes:**

- New signature: `classifyTaskComplexity(blueprint, request, analysis?)`
- Three-tier fallback: (1) analysis.complexity → map to `TaskComplexity` enum, (2) content heuristics from request body, (3) agent-ID fallback (existing logic as last resort)
- Remove underscore from `_request` parameter — now actually used
- Content heuristics extracted to `estimateFromContent(body: string)` private method

**Success criteria:**

- [ ] When analysis present, its complexity is the primary signal
- [ ] When analysis absent, content heuristics provide reasonable classification
- [ ] Agent-ID fallback still works for backward compatibility
- [ ] `_request` parameter actually used (no underscore prefix)
- [ ] `TaskComplexity.SIMPLE` for short, clear, single-concern requests
- [ ] `TaskComplexity.COMPLEX` for multi-file, multi-requirement, lengthy requests

**Planned tests** (`tests/services/request_processor_complexity_test.ts`):

- `[classifyTaskComplexity] uses analysis complexity as primary signal`
- `[classifyTaskComplexity] falls back to content heuristics without analysis`
- `[classifyTaskComplexity] falls back to agent ID without analysis or content signal`
- `[classifyTaskComplexity] maps analysis "simple" to TaskComplexity.SIMPLE`
- `[classifyTaskComplexity] maps analysis "epic" to TaskComplexity.COMPLEX`
- `[classifyTaskComplexity] content heuristic: short body → SIMPLE`
- `[classifyTaskComplexity] content heuristic: many bullets → COMPLEX`
- `[classifyTaskComplexity] content heuristic: many file refs → COMPLEX`

---

### Step 10: Add Analysis to Plan Metadata

**What:** Include `IRequestAnalysis` in plan metadata so downstream quality evaluation phases (Phase 48: acceptance criteria, Phase 49: reflexive agent) can access structured goals and requirements.

**Files to modify:**

- `src/services/plan_writer.ts` (extend plan metadata)
- `src/shared/schemas/plan_schema.ts` (add optional analysis field)

**Architecture notes:**

- Additive change: add optional `requestAnalysis` field to plan metadata schema
- `PlanWriter.writePlan()` receives analysis alongside existing params
- Analysis is stored as a nested object in plan YAML frontmatter or as a plan metadata section

**Success criteria:**

- [ ] Plan files include `requestAnalysis` in metadata when available
- [ ] Plan files work normally without analysis (backward compatible)
- [ ] Analysis data round-trips: write → read → compare equals
- [ ] Plan schema validates with and without analysis field

**Planned tests** (`tests/services/plan_writer_analysis_test.ts`):

- `[PlanWriter] includes requestAnalysis in plan metadata`
- `[PlanWriter] writes plan without analysis (backward compat)`
- `[PlanWriter] analysis survives plan read round-trip`

---

### Step 11: Extend `IFlowStepRequest` for Flow Integration

**What:** Extend the flow step request type to carry analysis context, enabling flow steps to access request analysis.

**Files to modify:**

- `src/shared/schemas/flow.ts` (extend `IFlowStepRequest`)
- `src/flows/flow_runner.ts` (propagate analysis to steps)
- `src/services/request_router.ts` (pass analysis to `FlowRunner.execute()`)

**Architecture notes:**

- Add optional `requestAnalysis?: IRequestAnalysis` field to `IFlowStepRequest`
- `FlowRunner.execute()` accepts analysis in its request parameter
- `FlowRunner.prepareStepRequest()` injects analysis into each step's request
- Gate steps can access analysis for future dynamic criteria (Phase 48)

**Success criteria:**

- [ ] `IFlowStepRequest` has optional `requestAnalysis` field
- [ ] `FlowRunner.execute()` passes analysis to step requests
- [ ] Existing flows work without analysis (field is optional)
- [ ] Gate step evaluation context includes analysis when available

**Planned tests** (`tests/flows/flow_runner_analysis_test.ts`):

- `[FlowRunner] propagates requestAnalysis to step requests`
- `[FlowRunner] works without requestAnalysis (backward compat)`
- `[FlowRunner] gate steps receive analysis in evaluation context`

---

### Step 12: Add `IRequestAnalyzerService` to TUI Data Path

**What:** Extend the request service layer so TUI can load and display analysis data alongside requests.

**Files to modify:**

- `src/shared/interfaces/i_request_service.ts` (add `getAnalysis` method)
- `src/cli/services/request_service.ts` (implement `getAnalysis`)

**Architecture notes:**

- Add `getAnalysis(requestId: string): Promise<IRequestAnalysis | null>` to `IRequestService`
- Implementation reads `_analysis.json` via `loadAnalysis()` from Step 7
- This exposes analysis data to both CLI and TUI consumers through the existing service interface

**Success criteria:**

- [ ] `IRequestService.getAnalysis()` defined in interface
- [ ] Implementation loads from `_analysis.json` using `loadAnalysis()`
- [ ] Returns `null` when no analysis exists
- [ ] Implementation handles both agent and flow request paths

**Planned tests** (`tests/cli/services/request_service_analysis_test.ts`):

- `[RequestService] getAnalysis returns analysis for analyzed request`
- `[RequestService] getAnalysis returns null for request without analysis`

---

### Step 13: Add Analysis Display to Request Manager TUI View

**What:** Enhance the Request Manager TUI view to display `IRequestAnalysis` data in the detail panel when a request is selected.

**Files to modify:**

- `src/tui/request_manager_view.ts` (add analysis rendering)

**Architecture notes:**

- Follow existing detail rendering pattern: `showRequestDetail()` → `formatDetailContent()`
- Add a new section in `formatDetailContent()` between request metadata and body that shows:
  - Complexity badge (simple/medium/complex/epic)
  - Actionability score bar (0–100)
  - Goals list (explicit/inferred markers)
  - Requirements count with breakdown (functional/non-functional/constraint)
  - Ambiguities count with first ambiguity summary if any
  - Referenced files list
- Lazy-load analysis via `service.getAnalysis()` only when detail view opens (matches existing `showRequestDetail()` pattern)
- No new keybindings; analysis is part of the detail view

**Success criteria:**

- [ ] Detail panel shows analysis section when analysis data exists
- [ ] Detail panel renders correctly without analysis data (graceful absence)
- [ ] Complexity displayed as colored badge (simple=green, medium=yellow, complex=red, epic=magenta)
- [ ] Actionability score displayed as visual bar (e.g., `████████░░ 80/100`)
- [ ] Goals listed with `[E]` (explicit) or `[I]` (inferred) markers
- [ ] Ambiguities shown with count and highest-impact summary

**Planned tests** (`tests/tui/request_manager_analysis_test.ts`):

- `[RequestManagerView] displays analysis section in detail view`
- `[RequestManagerView] renders detail without analysis gracefully`
- `[RequestManagerView] formats complexity badge with correct color`
- `[RequestManagerView] formats actionability score bar`
- `[RequestManagerView] lists goals with explicit/inferred markers`
- `[RequestManagerView] shows ambiguity count and summary`

---

### Step 14: Add Analysis to `exoctl request show` CLI Output

**What:** Enhance the CLI `request show` command to display analysis data alongside request metadata.

**Files to modify:**

- `src/cli/commands/request_commands.ts` (enhance `show` subcommand output)

**Architecture notes:**

- After showing existing request metadata, call `service.getAnalysis()` and format analysis if available
- Display format: table-style output for goals, requirements, complexity, and actionability
- Use same color coding as TUI (complexity badge colors)
- Silent when no analysis exists (no "analysis not found" message — maintains backward compat)

**Success criteria:**

- [ ] `exoctl request show <id>` includes analysis section when available
- [ ] Output is clean and readable without analysis
- [ ] Complexity and actionability are prominent
- [ ] Goals and ambiguities are listed concisely

**Planned tests** (`tests/cli/commands/request_show_analysis_test.ts`):

- `[request show] includes analysis section in output`
- `[request show] works without analysis data`

---

### Step 15: Add `exoctl request analyze` CLI Command

**What:** Add a standalone CLI command to trigger analysis on an existing request, enabling manual re-analysis and analysis review.

**Files to modify:**

- `src/cli/commands/request_commands.ts` (add `analyze` subcommand)

**Architecture notes:**

- `exoctl request analyze <id> [--mode heuristic|llm|hybrid] [--force]`
- Loads request file, runs `RequestAnalyzer.analyze()`, persists result, displays summary
- `--force` re-analyzes even if `_analysis.json` exists
- Without `--force`, shows existing analysis if present
- Uses same `IRequestService` and `RequestAnalyzer` instantiation as the pipeline

**Success criteria:**

- [ ] `exoctl request analyze <id>` produces and displays analysis
- [ ] `--mode` flag controls analysis mode
- [ ] `--force` flag re-analyzes even when `_analysis.json` exists
- [ ] Displays formatted analysis summary (complexity, actionability, goals count, ambiguity count)

**Planned tests** (`tests/cli/commands/request_analyze_test.ts`):

- `[request analyze] analyzes request and displays summary`
- `[request analyze] uses specified mode`
- `[request analyze] force re-analyzes existing analysis`
- `[request analyze] shows existing analysis without --force`

---

### Step 16: Add TOML Configuration for Request Analysis

**What:** Add `[request_analysis]` section to `exo.config.toml` schema so users can configure the analyzer globally.

**Files to modify:**

- `src/shared/schemas/config.ts` (extend `ConfigSchema`)
- `exo.config.toml` (add default section)

**Architecture notes:**

- New TOML section:

  ```toml
  [request_analysis]
  enabled = true
  mode = "hybrid"
  actionability_threshold = 60
  infer_acceptance_criteria = true
  persist_analysis = true
  ```

- `RequestProcessor` reads config from `Config.request_analysis` to construct `IRequestAnalyzerConfig`
- All fields optional with defaults in constants

**Success criteria:**

- [ ] Config schema validates new `[request_analysis]` section
- [ ] All fields are optional with sensible defaults
- [ ] `RequestProcessor` uses config values when constructing analyzer
- [ ] Invalid config values produce clear validation errors

**Planned tests** (`tests/shared/schemas/config_request_analysis_test.ts`):

- `[ConfigSchema] validates request_analysis section`
- `[ConfigSchema] uses defaults when request_analysis is absent`
- `[ConfigSchema] rejects invalid mode value`
- `[ConfigSchema] rejects actionability_threshold outside 0-100`

---

### Step 17: End-to-End Integration Test

**What:** Create an integration test that verifies the full pipeline from request file to analysis to plan metadata.

**Files to create:**

- `tests/integration/request_analysis_e2e_test.ts` (NEW)

**Architecture notes:**

- Uses `TestEnvironment.create()` for full workspace setup
- Creates a request `.md` file with known content
- Runs through `RequestProcessor.process()`
- Verifies: `_analysis.json` created, plan metadata contains analysis, `IParsedRequest` fields populated
- Tests both heuristic and hybrid modes

**Success criteria:**

- [ ] Full pipeline: request file → parse → analyze → agent run → plan with analysis metadata
- [ ] `_analysis.json` persisted and loadable
- [ ] `IParsedRequest.taskType` and `tags` populated from analysis
- [ ] Pipeline degrades gracefully when LLM is unavailable (heuristic fallback)

**Planned tests:**

- `[E2E] request analysis pipeline with heuristic mode`
- `[E2E] request analysis pipeline with hybrid mode (mock LLM)`
- `[E2E] analysis persisted as _analysis.json`
- `[E2E] plan metadata includes request analysis`
- `[E2E] flow request receives analysis context`

---

### Step 18: Update `ARCHITECTURE.md`

**What:** Update the project architecture document to reflect the new Request Analysis layer in the pipeline, new data flow, and new activity journal events.

**Files to modify:**

- `ARCHITECTURE.md`

**Sections to update:**

1. **"Request Processing Flow"** — Insert the `RequestAnalyzer.analyze()` step between `RequestParser.parse()` and the agent/flow routing decision. Update the pipeline diagram to show:

   ```text
   Request File (.md)
     → RequestParser.parse()
     → RequestAnalyzer.analyze()    ← NEW
     → RequestRouter (agent or flow)
   ```

1.

1.

1.

1.
   - Three analysis modes (heuristic / llm / hybrid) with cost/accuracy tradeoffs
   - Heuristic capabilities (file detection, keyword extraction, complexity signals, ambiguity detection)
   - LLM analysis flow (prompt → generate → validate against schema → fallback)
   - Persistence model (`_analysis.json` sibling files)
   - Configuration (`[request_analysis]` TOML section)
   - Integration points: `RequestProcessor`, `PlanWriter`, `FlowRunner`

1.

1.

**Success criteria:**

- [ ] Pipeline diagram includes `RequestAnalyzer.analyze()` step
- [ ] New "Request Analysis Layer" subsection with mode descriptions
- [ ] `RequestAnalysisSchema` listed in schema layer section
- [ ] `request.analyzed` event documented in activity logging
- [ ] Flow routing section notes analysis propagation to both paths
- [ ] TUI section notes analysis display in request detail
- [ ] All internal links use relative paths per documentation standards

**Planned tests:** None (documentation-only; validated by `deno task check:docs` and manual review).

---

### Step 19: Update User-Facing Documentation in `docs/`

**What:** Update user guide, technical spec, and developer-facing docs to cover the new request analysis feature.

**Files to modify:**

- `docs/ExoFrame_User_Guide.md`
- `docs/dev/ExoFrame_Technical_Spec.md`
- `docs/dev/Agent_Validation_Requests.md`
- `docs/dev/ExoFrame_Testing_and_CI_Strategy.md`

**Updates per file:**

1. **`docs/ExoFrame_User_Guide.md`:**
   - Add section explaining request analysis: what it does, when it runs, how to configure it
   - Document `exoctl request analyze <id>` command with flags (`--mode`, `--force`)
   - Note that `exoctl request show <id>` now displays analysis summary
   - Explain `[request_analysis]` config section in `exo.config.toml` with examples
   - Describe `_analysis.json` files in `Workspace/Requests/`

1.
   - Add `IRequestAnalysis` schema specification to schemas section
   - Document `RequestAnalyzer` service API (modes, config, output)
   - Add `_analysis.json` to file format specifications
   - Document analysis-enriched `IParsedRequest` fields

1.
   - Add test scenarios for request analysis validation (heuristic, LLM, hybrid modes)
   - Add request examples showing analysis output for different complexity levels
   - Document how quality judges can use analysis data

1.
   - Add request analysis test categories to the test strategy matrix
   - Document schema validation tests, heuristic tests, LLM mock tests, integration tests
   - Note new test file locations (`tests/services/request_analysis/`, `tests/shared/schemas/request_analysis_test.ts`)

**Success criteria:**

- [ ] User guide explains request analysis in user-accessible language
- [ ] `exoctl request analyze` command documented with usage examples
- [ ] `[request_analysis]` config section documented with TOML examples
- [ ] Technical spec includes `IRequestAnalysis` schema definition
- [ ] Test strategy doc covers new test categories
- [ ] No broken internal links

**Planned tests:** None (documentation-only; validated by manual review and link checker).

---

### Step 20: Update `.copilot/` Agent Documentation

**What:** Update the AI agent guidance docs to reflect the new request analysis components, ensuring future AI agents (and human developers) can find guidance on the analysis layer.

**Files to modify:**

- `.copilot/source/exoframe.md` (add RequestAnalyzer to service catalog)
- `.copilot/cross-reference.md` (add request-analysis task mapping)
- `.copilot/manifest.json` (regenerate via build script)

**Updates:**

1. **`.copilot/source/exoframe.md`:**
   - Add `RequestAnalyzer` to the services section with: purpose, location (`src/services/request_analysis/`), config interface, key methods, integration point
   - Add `RequestAnalysisSchema` to the schemas section
   - Update the request processing pipeline description to include analysis step
   - Document the `src/services/request_analysis/` directory structure (mod.ts, heuristic_analyzer.ts, llm_analyzer.ts, request_analyzer.ts, analysis_persistence.ts)

1.
   - Add row: `request analysis / intent extraction` → `source/exoframe.md` + `planning/phase-45-request-intent-analysis.md`
   - Add topic index entries: `request-analysis`, `intent-extraction`, `actionability`

1.
   - Regenerate via `deno run --allow-read --allow-write scripts/build_agents_index.ts`

**Success criteria:**

- [ ] `.copilot/source/exoframe.md` lists `RequestAnalyzer` in service catalog
- [ ] `.copilot/cross-reference.md` has `request analysis` task row
- [ ] `manifest.json` is fresh (passes `deno task check:docs`)
- [ ] Future agents can find request analysis guidance via cross-reference

**Planned tests:** `deno task check:docs` passes (verifies manifest freshness).

---

### Implementation Order & Dependencies

```text
Step  1: Schema & types              ← foundation, no dependencies
Step  2: Interface                   ← depends on Step 1 (types)
Step  6: Constants & enums           ← can parallel with Steps 1-2
Step  3: Heuristic analyzer          ← depends on Steps 1, 6
Step  4: LLM analyzer               ← depends on Steps 1, 6
Step  5: RequestAnalyzer service     ← depends on Steps 2, 3, 4
Step  7: Persistence                 ← depends on Step 1
Step  8: RequestProcessor wiring     ← depends on Steps 5, 7
Step  9: classifyTaskComplexity      ← depends on Step 8
Step 10: Plan metadata               ← depends on Step 8
Step 11: Flow integration            ← depends on Step 8
Step 12: TUI data path               ← depends on Step 7
Step 13: TUI view                    ← depends on Step 12
Step 14: CLI show                    ← depends on Step 12
Step 15: CLI analyze command         ← depends on Step 5
Step 16: TOML config                 ← depends on Step 5
Step 17: E2E test                    ← depends on all above
Step 18: ARCHITECTURE.md             ← depends on Steps 8, 11, 13 (needs final design)
Step 19: User & dev docs             ← depends on Steps 15, 16 (needs CLI & config)
Step 20: .copilot/ agent docs        ← depends on Step 18 (needs architecture)
```

**Parallel waves:**

| Wave | Steps | Description |
| ------ | ------- | ------------- |
| 1 | 1, 2, 6 | Types, interfaces, constants (no runtime code) |
| 2 | 3, 4 | Analysis strategies (parallel, independent) |
| 3 | 5, 7 | Orchestrator service + persistence |
| 4 | 8, 15, 16 | Pipeline wiring + CLI command + config |
| 5 | 9, 10, 11, 12 | Downstream consumers (parallel) |
| 6 | 13, 14 | UI integration (depends on data path) |
| 7 | 17 | E2E validation |
| 8 | 18, 19, 20 | Documentation (after implementation stabilizes) |

---

## Detailed Design

### 1. `IRequestAnalysis` Schema

```typescript
export interface IRequestGoal {
  /** One-sentence description of the goal */
  description: string;
  /** Whether explicitly stated or inferred */
  explicit: boolean;
  /** Priority relative to other goals (1 = highest) */
  priority: number;
}

export interface IRequirement {
  /** What is required */
  description: string;
  /** Whether functional or non-functional */
  type: "functional" | "non-functional" | "constraint";
  /** Whether explicitly stated or inferred */
  explicit: boolean;
  /** Confidence in extraction accuracy (0.0–1.0) */
  confidence: number;
}

export interface IAmbiguity {
  /** What is ambiguous */
  description: string;
  /** Why it matters */
  impact: "high" | "medium" | "low";
  /** Possible interpretations */
  interpretations: string[];
  /** Suggested clarification question */
  clarificationQuestion?: string;
}

export interface IRequestAnalysis {
  /** Primary goals extracted from the request */
  goals: IRequestGoal[];
  /** Explicit and inferred requirements */
  requirements: IRequirement[];
  /** Detected constraints (technology, timeline, scope) */
  constraints: string[];
  /** Extracted or inferred acceptance criteria */
  acceptanceCriteria: string[];
  /** Detected ambiguities and underspecification */
  ambiguities: IAmbiguity[];
  /** Overall actionability score (0–100) */
  actionabilityScore: number;
  /** Classified complexity based on content analysis */
  complexity: "simple" | "medium" | "complex" | "epic";
  /** Suggested task type for skill matching */
  taskType: string;
  /** Extracted keywords/tags for skill matching */
  tags: string[];
  /** Whether the request references specific files */
  referencedFiles: string[];
  /** Analysis metadata */
  metadata: {
    analyzedAt: string;
    analyzerVersion: string;
    durationMs: number;
  };
}
```

### 2. `RequestAnalyzer` Service

```typescript
export interface IRequestAnalyzerConfig {
  /** Whether to use LLM for deep analysis or heuristics-only */
  mode: "llm" | "heuristic" | "hybrid";
  /** Minimum actionability score to proceed without warning */
  actionabilityThreshold?: number;
  /** Whether to extract acceptance criteria even when not explicit */
  inferAcceptanceCriteria?: boolean;
}

export class RequestAnalyzer {
  constructor(
    private config: IRequestAnalyzerConfig,
    private modelProvider?: IModelProvider,
  ) {}

  async analyze(requestText: string, context?: Record<string, string>): Promise<IRequestAnalysis>;

  /** Quick heuristic analysis without LLM call */
  analyzeQuick(requestText: string): Partial<IRequestAnalysis>;
}
```

#### Analysis Modes

| Mode | Cost | Accuracy | Use Case |
| ------ | ------ | ---------- | ---------- |
| `heuristic` | Zero (no LLM) | Basic | Quick classification, keyword extraction, file reference detection |
| `llm` | 1 LLM call | High | Full intent extraction, acceptance criteria inference, ambiguity detection |
| `hybrid` | Conditional | Balanced | Heuristic first; LLM only if actionability is below threshold |

#### Heuristic Analysis Capabilities (No LLM)

- **File reference detection**: regex for file paths, `src/`, extensions
- **Keyword extraction**: action verbs (implement, fix, refactor, add, remove, test)
- **Complexity signals**: number of distinct requirements, presence of "and" chains, multiple file references
- **Ambiguity signals**: question marks, hedging language, unresolved pronouns ("it", "that", "this")
- **Task type classification**: map action verbs to types (feature, bugfix, refactor, test, docs)

#### LLM Analysis Prompt (Sketch)

```text
You are analyzing a request submitted to an AI agent system. Extract structured information.

## Request
{requestText}

## Extract

1. Goals: What is the user trying to accomplish? List each goal.
1.
1.
1.
1.
1.
1.

Respond with JSON matching the IRequestAnalysis schema.
```

### 3. Integration with `RequestProcessor`

The analyzer slots into `processAgentRequest()` between request construction and agent execution:

```text
Request File (.md)
  → RequestParser.parse()
  → buildParsedRequest()
  → **RequestAnalyzer.analyze()**    ← NEW STEP
  → enrichParsedRequest(analysis)    ← Populate taskType, tags, context
  → classifyTaskComplexity(analysis) ← Content-aware classification
  → AgentRunner.run()
  → PlanWriter.writePlan()
```

### 4. Impact on `classifyTaskComplexity()`

Replace the current implementation:

```typescript
// BEFORE (agent-name-based, ignores request content)
private classifyTaskComplexity(blueprint: IBlueprint, _request: IParsedRequest): TaskComplexity {
    const agentId = blueprint.agentId || "";
    if (agentId.includes("analyzer")) return TaskComplexity.SIMPLE;
    if (agentId.includes("coder")) return TaskComplexity.COMPLEX;
    return TaskComplexity.MEDIUM;
}

// AFTER (content-aware, uses analysis)
private classifyTaskComplexity(
    blueprint: IBlueprint,
    request: IParsedRequest,
    analysis: IRequestAnalysis,
): TaskComplexity {
    // Primary: use analysis complexity
    // Secondary: agent-type hints
    // Tertiary: fallback to MEDIUM
}
```

---

## Methodology: Specification-Driven Development

This phase produces the structured `IRequestAnalysis` — the raw material from which a formal specification is built. In SDD terms, this is the **intent extraction** step: converting unstructured user prose into structured goals, requirements, and acceptance criteria that downstream phases use as the specification contract.

See `.copilot/process/specification-driven-development.md` for the full SDD analysis and how Phases 45–49 map to SDD principles.

---

## Dependencies

- `src/services/output_validator.ts` — For validating LLM analysis output
- `src/services/agent_runner.ts` — For LLM mode analysis calls
- `src/services/request_processor.ts` — Integration point
- `src/shared/schemas/` — New schema definitions
- **Phase 46** (optional) — Portal codebase knowledge (`IPortalKnowledge`) can validate file references, inform complexity classification, and detect convention conflicts during request analysis

## Risks & Mitigations

| Risk | Mitigation |
| ------ | ----------- |
| LLM analysis adds latency/cost to every request | Hybrid mode: heuristic first, LLM only when needed |
| Analysis may be inaccurate | Heuristic fallback; analysis is advisory, not blocking |
| Over-engineering simple requests | Actionability threshold skips deep analysis for clear requests |
| Schema changes to `IParsedRequest` | Additive only; existing fields gain population, no breaking changes |

## Open Questions

- Should the analysis be persisted alongside the request file (e.g., as a sibling `_analysis.json`)?
- Should the `product-manager` agent blueprint be usable as the analyzer in LLM mode?
- Should analysis results be visible in CLI/TUI for user review before execution?
- What is the right actionability threshold below which to warn or block?

---

## Flow Request Coverage

**Gap identified:** The current integration design targets only the agent processing path (`processAgentRequest`). Flow-routed requests (`processFlowRequest`) bypass `buildParsedRequest()` entirely and produce a static plan stub. The `FlowRunner` receives the raw `request.body` as `userPrompt` with no analysis attached.

### Required Changes for Flow Requests

1. **Move analysis before the agent/flow split.** `RequestAnalyzer.analyze()` should run in `RequestProcessor.process()` after `RequestParser.parse()` but before `processRequestByKind()`. The analysis applies to the *request*, not to the execution mechanism.

1.

```typescript
export interface IFlowStepRequest {
  userPrompt: string;
  context?: IFlowStepContext;
  traceId?: string;
  requestId?: string;
  skills?: string[];
  /** Request analysis from Phase 45 (when available) */
  requestAnalysis?: IRequestAnalysis;
}
```

1.

1.

```text
Request File (.md)
  → RequestParser.parse()
  → **RequestAnalyzer.analyze()**       ← Runs for BOTH agent and flow requests
  → getRequestKindOrFail()
  → [if flow] → processFlowRequest()    ← Now receives IRequestAnalysis
      → FlowRunner.execute() with analysis context
  → [if agent] → processAgentRequest()  ← Existing integration
```
