# Phase 48: Acceptance Criteria Propagation & Goal-Aligned Evaluation

## Status: PLANNING

Close the gap between "what was asked" and "what quality gates evaluate" by propagating extracted acceptance criteria through the entire pipeline and introducing goal-alignment evaluation criteria.

## Executive Summary

**Problem:**
ExoFrame's quality evaluation system (`GateEvaluator`, `JudgeEvaluator`, `ReflexiveAgent`, `ConfidenceScorer`) operates with **generic criteria only**. The built-in `CRITERIA` library in `evaluation_criteria.ts` covers universal dimensions (code correctness, security, style, completeness) but has no mechanism to evaluate whether a response satisfies the **specific goals and requirements** of the original request.

The `CODE_COMPLETENESS` criterion says *"All requirements from the prompt are addressed"* — but relies entirely on the judge LLM to infer what those requirements were from the raw prompt text. There is no structured data telling the judge: "these are the specific requirements; check each one."

Similarly, the `ReflexiveAgent` self-critique prompt evaluates against generic dimensions (accuracy, completeness, clarity) without knowing what the user's specific expectations are. The critique can say "this seems complete" but cannot say "requirements A and B are met, requirement C is missing."

**Solution:**

1. Introduce request-specific `EvaluationCriterion` generation from extracted requirements (depends on Phase 45).

1.
1.

---

## Current State Analysis

### Generic-Only Evaluation Criteria

The entire `CRITERIA` constant in `src/flows/evaluation_criteria.ts` consists of universal criteria:

| Criterion | Category | Request-Specific? |
| ----------- | ---------- | ------------------- |
| `CODE_CORRECTNESS` | Correctness | No — checks syntax/logic generally |
| `CODE_COMPLETENESS` | Completeness | Weak — "all requirements addressed" but requirements not specified |
| `HAS_TESTS` | Quality | No |
| `FOLLOWS_CONVENTIONS` | Style | No |
| `NO*SECURITY*ISSUES` | Security | No |
| `ERROR_HANDLING` | Quality | No |
| `CLARITY` | Quality | No |
| `ACCURACY` | Correctness | No |
| `RELEVANCE` | Completeness | Weak — "relevant to request" without structured goals |
| `CONCISENESS` | Style | No |
| `DOCUMENTATION_QUALITY` | Quality | No |
| `API_CONSISTENCY` | Style | No |
| `PERFORMANCE_CONSIDERATIONS` | Performance | No |
| `SCALABILITY` | Performance | No |

**No criterion exists** that says: "The user asked for X, Y, and Z — does the response deliver all three?"

### Gate Configuration Is Static

Flow gates specify criteria by name from the built-in library:

```yaml
evaluate:
  agent: quality-judge
  criteria: ["code*correctness", "code*completeness"]
  threshold: 0.8
```

There is no way to inject request-derived criteria into a gate evaluation.

### Reflexive Agent Critique Is Context-Free

The default critique prompt in `src/services/reflexive_agent.ts`:

```text
Consider:

1. **Accuracy**: Is the information correct?

1.
1.
1.
1.

"Completeness" and "Relevance" reference "the request" but the critique agent receives only the raw request text — not a structured list of requirements to check against.

### Quality Judge Blueprint Has No Request Context

The `quality-judge` agent in `Blueprints/Agents/quality-judge.md` defines scoring rubrics for `code_correctness`, `security`, `maintainability`, `completeness` — but `completeness` is defined as a vague rubric:

```text
### completeness (0.0-1.0)

- 1.0: All requirements addressed thoroughly

Without knowing what "all requirements" are, the judge must guess.

---

## Goals

- [ ] Add `GOAL*ALIGNMENT` and `TASK*FULFILLMENT` criteria to the built-in `CRITERIA` library.
- [ ] Implement `CriteriaGenerator` that produces request-specific `EvaluationCriterion` objects from `IRequestAnalysis` (Phase 45 output).
- [ ] Extend `GateConfig` to accept dynamic criteria alongside named ones.
- [ ] Propagate `IRequestAnalysis.acceptanceCriteria` through plan metadata.
- [ ] Enhance `ReflexiveAgent` critique prompts with structured requirements context.
- [ ] Enhance `ConfidenceScorer` to factor in goal alignment.
- [ ] Write tests for dynamic criteria generation and goal-aligned evaluation.

---

## Detailed Design

### 1. New Built-In Criteria

Add to `CRITERIA` in `src/flows/evaluation_criteria.ts`:

```typescript
GOAL_ALIGNMENT: {
  name: "goal_alignment",
  description:
    "The response directly accomplishes the stated objective(s). " +
    "Every primary goal from the original request is addressed. " +
    "Check the response against each stated goal and verify it is met.",
  weight: 2.5,
  required: true,
  category: EvaluationCategory.COMPLETENESS,
},

TASK_FULFILLMENT: {
  name: "task_fulfillment",
  description:
    "All explicitly stated requirements are fulfilled. " +
    "Each functional requirement is implemented, each constraint is respected, " +
    "and no stated requirement is silently omitted.",
  weight: 2.0,
  required: true,
  category: EvaluationCategory.COMPLETENESS,
},

REQUEST_UNDERSTANDING: {
  name: "request_understanding",
  description:
    "The response demonstrates correct understanding of the task. " +
    "The approach taken is appropriate for the goal, terminology is used correctly, " +
    "and the response doesn't solve a different problem than what was asked.",
  weight: 1.5,
  required: false,
  category: EvaluationCategory.CORRECTNESS,
},
```

Add new criterion sets:

```typescript
GOAL*ALIGNED*REVIEW: [
  CRITERIA.GOAL_ALIGNMENT,
  CRITERIA.TASK_FULFILLMENT,
  CRITERIA.REQUEST_UNDERSTANDING,
  CRITERIA.CODE_CORRECTNESS,
  CRITERIA.CODE_COMPLETENESS,
],

FULL*QUALITY*GATE: [
  CRITERIA.GOAL_ALIGNMENT,
  CRITERIA.TASK_FULFILLMENT,
  CRITERIA.CODE_CORRECTNESS,
  CRITERIA.CODE_COMPLETENESS,
  CRITERIA.NO*SECURITY*ISSUES,
  CRITERIA.HAS_TESTS,
  CRITERIA.ERROR_HANDLING,
],
```

### 2. Dynamic Criteria Generation

```typescript
export class CriteriaGenerator {
  /**
   * Generate request-specific criteria from analysis results.
   * Each extracted requirement becomes a checkable criterion.
   */
  fromAnalysis(analysis: IRequestAnalysis): EvaluationCriterion[] {
    const criteria: EvaluationCriterion[] = [];

    // Generate a criterion for each explicit goal
    for (const goal of analysis.goals.filter(g => g.explicit)) {
      criteria.push({
        name: `goal_${sanitizeName(goal.description)}`,
        description: `Goal: "${goal.description}" — Verify this specific goal is achieved in the response.`,
        weight: goal.priority === 1 ? 2.0 : 1.0,
        required: goal.priority <= 2,
        category: EvaluationCategory.COMPLETENESS,
      });
    }

    // Generate a criterion for each acceptance criterion
    for (const ac of analysis.acceptanceCriteria) {
      criteria.push({
        name: `ac_${sanitizeName(ac)}`,
        description: `Acceptance Criterion: "${ac}" — Verify this condition is satisfied.`,
        weight: 1.5,
        required: true,
        category: EvaluationCategory.COMPLETENESS,
      });
    }

    return criteria;
  }
}
```

### 3. Enhanced Gate Configuration

Extend `GateConfig` to accept both static and dynamic criteria:

```typescript
export const GateConfigSchema = z.object({
  agent: z.string(),
  criteria: z.array(z.union([z.string(), EvaluationCriterionSchema])),
  // NEW: auto-generate criteria from request analysis
  includeRequestCriteria: z.boolean().default(false),
  threshold: z.number().min(0).max(1).default(0.8),
  onFail: z.nativeEnum(FlowGateOnFail).default(FlowGateOnFail.HALT),
  maxRetries: z.number().int().min(1).default(3),
});
```

When `includeRequestCriteria` is true and an `IRequestAnalysis` is available, the `GateEvaluator` merges generated criteria with the static ones before evaluation.

### 4. Enhanced Reflexive Agent Critique

When `IRequestAnalysis` is available, inject structured requirements into the critique prompt:

```text
## Original Request
{request}

## Extracted Requirements (from pre-analysis)
Goals:
{goals_list}

Requirements:
{requirements_list}

Acceptance Criteria:
{acceptance*criteria*list}

## Response to Evaluate
{response}

## Your Task
Evaluate the response against EACH specific requirement listed above.
For every goal and acceptance criterion, state whether it is:

- ✅ MET: fully addressed
- ⚠️ PARTIAL: partially addressed
- ❌ MISSING: not addressed

### 5. Acceptance Criteria Flow Through Pipeline

```text
Request File
  → RequestParser.parse()
  → RequestAnalyzer.analyze()        → IRequestAnalysis
  → buildParsedRequest()             → IParsedRequest (enriched)
  → AgentRunner.run()                → IAgentExecutionResult
  → PlanWriter.writePlan()           → Plan file (with analysis metadata)
  → ExecutionLoop.executeCore()
  → PlanExecutor (execution)
  → GateEvaluator / ReflexiveAgent   → Uses IRequestAnalysis for evaluation
  → MissionReporter                  → Reports goal satisfaction metrics
```

The `IRequestAnalysis` must be persisted in plan metadata or passed through the execution context so that downstream quality evaluation components can access it.

---

## Step-by-Step Implementation Plan

### Step 1: Add Built-In `GOAL*ALIGNMENT`, `TASK*FULFILLMENT`, and `REQUEST_UNDERSTANDING` Criteria

**What:** Add three new evaluation criteria and two new criterion sets to the built-in `CRITERIA` library in `src/flows/evaluation_criteria.ts`.

**Files to modify:**

- `src/flows/evaluation_criteria.ts` (add criteria + sets)

**Architecture notes:**

- Follow existing `CRITERIA` constant pattern: each criterion has `name`, `description`, `weight`, `required`, `category`
- `GOAL_ALIGNMENT`: weight 2.5, required, category COMPLETENESS — checks every primary goal is addressed
- `TASK_FULFILLMENT`: weight 2.0, required, category COMPLETENESS — checks all stated requirements fulfilled
- `REQUEST_UNDERSTANDING`: weight 1.5, not required, category CORRECTNESS — checks correct understanding of task
- New criterion sets: `GOAL*ALIGNED*REVIEW` (3 new + code*correctness + code*completeness), `FULL*QUALITY*GATE` (goal*alignment + task*fulfillment + code*correctness + code*completeness + security + tests + error_handling)
- Category enum may need `EvaluationCategory.COMPLETENESS` and `EvaluationCategory.CORRECTNESS` — verify or add

**Success criteria:**

- [ ] `CRITERIA.GOAL_ALIGNMENT` accessible with correct weight and description
- [ ] `CRITERIA.TASK_FULFILLMENT` accessible with correct weight and description
- [ ] `CRITERIA.REQUEST_UNDERSTANDING` accessible with correct weight and description
- [ ] `CRITERIA.GOAL*ALIGNED*REVIEW` set contains the right 5 criteria
- [ ] `CRITERIA.FULL*QUALITY*GATE` set contains the right 7 criteria
- [ ] Existing criteria unaffected (backward compatible)
- [ ] No lint or type errors

**Planned tests** (`tests/flows/evaluation*criteria*test.ts`):

- `[EvaluationCriteria] GOAL_ALIGNMENT has correct weight and category`
- `[EvaluationCriteria] TASK_FULFILLMENT has correct weight and category`
- `[EvaluationCriteria] REQUEST_UNDERSTANDING has correct weight and category`
- `[EvaluationCriteria] GOAL*ALIGNED*REVIEW set contains 5 criteria`
- `[EvaluationCriteria] FULL*QUALITY*GATE set contains 7 criteria`
- `[EvaluationCriteria] existing criteria remain unchanged`

---

### Step 2: Define `ICriteriaGeneratorService` Interface

**What:** Create the service interface for dynamic criteria generation in `src/shared/interfaces/i*criteria*generator_service.ts`. Register in barrel.

**Files to create/modify:**

- `src/shared/interfaces/i*criteria*generator_service.ts` (NEW)
- `src/shared/interfaces/mod.ts` (add export)

**Architecture notes:**

- Interface `ICriteriaGeneratorService` with method: `fromAnalysis(analysis: IRequestAnalysis) → EvaluationCriterion[]`
- Optional method: `fromSpecification(spec: IRequestSpecification) → EvaluationCriterion[]` (when Phase 47 Q&A produced a spec)
- Depends on `IRequestAnalysis` (Phase 45 types) and `EvaluationCriterion` (existing type)
- No config interface needed — generator is stateless

**Success criteria:**

- [ ] Interface exported through barrel
- [ ] Depends only on existing types
- [ ] TypeScript compiles with `deno check`

**Planned tests:** None (interface-only).

---

### Step 3: Implement `CriteriaGenerator` Service

**What:** Create `src/services/criteria_generator.ts` — generates request-specific `EvaluationCriterion` objects from `IRequestAnalysis` and optionally `IRequestSpecification`.

**Files to create:**

- `src/services/criteria_generator.ts` (NEW)

**Architecture notes:**

- Class `CriteriaGenerator` implements `ICriteriaGeneratorService`
- `fromAnalysis()`: for each explicit goal → generate criterion named `goal*{sanitized}` with weight based on priority; for each acceptance criterion → generate criterion named `ac*{sanitized}`, weight 1.5, required
- `fromSpecification()`: for each `goals[]` → goal criterion; for each `successCriteria[]` → acceptance criterion; constraint criteria from `constraints[]`
- Sanitize names: lowercase, replace spaces/special chars with underscores, cap length
- Cap total generated criteria at 10 (merge similar with higher weight)
- All generated criteria get category `EvaluationCategory.COMPLETENESS`

**Success criteria:**

- [ ] Generates goal criteria from explicit goals in `IRequestAnalysis`
- [ ] Generates acceptance criteria from `acceptanceCriteria` in analysis
- [ ] Generates criteria from `IRequestSpecification` goals and successCriteria
- [ ] Sanitizes criterion names correctly
- [ ] Caps at 10 criteria (merges if over limit)
- [ ] Priority-1 goals get weight 2.0, others get weight 1.0
- [ ] Acceptance criteria get weight 1.5 and required=true
- [ ] Returns empty array for analysis with no extractable goals

**Planned tests** (`tests/services/criteria*generator*test.ts`):

- `[CriteriaGenerator] generates criteria from explicit goals`
- `[CriteriaGenerator] generates criteria from acceptance criteria`
- `[CriteriaGenerator] generates criteria from IRequestSpecification`
- `[CriteriaGenerator] sanitizes criterion names`
- `[CriteriaGenerator] caps at 10 criteria`
- `[CriteriaGenerator] priority-1 goals get higher weight`
- `[CriteriaGenerator] acceptance criteria are required`
- `[CriteriaGenerator] returns empty for analysis without goals`
- `[CriteriaGenerator] handles analysis with only inferred goals`

---

### Step 4: Extend `GateConfig` to Accept Dynamic Criteria

**What:** Extend `GateConfigSchema` to support `includeRequestCriteria` flag that triggers dynamic criteria injection alongside static criteria.

**Files to modify:**

- `src/shared/schemas/flow.ts` or `src/flows/gate_evaluator.ts` (wherever `GateConfigSchema` is defined)

**Architecture notes:**

- Add `includeRequestCriteria: z.boolean().default(false)` to `GateConfigSchema`
- When `true`, `GateEvaluator` merges generated criteria (from `CriteriaGenerator`) with static criteria before evaluation
- Static criteria resolved by name from `CRITERIA` library; dynamic criteria already `EvaluationCriterion` objects
- Combined criteria list deduplicates by name (static wins if both exist)
- Backward compatible: defaults to `false`, existing flows unaffected

**Success criteria:**

- [ ] `GateConfigSchema` validates `includeRequestCriteria` field
- [ ] Default is `false`
- [ ] Existing gate configs validate without modification
- [ ] Schema accepts both named (string) and inline (object) criteria in array

**Planned tests** (`tests/flows/gate*config*test.ts`):

- `[GateConfigSchema] validates includeRequestCriteria field`
- `[GateConfigSchema] defaults includeRequestCriteria to false`
- `[GateConfigSchema] backward compatible with existing configs`

---

### Step 5: Enhance `GateEvaluator` to Use Dynamic Criteria

**What:** Modify `GateEvaluator` to merge dynamically generated criteria with static criteria when `includeRequestCriteria` is enabled and `IRequestAnalysis` is available.

**Files to modify:**

- `src/flows/gate_evaluator.ts` (add dynamic criteria resolution)

**Architecture notes:**

- In the evaluation method, before passing criteria to the judge agent:
  1. Resolve static criteria by name from `CRITERIA` library (existing behavior)
  1.
  1.
  1.
  1.
- `CriteriaGenerator` injected via constructor or created internally
- `requestAnalysis` available from `IFlowStepRequest.requestAnalysis` (Phase 45 Step 11)

**Success criteria:**

- [ ] Dynamic criteria generated when `includeRequestCriteria` is true
- [ ] Dynamic criteria merged with static criteria
- [ ] Deduplication by name with static precedence
- [ ] No dynamic criteria when `includeRequestCriteria` is false
- [ ] No dynamic criteria when analysis not available
- [ ] Judge agent receives combined criteria list
- [ ] Existing flows work unchanged

**Planned tests** (`tests/flows/gate*evaluator*dynamic_test.ts`):

- `[GateEvaluator] includes dynamic criteria when enabled and analysis available`
- `[GateEvaluator] skips dynamic criteria when disabled`
- `[GateEvaluator] skips dynamic criteria when analysis unavailable`
- `[GateEvaluator] deduplicates criteria by name`
- `[GateEvaluator] static criteria take precedence over dynamic`
- `[GateEvaluator] includes specification criteria when available`
- `[GateEvaluator] existing flows unaffected`

---

### Step 6: Enhance `ReflexiveAgent` Critique with Structured Requirements

**What:** Extend `ReflexiveAgent` to inject structured requirements into the critique prompt when `IRequestAnalysis` is available.

**Files to modify:**

- `src/services/reflexive_agent.ts` (extend config and critique prompt)

**Architecture notes:**

- Add optional `requestAnalysis?: IRequestAnalysis` to `IReflexiveAgentConfig`
- When analysis available, build enhanced critique prompt with:

  ```text
  ## Specific Requirements to Verify
  {goals_list — each goal with [E]xplicit/[I]nferred marker}

  ## Acceptance Criteria
  {criteria_list}

  For each requirement, state: ✅ MET / ⚠️ PARTIAL / ❌ MISSING
  ```

- When analysis NOT available, existing generic prompt works unchanged (non-breaking)
- Add optional `requirementsFulfillment` field to `CritiqueSchema` output for structured MET/PARTIAL/MISSING tracking

**Success criteria:**

- [ ] Enhanced prompt includes structured goals when analysis available
- [ ] Enhanced prompt includes acceptance criteria when available
- [ ] Critique output includes `requirementsFulfillment` field
- [ ] Existing generic critique works without analysis (backward compatible)
- [ ] Goals listed with explicit/inferred markers
- [ ] Requirements checked as MET/PARTIAL/MISSING in output

**Planned tests** (`tests/services/reflexive*agent*criteria_test.ts`):

- `[ReflexiveAgent] includes goals in critique when analysis available`
- `[ReflexiveAgent] includes acceptance criteria in critique prompt`
- `[ReflexiveAgent] critique output includes requirementsFulfillment`
- `[ReflexiveAgent] generic critique works without analysis`
- `[ReflexiveAgent] goals show explicit/inferred markers`

---

### Step 7: Enhance `ConfidenceScorer` with Goal Alignment

**What:** Add goal alignment as a factor in the confidence score calculation.

**Files to modify:**

- `src/services/confidence_scorer.ts` (add goal alignment factor)

**Architecture notes:**

- When `IRequestAnalysis` is available in the scoring context:
  - Extract goal count and acceptance criteria count
  - If reflexive agent critique includes `requirementsFulfillment`, calculate: `metCount / totalCount` as `goalAlignmentScore`
  - Factor into overall confidence: `(existingScore * 0.7) + (goalAlignmentScore * 0.3)` (configurable weights)
- When analysis NOT available, existing scoring logic unchanged
- New factor is additive — existing tests still pass

**Success criteria:**

- [ ] Goal alignment factored into confidence when analysis available
- [ ] `goalAlignmentScore` derived from requirementsFulfillment ratios
- [ ] Confidence score reflects goal satisfaction
- [ ] Existing scoring unchanged without analysis
- [ ] Weights configurable (default 0.7/0.3 split)

**Planned tests** (`tests/services/confidence*scorer*alignment_test.ts`):

- `[ConfidenceScorer] includes goal alignment factor when analysis available`
- `[ConfidenceScorer] higher goalAlignmentScore increases confidence`
- `[ConfidenceScorer] zero goalAlignmentScore decreases confidence`
- `[ConfidenceScorer] existing scoring unchanged without analysis`
- `[ConfidenceScorer] respects configurable weight split`

---

### Step 8: Propagate `IRequestAnalysis` Through Plan Metadata

**What:** Ensure `IRequestAnalysis` is persisted in plan metadata and accessible to downstream quality evaluation components during execution.

**Files to modify:**

- `src/services/plan_writer.ts` (ensure analysis in metadata — may overlap with Phase 45 Step 10)
- `src/services/execution/plan_executor.ts` or execution context (propagate to evaluators)

**Architecture notes:**

- This step ensures that the `requestAnalysis` written to plan metadata in Phase 45 Step 10 is actually *loaded and passed* to gate evaluators and reflexive agent during execution
- `ExecutionLoop` or `PlanExecutor` reads plan metadata, extracts `requestAnalysis`, passes to `GateEvaluator` and `ReflexiveAgent` in the evaluation context
- If plan metadata doesn't have analysis (older plans), evaluators fall back to generic criteria

**Success criteria:**

- [ ] `GateEvaluator` receives `requestAnalysis` from plan metadata during execution
- [ ] `ReflexiveAgent` receives `requestAnalysis` from plan metadata during execution
- [ ] `ConfidenceScorer` receives `requestAnalysis` from execution context
- [ ] Evaluators gracefully handle plans without analysis

**Planned tests** (`tests/services/execution/criteria*propagation*test.ts`):

- `[ExecutionLoop] passes requestAnalysis to GateEvaluator`
- `[ExecutionLoop] passes requestAnalysis to ReflexiveAgent`
- `[ExecutionLoop] passes requestAnalysis to ConfidenceScorer`
- `[ExecutionLoop] handles plans without requestAnalysis`

---

### Step 9: Extend Flow Gate Integration

**What:** Ensure flow gate steps can access `IRequestAnalysis` for dynamic criteria generation, and add flow-level `includeRequestCriteria` default.

**Files to modify:**

- `src/flows/flow_runner.ts` (propagate analysis to gate steps)
- `src/shared/schemas/flow.ts` (add flow-level settings)

**Architecture notes:**

- When `FlowRunner` encounters a gate step with `includeRequestCriteria: true`, it passes `requestAnalysis` from the flow execution context to `GateEvaluator`
- Add flow-level `includeRequestCriteria` to `FlowSchema.settings` — applies to all gate steps as default (step-level overrides flow-level)
- Gate evaluator's dynamic criteria logic (Step 5) receives analysis from either flow context or step-level override
- Feedback loops (`loop` config) can incorporate goal satisfaction as a retry signal

**Success criteria:**

- [ ] Flow-level `includeRequestCriteria` setting added to schema
- [ ] Flow-level default applies to all gate steps
- [ ] Step-level `includeRequestCriteria` overrides flow-level
- [ ] `FlowRunner` passes analysis to gate evaluator for gate steps
- [ ] Existing flows without the setting work unchanged

**Planned tests** (`tests/flows/flow*gate*criteria_test.ts`):

- `[FlowRunner] applies flow-level includeRequestCriteria to gate steps`
- `[FlowRunner] step-level overrides flow-level setting`
- `[FlowRunner] passes requestAnalysis to gate evaluator`
- `[FlowRunner] existing flows work without includeRequestCriteria`

---

### Step 10: Add Criteria Generation Constants

**What:** Add criteria generation constants to `src/shared/constants.ts`.

**Files to modify:**

- `src/shared/constants.ts` (add new section)

**Architecture notes:**

- Constants: `MAX*DYNAMIC*CRITERIA = 10`, `DEFAULT*GOAL*WEIGHT = 1.0`, `PRIORITY*1*GOAL*WEIGHT = 2.0`, `ACCEPTANCE*CRITERION*WEIGHT = 1.5`, `GOAL*ALIGNMENT*CONFIDENCE*WEIGHT = 0.3`, `EXISTING*SCORE*CONFIDENCE*WEIGHT = 0.7`, `CRITERION*NAME*MAX*LENGTH = 50`, `CRITERION*NAME*SANITIZE_PATTERN`
- Grouped under `// === Acceptance Criteria Propagation ===`

**Success criteria:**

- [ ] All weights and limits referenced from constants
- [ ] Constants grouped under proper section header
- [ ] No magic numbers in Steps 3, 5, 6, 7

**Planned tests:** None (validated through usage in other step tests).

---

### Step 11: End-to-End Integration Test

**What:** Create an integration test that verifies dynamic criteria generation, propagation through the pipeline, and goal-aligned evaluation.

**Files to create:**

- `tests/integration/acceptance*criteria*e2e_test.ts` (NEW)

**Architecture notes:**

- Uses `TestEnvironment.create()` for full workspace setup
- Test scenarios:
  1. Request with explicit goals → analyze → plan → execute → gate evaluator uses dynamic criteria
  1.
  1.
  1.
- Uses mock LLM provider for deterministic evaluation results

**Success criteria:**

- [ ] Dynamic criteria from goals reach gate evaluator
- [ ] Acceptance criteria from analysis reach reflexive agent
- [ ] Goal alignment factored into confidence score
- [ ] Generic-only fallback when no goals extractable
- [ ] Flow gate steps receive dynamic criteria

**Planned tests:**

- `[E2E] request goals generate dynamic evaluation criteria`
- `[E2E] acceptance criteria propagate to reflexive agent`
- `[E2E] goal alignment factor in confidence scoring`
- `[E2E] generic fallback without extractable goals`
- `[E2E] flow gate with includeRequestCriteria uses dynamic criteria`

---

### Step 12: Update `ARCHITECTURE.md`

**What:** Update architecture document to reflect acceptance criteria propagation and goal-aligned evaluation.

**Files to modify:**

- `ARCHITECTURE.md`

**Sections to update:**

1. **"Quality Evaluation Pipeline"** — Add dynamic criteria generation:

   ```text
   IRequestAnalysis
     → CriteriaGenerator.fromAnalysis()
     → Dynamic EvaluationCriterion[] + static CRITERIA
     → GateEvaluator / ReflexiveAgent / ConfidenceScorer
   ```

1.

1.

1.

1.

1.

**Success criteria:**

- [ ] Dynamic criteria flow documented with diagram
- [ ] New criteria listed in criteria table
- [ ] Gate architecture updated with dynamic criteria
- [ ] ReflexiveAgent and ConfidenceScorer enhancements documented

**Planned tests:** None (documentation-only).

---

### Step 13: Update User-Facing and Agent Documentation

**What:** Update docs/ and .copilot/ to cover acceptance criteria propagation.

**Files to modify:**

- `docs/dev/ExoFrame*Technical*Spec.md`
- `.copilot/source/exoframe.md`
- `.copilot/cross-reference.md`
- `.copilot/manifest.json`

**Updates:**

1. **`docs/dev/ExoFrame*Technical*Spec.md`:**
   - Add `CriteriaGenerator` service specification
   - Document dynamic criteria generation from analysis and specification
   - Document `includeRequestCriteria` gate config
   - Document enhanced reflexive critique and confidence scoring

1.
   - Add `CriteriaGenerator` to services section
   - Document dynamic criteria in flow gate section
   - Update evaluation pipeline description

1.
   - Add row: `acceptance criteria / goal-aligned evaluation` → `source/exoframe.md` + `planning/phase-48-acceptance-criteria-propagation.md`
   - Add topic index entries: `acceptance-criteria`, `goal-alignment`, `dynamic-criteria`

1.
   - Regenerate via `deno run --allow-read --allow-write scripts/build*agents*index.ts`

**Success criteria:**

- [ ] Technical spec documents CriteriaGenerator API
- [ ] `.copilot/` docs list CriteriaGenerator
- [ ] Cross-reference has acceptance criteria row
- [ ] `manifest.json` is fresh

**Planned tests:** `deno task check:docs` passes.

---

### Implementation Order & Dependencies

```text
Step  1: New built-in criteria        ← foundation, no dependencies
Step  2: Generator interface           ← depends on Step 1 (criterion type)
Step 10: Constants                     ← can parallel with Steps 1-2
Step  3: CriteriaGenerator service     ← depends on Steps 1, 2, 10
Step  4: GateConfig extension          ← depends on Step 1
Step  5: GateEvaluator enhancement     ← depends on Steps 3, 4
Step  6: ReflexiveAgent enhancement    ← depends on Phase 45 (IRequestAnalysis type)
Step  7: ConfidenceScorer enhancement  ← depends on Step 6 (requirementsFulfillment)
Step  8: Plan metadata propagation     ← depends on Phase 45 Step 10
Step  9: Flow gate integration         ← depends on Steps 4, 5, 8
Step 11: E2E test                      ← depends on all above
Step 12: ARCHITECTURE.md               ← depends on Steps 5, 6, 7, 9
Step 13: Docs + .copilot/             ← depends on Step 12
```

**Parallel waves:**

| Wave | Steps | Description |
| ------ | ------- | ------------- |
| 1 | 1, 2, 10 | Criteria, interface, constants (no runtime deps) |
| 2 | 3, 4 | Generator service + gate config extension |
| 3 | 5, 6, 7 | Evaluator enhancements (parallel, independent) |
| 4 | 8, 9 | Pipeline propagation + flow integration |
| 5 | 11 | E2E validation |
| 6 | 12, 13 | Documentation (after implementation stabilizes) |

---

## Methodology: Specification-Driven Development

This phase implements SDD's core feedback principle: **the specification is the evaluation rubric**. The `GOAL*ALIGNMENT` and `TASK*FULFILLMENT` criteria generated from `IRequestAnalysis` ensure that quality gates verify output against the *specification*, not generic heuristics. This closes the SDD loop: spec → execute → verify against spec.

See `.copilot/process/specification-driven-development.md` for the full SDD analysis.

---

## Dependencies

- **Phase 45** (Request Intent Analysis) — Provides `IRequestAnalysis` as input
- `src/flows/evaluation_criteria.ts` — Add new criteria and generator
- `src/flows/gate_evaluator.ts` — Accept dynamic criteria
- `src/services/reflexive_agent.ts` — Enhanced critique prompts
- `src/services/confidence_scorer.ts` — Goal-alignment factor
- `src/services/plan_writer.ts` — Persist analysis in plan metadata

## Risks & Mitigations

| Risk | Mitigation |
| ------ | ----------- |
| Too many dynamic criteria slow evaluation | Cap at 10 generated criteria; merge similar ones |
| Request analysis may extract wrong requirements | Criteria are advisory; generic criteria still form the baseline |
| Judge agent overwhelmed by long criteria lists | Summarize criteria list; use structured scoring format |
| Breaking changes to gate evaluation | Additive: `includeRequestCriteria` defaults to `false` |

## Open Questions

- Should request analysis be visible to the executing agent (not just the evaluator)?
- Should dynamic criteria be logged in the Activity Journal for auditability?
- What happens when the request has zero extractable acceptance criteria? (Fall back to generic-only.)

---

## Flow Request Coverage

**Gap identified:** Flow gate steps (`type: "gate"`) use static `criteria` arrays from the flow YAML definition. The `includeRequestCriteria` enhancement only works if `IRequestAnalysis` is available in the gate evaluation context — but `FlowRunner` currently doesn't propagate analysis to gate steps.

### Required Changes for Flow Requests

1. **Propagate `IRequestAnalysis` through `FlowRunner` to gate steps.** When `FlowRunner.execute()` receives request analysis (see Phase 45 flow changes), gate steps of `type: "gate"` should have access to it for dynamic criteria generation.

1.

1.

1.

```typescript
// In FlowSchema.settings:
settings: z.object({
  maxParallelism: z.number().int().min(1).default(3),
  failFast: z.boolean().default(true),
  timeout: z.number().positive().optional(),
  /** NEW: Auto-include request-derived criteria in all gate evaluations */
  includeRequestCriteria: z.boolean().default(false),
}),
```

- Should the `product-manager` agent be invoked to generate acceptance criteria for complex requests?
