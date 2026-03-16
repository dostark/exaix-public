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

> ⚠️ **Gap Analysis Notes** — See [Gap A2](#gap-a2-steps-1--2-conflict-with-phase-48s-actual-design--critical).
> Phase 48 already passes `requestAnalysis` as a third `run()` parameter; adding it to the config makes two competing mechanisms. **Before implementing**, decide whether to: (a) add to config and update `run()` to prefer config over method param, or (b) drop this step and adopt a factory/wrapper pattern. Document the chosen design here before writing code.

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

> ⚠️ **Gap Analysis Notes** — See [Gap A2](#gap-a2-steps-1--2-conflict-with-phase-48s-actual-design--critical) and [Gap C1](#gap-c1-steps-14-tests-may-duplicate-phase-48-coverage--testing).
> Phase 48 has already inlined the enhanced-prompt logic inside `critique()`. This step is a **refactor** (extract into a private method) + **net-new feature** (10-item cap using `MAX_CRITIQUE_REQUIREMENTS` from Step 12). Before writing tests, read `tests/services/reflexive_agent_criteria_test.ts` to identify which scenarios are already covered; only write tests for the cap behaviour and any uncovered edge cases.

**What:** Extract the inline enhanced-prompt logic into a private `buildEnhancedCritiquePrompt()` method and add the 10-item requirement cap.

**Files to modify:**

- `src/services/reflexive_agent.ts` (extract method, add cap)

**Architecture notes:**

- Private method `buildEnhancedCritiquePrompt(request, response, analysis) → string` inside `ReflexiveAgent`
- When `requestAnalysis` is present: inject goals list (with `[E]`/`[I]` markers), requirements checklist, acceptance criteria list, instruction to evaluate each as MET/PARTIAL/MISSING
- When `requestAnalysis` is absent: return existing generic prompt unchanged
- Cap injected requirements at `MAX_CRITIQUE_REQUIREMENTS` (10) — sort goals by priority ascending, take top N across goals + ACs combined
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
- [ ] Requirements capped at `MAX_CRITIQUE_REQUIREMENTS` (no magic literal `10`)
- [ ] Prompt structure matches expected format

**Planned tests** (`tests/services/reflexive_agent_enhanced_prompt_test.ts`):

- `[buildEnhancedCritiquePrompt] caps requirements at MAX_CRITIQUE_REQUIREMENTS` ← **new** (not in Phase 48)
- `[buildEnhancedCritiquePrompt] handles analysis with no goals` ← verify not already covered
- *(skip tests already passing in `reflexive_agent_criteria_test.ts`)*

---

### Step 3: Add `requirementsFulfillment` to `CritiqueSchema` (Gap 1)

> ✅ **Gap Analysis Notes** — See [Gap A1](#gap-a1-steps-3--4-already-fully-implemented-by-phase-48--critical).
> **This step is already complete.** `CritiqueSchema` in `src/services/reflexive_agent.ts` already has `requirementsFulfillment: z.array(RequirementFulfillmentSchema).optional()` using Phase 48's `RequirementFulfillmentSchema` from `evaluation_criteria.ts`. **Action required:** tick all success criteria below, verify tests exist in `reflexive_agent_criteria_test.ts`, and skip re-implementation.

**What:** ~~Extend the critique output schema~~ **[DONE by Phase 48 Step 8 — verify only]**

**Success criteria:**

- [x] `CritiqueSchema` validates `requirementsFulfillment` when present
- [x] Schema validates without `requirementsFulfillment` (backward compatible)
- [x] Status enum: `MET`, `PARTIAL`, `MISSING`
- [x] Each entry has `requirement` string and `status`
- [x] Optional `note` field for explanation

**Planned tests** — verify coverage in `tests/services/reflexive_agent_criteria_test.ts` rather than creating a new file.

---

### Step 4: Wire Enhanced Critique in `ReflexiveAgent.run()` (Gap 1)

> ✅ **Gap Analysis Notes** — See [Gap A1](#gap-a1-steps-3--4-already-fully-implemented-by-phase-48--critical).
> **This step is already complete.** `run()` already takes `requestAnalysis?: IRequestAnalysis` as its third param and passes it to `critique()`. `critique()` already builds the enhanced prompt and `OutputValidator` parses `requirementsFulfillment`. **Action required:** tick all success criteria below, confirm the 7 tests in `reflexive_agent_criteria_test.ts` cover these scenarios, and skip re-implementation. The only outstanding item is calling `buildEnhancedCritiquePrompt()` once it's extracted in Step 2.

**What:** ~~Update `run()` to use the enhanced critique prompt~~ **[DONE by Phase 48 Step 8 — verify only; update call site after Step 2 extracts the method]**

**Success criteria:**

- [x] `ReflexiveAgent` uses enhanced prompt when analysis available
- [x] `ReflexiveAgent` uses generic prompt when analysis absent
- [x] `requirementsFulfillment` parsed from LLM output
- [x] Critique result includes fulfillment data
- [x] Handles LLM not returning fulfillment gracefully (optional field)

**Planned tests** — verify coverage in `tests/services/reflexive_agent_criteria_test.ts`.

---

### Step 5: Make `SessionMemory.enhanceRequest()` Available Earlier in Pipeline (Gap 2)

> ⚠️ **Gap Analysis Notes** — See [Gap A4](#gap-a4-sessionmemoryenhance-method-does-not-exist--critical), [Gap B1](#gap-b1-irequestqualitycontext-has-no-memories-field--feasibility), and [Gap B3](#gap-b3-double-call-to-enhancerequest--no-caching-design--feasibility).
>
> **Three fixes required before implementing:**
>
> 1. **Rename everywhere:** `SessionMemory.enhance()` → `SessionMemoryService.enhanceRequest()`. Update all success criteria and test names below.
> 2. **New dependency injection:** `SessionMemoryService` is not currently in `RequestProcessor`. Add `sessionMemory?: SessionMemoryService` to the `RequestProcessor` constructor (optional, defaults to undefined → no-op path).
> 3. **Design the sharing mechanism:** After calling `enhanceRequest()` in `RequestProcessor`, store the result on `IParsedRequest.context["memory_context"]` (or a dedicated field) so `AgentRunner` reads it rather than calling `enhanceRequest()` a second time. Document the chosen key name here before coding.
> 4. **Quality gate wiring is unspecified:** `IRequestQualityContext` has no `memories` field. Either extend it (requires interface + implementation update) or remove that success criterion from this step and defer.

**What:** Inject `SessionMemoryService` into `RequestProcessor` and call `enhanceRequest()` before the analysis step, sharing the result downstream.

**Files to modify:**

- `src/services/request_processor.ts` (add optional `SessionMemoryService` injection; call `enhanceRequest()` before analysis; store on request context)
- `src/shared/types/request.ts` or `src/services/agent_runner.ts` (add context key constant for memory context if needed)

**Architecture notes:**

- Currently `SessionMemoryService.enhanceRequest()` is **not called anywhere in `RequestProcessor` or `AgentRunner`** — this is a fresh injection, not a move
- Add `sessionMemory?: SessionMemoryService` as an optional constructor param in `RequestProcessor`
- Call `sessionMemory.enhanceRequest(request.userPrompt)` before `RequestAnalyzer.analyze()` and `RequestQualityGate.assess()`
- Store `EnhancedRequest` result on `request.context[MEMORY_CONTEXT_KEY]` so `AgentRunner` can read it
- No-op when `sessionMemory` is undefined (backward compatible)

**Success criteria:**

- [ ] `SessionMemoryService.enhanceRequest()` called in `RequestProcessor.process()` before analysis
- [ ] Memory context stored on `IParsedRequest.context` (not passed to `RequestAnalyzer` yet — that is Step 6)
- [ ] `AgentRunner` can read memory context from `request.context` without a second `enhanceRequest()` call
- [ ] Works when `SessionMemoryService` is not configured (no-op)

**Planned tests** (`tests/services/request_processor_memory_test.ts`):

- `[RequestProcessor] calls SessionMemoryService.enhanceRequest() before analysis`
- `[RequestProcessor] stores memory context on request context`
- `[RequestProcessor] handles missing SessionMemoryService gracefully`
- `[RequestProcessor] does not call enhanceRequest() when sessionMemory is undefined`

---

### Step 6: Pass Memory Context to `RequestAnalyzer` (Gap 2)

> ⚠️ **Gap Analysis Notes** — See [Gap B2](#gap-b2-irequestanalysiscontext-has-no-memories-field--feasibility).
> `IRequestAnalysisContext` has no `memories` field; `analyze()` signature is `analyze(requestText, context?: IRequestAnalysisContext)`. To add memories, extend `IRequestAnalysisContext` with `memories?: EnhancedRequest` (preferred — single change site, optional field, backward compatible). This requires updating the interface **and** all concrete implementations. Add the following to "Files to modify".

**What:** Extend `IRequestAnalysisContext` with `memories?: EnhancedRequest` and update `RequestAnalyzer.analyze()` to use it.

**Files to modify:**

- `src/shared/interfaces/i_request_analyzer_service.ts` (add `memories?: EnhancedRequest` to `IRequestAnalysisContext`)
- `src/services/request_analysis/request_analyzer.ts` (consume `context.memories` in LLM/heuristic paths)
- `src/services/request_analysis/heuristic_analyzer.ts` (accept updated context; use keyword signals if memories present)
- `src/services/request_analysis/llm_analyzer.ts` (inject `context.memories.memoryContext` into LLM prompt when present)

**Architecture notes:**

- Add `memories?: EnhancedRequest` to `IRequestAnalysisContext` in the shared interface
- When memories available, use them to:
  - Provide additional context for LLM analysis prompt (inject `memories.memoryContext` section)
  - Heuristic mode: use memory keyword signals as additional signals
- `RequestProcessor` (Step 5) reads memory context from `request.context` and passes it via `IRequestAnalysisContext.memories`

**Success criteria:**

- [ ] `IRequestAnalysisContext` has optional `memories?: EnhancedRequest` field
- [ ] `analyze()` accepts the field via existing `context` parameter (no signature break)
- [ ] `heuristic_analyzer.ts` and `llm_analyzer.ts` updated to handle the new field
- [ ] Memory context used as additional signal in LLM prompt
- [ ] Analysis works without memory context (backward compatible)

**Planned tests** (`tests/services/request_analysis/analyzer_memory_test.ts`):

- `[RequestAnalyzer] uses memory context in analysis when provided`
- `[RequestAnalyzer] includes memory snippets in LLM prompt`
- `[RequestAnalyzer] works without memory context`
- `[RequestAnalyzer] memory informs complexity classification`

---

### Step 7: Align `classifyTaskComplexity()` with Step 12 Constants (Gap 3)

> ⚠️ **Gap Analysis Notes** — See [Gap A3](#gap-a3-gap-3-complexity-classifier-already-implemented--critical) and [Gap A5](#gap-a5-step-12-constants-must-precede-steps-2-and-7--critical).
> **The multi-signal classifier is already implemented.** `classifyTaskComplexity()` already has a 3-param signature, `checkContentHeuristics()`, `mapAnalysisComplexity()`, and `classifyByAgentId()`. This step's remaining work is:
>
> 1. **Commit Step 12 first** — then use the new constants to replace magic numbers in `checkContentHeuristics()`.
> 2. **Reconcile thresholds** — the plan says `> 10` bullets / `< 500` chars; the code has `>= 8` / `< 50`. Pick one set, update `checkContentHeuristics()` to use constants, and ensure tests match.
> 3. **Add `COMPLEXITY_FILE_REF_PATTERN`** constant (see [Gap D2](#gap-d2-file-ref-regex-in-checkcontentheuristics-is-an-unlisted-magic-literal--conceptual)) to Step 12 and use it here.

**What:** Replace magic numbers in `checkContentHeuristics()` with Step 12 constants; add `COMPLEXITY_FILE_REF_PATTERN` constant for the file-ref regex.

**Files to modify:**

- `src/services/request_processor.ts` — `checkContentHeuristics()` (replace literals with constants)

**Architecture notes:**

- Three-tier fallback is already in place; no structural changes needed
- After Step 12 constants are committed, update `checkContentHeuristics()` to reference them
- Agreed threshold values (resolve before implementing): COMPLEX ≥ `COMPLEXITY_BULLET_THRESHOLD_HIGH` bullets / ≥ `COMPLEXITY_FILE_REF_THRESHOLD_HIGH` file refs / ≥ `COMPLEXITY_BODY_LENGTH_HIGH` chars; SIMPLE ≤ `COMPLEXITY_BULLET_THRESHOLD_LOW` bullets AND ≤ 1 file ref AND < `COMPLEXITY_BODY_LENGTH_LOW` chars

**Success criteria:**

- [x] Analysis complexity used as primary signal when available *(already done)*
- [x] Content heuristics provide reasonable classification without analysis *(already done)*
- [x] Agent-ID fallback still works for backward compatibility *(already done)*
- [x] No underscore on `request` parameter *(already done)*
- [ ] No magic number literals in `checkContentHeuristics()` — all from Step 12 constants
- [ ] `checkContentHeuristics()` uses `COMPLEXITY_FILE_REF_PATTERN` constant
- [ ] Threshold values match Step 12 constant definitions

**Planned tests** (`tests/services/request_processor_complexity_test.ts` — new file, but assertions must use constant values not literals):

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

> ⚠️ **Gap Analysis Notes** — See [Gap D1](#gap-d1-irequestfrontmatter-is-a-plain-interface--no-zod--conceptual).
> `IRequestFrontmatter` is a plain TypeScript `interface` — **not** a Zod schema. Adding new optional fields requires only `?:` syntax; there is no `.optional()` or Zod concern. Runtime validation of the new array fields happens only in `RequestParser` via an `as IRequestFrontmatter` cast — so Step 9 must include explicit `Array.isArray()` guards for `acceptance_criteria` and `expected_outcomes`, and an `typeof === 'object'` guard for `scope`.

**What:** Add optional structured fields to `IRequestFrontmatter` for explicit acceptance criteria, expected outcomes, and scope.

**Files to modify:**

- `src/services/request_processing/types.ts` (add `?:` fields to `IRequestFrontmatter`)

**Architecture notes:**

- `IRequestFrontmatter` is a plain interface; new fields just need `optional?: type` syntax (no Zod)
- Add: `acceptance_criteria?: string[]`, `expected_outcomes?: string[]`, `scope?: { include?: string[]; exclude?: string[] }`
- YAML list format — `@std/yaml` parses YAML arrays to `string[]` natively
- Fields are optional — existing requests work without them
- Runtime validation (Array.isArray guards) is Step 9's responsibility

**Success criteria:**

- [ ] `IRequestFrontmatter` has `acceptance_criteria?: string[]`
- [ ] `IRequestFrontmatter` has `expected_outcomes?: string[]`
- [ ] `IRequestFrontmatter` has `scope?: { include?: string[]; exclude?: string[] }`
- [ ] Existing frontmatter without new fields still valid
- [ ] TypeScript compiles

**Planned tests** (`tests/services/request_processing/frontmatter_structured_test.ts`):

- `[IRequestFrontmatter] validates acceptance_criteria array`
- `[IRequestFrontmatter] validates expected_outcomes array`
- `[IRequestFrontmatter] validates scope includes/excludes`
- `[IRequestFrontmatter] validates without new fields (backward compat)`

---

### Step 9: Update `RequestParser` for Structured Frontmatter (Gap 4)

> ⚠️ **Gap Analysis Notes** — See [Gap C2](#gap-c2-step-9-missing-malformed-scope-test-case--testing) and [Gap D1](#gap-d1-irequestfrontmatter-is-a-plain-interface--no-zod--conceptual).
> `@std/yaml` natively parses YAML arrays — no custom logic needed for extraction. However, because `IRequestFrontmatter` is a plain interface and the parser casts with `as IRequestFrontmatter`, malformed values (e.g., `scope: "bad-string"`) are silently accepted at compile time. This step must add explicit runtime guards (using `Array.isArray()` and `typeof x === 'object'`) and log-and-strip malformed values. Add the missing `scope` malformed-input test case listed in Gap C2.

**What:** Add runtime type guards in `RequestParser` for the three new frontmatter fields and strip malformed values with a warning log.

**Files to modify:**

- `src/services/request_processing/request_parser.ts` (add runtime Array.isArray / object checks; log-and-strip on invalid values)

**Architecture notes:**

- `@std/yaml` already handles YAML arrays → `string[]` natively; no custom extraction needed
- After `parseYaml`, validate:
  - `acceptance_criteria`: `Array.isArray()` → each element is a string; otherwise log warning and delete the field
  - `expected_outcomes`: same guard
  - `scope`: `typeof === 'object' && !Array.isArray()` → `include`/`exclude` are arrays of strings; otherwise log warning and delete
- If fields are present but malformed, log warning and strip (don't fail the parse)

**Success criteria:**

- [ ] Parser extracts `acceptance_criteria` array from frontmatter
- [ ] Parser extracts `expected_outcomes` array from frontmatter
- [ ] Parser extracts `scope` object from frontmatter
- [ ] Gracefully handles malformed `acceptance_criteria` (warns, strips, doesn't fail)
- [ ] Gracefully handles malformed `scope` (non-object value — warns, strips, doesn't fail)
- [ ] Existing request files parse unchanged

**Planned tests** (`tests/services/request_processing/request_parser_structured_test.ts`):

- `[RequestParser] extracts acceptance_criteria from frontmatter`
- `[RequestParser] extracts expected_outcomes from frontmatter`
- `[RequestParser] extracts scope from frontmatter`
- `[RequestParser] handles malformed acceptance_criteria gracefully`
- `[RequestParser] handles malformed scope (non-object value) gracefully` ← **new, from Gap C2**
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

> ⚠️ **Gap Analysis Notes** — See [Gap B4](#gap-b4-irequestoptions-missing-acceptancecriteria--expectedoutcomes-fields--feasibility).
> `IRequestOptions` in `src/shared/types/request.ts` does not have `acceptanceCriteria` or `expectedOutcomes` fields, so CLI flag values cannot flow to `RequestCreateHandler.addOptionalFrontmatterFields()`. Two files must be added to "Files to modify":
>
> 1. `src/shared/types/request.ts` — add `acceptanceCriteria?: string[]` and `expectedOutcomes?: string[]` to `IRequestOptions`
> 2. `src/cli/handlers/request_create_handler.ts` — update `addOptionalFrontmatterFields()` to write these arrays to the YAML frontmatter object.

**What:** Add `--acceptance-criteria` and `--expected-outcome` CLI flags and wire them through `IRequestOptions` to frontmatter.

**Files to modify:**

- `src/shared/types/request.ts` (add `acceptanceCriteria?: string[]` and `expectedOutcomes?: string[]` to `IRequestOptions`)
- `src/cli/handlers/request_create_handler.ts` (update `addOptionalFrontmatterFields()` to write new arrays)
- `src/cli/commands/request_commands.ts` (add repeatable flag declarations to `create` subcommand)

**Architecture notes:**

- `exoctl request create --acceptance-criteria "All tests pass" --acceptance-criteria "New endpoint returns 200"`
- Repeatable flag — each usage adds to the `acceptanceCriteria` array in `IRequestOptions`
- Also add `--expected-outcome` repeatable flag → `expectedOutcomes`
- `addOptionalFrontmatterFields()` writes them as `acceptance_criteria` / `expected_outcomes` in the YAML (snake_case to match `IRequestFrontmatter`)

**Success criteria:**

- [ ] `IRequestOptions` has `acceptanceCriteria?: string[]` and `expectedOutcomes?: string[]`
- [ ] `--acceptance-criteria` flag accepted (repeatable)
- [ ] `--expected-outcome` flag accepted (repeatable)
- [ ] Values propagated from flag → `IRequestOptions` → `addOptionalFrontmatterFields()` → YAML
- [ ] Request creation works without new flags

**Planned tests** (`tests/cli/commands/request_create_criteria_test.ts`):

- `[request create] writes acceptance_criteria to frontmatter`
- `[request create] writes multiple criteria from repeated flags`
- `[request create] writes expected_outcomes to frontmatter`
- `[request create] creates request without criteria flags`

---

### Step 12: Add Hardening Constants

> ⚠️ **Gap Analysis Notes** — See [Gap A5](#gap-a5-step-12-constants-must-precede-steps-2-and-7--critical) and [Gap D2](#gap-d2-file-ref-regex-in-checkcontentheuristics-is-an-unlisted-magic-literal--conceptual).
> **This step must be committed first** (before Steps 2 and 7) to avoid magic literals entering committed code. Two additions missing from the plan:
>
> 1. Add `COMPLEXITY_FILE_REF_PATTERN` regex constant (the file-ref detection regex from `checkContentHeuristics()`).
> 2. Reconcile threshold values: the plan specifies `> 10` bullets / `< 500` chars but the already-committed `checkContentHeuristics()` uses `>= 8` / `< 50`. Agree on values **here**, document them in JSDoc, and use them when Step 7 replaces the magic numbers.

**What:** Add all Phase 49 hardening constants to `src/shared/constants.ts` as the first step before any implementation.

**Files to modify:**

- `src/shared/constants.ts` (add new section)

**Architecture notes:**

- Grouped under `// === Quality Pipeline Hardening ===`
- Gap 1: `MAX_CRITIQUE_REQUIREMENTS = 10` (cap for goals+ACs injected into critique prompt)
- Gap 3: `COMPLEXITY_BULLET_THRESHOLD_HIGH` (≥ N bullets → COMPLEX), `COMPLEXITY_FILE_REF_THRESHOLD_HIGH` (≥ N file refs → COMPLEX), `COMPLEXITY_BODY_LENGTH_HIGH` (≥ N chars → COMPLEX), `COMPLEXITY_BODY_LENGTH_LOW` (< N chars → SIMPLE candidate), `COMPLEXITY_BULLET_THRESHOLD_LOW` (≤ N bullets → SIMPLE candidate), `COMPLEXITY_FILE_REF_PATTERN` (regex for file ref detection)
- Gap 4: not needed beyond type definitions
- Document the agreed threshold values in JSDoc before committing

**Success criteria:**

- [x] `MAX_CRITIQUE_REQUIREMENTS` constant exported
- [x] All five complexity threshold constants exported
- [x] `COMPLEXITY_FILE_REF_PATTERN` regex constant exported
- [x] Grouped under `// === Quality Pipeline Hardening ===` section header
- [x] No magic literals in Step 7 `checkContentHeuristics()` after this step commits

**Planned tests:** None (validated through usage in Steps 2 and 7).

**✅ IMPLEMENTED** — `src/shared/constants.ts`, thresholds match existing code (`>= 8` bullets, `>= 5` file refs, `< 50` body chars).

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

> ⚠️ Ordering revised by gap analysis — see [Gap A5](#gap-a5-step-12-constants-must-precede-steps-2-and-7--critical). Step 12 moved to Wave 0. Steps 3 & 4 marked done.

```text
Step 12: Constants                     ← Wave 0 FIRST — foundation, no dependencies
Step  3: requirementsFulfillment       ← ✅ DONE (Phase 48) — skip
Step  4: Wire in ReflexiveAgent.run    ← ✅ DONE (Phase 48) — skip
Step  1: requestAnalysis in config     ← foundation, depends on Phase 45 types (after design decision)
Step  8: Structured frontmatter types  ← foundation, can parallel
Step  2: buildEnhancedCritiquePrompt   ← depends on Step 12 (needs MAX_CRITIQUE_REQUIREMENTS)
Step  7: Complexity heuristics align   ← depends on Step 12 (replace magic numbers with constants)
Step  9: RequestParser for frontmatter ← depends on Step 8
Step 10: buildParsedRequest extension  ← depends on Steps 8, 9
Step 11: CLI --acceptance-criteria     ← depends on Steps 8, 9; also needs IRequestOptions update
Step  5: SessionMemory early pipeline  ← fresh injection; needs constructor update in RequestProcessor
Step  6: Memory in RequestAnalyzer     ← depends on Step 5; needs IRequestAnalysisContext update
Step 13: E2E test                      ← depends on all above
Step 14: ARCHITECTURE.md               ← depends on Steps 2, 7, 10
Step 15: Docs + .copilot/             ← depends on Step 14
```

**Parallel waves (revised):**

| Wave | Steps | Description |
| ------ | ------- | ------------- |
| 0 | 12 | Constants — **must commit first** |
| 1 | 1, 8 | Config field (after design decision), frontmatter schema |
| 2 | 2, 7, 9 | Enhanced prompt (with cap), heuristics align, parser |
| 3 | 5, 10, 11 | Memory injection, request building, CLI |
| 4 | 6 | Analyzer memory (depends on Step 5 + interface update) |
| 5 | 13 | E2E validation |
| 6 | 14, 15 | Documentation |

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

---

## Pre-Implementation Gap Analysis

> **Verified against source on:** 2026-03-15
> **Files read:** `src/services/reflexive_agent.ts`, `src/shared/schemas/request_analysis.ts`, `src/shared/schemas/mod.ts`, `src/services/session_memory.ts`, `src/services/request_processor.ts`, `src/services/agent_runner.ts`, `src/shared/interfaces/i_request_analyzer_service.ts`, `src/services/request_analysis/request_analyzer.ts`, `src/services/request_processing/types.ts`, `src/services/request_processing/request_parser.ts`, `src/services/request_common.ts`, `src/shared/types/request.ts`, `src/cli/commands/request_commands.ts`, `src/shared/interfaces/i_request_quality_gate_service.ts`, `src/shared/constants.ts`

### Summary

---

### Gap A1: Steps 3 & 4 Already Fully Implemented by Phase 48 🔴 Critical

**Location in plan:** Steps 3–4 — "`requirementsFulfillment` to `CritiqueSchema`" and "Wire Enhanced Critique in `ReflexiveAgent.run()`"

**Problem:** Phase 48 Step 8 was committed before Phase 49 planning began. The source already contains:

- `CritiqueSchema` has `requirementsFulfillment: z.array(RequirementFulfillmentSchema).optional()` (using Phase 48's `RequirementFulfillmentSchema` from `evaluation_criteria.ts`, which validates `requirement`, `status: "MET"|"PARTIAL"|"MISSING"`, and optional `note`).
- `ReflexiveAgent.run()` already takes `requestAnalysis?: IRequestAnalysis` as its third parameter and passes it to `critique()`.
- `ReflexiveAgent.critique()` already appends the goals/ACs section and the `requirementsFulfillment` instruction to the prompt when `requestAnalysis` is provided.

Implementing Steps 3 & 4 as written will conflict with existing committed code.

**Impact:** Duplicate implementation → compile errors or silent schema mismatch (Phase 49's `.enum(["MET","PARTIAL","MISSING"])` vs Phase 48's `RequirementFulfillmentSchema` may diverge).

**To fix:** Mark Steps 3 & 4 as **already complete (Phase 48)**. Remove them from the implementation sequence. Redirect their planned tests (`reflexive_agent_critique_schema_test.ts`, `reflexive_agent_gap1_integration_test.ts`) to verify the already-committed behaviour instead.

---

### Gap A2: Steps 1 & 2 Conflict with Phase 48's Actual Design 🔴 Critical

**Location in plan:** Steps 1–2 — "Add `requestAnalysis` to `IReflexiveAgentConfig`" and "Implement `buildEnhancedCritiquePrompt()`"

**Problem:** Three design decisions in Phase 48 differ from what Phase 49 plans to implement:

1. `IReflexiveAgentConfig` does **not** have `requestAnalysis?: IRequestAnalysis`. Phase 48 chose to pass `requestAnalysis` as a third argument to `run()` rather than storing it in config. Adding it to the config now creates two competing mechanisms.
2. There is no `buildEnhancedCritiquePrompt()` private method. The enhanced prompt logic is inlined directly in `critique()`. Extracting it is a refactor, not a new feature.
3. The 10-item cap on injected requirements described in Step 2 is **not implemented**. The current `critique()` injects all goals and ACs without limit, even if there are 20+.

**Impact:** Step 1 as written adds a config field that is never read by Phase 48's `run()` — effective dead code. Step 2 creates a new private method that duplicates existing inline logic.

**To fix:**

- **Step 1:** Redesign as "add `requestAnalysis` to `IReflexiveAgentConfig` and update `run()` to prefer config field over method param" — or drop Step 1 and adopt a factory/wrapper pattern instead.
- **Step 2:** Redesign as "extract `buildEnhancedCritiquePrompt()` refactor + add 10-item cap using `MAX_CRITIQUE_REQUIREMENTS`". Treat it as a refactor of existing code, not a net-new feature.

---

### Gap A3: Gap 3 (Complexity Classifier) Already Implemented 🔴 Critical

**Location in plan:** Step 7 — "Replace the naive agent-ID-based complexity classification with a multi-signal classifier"

**Problem:** `classifyTaskComplexity()` in `request_processor.ts` already has the three-parameter signature and multi-signal logic described by the plan:

```typescript
private classifyTaskComplexity(
  blueprint: IBlueprint,
  request: IParsedRequest,
  analysis?: IRequestAnalysis,
): TaskComplexity
```

It already uses `mapAnalysisComplexity()`, `checkContentHeuristics()`, and `classifyByAgentId()` as a three-tier fallback. There is no `_request` underscore. However, **three issues remain**:

1. The thresholds in `checkContentHeuristics()` use **magic numbers** (`>= 8` bullets, `< 50` chars for simple) that differ from the plan's proposed Step 12 constants (`> 10` bullets, `< 500` chars).
2. The file-ref regex `/(\/[\w.-]+|[a-z0-9_]+\.(ts|js|md|...)/gi` is a magic literal not yet extracted as `CONTENT_FILE_REF_PATTERN`.
3. The plan's Step 12 constants (`COMPLEXITY_BULLET_THRESHOLD_HIGH`, etc.) are absent from `constants.ts`.

**Impact:** Step 7 "tests" will pass trivially but Step 12 constants step will be blocked by a threshold mismatch between the plan and what's already committed.

**To fix:** Mark Step 7 as **partially complete**. Redefine its scope as "verify existing implementation aligns with step-12 constants after Step 12 is committed; reconcile threshold values." Move Step 12 before Step 7 in the implementation order.

---

### Gap A4: `SessionMemory.enhance()` Method Does Not Exist 🔴 Critical

**Location in plan:** Steps 5, 6 — "Make `SessionMemory.enhance()` callable from `RequestProcessor`"

**Problem:** The method is named `enhanceRequest(request: string, options?: Partial<SessionMemoryConfig>): Promise<EnhancedRequest>`, not `enhance()`. Every reference to `SessionMemory.enhance()` in the plan (Steps 5 and 6, success criteria, test names) will produce a compile error.

Additionally, `SessionMemoryService` is **not currently used** in `RequestProcessor` at all (no import, no constructor injection, no call site). The plan treats this as a "move the call" change, but it is a fresh injection of a new dependency.

**Impact:** Every test in Steps 5–6 that calls `.enhance()` fails to compile. `RequestProcessor` constructor must be extended to accept an optional `SessionMemoryService` dependency with backward-compatible default (undefined).

**To fix:** Replace all references to `SessionMemory.enhance()` with `SessionMemoryService.enhanceRequest()` throughout Steps 5–6, test names, and success criteria. Update `RequestProcessor` constructor to accept `sessionMemory?: SessionMemoryService` and inject it in the production call site.

---

### Gap A5: Step 12 Constants Must Precede Steps 2 and 7 🔴 Critical

**Location in plan:** Step 12 — "Add Hardening Constants"; Implementation Order diagram — "Step 12 Wave 1"

**Problem:** The implementation order diagram places Step 12 in Wave 1, but:

- Step 2 depends on `MAX_CRITIQUE_REQUIREMENTS` (cap logic) — if Step 2 is implemented before Step 12, a magic literal `10` is introduced.
- Step 7's existing `checkContentHeuristics()` already has magic numbers that Step 12 should define. If Step 12 is implemented after Step 7, the constants are added but never replace the already-committed magic numbers.

**Impact:** Magic numbers leak into committed code between waves; Step 12 becomes a cleanup step rather than a foundation step as intended.

**To fix:** Confirm Step 12 is committed **first** in every implementation session. After Step 12 commits, immediately update `checkContentHeuristics()` to use the new constants (this is the real body of Step 7's "verify and align" work).

---

### Gap B1: `IRequestQualityContext` Has No `memories` Field 🟡 Feasibility

**Location in plan:** Step 5 — "Memory context available to `RequestQualityGate` for quality assessment"

**Problem:** `IRequestQualityGateService.assess()` signature is `assess(requestText: string, context?: IRequestQualityContext)`. `IRequestQualityContext` contains `requestId`, `agentId`, `requestFilePath`, `traceId` — no `memories` field. The plan does not describe how memory affects the quality score, nor does it specify extending `IRequestQualityContext`.

**Impact:** The success criterion "Memory context available to `RequestQualityGate`" is unimplementable without a schema change whose design is unspecified.

**To fix:** Either (a) add `memories?: EnhancedRequest` to `IRequestQualityContext` and define a concrete scoring heuristic (e.g., ".presence of memories boosts `actionabilityScore` by N points"), or (b) remove this success criterion from Step 5 and defer it to a future phase.

---

### Gap B2: `IRequestAnalysisContext` Has No `memories` Field 🟡 Feasibility

**Location in plan:** Step 6 — "Add optional `memories?: EnhancedRequest` parameter to `analyze()` method"

**Problem:** `IRequestAnalyzerService.analyze()` signature is `analyze(requestText: string, context?: IRequestAnalysisContext)`. To add `memories`, the plan must either add it to `IRequestAnalysisContext` or add a third parameter. Both require updating the shared interface and all concrete implementations (`HeuristicAnalyzer`, `LLMAnalyzer`, `RequestAnalyzer` orchestrator). The plan specifies only the `request_analyzer.ts` file; the three implementations are not listed.

**Impact:** Updating one file produces a compile error on all other `IRequestAnalyzerService` implementors.

**To fix:** Extend `IRequestAnalysisContext` with `memories?: EnhancedRequest` (preferred — single change site, backward-compatible optional field) and list all implementation files (`heuristic_analyzer.ts`, `llm_analyzer.ts`) in Step 6's "Files to modify".

---

### Gap B3: Double Call to `enhanceRequest()` — No Caching Design 🟡 Feasibility

**Location in plan:** Step 5 — "`AgentRunner` can still call `enhance()` separately or use the cached result"

**Problem:** `SessionMemoryService` is currently not used in `AgentRunner` either (verified: no import). The "cached result" concept assumes some mechanism to share the `EnhancedRequest` between `RequestProcessor` and `AgentRunner`, but no such mechanism is designed. If both call `enhanceRequest()` independently, the memory bank is queried twice per request.

**Impact:** Double memory lookup latency per request; potential inconsistency if memories change between calls (unlikely but possible).

**To fix:** Explicitly design the sharing mechanism. Options: (a) store the `EnhancedRequest` on `IParsedRequest.context["memory_context"]` after the `RequestProcessor` call, letting `AgentRunner` read from context rather than calling `enhanceRequest()` again; (b) pass `EnhancedRequest` as an optional parameter through the processing chain.

---

### Gap B4: `IRequestOptions` Missing `acceptanceCriteria` / `expectedOutcomes` Fields 🟡 Feasibility

**Location in plan:** Step 11 — "Add `--acceptance-criteria` option to `exoctl request create`"

**Problem:** `IRequestOptions` in `src/shared/types/request.ts` defines the CLI-to-handler contract (`agent`, `priority`, `portal`, `target_branch`, `model`, `flow`, `skills`, `skipSkills`, `subject`, `analyze`, `analysis_engine`). There is no `acceptanceCriteria` or `expectedOutcomes` field. `RequestCreateHandler.addOptionalFrontmatterFields()` only reads from `IRequestOptions` fields. Step 11 adds CLI flags but the chain from flag → `IRequestOptions` → `addOptionalFrontmatterFields()` → YAML is not specified.

**Impact:** CLI flag values are captured by cliffy but never propagated to the frontmatter writer.

**To fix:** Add `acceptanceCriteria?: string[]` and `expectedOutcomes?: string[]` to `IRequestOptions` in `src/shared/types/request.ts`, then update `addOptionalFrontmatterFields()` to write them to the YAML object. List both files in Step 11's "Files to modify".

---

### Gap C1: Steps 1–4 Tests May Duplicate Phase 48 Coverage 🟠 Testing

**Location in plan:** Steps 2, 4 — `reflexive_agent_enhanced_prompt_test.ts`, `reflexive_agent_gap1_integration_test.ts`

**Problem:** Phase 48 already has `tests/services/reflexive_agent_criteria_test.ts` with 7 passing tests covering: enhanced prompt injection with goals/ACs, generic fallback without analysis, `requirementsFulfillment` in critique result, and graceful handling of missing fulfillment. The planned test files for Steps 2 and 4 describe near-identical coverage.

**Impact:** Duplicated test suites add CI time without increasing coverage; any conflict in test names causes confusion.

**To fix:** Before writing Step 2/4 test files, read `reflexive_agent_criteria_test.ts` and identify which scenarios are already covered. Only write tests for the delta (e.g., the 10-item cap test from Step 2 is genuinely new; the enhanced-prompt-included-goals test is already covered).

---

### Gap C2: Step 9 Missing Malformed `scope` Test Case 🟠 Testing

**Location in plan:** Step 9 — "handles malformed acceptance_criteria gracefully"

**Problem:** The planned tests include a malformed `acceptance_criteria` case but not a malformed `scope` case (e.g., `scope: "bad-string"` instead of an object, or `scope: { include: "not-an-array" }`). Given that `scope` is a nested object, YAML cast-to-`IRequestFrontmatter` will silently produce unexpected types on malformed input.

**Impact:** Parser will not warn on malformed `scope`; silent data corruption if consumer assumes `scope.include` is always `string[]`.

**To fix:** Add test: `[RequestParser] handles malformed scope gracefully (non-object value)` and implement the corresponding validation branch in the parser.

---

### Gap D1: `IRequestFrontmatter` Is a Plain Interface — No Zod 🔵 Conceptual

**Location in plan:** Step 8 Architecture notes — "Zod schema backward compatibility" subtext implied

**Problem:** `IRequestFrontmatter` in `types.ts` is a plain TypeScript `interface`, not a Zod schema. Adding optional fields requires only `?:` syntax — there is no `.optional()` concern. Runtime validation of the new fields is performed only via the `as IRequestFrontmatter` cast in `RequestParser`, which means malformed YAML values pass TypeScript compilation silently.

**Impact:** Step 8 notes that "fields are optional — existing requests work without them" is correct, but implies Zod semantics that don't apply. Step 9 must include explicit runtime type guards for new array fields.

**To fix:** Update Step 8 architecture notes to say "TypeScript interface, not Zod — add `?` fields only; Step 9 must validate with runtime Array.isArray() guards". Step 9 success criteria should reference runtime validation, not Zod `.optional()`.

---

### Gap D2: File-Ref Regex in `checkContentHeuristics()` Is an Unlisted Magic Literal 🔵 Conceptual

**Location in plan:** Step 12 — "Gap 3: heuristic thresholds as constants"

**Problem:** Step 12 lists `COMPLEXITY_BULLET_THRESHOLD_HIGH`, `COMPLEXITY_FILE_REF_THRESHOLD_HIGH`, `COMPLEXITY_BODY_LENGTH_HIGH`, `COMPLEXITY_BODY_LENGTH_LOW`, `COMPLEXITY_BULLET_THRESHOLD_LOW` as constants to add. It does not mention the file-ref detection regex, which is already committed as:

```typescript
const fileRefs = body.match(/(\/[\w.-]+|[a-z0-9_]+\.(ts|js|md|json|py|go|rs|c|cpp|h))/gi);
```

This magic regex belongs in `constants.ts` as `COMPLEXITY_FILE_REF_PATTERN` (analogous to `CRITERION_NAME_SANITIZE_PATTERN` from Phase 48).

**Impact:** Low risk — the pattern is consistent — but inconsistent with Phase 48 convention of exporting all non-trivial regex literals as named constants.

**To fix:** Add `COMPLEXITY_FILE_REF_PATTERN` to the Step 12 constants list in `constants.ts`.

---

### Recommended Pre-Implementation Actions

1. **(Before any code)** Verify and mark Steps 3 & 4 as already complete — read `reflexive_agent.ts` and `tests/services/reflexive_agent_criteria_test.ts` to confirm. Update `Goals` checklists in the document.

2. **(Before Step 1)** Resolve the config-vs-param design conflict: decide whether `requestAnalysis` moves to `IReflexiveAgentConfig` (with `run()` reading from config) or stays as a `run()` param. Document the decision in Step 1's architecture notes.

3. **(Before Step 5)** Fix all references to `SessionMemory.enhance()` → `SessionMemoryService.enhanceRequest()`. Update Step 5 and Step 6 success criteria and test names. Add `sessionMemory?: SessionMemoryService` to `RequestProcessor` constructor in the Files to modify list.

4. **(Step 12 first)** Move Step 12 to Wave 0. Commit constants before writing any step that references them. Add `COMPLEXITY_FILE_REF_PATTERN` and `MAX_CRITIQUE_REQUIREMENTS` to the Step 12 constants list.

5. **(Before Step 7)** After Step 12 commits, update `checkContentHeuristics()` to use the new constants. Reconcile threshold values between the plan (`> 10` bullets / `< 500` chars) and what is already committed (`>= 8` / `< 50`). Pick one set and use it everywhere.

6. **(Before Step 6)** Add `memories?: EnhancedRequest` to `IRequestAnalysisContext`. List `heuristic_analyzer.ts` and `llm_analyzer.ts` in Step 6's Files to modify.

7. **(Before Step 5)** Add `acceptanceCriteria?: string[]` and `expectedOutcomes?: string[]` to `IRequestOptions`. Add `addOptionalFrontmatterFields()` call site to Step 11's Files to modify.

8. **(Before Step 5 integration test)** Design and document the `EnhancedRequest` sharing mechanism (context key or parameter pass-through) to avoid a double `enhanceRequest()` call.

9. **(Before writing Step 2/4 tests)** Read `tests/services/reflexive_agent_criteria_test.ts` and identify unique gaps. Only write tests for the 10-item cap and any scenarios not already covered.

10. **(Before Step 9)** Add `scope` malformed-input test case to the Step 9 test plan.
