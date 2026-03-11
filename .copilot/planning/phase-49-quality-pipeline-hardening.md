# Phase 49: Quality Pipeline Hardening — Minor Gaps

## Status: PLANNING

A collection of smaller improvements to the quality evaluation pipeline that complement Phases 45–47 but are independently valuable and lower in complexity.

## Executive Summary

This phase addresses four related but individually smaller gaps in the quality pipeline:

1. **Reflexive Agent critique needs request-specific context** — The self-critique loop evaluates against generic dimensions without structured goals.

1.
1.

These are combined into one phase because each is a targeted fix rather than a new architectural component.

---

## Gap 1: Reflexive Agent Critique Lacks Structured Goals

### Current State

The `ReflexiveAgent` in `src/services/reflexive_agent.ts` uses a default critique prompt that evaluates against six generic dimensions:

```text
Consider:

1. Accuracy         — Is the information correct?

1.
1.
1.
1.

The critique agent receives the raw `{request}` text and the `{response}` — but no structured list of what "complete" or "relevant" means for this specific request.

### Impact

The critique can identify surface-level issues (grammar, structure, obvious omissions) but cannot reliably detect:

- Missing requirements that were stated in the request
- Subtle misunderstandings of the task
- Responses that are "technically correct" but miss the point

### Proposed Improvement

**When `IRequestAnalysis` is available (Phase 45):**

Extend the `ReflexiveAgent` config to accept an optional `requestAnalysis` parameter. When present, inject structured requirements into the critique prompt:

```typescript
export interface IReflexiveAgentConfig extends IAgentRunnerConfig {
  // ... existing fields ...
  /** Optional: Structured analysis of the request for goal-aware critique */
  requestAnalysis?: IRequestAnalysis;
}
```

Modify the critique prompt template to include a requirements checklist:

```text
## Specific Requirements to Verify
{requirements_checklist}

## Acceptance Criteria
{acceptance_criteria_list}

For each requirement, explicitly state whether the response addresses it (MET / PARTIAL / MISSING).
```

**When `IRequestAnalysis` is NOT available (standalone use):**

The existing generic prompt continues to work unchanged. This is a non-breaking enhancement.

### Goals

- [ ] Add `requestAnalysis` optional field to `IReflexiveAgentConfig`.
- [ ] Build a `buildEnhancedCritiquePrompt()` that merges generic dimensions with specific requirements.
- [ ] Add `requirementsFulfillment` field to `CritiqueSchema` output for structured tracking.
- [ ] Write tests for enhanced critique with and without analysis context.

---

## Gap 2: Session Memory Not Leveraged for Request Understanding

### Current State

`SessionMemory` in `src/services/session_memory.ts` provides relevant past learnings and patterns that get injected into agent prompts. This helps agents avoid repeating past mistakes and follow established patterns.

However, session memory is injected **after** the request is already constructed and **only as additional context for the executing agent**. It does not contribute to:

- Understanding the current request better
- Detecting patterns in what the user typically asks for
- Enriching the request with relevant historical context
- Informing the quality assessment of the request

### Impact

- If a user has repeatedly submitted similar requests, the system doesn't recognize the pattern
- Past failures on similar requests don't inform whether the current request is well-specified
- Memory context could improve request analysis accuracy (Phase 45) but isn't available at that stage

### Proposed Improvement

Make `SessionMemory.enhance()` available to the `RequestAnalyzer` (Phase 45) and `RequestQualityGate` (Phase 47), not just the `AgentRunner`:

```typescript
// In RequestAnalyzer:
async analyze(
  requestText: string,
  context?: Record<string, string>,
  memories?: EnhancedRequest,          // NEW: past learnings
): Promise<IRequestAnalysis> {
  // Use memories to:
  // - Identify similar past requests and their outcomes
  // - Detect recurring patterns in user requests
  // - Inform complexity classification with historical data
}
```

This is a wiring change — `SessionMemory` already produces the right data; it just needs to be consumed earlier in the pipeline.

### Goals

- [ ] Make `SessionMemory.enhance()` callable from `RequestProcessor` before agent execution.
- [ ] Pass memory context to `RequestAnalyzer` (when available).
- [ ] Add "similar past requests" as a signal for quality assessment.
- [ ] Write tests for memory-enhanced request analysis.

---

## Gap 3: Task Complexity Classification Is Naive

### Current State

`RequestProcessor.classifyTaskComplexity()` in `src/services/request_processor.ts`:

```typescript
private classifyTaskComplexity(blueprint: IBlueprint, _request: IParsedRequest): TaskComplexity {
    const agentId = blueprint.agentId || "";
    if (agentId.includes("analyzer") || agentId.includes("summarizer")) return TaskComplexity.SIMPLE;
    if (agentId.includes("coder") || agentId.includes("planner") || agentId.includes("architect")) {
      return TaskComplexity.COMPLEX;
    }
    return TaskComplexity.MEDIUM;
}
```

The method:

- Takes `_request` as parameter but **completely ignores it** (underscore prefix)
- Classifies solely by agent ID substring matching
- Has no awareness of request scope, number of requirements, or technical complexity
- Directly affects **provider selection** — wrong classification means wrong model

### Impact

- A trivial one-line fix assigned to `senior-coder` → classified as `COMPLEX` → expensive model
- A massive multi-file refactor described in a text body → always `MEDIUM` if agent is `quality-judge`
- Provider budget is not optimized based on actual task needs

### Proposed Improvement

Replace with a multi-signal classifier that uses:

1. **Request analysis** (Phase 45): `analysis.complexity` is the primary signal

1.

```typescript
private classifyTaskComplexity(
    blueprint: IBlueprint,
    request: IParsedRequest,
    analysis?: IRequestAnalysis,
): TaskComplexity {
    // Primary: analysis-derived complexity (Phase 45)
    if (analysis) {
        return this.mapAnalysisComplexity(analysis.complexity);
    }

    // Secondary: content-based heuristics
    const contentComplexity = this.estimateFromContent(request.userPrompt);
    if (contentComplexity !== null) return contentComplexity;

    // Tertiary: agent-type fallback (existing behavior)
    return this.estimateFromAgentId(blueprint.agentId);
}

private estimateFromContent(body: string): TaskComplexity | null {
    const lines = body.split("\n").filter(l => l.trim());
    const bulletPoints = lines.filter(l => /^\s*[-*\d]/.test(l)).length;
    const fileRefs = (body.match(/\b[\w/]+\.\w{1,5}\b/g) || []).length;

    if (bulletPoints > 10 || fileRefs > 5 || body.length > 3000) return TaskComplexity.COMPLEX;
    if (bulletPoints <= 2 && fileRefs <= 1 && body.length < 500) return TaskComplexity.SIMPLE;
    return null; // Indeterminate
}
```

### Goals

- [ ] Add content-based heuristics to `classifyTaskComplexity()`.
- [ ] Accept optional `IRequestAnalysis` parameter for primary classification.
- [ ] Remove underscore from `_request` parameter — it's now used.
- [ ] Write tests for complexity classification with various request patterns.

---

## Gap 4: No Structured Request Frontmatter for Expectations

### Current State

`IRequestFrontmatter` in `src/services/request_processing/types.ts`:

```typescript
export interface IRequestFrontmatter {
  trace_id: string;
  created: string;
  status: RequestStatusType;
  priority: string;
  agent?: string;
  flow?: string;
  source: string;
  created_by: string;
  portal?: string;
  target_branch?: string;
  model?: string;
  skills?: string;
  subject?: string;
  subject_is_fallback?: boolean;
}
```

There is no field for users to explicitly state:

- Acceptance criteria (what "done" looks like)
- Expected outcomes
- Success conditions
- Scope constraints

Users can only express these in the free-text body, which requires LLM analysis to extract (Phase 45).

### Impact

- Users with specific expectations must rely on the agent inferring them from prose
- Structured expectations would improve Phase 45 analysis accuracy
- Automated systems submitting requests (CI, webhooks) cannot specify machine-readable criteria

### Proposed Improvement

Add optional structured fields to `IRequestFrontmatter`:

```typescript
export interface IRequestFrontmatter {
  // ... existing fields ...

  /** Explicit acceptance criteria (YAML list) */
  acceptance_criteria?: string[];

  /** Expected outcomes (YAML list) */
  expected_outcomes?: string[];

  /** Scope constraints */
  scope?: {
    include?: string[];
    exclude?: string[];
  };
}
```

Example request file:

```yaml
---
trace_id: "abc-123"
agent: "senior-coder"
portal: "my-project"
priority: "high"
acceptance_criteria:
  - "All existing tests pass"
  - "New endpoint returns 200 for valid input"
  - "Input validation rejects payloads > 1MB"
expected_outcomes:
  - "New REST endpoint at /api/v2/upload"
  - "Updated API documentation"
scope:
  include: ["src/api/", "tests/api/"]
  exclude: ["src/legacy/"]
---

Implement a file upload endpoint...
```

These structured fields feed directly into:

- **Phase 45** `RequestAnalyzer` (high-confidence explicit requirements)
- **Phase 48** `CriteriaGenerator` (each acceptance criterion becomes an evaluation criterion)
- **Phase 47** `RequestQualityGate` (presence of criteria boosts quality score)

### Goals

- [ ] Add `acceptance_criteria`, `expected_outcomes`, and `scope` to `IRequestFrontmatter`.
- [ ] Update `RequestParser` to handle YAML list fields.
- [ ] Update `buildParsedRequest()` to include structured expectations in context.
- [ ] Add `--acceptance-criteria` option to `exoctl request create`.
- [ ] Write tests for parsing and propagating structured expectations.

---

## Step-by-Step Implementation Plan

### Step 1: Add `requestAnalysis` to `IReflexiveAgentConfig` (Gap 1)

**What:** Extend the `IReflexiveAgentConfig` interface to accept an optional `requestAnalysis` parameter for goal-aware critique.

**Files to modify:**

- `src/services/reflexive_agent.ts` (extend config interface)

**Architecture notes:**

- Add `requestAnalysis?: IRequestAnalysis` to `IReflexiveAgentConfig`
- This is the entry point for Gap 1 — all downstream prompt enhancements depend on this field
- Non-breaking: field is optional; all existing uses of `ReflexiveAgent` continue unchanged
- Import `IRequestAnalysis` from `src/shared/schemas/mod.ts`

**Success criteria:**

- [ ] `IReflexiveAgentConfig` has optional `requestAnalysis` field
- [ ] Existing `ReflexiveAgent` instantiations compile without changes
- [ ] TypeScript compiles with `deno check`

**Planned tests:** None (type-only change; validated by compile and Step 2 tests).

---

### Step 2: Implement `buildEnhancedCritiquePrompt()` (Gap 1)

**What:** Create a function that builds an enhanced critique prompt merging generic dimensions with specific requirements from `IRequestAnalysis`.

**Files to modify:**

- `src/services/reflexive_agent.ts` (add prompt builder function)

**Architecture notes:**

- Private method `buildEnhancedCritiquePrompt(request, response, analysis) → string` inside `ReflexiveAgent`
- When `requestAnalysis` is present: inject goals list (with `[E]`/`[I]` markers), requirements checklist, acceptance criteria list, instruction to evaluate each as MET/PARTIAL/MISSING
- When `requestAnalysis` is absent: return existing generic prompt unchanged
- Cap injected requirements at 10 to avoid prompt bloat (use top-priority items if over 10)
- Prompt section added between request and generic dimensions:

  ```text
  ## Specific Requirements to Verify
  {numbered goals with markers}

  ## Acceptance Criteria
  {numbered criteria}

  For each, state: ✅ MET / ⚠️ PARTIAL / ❌ MISSING
  ```

**Success criteria:**

- [ ] Enhanced prompt includes goals with [E]/[I] markers when analysis present
- [ ] Enhanced prompt includes acceptance criteria when present
- [ ] Generic prompt returned when no analysis
- [ ] Requirements capped at 10
- [ ] Prompt structure matches expected format

**Planned tests** (`tests/services/reflexive_agent_enhanced_prompt_test.ts`):

- `[buildEnhancedCritiquePrompt] includes goals when analysis present`
- `[buildEnhancedCritiquePrompt] includes acceptance criteria`
- `[buildEnhancedCritiquePrompt] marks goals as explicit/inferred`
- `[buildEnhancedCritiquePrompt] returns generic prompt without analysis`
- `[buildEnhancedCritiquePrompt] caps requirements at 10`
- `[buildEnhancedCritiquePrompt] handles analysis with no goals`

---

### Step 3: Add `requirementsFulfillment` to `CritiqueSchema` (Gap 1)

**What:** Extend the critique output schema to include a structured `requirementsFulfillment` field tracking MET/PARTIAL/MISSING per requirement.

**Files to modify:**

- `src/services/reflexive_agent.ts` or related schema file (extend `CritiqueSchema`)

**Architecture notes:**

- Add optional `requirementsFulfillment` field to the Zod schema used for parsing critique LLM output
- Type: `z.array(z.object({ requirement: z.string(), status: z.enum(["MET", "PARTIAL", "MISSING"]), note: z.string().optional() })).optional()`
- Optional at schema level — critique without analysis won't have this field
- This field is consumed by `ConfidenceScorer` (Phase 48 Step 7) for goal alignment scoring

**Success criteria:**

- [ ] `CritiqueSchema` validates `requirementsFulfillment` when present
- [ ] Schema validates without `requirementsFulfillment` (backward compatible)
- [ ] Status enum: `MET`, `PARTIAL`, `MISSING`
- [ ] Each entry has `requirement` string and `status`
- [ ] Optional `note` field for explanation

**Planned tests** (`tests/services/reflexive_agent_critique_schema_test.ts`):

- `[CritiqueSchema] validates requirementsFulfillment array`
- `[CritiqueSchema] validates without requirementsFulfillment`
- `[CritiqueSchema] validates status enum values`
- `[CritiqueSchema] allows optional note per requirement`

---

### Step 4: Wire Enhanced Critique in `ReflexiveAgent.run()` (Gap 1)

**What:** Update the `ReflexiveAgent.run()` method to use the enhanced critique prompt and parse the new `requirementsFulfillment` field.

**Files to modify:**

- `src/services/reflexive_agent.ts` (update `run()` to call `buildEnhancedCritiquePrompt()`)

**Architecture notes:**

- In `run()`, check if `config.requestAnalysis` is set
- If yes: call `buildEnhancedCritiquePrompt()` and use enhanced schema for parsing
- If no: continue with existing generic critique flow
- Parse `requirementsFulfillment` from LLM output via `OutputValidator`
- Include fulfillment data in the critique result for downstream consumers

**Success criteria:**

- [ ] `ReflexiveAgent` uses enhanced prompt when analysis available
- [ ] `ReflexiveAgent` uses generic prompt when analysis absent
- [ ] `requirementsFulfillment` parsed from LLM output
- [ ] Critique result includes fulfillment data
- [ ] Handles LLM not returning fulfillment gracefully (optional field)

**Planned tests** (`tests/services/reflexive_agent_gap1_integration_test.ts`):

- `[ReflexiveAgent] uses enhanced prompt with analysis`
- `[ReflexiveAgent] uses generic prompt without analysis`
- `[ReflexiveAgent] parses requirementsFulfillment from output`
- `[ReflexiveAgent] handles missing requirementsFulfillment gracefully`
- `[ReflexiveAgent] critique result includes fulfillment data`

---

### Step 5: Make `SessionMemory.enhance()` Available Earlier in Pipeline (Gap 2)

**What:** Move or duplicate the `SessionMemory.enhance()` call to make memory context available to `RequestAnalyzer` and `RequestQualityGate`, not just `AgentRunner`.

**Files to modify:**

- `src/services/request_processor.ts` (call `SessionMemory.enhance()` before analysis)

**Architecture notes:**

- Currently `SessionMemory.enhance()` is called in `AgentRunner.run()` — late in the pipeline
- Move the call to `RequestProcessor.process()`, before `RequestAnalyzer.analyze()` (Phase 45) and `RequestQualityGate.assess()` (Phase 47)
- Pass the `EnhancedRequest` context to both services via the processing context
- `AgentRunner` can still call `enhance()` separately or use the cached result
- This is a wiring change — `SessionMemory` API stays the same

**Success criteria:**

- [ ] `SessionMemory.enhance()` called in `RequestProcessor.process()` before analysis
- [ ] Memory context available to `RequestAnalyzer` as input
- [ ] Memory context available to `RequestQualityGate` for quality assessment
- [ ] `AgentRunner` still receives memory context (no regression)
- [ ] Works when `SessionMemory` is not configured (no-op)

**Planned tests** (`tests/services/request_processor_memory_test.ts`):

- `[RequestProcessor] calls SessionMemory.enhance() before analysis`
- `[RequestProcessor] passes memory context to RequestAnalyzer`
- `[RequestProcessor] passes memory context to RequestQualityGate`
- `[RequestProcessor] handles missing SessionMemory gracefully`
- `[RequestProcessor] AgentRunner still receives memory context`

---

### Step 6: Pass Memory Context to `RequestAnalyzer` (Gap 2)

**What:** Extend `RequestAnalyzer.analyze()` to accept optional memory context and use it as a signal for analysis.

**Files to modify:**

- `src/services/request_analysis/request_analyzer.ts` (Phase 45 — extend `analyze()` signature)
- `src/shared/interfaces/i_request_analyzer_service.ts` (update interface)

**Architecture notes:**

- Add optional `memories?: EnhancedRequest` parameter to `analyze()` method
- When memories available, use them to:
  - Identify similar past requests and their outcomes (inform complexity)
  - Detect recurring patterns in user requests (inform taskType)
  - Provide additional context for LLM analysis prompt
- Heuristic mode: use memory keywords as additional signals
- LLM mode: inject relevant memory snippets into analysis prompt

**Success criteria:**

- [ ] `analyze()` accepts optional `memories` parameter
- [ ] Interface updated to reflect new parameter
- [ ] Memory context used as additional signal in LLM prompt
- [ ] Memory context used for heuristic complexity hints
- [ ] Analysis works without memory context (backward compatible)

**Planned tests** (`tests/services/request_analysis/analyzer_memory_test.ts`):

- `[RequestAnalyzer] uses memory context in analysis when provided`
- `[RequestAnalyzer] includes memory snippets in LLM prompt`
- `[RequestAnalyzer] works without memory context`
- `[RequestAnalyzer] memory informs complexity classification`

---

### Step 7: Add Content-Based Heuristics to `classifyTaskComplexity()` (Gap 3)

**What:** Replace the naive agent-ID-based complexity classification with a multi-signal classifier that uses request content heuristics.

**Files to modify:**

- `src/services/request_processor.ts` (rewrite `classifyTaskComplexity()`)

**Architecture notes:**

- New signature: `classifyTaskComplexity(blueprint, request, analysis?)`
- Three-tier fallback:
  1. `analysis.complexity` → map to `TaskComplexity` enum (Phase 45 primary)
  1.
  1.
- Remove underscore from `_request` parameter — now actually used
- `estimateFromContent()` as private method:
  - COMPLEX: >10 bullets, >5 file refs, >3000 chars
  - SIMPLE: ≤2 bullets, ≤1 file ref, <500 chars
  - null for indeterminate (falls through to agent-ID)

**Success criteria:**

- [ ] Analysis complexity used as primary signal when available
- [ ] Content heuristics provide reasonable classification without analysis
- [ ] Agent-ID fallback still works for backward compatibility
- [ ] `_request` parameter actually used (no underscore)
- [ ] Short/simple requests → SIMPLE
- [ ] Long/complex requests → COMPLEX
- [ ] Indeterminate → falls through to agent-ID

**Planned tests** (`tests/services/request_processor_complexity_test.ts`):

- `[classifyTaskComplexity] uses analysis.complexity as primary signal`
- `[classifyTaskComplexity] falls back to content heuristics without analysis`
- `[classifyTaskComplexity] falls back to agent ID without content signal`
- `[classifyTaskComplexity] content: short body → SIMPLE`
- `[classifyTaskComplexity] content: many bullets → COMPLEX`
- `[classifyTaskComplexity] content: many file refs → COMPLEX`
- `[classifyTaskComplexity] content: long body → COMPLEX`
- `[classifyTaskComplexity] maps analysis "simple" to TaskComplexity.SIMPLE`
- `[classifyTaskComplexity] maps analysis "epic" to TaskComplexity.COMPLEX`

---

### Step 8: Add `acceptance_criteria` to `IRequestFrontmatter` (Gap 4)

**What:** Add optional structured fields to `IRequestFrontmatter` for explicit acceptance criteria, expected outcomes, and scope.

**Files to modify:**

- `src/services/request_processing/types.ts` (extend `IRequestFrontmatter`)

**Architecture notes:**

- Add optional fields: `acceptance_criteria?: string[]`, `expected_outcomes?: string[]`, `scope?: { include?: string[]; exclude?: string[] }`
- YAML list format — users can write criteria directly in frontmatter
- Fields are optional — existing requests work without them
- These fields feed directly into Phase 45 `RequestAnalyzer` (explicit high-confidence requirements) and Phase 48 `CriteriaGenerator` (each criterion → evaluation criterion)

**Success criteria:**

- [ ] `IRequestFrontmatter` has `acceptance_criteria` optional array
- [ ] `IRequestFrontmatter` has `expected_outcomes` optional array
- [ ] `IRequestFrontmatter` has `scope` optional object with include/exclude
- [ ] Existing frontmatter without new fields still valid
- [ ] TypeScript compiles

**Planned tests** (`tests/services/request_processing/frontmatter_structured_test.ts`):

- `[IRequestFrontmatter] validates acceptance_criteria array`
- `[IRequestFrontmatter] validates expected_outcomes array`
- `[IRequestFrontmatter] validates scope includes/excludes`
- `[IRequestFrontmatter] validates without new fields (backward compat)`

---

### Step 9: Update `RequestParser` for Structured Frontmatter (Gap 4)

**What:** Update `RequestParser` to parse the new YAML list fields from frontmatter.

**Files to modify:**

- `src/services/request_processing/request_parser.ts` (handle new frontmatter fields)

**Architecture notes:**

- The YAML parser already handles arrays; ensure the new fields are extracted correctly
- Add validation: `acceptance_criteria` and `expected_outcomes` must be arrays of strings; `scope` must be object with `include?`/`exclude?` arrays
- If fields are present but malformed, log warning and skip (don't fail the parse)

**Success criteria:**

- [ ] Parser extracts `acceptance_criteria` array from frontmatter
- [ ] Parser extracts `expected_outcomes` array from frontmatter
- [ ] Parser extracts `scope` object from frontmatter
- [ ] Gracefully handles malformed new fields (warns, doesn't fail)
- [ ] Existing request files parse unchanged

**Planned tests** (`tests/services/request_processing/request_parser_structured_test.ts`):

- `[RequestParser] extracts acceptance_criteria from frontmatter`
- `[RequestParser] extracts expected_outcomes from frontmatter`
- `[RequestParser] extracts scope from frontmatter`
- `[RequestParser] handles malformed acceptance_criteria gracefully`
- `[RequestParser] parses existing files without new fields`

---

### Step 10: Update `buildParsedRequest()` with Structured Expectations (Gap 4)

**What:** Extend `buildParsedRequest()` to include structured expectations from frontmatter in the request context.

**Files to modify:**

- `src/services/request_common.ts` (extend `buildParsedRequest`)

**Architecture notes:**

- When frontmatter has `acceptance_criteria`, `expected_outcomes`, or `scope`: add them to `IParsedRequest.context`
- These structured expectations are available to `RequestAnalyzer` (Phase 45) as high-confidence explicit requirements
- `RequestAnalyzer` can merge explicit frontmatter criteria with LLM-extracted implicit criteria

**Success criteria:**

- [ ] `IParsedRequest.context` includes `acceptance_criteria` when present
- [ ] `IParsedRequest.context` includes `expected_outcomes` when present
- [ ] `IParsedRequest.context` includes `scope` when present
- [ ] Context unchanged when fields not present

**Planned tests** (`tests/services/request_common_structured_test.ts`):

- `[buildParsedRequest] includes acceptance_criteria in context`
- `[buildParsedRequest] includes expected_outcomes in context`
- `[buildParsedRequest] includes scope in context`
- `[buildParsedRequest] works without structured expectations`

---

### Step 11: Add `--acceptance-criteria` CLI Option (Gap 4)

**What:** Add `--acceptance-criteria` option to `exoctl request create` for specifying criteria at creation time.

**Files to modify:**

- `src/cli/commands/request_commands.ts` (add option to `create` subcommand)

**Architecture notes:**

- `exoctl request create --acceptance-criteria "All tests pass" --acceptance-criteria "New endpoint returns 200"`
- Repeatable flag — each usage adds to the `acceptance_criteria` array in frontmatter
- Also add `--expected-outcome` repeatable flag
- Values written into YAML frontmatter of the created request file

**Success criteria:**

- [ ] `--acceptance-criteria` flag accepted (repeatable)
- [ ] `--expected-outcome` flag accepted (repeatable)
- [ ] Values written into request file YAML frontmatter
- [ ] Request creation works without new flags

**Planned tests** (`tests/cli/commands/request_create_criteria_test.ts`):

- `[request create] writes acceptance_criteria to frontmatter`
- `[request create] writes multiple criteria from repeated flags`
- `[request create] writes expected_outcomes to frontmatter`
- `[request create] creates request without criteria flags`

---

### Step 12: Add Hardening Constants

**What:** Add constants for all four gaps to `src/shared/constants.ts`.

**Files to modify:**

- `src/shared/constants.ts` (add new section)

**Architecture notes:**

- Grouped under `// === Quality Pipeline Hardening ===`
- Gap 1: `MAX_CRITIQUE_REQUIREMENTS = 10`, fulfillment status enum values
- Gap 3: `COMPLEXITY_BULLET_THRESHOLD_HIGH = 10`, `COMPLEXITY_FILE_REF_THRESHOLD_HIGH = 5`, `COMPLEXITY_BODY_LENGTH_HIGH = 3000`, `COMPLEXITY_BODY_LENGTH_LOW = 500`, `COMPLEXITY_BULLET_THRESHOLD_LOW = 2`
- Gap 4: not needed beyond type definitions

**Success criteria:**

- [ ] All heuristic thresholds from constants
- [ ] Grouped under proper section header

**Planned tests:** None (validated through usage).

---

### Step 13: End-to-End Integration Test

**What:** Create integration tests for each gap's full pipeline flow.

**Files to create:**

- `tests/integration/quality_hardening_e2e_test.ts` (NEW)

**Architecture notes:**

- Uses `TestEnvironment.create()` for full workspace setup
- Gap 1 scenario: request with goals → analyze → reflexive agent receives enhanced prompt → requirementsFulfillment in critique
- Gap 2 scenario: request with memory context → analyze uses memory → enhanced analysis quality
- Gap 3 scenario: various request bodies → classifyTaskComplexity → verify correct classification
- Gap 4 scenario: request with frontmatter criteria → parse → analysis → criteria used in evaluation

**Success criteria:**

- [ ] Enhanced critique with requirements when analysis available
- [ ] Memory context improves analysis when available
- [ ] Content-based complexity classification works end-to-end
- [ ] Structured frontmatter criteria flow through pipeline

**Planned tests:**

- `[E2E] Gap 1: reflexive agent enhanced critique with goals`
- `[E2E] Gap 2: memory context feeds into analysis`
- `[E2E] Gap 3: content-based complexity classification`
- `[E2E] Gap 4: structured frontmatter criteria in evaluation`

---

### Step 14: Update `ARCHITECTURE.md`

**What:** Update architecture document to reflect the four hardening improvements.

**Files to modify:**

- `ARCHITECTURE.md`

**Sections to update:**

1. **"ReflexiveAgent"** — Document enhanced critique with goal-aware prompt. Note `requirementsFulfillment` output field.

1.

1.

1.

1.

**Success criteria:**

- [ ] ReflexiveAgent enhancement documented
- [ ] SessionMemory early call documented
- [ ] Task complexity multi-signal approach documented
- [ ] Structured frontmatter documented with example

**Planned tests:** None (documentation-only).

---

### Step 15: Update User-Facing and Agent Documentation

**What:** Update docs/ and .copilot/ to cover all four hardening improvements.

**Files to modify:**

- `docs/ExoFrame_User_Guide.md`
- `docs/dev/ExoFrame_Technical_Spec.md`
- `.copilot/source/exoframe.md`
- `.copilot/cross-reference.md`
- `.copilot/manifest.json`

**Updates:**

1. **`docs/ExoFrame_User_Guide.md`:**
   - Document structured frontmatter fields with examples
   - Document `--acceptance-criteria` and `--expected-outcome` CLI flags
   - Explain how explicit criteria improve quality

1.
   - Document enhanced ReflexiveAgent config
   - Document memory pipeline changes
   - Document complexity classification algorithm
   - Document frontmatter schema extensions

1.
   - Update ReflexiveAgent section with enhanced critique
   - Update request processing section with early memory
   - Update complexity classification section
   - Add structured frontmatter to request format

1.
   - Add row: `quality hardening / pipeline improvements` → `source/exoframe.md` + `planning/phase-49-quality-pipeline-hardening.md`

1.
   - Regenerate via `deno run --allow-read --allow-write scripts/build_agents_index.ts`

**Success criteria:**

- [ ] User guide documents frontmatter fields and CLI flags
- [ ] Technical spec covers all four improvements
- [ ] `.copilot/` docs updated
- [ ] `manifest.json` is fresh

**Planned tests:** `deno task check:docs` passes.

---

### Implementation Order & Dependencies

```text
Step 12: Constants                     ← foundation, no dependencies
Step  1: requestAnalysis in config     ← foundation, depends on Phase 45 types
Step  8: Structured frontmatter types  ← foundation, can parallel
Step  2: buildEnhancedCritiquePrompt   ← depends on Step 1
Step  3: requirementsFulfillment       ← depends on Step 2
Step  4: Wire in ReflexiveAgent.run    ← depends on Steps 2, 3
Step  7: Complexity heuristics         ← depends on Step 12
Step  9: RequestParser for frontmatter ← depends on Step 8
Step 10: buildParsedRequest extension  ← depends on Steps 8, 9
Step 11: CLI --acceptance-criteria     ← depends on Steps 8, 9
Step  5: SessionMemory early pipeline  ← depends on nothing, but best after Phase 45 wiring
Step  6: Memory in RequestAnalyzer     ← depends on Step 5
Step 13: E2E test                      ← depends on all above
Step 14: ARCHITECTURE.md               ← depends on Steps 4, 7, 10
Step 15: Docs + .copilot/             ← depends on Step 14
```

**Parallel waves:**

| Wave | Steps | Description |
| ------ | ------- | ------------- |
| 1 | 1, 8, 12 | Types, frontmatter schema, constants (foundations) |
| 2 | 2, 7, 9 | Enhanced prompt, complexity heuristics, parser (parallel, independent) |
| 3 | 3, 5, 10, 11 | Critique schema, memory wiring, request building, CLI (parallel) |
| 4 | 4, 6 | ReflexiveAgent wiring, analyzer memory (depend on wave 2–3) |
| 5 | 13 | E2E validation |
| 6 | 14, 15 | Documentation (after implementation stabilizes) |

---

## Implementation Order

These gaps have natural dependencies:

```text
Gap 3 (Complexity Classification) ← Can be done independently, quick win
Gap 4 (Structured Frontmatter)    ← Can be done independently, enables Phase 45/48
Gap 1 (Reflexive Agent)           ← Benefits from Phase 45 IRequestAnalysis
Gap 2 (Session Memory)            ← Benefits from Phase 45 RequestAnalyzer
```

**Recommended sequence:**

1. Gap 3 first (smallest scope, immediate value for provider selection)

1.

---

## Methodology: Specification-Driven Development

The minor gaps addressed here strengthen the SDD traceability chain. Goal-aware reflexive critique (Gap 1) ensures the self-improvement loop checks against the specification, not generic dimensions. Structured frontmatter (Gap 4) lets users write partial specifications directly. Together, these make the spec-to-evaluation path more robust.

See `.copilot/process/specification-driven-development.md` for the full SDD analysis.

---

## Dependencies

- `src/services/request_processor.ts` — Complexity classification fix
- `src/services/reflexive_agent.ts` — Critique enhancement
- `src/services/session_memory.ts` — Earlier pipeline integration
- `src/services/request_processing/types.ts` — Frontmatter schema extension
- `src/services/request_common.ts` — Request enrichment with structured expectations
- **Phase 45** — Gaps 1 and 2 benefit from but don't strictly require it

## Risks & Mitigations

| Risk | Mitigation |
| ------ | ----------- |
| Structured frontmatter adoption is slow | Fields are optional; free-text body still works |
| Complexity heuristics misclassify edge cases | Keep agent-type fallback as tertiary signal |
| Critique prompt bloat with too many requirements | Cap injected requirements; summarize if > 10 |
| Session memory lookup adds latency early in pipeline | Already fast (in-memory search); threshold-gated |
