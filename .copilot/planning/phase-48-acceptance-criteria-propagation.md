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

**What:** Add three new evaluation criteria to `CRITERIA` and two new criterion sets to `CRITERION_SETS` in `src/flows/evaluation_criteria.ts`.

**Files to modify:**

- `src/flows/evaluation_criteria.ts` (add 3 criteria to `CRITERIA`; add 2 sets to `CRITERION_SETS`)

**Architecture notes:**

- Follow existing `CRITERIA` constant pattern: each criterion has `name`, `description`, `weight`, `required`, `category`
- `GOAL_ALIGNMENT`: weight 2.5, required, category COMPLETENESS — checks every primary goal is addressed
- `TASK_FULFILLMENT`: weight 2.0, required, category COMPLETENESS — checks all stated requirements fulfilled
- `REQUEST_UNDERSTANDING`: weight 1.5, not required, category CORRECTNESS — checks correct understanding of task
- New criterion sets `GOAL*ALIGNED*REVIEW` and `FULL*QUALITY*GATE` must be added to **`CRITERION_SETS`**, **not** to `CRITERIA` (Gap 3: `CRITERIA` holds only single `EvaluationCriterion` objects; inserting arrays there breaks `as const` typing and silently corrupts `getCriteriaByNames()`)
- Category enum: verify `EvaluationCategory.COMPLETENESS` and `EvaluationCategory.CORRECTNESS` exist; add if missing

**Success criteria:**

- [x] `CRITERIA.GOAL_ALIGNMENT` accessible with correct weight and description
- [x] `CRITERIA.TASK_FULFILLMENT` accessible with correct weight and description
- [x] `CRITERIA.REQUEST_UNDERSTANDING` accessible with correct weight and description
- [x] `CRITERION_SETS.GOAL_ALIGNED_REVIEW` contains the right 5 criteria (Gap 15)
- [x] `CRITERION_SETS.FULL_QUALITY_GATE` contains the right 7 criteria (Gap 15)
- [x] Existing `CRITERIA` entries and `CRITERION_SETS` entries unaffected (backward compatible)
- [x] No lint or type errors

**Planned tests** (`tests/flows/evaluation_criteria_test.ts`):

- ✅ `[EvaluationCriteria] GOAL_ALIGNMENT has correct weight and category`
- ✅ `[EvaluationCriteria] TASK_FULFILLMENT has correct weight and category`
- ✅ `[EvaluationCriteria] REQUEST_UNDERSTANDING has correct weight and category`
- ✅ `[EvaluationCriteria] CRITERION_SETS.GOAL_ALIGNED_REVIEW contains 5 criteria`
- ✅ `[EvaluationCriteria] CRITERION_SETS.FULL_QUALITY_GATE contains 7 criteria`
- ✅ `[EvaluationCriteria] existing criteria remain unchanged`

**✅ IMPLEMENTED** — `src/flows/evaluation_criteria.ts`, 6/6 tests passing

---

### Step 2: Define `ICriteriaGeneratorService` Interface and Shared `IRequirementFulfillment` Type

**What:** Create the service interface for dynamic criteria generation and define the shared `IRequirementFulfillment` type that bridges Steps 8 and 9. Register in barrel.

**Files to create/modify:**

- `src/shared/interfaces/i*criteria*generator_service.ts` (NEW)
- `src/flows/evaluation_criteria.ts` (add `RequirementFulfillmentSchema` + `IRequirementFulfillment`)
- `src/shared/interfaces/mod.ts` (add export)

**Architecture notes:**

- Interface `ICriteriaGeneratorService` with single method: `fromAnalysis(analysis: IRequestAnalysis) → EvaluationCriterion[]`
- `fromSpecification()` is **deferred to Phase 49** — `IRequestSpecification` is not persisted in plan frontmatter (`PlanFrontmatterSchema`), so its value is unavailable at evaluation time (Gap 9). Do **not** declare it on the interface.
- Define `RequirementFulfillmentSchema` in `src/flows/evaluation_criteria.ts` alongside the other evaluation schemas (Gap 10 — single authoritative definition shared by Steps 8 and 9):

  ```typescript
  export const RequirementFulfillmentSchema = z.object({
    requirement: z.string(),
    status: z.enum(["MET", "PARTIAL", "MISSING"]),
  });
  export type IRequirementFulfillment = z.infer<typeof RequirementFulfillmentSchema>;
  ```

- `ICriteriaGeneratorService` depends on `IRequestAnalysis` (Phase 45) and `EvaluationCriterion` (existing)
- No config interface needed — generator is stateless

**Success criteria:**

- [x] `ICriteriaGeneratorService` exported through barrel with `fromAnalysis()` only
- [x] `fromSpecification()` is **not** declared — deferred to Phase 49
- [x] `RequirementFulfillmentSchema` and `IRequirementFulfillment` exported from `evaluation_criteria.ts`
- [x] Depends only on existing types
- [x] TypeScript compiles with `deno check`

**Planned tests** (`tests/flows/evaluation_criteria_test.ts`):

- ✅ `[EvaluationCriteria] RequirementFulfillmentSchema validates MET status`
- ✅ `[EvaluationCriteria] RequirementFulfillmentSchema validates PARTIAL status`
- ✅ `[EvaluationCriteria] RequirementFulfillmentSchema rejects unknown status`

**✅ IMPLEMENTED** — `src/shared/interfaces/i_criteria_generator_service.ts` created, `src/flows/evaluation_criteria.ts` extended, 3/3 tests passing

---

### Step 3: Add Criteria Generation Constants

**What:** Add criteria generation constants to `src/shared/constants.ts`.

**Files to modify:**

- `src/shared/constants.ts` (add new section)

**Architecture notes:**

- Constants (with exact values — required so Steps 4 and 9 have no ambiguity about magic numbers, Gap 7/16):
  - `MAX_DYNAMIC_CRITERIA = 10`
  - `DEFAULT_GOAL_WEIGHT = 1.0`
  - `PRIORITY_1_GOAL_WEIGHT = 2.0`
  - `ACCEPTANCE_CRITERION_WEIGHT = 1.5`
  - `GOAL_ALIGNMENT_CONFIDENCE_WEIGHT = 0.3`
  - `EXISTING_SCORE_CONFIDENCE_WEIGHT = 0.7`
  - `CRITERION_NAME_MAX_LENGTH = 50`
  - `CRITERION_NAME_SANITIZE_PATTERN = /[^a-z0-9_]/g` ← strips everything that is not a lowercase letter, digit, or underscore (Gap 7)
- Grouped under `// === Acceptance Criteria Propagation ===`
- Step 4's `sanitizeName` private method uses `CRITERION_NAME_SANITIZE_PATTERN` and `CRITERION_NAME_MAX_LENGTH`

**Success criteria:**

- [x] All weights and limits referenced from constants
- [x] `CRITERION_NAME_SANITIZE_PATTERN = /[^a-z0-9_]/g` is defined (Gap 7)
- [x] Constants grouped under proper section header
- [x] No magic numbers in Steps 4, 7, 8, 9

**Planned tests:** None (validated through usage in other step tests).

**✅ IMPLEMENTED** — `src/shared/constants.ts` extended with `// === Acceptance Criteria Propagation ===` section; 8 constants exported.

---

### Step 4: Implement `CriteriaGenerator` Service

**What:** Create `src/services/criteria_generator.ts` — generates request-specific `EvaluationCriterion` objects from `IRequestAnalysis`.

**Files to create:**

- `src/services/criteria_generator.ts` (NEW)

**Architecture notes:**

- Class `CriteriaGenerator` implements `ICriteriaGeneratorService`
- `fromAnalysis()` algorithm:
  1. For each explicit goal → criterion named `goal_{sanitized}` with weight `PRIORITY_1_GOAL_WEIGHT` (2.0) if `priority === 1`, else `DEFAULT_GOAL_WEIGHT` (1.0); `required: true` if `priority <= 2`
  2. For each acceptance criterion string → criterion named `ac_{sanitized}`, weight `ACCEPTANCE_CRITERION_WEIGHT` (1.5), `required: true`
  3. Combine both lists; sort by **descending weight** (tiebreak: goal priority ascending)
  4. Truncate to `MAX_DYNAMIC_CRITERIA` (10) — **no similarity-based merging in Phase 48** (Gap 8)
  5. All generated criteria get `category: EvaluationCategory.COMPLETENESS`
- `fromSpecification()` is **not implemented in Phase 48** — `IRequestSpecification` is unavailable at evaluation time (Gap 9). Omit from class entirely.
- `sanitizeName(s: string)` is a **private method**: `s.toLowerCase().replace(CRITERION_NAME_SANITIZE_PATTERN, '_').slice(0, CRITERION_NAME_MAX_LENGTH)` (uses Step 3 constants). Example: `sanitizeName('Add unit tests for auth module')` → `'add_unit_tests_for_auth_module'`
- All weights and limits **must reference Step 3 constants** — no magic number literals (Gap 16)

**Success criteria:**

- [x] Generates goal criteria from explicit goals in `IRequestAnalysis`
- [x] Generates acceptance criteria from `acceptanceCriteria` in analysis
- [x] `fromSpecification()` is **not** present — deferred to Phase 49
- [x] `sanitizeName('Add unit tests for auth module')` → `'add_unit_tests_for_auth_module'`
- [x] Caps at `MAX_DYNAMIC_CRITERIA` by sort-then-truncate (no similarity merge)
- [x] Sort order: descending weight; tiebreak ascending goal priority
- [x] Priority-1 goals get `PRIORITY*1*GOAL_WEIGHT` (2.0), others `DEFAULT_GOAL_WEIGHT` (1.0)
- [x] Acceptance criteria get `ACCEPTANCE_CRITERION_WEIGHT` (1.5) and `required: true`
- [x] Returns empty array for analysis with no extractable goals or acceptance criteria
- [x] No magic number literals — all weight/limit references use Step 3 constants (Gap 16)

**Planned tests** (`tests/services/criteria*generator*test.ts`):

- `[CriteriaGenerator] generates criteria from explicit goals`
- `[CriteriaGenerator] generates criteria from acceptance criteria`
- `[CriteriaGenerator] sanitizes criterion names`
- `[CriteriaGenerator] caps at MAX_DYNAMIC_CRITERIA (10) criteria`
- `[CriteriaGenerator] sort order: higher weight criteria survive truncation`
- `[CriteriaGenerator] priority-1 goals get higher weight`
- `[CriteriaGenerator] acceptance criteria are required`
- `[CriteriaGenerator] returns empty for analysis without goals`
- `[CriteriaGenerator] handles analysis with only inferred goals`
- `[CriteriaGenerator] generates from goals only when acceptanceCriteria empty` (Gap 11)
- `[CriteriaGenerator] generates from acceptanceCriteria only when goals empty` (Gap 11)
- `[CriteriaGenerator] caps at exactly MAX_DYNAMIC_CRITERIA when input produces 11` (Gap 11)


**✅ IMPLEMENTED** — `src/services/criteria_generator.ts` created, 12/12 tests passing
---

### Step 5: Extend Gate Schemas to Accept Dynamic Criteria Flag

**What:** Add `includeRequestCriteria: boolean` to **both** gate-config schemas so that both YAML-authored flows and programmatic `GateEvaluator` usage recognise the flag.

**Files to modify:**

- `src/shared/schemas/flow.ts` — `GateEvaluateSchema` (the YAML-facing schema; `criteria` currently `z.array(z.string())`)
- `src/flows/gate_evaluator.ts` — `GateConfigSchema` (the programmatic schema; `criteria` supports inline objects)

**Architecture notes:**

- **Two schemas exist and both must be extended** (Gap 2): `GateEvaluateSchema` (validates YAML flow files) and `GateConfigSchema` (typed input to `GateEvaluator.evaluate()`). Extending only one means either YAML files are rejected at load time, or the evaluator never receives the flag.
- Add `includeRequestCriteria: z.boolean().default(false)` to **both** schemas
- In Step 6, `FlowRunner` converts `IGateEvaluate` → `GateConfig` when dispatching to `GateEvaluator`; this conversion must copy `includeRequestCriteria` across
- When `includeRequestCriteria` is `true`, `GateEvaluator` merges generated criteria from `CriteriaGenerator` with static criteria before evaluation
- Static criteria resolved by name from `CRITERIA`; dynamic criteria are already `EvaluationCriterion` objects
- Combined list deduplicates by `name` (static wins on collision)
- Backward compatible: both schemas default to `false`; all existing flow YAMLs validate unchanged

**Success criteria:**

- [ ] `GateEvaluateSchema` (in `flow.ts`) validates `includeRequestCriteria`; defaults to `false`
- [ ] `GateConfigSchema` (in `gate_evaluator.ts`) validates `includeRequestCriteria`; defaults to `false`
- [ ] Existing gate configs in YAML files validate without modification
- [ ] `GateConfigSchema` continues to accept inline `EvaluationCriterion` objects alongside string names
- [ ] `IGateEvaluate` type exposes `includeRequestCriteria` for Step 6’s conversion

**Planned tests** (`tests/flows/gate*config*test.ts`):

- `[GateEvaluateSchema] validates includeRequestCriteria field`
- `[GateEvaluateSchema] defaults includeRequestCriteria to false`
- `[GateEvaluateSchema] backward compatible with existing YAML configs`
- `[GateConfigSchema] validates includeRequestCriteria field`
- `[GateConfigSchema] defaults includeRequestCriteria to false`

---

### Step 6: Add FlowRunner Gate-Step Dispatch and `requestAnalysis` Forwarding

> **Wave 2 prerequisite.** This step unblocks Steps 7 and 10: both require `GateEvaluator` to be reachable from `FlowRunner` and `requestAnalysis` to flow through `IFlowStepRequest`. (Gap 1)

**What:** Add the missing gate-type dispatch to `FlowRunner.executeStep()` and propagate `requestAnalysis` from the `FlowRunner.execute()` input through to `IFlowStepRequest` for all step types.

**Files to modify:**

- `src/flows/flow_runner.ts` (add gate dispatch; forward `requestAnalysis` through step chain)
- Inject `GateEvaluator` and `CriteriaGenerator` into `FlowRunner` constructor

**Architecture notes:**

- In `FlowRunner.executeStep()`, add gate-type handling:

  ```typescript
  if (step.type === FlowStepType.GATE && step.evaluate) {
    const gateConfig = toGateConfig(step.evaluate); // converts IGateEvaluate → GateConfig (copies includeRequestCriteria)
    const result = await this.gateEvaluator.evaluate(
      gateConfig, stepRequest.userPrompt, stepRequest.userPrompt, 0, stepRequest.requestAnalysis
    );
    // map IGateResult → IStepResult
  }
  ```

- Propagate `requestAnalysis` through the call chain: `execute(flow, request)` → `executeWaves` → `executeWave` → `executeStep` → `prepareStepRequest` → `IFlowStepRequest.requestAnalysis` (the field already exists on `IFlowStepRequest` but is never populated today)
- `IGateEvaluate` → `GateConfig` conversion function `toGateConfig()` maps: `agent`, `criteria`, `threshold`, `onFail`, `maxRetries`, `includeRequestCriteria` (added in Step 5). This function must copy `includeRequestCriteria` to ensure the flag is not silently dropped (Gap 2).
- Non-gate steps continue to use `agentExecutor.run()` unchanged
- When `includeRequestCriteria` is `true` but `requestAnalysis` is `undefined`, log a `logDebug` warning (Gap 17) and continue with static criteria
- Add JSDoc to `IFlowRunner.execute()` documenting the `requestAnalysis` contract (Gap 17)

**Success criteria:**

- [ ] Gate steps (`type: "gate"`) execute via `GateEvaluator.evaluate()`, not `agentExecutor`
- [ ] `IFlowStepRequest.requestAnalysis` is populated from `FlowRunner.execute()` input
- [ ] `IGateEvaluate` → `GateConfig` conversion preserves all fields including `includeRequestCriteria`
- [ ] `IGateResult` is mapped to a valid `IStepResult`
- [ ] Non-gate steps continue to use `agentExecutor` unchanged
- [ ] Debug warning logged when `includeRequestCriteria=true` but no analysis provided (Gap 17)
- [ ] JSDoc on `IFlowRunner.execute()` documents the `requestAnalysis` contract (Gap 17)

**Planned tests** (`tests/flows/flow*runner*gate_dispatch_test.ts`):

- `[FlowRunner] dispatches gate steps to GateEvaluator`
- `[FlowRunner] non-gate steps use agentExecutor`
- `[FlowRunner] requestAnalysis forwarded to IFlowStepRequest`
- `[FlowRunner] gate dispatch preserves includeRequestCriteria from step.evaluate`
- `[FlowRunner] logs warning when includeRequestCriteria=true but no analysis`

---

### Step 7: Enhance `GateEvaluator` to Use Dynamic Criteria

**What:** Modify `GateEvaluator` to merge dynamically generated criteria with static criteria when `includeRequestCriteria` is enabled and `IRequestAnalysis` is available.

> **Depends on Step 6** (FlowRunner gate dispatch): `requestAnalysis` reaches `GateEvaluator` only after Step 6 wires `IFlowStepRequest.requestAnalysis` through `FlowRunner`.

**Files to modify:**

- `src/flows/gate_evaluator.ts` (inject `CriteriaGenerator`; add dynamic criteria resolution)

**Architecture notes:**

- Inject `CriteriaGenerator` into `GateEvaluator` constructor (or create internally)
- In `evaluate()`, before passing criteria to the judge agent:
  1. Resolve static criteria by name from `CRITERIA` (existing behaviour)
  2. If `config.includeRequestCriteria` is `true` **and** `requestAnalysis` is provided, call `criteriaGenerator.fromAnalysis(requestAnalysis)`
  3. Merge: start with static list; append dynamic items whose `name` does not already appear (static wins on collision)
  4. If `criteriaGenerator.fromAnalysis()` throws, catch, log the error, and fall back to static criteria only (Gap 12)
  5. If `includeRequestCriteria` is `true` but `requestAnalysis` is `undefined`, continue with static criteria only (no error)
- `requestAnalysis` is passed as a new optional parameter to `evaluate()`: `evaluate(config, content, context?, previousAttempts?, requestAnalysis?)`
- When analysis is provided but generates an empty list, combined criteria equals static list only (not treated as an error)

**Success criteria:**

- [ ] Dynamic criteria generated when `includeRequestCriteria` is `true` and analysis available
- [ ] Dynamic criteria merged with static; deduplication by name with static precedence
- [ ] No dynamic criteria when `includeRequestCriteria` is `false`
- [ ] Falls back to static-only when `includeRequestCriteria` is `true` but analysis is `undefined` (Gap 12)
- [ ] Falls back to static-only when dynamic generation returns empty array (Gap 12)
- [ ] Catches and logs `CriteriaGenerator` errors; continues with static criteria (Gap 12)
- [ ] Judge agent receives combined criteria list
- [ ] Existing flows work unchanged

**Planned tests** (`tests/flows/gate*evaluator*dynamic_test.ts`):

- `[GateEvaluator] includes dynamic criteria when enabled and analysis available`
- `[GateEvaluator] skips dynamic criteria when disabled`
- `[GateEvaluator] skips dynamic criteria when analysis unavailable`
- `[GateEvaluator] deduplicates criteria by name`
- `[GateEvaluator] static criteria take precedence over dynamic`
- `[GateEvaluator] existing flows unaffected`
- `[GateEvaluator] falls back to static when dynamic generation returns empty` (Gap 12)
- `[GateEvaluator] catches CriteriaGenerator errors and continues with static criteria` (Gap 12)

---

### Step 8: Enhance `ReflexiveAgent` Critique with Structured Requirements

**What:** Extend `ReflexiveAgent` to inject structured requirements into the critique prompt when `IRequestAnalysis` is available.

**Files to modify:**

- `src/services/reflexive_agent.ts` (extend `run()` signature; enhance critique prompt; add `requirementsFulfillment` to `CritiqueSchema`)

**Architecture notes:**

- Add optional `requestAnalysis?: IRequestAnalysis` as a **third parameter to `run()`** — `run(blueprint, request, requestAnalysis?)` (Gap 6). Do **not** add it to `IReflexiveAgentConfig` or `this.config`: a single `ReflexiveAgent` instance is reused across many requests; baking per-request data into the constructor would either require a new instance per request (resetting `CircuitBreaker` counters) or leak stale analysis from a prior request.
- When `requestAnalysis` is provided, build an enhanced critique prompt that includes:

  ```text
  ## Specific Requirements to Verify
  {goals_list — each goal with [E]xplicit/[I]nferred marker}

  ## Acceptance Criteria
  {criteria_list}

  For each requirement, state: ✅ MET / ⚠️ PARTIAL / ❌ MISSING
  ```

- When analysis is **not** provided, existing generic prompt works unchanged (non-breaking)
- Add optional `requirementsFulfillment: IRequirementFulfillment[]` field to `CritiqueSchema` using the shared type defined in Step 2 (Gap 10). The LLM populates this array only when the enhanced prompt is used.

**Success criteria:**

- [ ] `run()` accepts optional third parameter `requestAnalysis?: IRequestAnalysis`
- [ ] `requestAnalysis` is **not** stored in `this.config` (Gap 6)
- [ ] Enhanced prompt includes structured goals and acceptance criteria when analysis provided
- [ ] Goals listed with `[E]`/`[I]` explicit/inferred markers
- [ ] `CritiqueSchema` includes optional `requirementsFulfillment: IRequirementFulfillment[]` (type from Step 2)
- [ ] Generic critique works without `requestAnalysis` (backward compatible)

**Planned tests** (`tests/services/reflexive*agent*criteria_test.ts`):

- `[ReflexiveAgent] includes goals in critique when analysis available`
- `[ReflexiveAgent] includes acceptance criteria in critique prompt`
- `[ReflexiveAgent] critique output includes requirementsFulfillment`
- `[ReflexiveAgent] generic critique works without analysis`
- `[ReflexiveAgent] goals show explicit/inferred markers`

---

### Step 9: Enhance `ConfidenceScorer` with Goal Alignment

**What:** Add goal alignment as a factor in the confidence score calculation by extending `assess()` to accept an optional `ICritique` from a prior `ReflexiveAgent` run.

**Files to modify:**

- `src/services/confidence_scorer.ts` (extend `assess()` signature; add goal alignment factor)

**Architecture notes:**

- Extend `assess()` to accept an optional fourth parameter: `assess(request, response, traceId?, critique?)` (Gap 5 — this is the explicit data-path from `ReflexiveAgent` to `ConfidenceScorer`; the caller that runs both services passes the critique result in)
- When `critique?.requirementsFulfillment` is present and non-empty:
  - `metCount` = items with `status === "MET"` + `0.5 * items with status === "PARTIAL"`
  - `goalAlignmentScore` = `metCount / totalCount` (clamped 0–1)
  - Final score = `(rawScore * EXISTING_SCORE_CONFIDENCE_WEIGHT) + (goalAlignmentScore * GOAL_ALIGNMENT_CONFIDENCE_WEIGHT)` (defaults 0.7 / 0.3 from Step 3 constants)
- When `critique` is absent or `requirementsFulfillment` is absent/empty, `goalAlignmentScore` defaults to **1.0** — absence of fulfillment data must not penalise pre-Phase-48 flows (Gap 13)
- All weight constants reference Step 3 constants — no magic numbers (Gap 16)
- Weights configurable via `IConfidenceScorerConfig` new optional fields `goalAlignmentWeight` / `existingScoreWeight`

**Success criteria:**

- [ ] `assess()` accepts optional `critique?: ICritique` parameter
- [ ] `goalAlignmentScore` derived from `requirementsFulfillment` MET/PARTIAL ratios
- [ ] Absence of `critique` produces `goalAlignmentScore = 1.0` (no penalty for pre-Phase-48 callers)
- [ ] Goal alignment factored into confidence when critique with fulfillment data is present
- [ ] `assess()` called without `critique` produces **numerically identical scores** to the pre-Phase-48 formula (Gap 13 — verified against a fixture input/output pair)
- [ ] Weights configurable; defaults 0.7 / 0.3 from constants
- [ ] No magic number literals (Gap 16)

**Planned tests** (`tests/services/confidence*scorer*alignment_test.ts`):

- `[ConfidenceScorer] includes goal alignment factor when critique with fulfillment available`
- `[ConfidenceScorer] higher goalAlignmentScore increases confidence`
- `[ConfidenceScorer] zero goalAlignmentScore decreases confidence`
- `[ConfidenceScorer] absent critique produces goalAlignmentScore of 1.0 (no penalty)` (Gap 13)
- `[ConfidenceScorer] numeric regression: assess without critique matches pre-Phase-48 formula` (Gap 13)
- `[ConfidenceScorer] respects configurable weight split`

---

### Step 10: Propagate `IRequestAnalysis` Through Plan Metadata to `FlowRunner`

**What:** Verify that `IRequestAnalysis` is correctly written to plan frontmatter by `PlanWriter`, and ensure the analysis is forwarded from plan frontmatter into the `FlowRunner.execute()` input when a flow-based plan step runs.

**Files to modify:**

- `src/services/plan_writer.ts` (verify `request_analysis` is written — may be a no-op if Phase 45 already writes it)
- `src/flows/flow_runner.ts` (load `request_analysis` from `PlanFrontmatter` and pass to `FlowRunner.execute()` input)

**Architecture notes:**

- **Scope correction from original plan** (Gaps 4, 8): `ExecutionLoop` → `PlanExecutor` is the ReAct-loop path and uses no `GateEvaluator` or `ReflexiveAgent`. The correct target is `FlowRunner`, which is the execution path in which gate steps and reflexive critique occur.
- **Part A — PlanWriter:** `plan_writer.ts` line 279 already writes `request_analysis: ${JSON.stringify(metadata.requestAnalysis)}` when `metadata.requestAnalysis` is set. Verify this is populated in all call sites where an `IRequestAnalysis` has been produced; add it to any that omit it. This sub-task may be a no-op.
- **Part B — FlowRunner propagation:** When the execution path calls `flowRunner.execute(flow, { userPrompt, ... })`, it must now also pass `requestAnalysis` extracted from `PlanFrontmatterSchema`-parsed frontmatter (field `request_analysis`, already parsed by `PlanFrontmatterSchema`). The forwarding implemented in Step 6 carries this value to gate steps and agent steps.
- If plan frontmatter has no `request_analysis` field (plans written before Phase 45), `PlanFrontmatterSchema.request_analysis` returns `undefined`; evaluators fall back to generic criteria gracefully.

**Success criteria:**

- [ ] `PlanWriter` writes `request_analysis` to frontmatter whenever `metadata.requestAnalysis` is provided
- [ ] `FlowRunner.execute()` receives `requestAnalysis` when executing a flow that has associated analysis in its plan frontmatter
- [ ] Plans without `request_analysis` frontmatter field execute normally with generic criteria (Gap 14)
- [ ] No `TypeError` from missing `?.` operator when executing old plans

**Planned tests** (`tests/flows/flow*runner*analysis_propagation_test.ts`):

- `[FlowRunner] receives requestAnalysis from plan frontmatter on execution`
- `[FlowRunner] executes normally when plan has no request_analysis field`
- `[FlowRunner/GateEvaluator] handles flow request without requestAnalysis, uses static criteria only` (Gap 14)

---

### Step 11: Extend Flow-Level Gate Integration

**What:** Add flow-level `includeRequestCriteria` default to `FlowSchema.settings` so it applies to all gate steps unless overridden at the step level.

**Files to modify:**

- `src/shared/schemas/flow.ts` (add `includeRequestCriteria` to `FlowSchema.settings`)

**Architecture notes:**

- Add `includeRequestCriteria: z.boolean().default(false)` to the `settings` object in `FlowSchema`
- `FlowRunner` (Step 6) resolves effective flag: `step.evaluate.includeRequestCriteria ?? flow.settings.includeRequestCriteria ?? false`
- Step-level `GateEvaluateSchema.includeRequestCriteria` overrides flow-level default
- Existing flows without the setting validate unchanged

**Success criteria:**

- [ ] `FlowSchema.settings.includeRequestCriteria` field added; defaults to `false`
- [ ] Flow-level default applies to all gate steps that do not set the flag themselves
- [ ] Step-level `includeRequestCriteria` overrides flow-level
- [ ] Existing flows without the setting validate unchanged

**Planned tests** (`tests/flows/flow*gate*criteria_test.ts`):

- `[FlowRunner] applies flow-level includeRequestCriteria to gate steps`
- `[FlowRunner] step-level overrides flow-level setting`
- `[FlowRunner] existing flows work without includeRequestCriteria`

---

### Step 12: End-to-End Integration Test

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
- `[E2E] pre-Phase-45 plan without requestAnalysis falls back to generic-only criteria` (Gap 14)

---

### Step 13: Update `ARCHITECTURE.md`

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

**Success criteria:**

- [ ] Dynamic criteria flow documented with diagram
- [ ] New criteria listed in criteria table
- [ ] Gate architecture updated with dynamic criteria
- [ ] ReflexiveAgent and ConfidenceScorer enhancements documented

**Planned tests:** None (documentation-only).

---

### Step 14: Update User-Facing and Agent Documentation

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
Step  1: New built-in criteria + CRITERION_SETS    ← foundation, no deps
Step  2: Shared types + interface                  ← depends on Step 1 (EvaluationCriterion type)
Step  3: Constants (with sanitize pattern)         ← parallel with Steps 1–2
Step  4: CriteriaGenerator service                 ← depends on Steps 1, 2, 3
Step  5: Extend BOTH gate schemas                  ← depends on Step 1
Step  6: FlowRunner gate dispatch + forwarding     ← depends on Steps 4, 5 (Gap 1 fix; unblocks Steps 7, 10)
Step  7: GateEvaluator dynamic criteria            ← depends on Steps 4, 5, 6
Step  8: ReflexiveAgent run() enhancement          ← depends on Phase 45 + Step 2
Step  9: ConfidenceScorer assess() extension       ← depends on Steps 2, 8
Step 10: Plan metadata propagation (FlowRunner)    ← depends on Step 6
Step 11: Flow-level schema settings                ← depends on Steps 5, 6
Step 12: E2E test                                  ← depends on all above
Step 13: ARCHITECTURE.md                           ← after implementation stabilizes
Step 14: Docs + .copilot/                         ← after Step 13
```

**Parallel waves:**

| Wave | Steps | Description |
| ------ | ------- | ------------- |
| 1 | 1, 2, 3 | Foundation: criteria (to CRITERION_SETS), shared types, constants |
| 2 | 4, 5, 6 | Generator service + both gate schemas + FlowRunner gate dispatch (Step 6 depends on Steps 4 and 5; Steps 4 and 5 can be parallel) |
| 3 | 7, 8, 9 | Evaluator enhancements — all depend on Wave 2 completion; can run in parallel with each other |
| 4 | 10, 11 | Plan metadata propagation + flow-level schema default (both depend on Step 6) |
| 5 | 12 | E2E validation |
| 6 | 13, 14 | Documentation (after implementation stabilizes) |

> **Note:** Within Wave 2, Step 6 must follow Steps 4 and 5 (it converts `IGateEvaluate`→`GateConfig` and injects `CriteriaGenerator`). Steps 4 and 5 are fully parallel with each other.

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

---

## Gap Analysis

> Performed against source code prior to any Phase 48 implementation.
> **5 critical · 5 feasibility · 4 testing · 3 conceptual**

---

### Gap 1: `FlowRunner` never branches on gate step type — `GateEvaluator` is never called from a flow

**Severity:** 🔴 Critical
**Affects steps:** 5, 9
**Description:** `FlowRunner.executeStep()` handles every step via a single code path: `await this.agentExecutor.run(step.agent, stepRequest)`. There is no `case FlowStepType.GATE:` branch. The `step.evaluate` config field and `GateConfig` are parsed into the schema but are never read at runtime. `GateEvaluator` is not imported by `FlowRunner`. The `IFlowStepRequest.requestAnalysis` field is also never populated by `prepareStepRequest()` — the function returns `{ userPrompt, context:{}, traceId, requestId, skills }` with no analysis.
**Impact if unaddressed:** Steps 5 and 9 add `includeRequestCriteria` to `GateEvaluator` methods that are never invoked during flow execution. The entire dynamic-criteria feature delivers zero value in the flow path.
**Fix:** Step 9 must be split into two sub-tasks: (a) add the missing gate-type dispatch in `FlowRunner.executeStep()` that calls `GateEvaluator.evaluate()` using `step.evaluate` config; (b) propagate `requestAnalysis` from `FlowRunner.execute()` through `executeWaves` → `executeWave` → `executeStep` → `prepareStepRequest` → `IFlowStepRequest`. Both sub-tasks are prerequisites to Steps 5 and 9.

---

### Gap 2: Two divergent gate configuration schemas — Step 4 amends only one

**Severity:** 🔴 Critical
**Affects steps:** 4, 5, 9
**Description:** There are two independent gate-config schemas that are never reconciled:

- `GateEvaluateSchema` in `src/shared/schemas/flow.ts` — used when a YAML flow file is validated; `criteria: z.array(z.string())` (strings only; no inline objects).
- `GateConfigSchema` in `src/flows/gate_evaluator.ts` — used programmatically by `GateEvaluator`; `criteria: z.array(z.union([z.string(), EvaluationCriterionSchema]))`.

Step 4 targets "`src/shared/schemas/flow.ts` or `src/flows/gate_evaluator.ts`" but treats them as a single thing. If `includeRequestCriteria: z.boolean().default(false)` is added only to `GateConfigSchema`, any YAML flow file that sets `includeRequestCriteria: true` will be **rejected at load time** by `GateEvaluateSchema`. Conversely, if added only to `GateEvaluateSchema`, the evaluator never sees it.
**Impact if unaddressed:** Either the YAML flow author cannot use the new field, or the evaluator never sees it. The two schemas diverge permanently.
**Fix:** Step 4 must explicitly amend **both** schemas and add a conversion step inside `FlowRunner` (once Gap 1 is fixed) that maps `IGateEvaluate` (from YAML) to `GateConfig` (for `GateEvaluator`), copying `includeRequestCriteria` across.

---

### Gap 3: New criterion *sets* placed inside `CRITERIA` breaks the constant's TypeScript type

**Severity:** 🔴 Critical
**Affects steps:** 1
**Description:** The plan adds `GOAL_ALIGNED_REVIEW` and `FULL_QUALITY_GATE` to the `CRITERIA` constant. All existing group sets (`CODE_REVIEW`, `CODE_REVIEW_FULL`, `SECURITY_REVIEW`, etc.) live in `CRITERION_SETS` in `evaluation_criteria.ts`. The `CRITERIA` constant is typed `as const` as an object of single `EvaluationCriterion` records. Inserting arrays into `CRITERIA` breaks the `as const` inference. Furthermore, `getCriteriaByNames()` calls `criteria.push(criterion)` for each entry found — pushing an array instead of a single criterion produces a corrupt criteria list silently.
**Impact if unaddressed:** TypeScript compile errors in every file that refers to `CRITERIA`; or, if the type widens to accept arrays, `resolveCriteria()` in `GateEvaluator` pushes arrays-as-items into the criteria list and the judge receives malformed input.
**Fix:** `GOAL_ALIGNED_REVIEW` and `FULL_QUALITY_GATE` must be added to `CRITERION_SETS`, not to `CRITERIA`. Update Step 1's success criteria and test names accordingly.

---

### Gap 4: Plan execution path (`ExecutionLoop` → `PlanExecutor`) does not use `GateEvaluator` or `ReflexiveAgent`

**Severity:** 🔴 Critical
**Affects steps:** 8
**Description:** Step 8 targets "ensure `IRequestAnalysis` is accessible to `GateEvaluator` / `ReflexiveAgent` during execution." The plan execution path is `ExecutionLoop.executeCore()` → `preparePlanExecution()` → `PlanExecutor.execute()` (ReAct loop with `ToolRegistry`). `PlanExecutor` uses no `GateEvaluator`, no `ReflexiveAgent`, and no `ConfidenceScorer`. These services are only reachable via `FlowRunner` (a parallel code path for flow-based tasks). The planned test file `tests/services/execution/criteria_propagation_test.ts` targets `ExecutionLoop` — the wrong component.
**Impact if unaddressed:** Step 8's success criteria ("GateEvaluator receives requestAnalysis from plan metadata during execution") can never be satisfied through `ExecutionLoop`/`PlanExecutor`, causing incorrect wiring or dead code.
**Fix:** Step 8 must be split: (a) verify/fix that `PlanWriter` correctly writes `request_analysis` to plan frontmatter (may already work — see `plan_writer.ts` line 279); (b) implement the `FlowRunner` propagation of analysis from `IFlowRunner.execute()` input to gate and agent steps (overlaps with Gap 1). The integration test for Step 8 must target `FlowRunner`, not `ExecutionLoop`.

---

### Gap 5: `ConfidenceScorer` has no data path to receive `requirementsFulfillment` from `ReflexiveAgent`

**Severity:** 🔴 Critical
**Affects steps:** 6, 7
**Description:** Step 7 states: "If reflexive agent critique includes `requirementsFulfillment`, calculate `goalAlignmentScore` = `metCount / totalCount`." However, `ConfidenceScorer.assess(request, response, traceId?)` takes plain strings only. `ReflexiveAgent.run()` returns `IReflexiveExecutionResult` which includes `finalCritique: ICritique | null`. The `CritiqueSchema` does not currently have a `requirementsFulfillment` field, and even after Step 6 adds it, `ConfidenceScorer` still receives only `(request: string, response: string)`. The caller that bridges both is unidentified in the plan.
**Impact if unaddressed:** The `goalAlignmentScore` computation in Step 7 has no input, making the 0.7/0.3 blended formula impossible to execute.
**Fix:** Step 7 must define the data-flow mechanism explicitly. Options: (a) add an overload `assess(request, response, critique?: ICritique, traceId?)` to `ConfidenceScorer`; (b) pass `requirementsFulfillment` as a pre-computed array; (c) merge scoring into a higher-level orchestrator that holds both results. Whichever is chosen must be specified before Step 7 implementation begins.

---

### Gap 6: `ReflexiveAgent` config is set at construction time; per-request `requestAnalysis` requires new instance or setter

**Severity:** 🟡 Feasibility
**Affects steps:** 6
**Description:** Step 6 proposes adding `requestAnalysis?: IRequestAnalysis` to `IReflexiveAgentConfig`. `ReflexiveAgent`'s constructor stores config at construction time and uses it throughout `run()`. The `critiquePromptTemplate` is baked in at construction. A single `ReflexiveAgent` instance is typically reused across multiple requests. Adding request-specific data to the constructor config means either: (a) a new instance per request (expensive — resets `CircuitBreaker` counters), or (b) extending the `run()` signature (breaking change to `IAgentRunner`).
**Impact if unaddressed:** Shipped with option (a), circuit breaker fault-tolerance degrades silently. Shipped partially, analysis from a prior request leaks into the current one.
**Fix:** Step 6 should extend `ReflexiveAgent.run()` to accept an optional `requestAnalysis?: IRequestAnalysis` as a third parameter (after `blueprint` and `request`). The critique-prompt building reads this parameter at call time, not from `this.config`.

---

### Gap 7: `sanitizeName()` helper is referenced but not defined anywhere in the codebase

**Severity:** 🟡 Feasibility
**Affects steps:** 3
**Description:** The `CriteriaGenerator.fromAnalysis()` pseudocode uses `sanitizeName(goal.description)` and `sanitizeName(ac)`. No `sanitizeName` function exists in the codebase. The Step 3 architecture notes describe the rules but don't specify where the function lives. Step 10 mentions `CRITERION_NAME_MAX_LENGTH = 50` and `CRITERION_NAME_SANITIZE_PATTERN` as constants but leaves the regex value unspecified.
**Impact if unaddressed:** The implementer invents a sanitizer that may produce names breaking the `getCriteriaByNames()` uppercase lookup or containing characters that invalidate Zod's `z.string()` criterion name field.
**Fix:** Step 10 must specify the regex value (e.g., `/[^a-z0-9_]/g`). Step 3 must state `sanitizeName` is a private method implementing: `s.toLowerCase().replace(pattern, '_').slice(0, MAX_LENGTH)`. Add to Step 3's success criteria: `sanitizeName('Add unit tests for auth module')` → `'add_unit_tests_for_auth_module'`.

---

### Gap 8: Cap-at-10 merge algorithm is unspecified — no sort order, similarity metric, or weight inheritance rule

**Severity:** 🟡 Feasibility
**Affects steps:** 3
**Description:** Step 3 states "Cap total generated criteria at 10 (merge similar with higher weight)" but defines no similarity metric, no sort order for truncation, and no rule for merged-weight calculation. A request with 8 goals and 6 acceptance criteria produces 14 dynamic criteria; reducing to 10 requires discarding 4 with no specified algorithm. The deduplication rule in Steps 4/5 handles only exact-name collisions with static criteria — intra-dynamic deduplication is a separate unaddressed problem.
**Impact if unaddressed:** Implementers choose different arbitrary algorithms; tests become brittle and tied to undocumented implementation choices.
**Fix:** Step 3 must specify: (a) sort order before truncation — descending weight, tiebreak by goal priority; (b) no "merge by similarity" in v1 — simply truncate after sort; (c) `MAX_DYNAMIC_CRITERIA = 10` applies to the combined goals + acceptance-criteria list after sorting. Add this as a numbered algorithm to Step 3's architecture notes.

---

### Gap 9: `fromSpecification()` — `IRequestSpecification` availability at evaluation time is unverified

**Severity:** 🟡 Feasibility
**Affects steps:** 2, 3
**Description:** `ICriteriaGeneratorService` defines an optional `fromSpecification(spec: IRequestSpecification): EvaluationCriterion[]` method (Step 2). During flow gate evaluation, only `IRequestAnalysis` (from plan metadata via `PlanFrontmatterSchema.request_analysis`) is confirmed available. There is no `request_specification` field in `PlanFrontmatterSchema` or `IFlowStepRequest`. If the specification is not persisted alongside the plan, `fromSpecification()` would receive `undefined` at runtime.
**Impact if unaddressed:** Either `fromSpecification()` is a permanently dead method, or Step 8's propagation must be expanded to also persist and load `IRequestSpecification`.
**Fix:** Add a note to Step 2 that `fromSpecification()` is aspirational for Phase 48 and requires Phase 47 specification persistence to be wired (out of scope). Alternatively, confirm whether `IRequestSpecification` is accessible at evaluation time and add the field to `PlanFrontmatterSchema`.

---

### Gap 10: `requirementsFulfillment` type is never defined in a shared schema

**Severity:** 🟡 Feasibility
**Affects steps:** 6, 7, 11
**Description:** Steps 6 and 7 both reference `requirementsFulfillment` — Step 6 emits it from `CritiqueSchema`, Step 7 reads it in `ConfidenceScorer`. The plan never defines the type beyond prose "MET/PARTIAL/MISSING for each requirement." If Step 6 implements it as `z.array(z.object({ requirement: z.string(), status: z.enum(["MET","PARTIAL","MISSING"]) }))` and Step 7 reads it expecting `{ metCount: number, totalCount: number }`, the two steps are silently incompatible.
**Impact if unaddressed:** Compile-time type mismatch or silent runtime mismatch. The E2E test (Step 11) catches this only after both steps are already complete.
**Fix:** Step 2 (or a new Wave 1 sub-item) must define `RequirementFulfillmentSchema` and `IRequirementFulfillment` in a shared location (e.g., `src/flows/evaluation_criteria.ts` or `src/shared/schemas/`). Both Step 6 and Step 7 must import it.

---

### Gap 11: Missing boundary tests for `CriteriaGenerator`

**Severity:** 🟠 Testing
**Affects steps:** 3
**Description:** The planned tests include `[CriteriaGenerator] returns empty for analysis without goals` and `[CriteriaGenerator] handles analysis with only inferred goals`. Neither covers: goals non-empty but `acceptanceCriteria` empty; `goals` empty but `acceptanceCriteria` non-empty; total criteria exactly 10 (boundary); or total criteria 11 (triggers cap exactly once).
**Impact if unaddressed:** Off-by-one in the cap logic and incorrect handling of empty arrays on one side are invisible until E2E.
**Fix:** Add three tests: (a) `[CriteriaGenerator] generates from goals only when acceptanceCriteria empty`; (b) `[CriteriaGenerator] generates from acceptanceCriteria only when goals empty`; (c) `[CriteriaGenerator] caps at exactly MAX_DYNAMIC_CRITERIA when input produces 11`.

---

### Gap 12: No failure-mode tests for `GateEvaluator` with stale or malformed analysis

**Severity:** 🟠 Testing
**Affects steps:** 5
**Description:** All 7 planned Step 5 tests cover happy-path or analysis-absent scenarios. None cover: (a) analysis present but both `goals` and `acceptanceCriteria` are empty arrays — combined criteria equals static only, must not throw; (b) `CriteriaGenerator.fromAnalysis()` throws an unexpected exception — `GateEvaluator` must not propagate it to `FlowRunner`.
**Impact if unaddressed:** A corrupt or partial `IRequestAnalysis` embedded in a plan causes an unhandled runtime exception that halts the flow with no useful error message.
**Fix:** Add: `[GateEvaluator] falls back to static criteria when dynamic generation returns empty` and `[GateEvaluator] catches CriteriaGenerator errors and continues with static criteria`.

---

### Gap 13: No numeric regression test for `ConfidenceScorer` without analysis

**Severity:** 🟠 Testing
**Affects steps:** 7
**Description:** Step 7 notes "existing scoring logic unchanged when analysis is not available." The single regression test `[ConfidenceScorer] existing scoring unchanged without analysis` only checks the final score qualitatively. If a future refactor accidentally applies `goalAlignmentScore * 0.3` with a default value of `0` (reducing all scores by 30%), only an explicit numeric assertion would catch it.
**Impact if unaddressed:** Silent regression — scores for all requests without analysis drop by 30% after Phase 48, degrading confidence thresholds for pre-existing flows.
**Fix:** The regression test must assert that `ConfidenceScorer.assess()` without analysis produces numerically identical results to the pre-Phase-48 formula, checked against a known fixture input/output pair.

---

### Gap 14: No test for old-plan (pre-Phase-45) end-to-end graceful handling

**Severity:** 🟠 Testing
**Affects steps:** 8
**Description:** Step 8 success criteria include "Evaluators gracefully handle plans without analysis." The planned integration test targets `ExecutionLoop` (wrong component per Gap 4). More critically, there is no test that reads an actual plan file lacking `request_analysis` frontmatter and exercises the full path to `GateEvaluator` / `ReflexiveAgent`, verifying every new `?.` in the propagation chain is correctly placed.
**Impact if unaddressed:** A missing `?.` at one point causes `TypeError: Cannot read properties of undefined` when executing any plan written before Phase 45.
**Fix:** Add a `FlowRunner`-level integration test: `[FlowRunner/GateEvaluator] handles flow request without requestAnalysis, uses static criteria only`.

---

### Gap 15: Criterion set naming convention — new sets belong in `CRITERION_SETS`, not `CRITERIA`

**Severity:** 🔵 Conceptual
**Affects steps:** 1
**Description:** Every existing criterion group is in `CRITERION_SETS`. The distinction is intentional: `CRITERIA` holds individual `EvaluationCriterion` objects; `CRITERION_SETS` holds `EvaluationCriterion[]` arrays. Phase 49+ agents that enumerate `Object.values(CRITERIA)` to build a catalogue would incorrectly encounter arrays with no type-level warning.
**Impact if unaddressed:** A future phase silently iterates arrays as if they were single criteria, producing malformed judge inputs.
**Fix:** Move `GOAL_ALIGNED_REVIEW` and `FULL_QUALITY_GATE` to `CRITERION_SETS`. Update Step 1 success criteria to reference `CRITERION_SETS.GOAL_ALIGNED_REVIEW`.

---

### Gap 16: Step 10 (constants) is Wave 1 but its dependent steps don't enforce the dependency in success criteria

**Severity:** 🔵 Conceptual
**Affects steps:** 3, 7, 10
**Description:** The wave table correctly places Step 10 in Wave 1 before Steps 3 and 7 in later waves. However, the plan's design-section pseudocode uses hardcoded `2.0`, `1.5`, `0.3`, `0.7`, `10` throughout. Implementers copying from the pseudocode will embed literals in Steps 3 and 7 without realising Step 10 must be completed first.
**Impact if unaddressed:** Constants file exists but is unused; magic numbers in two service files fail automated lint checks.
**Fix:** Add to Step 3's and Step 7's success criteria: `[ ] No magic number literals for weights or limits — all reference Step 10 constants`.

---

### Gap 17: `IFlowRunner.execute()` analysis-contract is undocumented for future callers

**Severity:** 🔵 Conceptual
**Affects steps:** 9
**Description:** `IFlowRunner.execute()` already accepts `requestAnalysis?: IRequestAnalysis` in its input object. There is no JSDoc or log warning that explains: "populating `requestAnalysis` enables dynamic criteria generation when `includeRequestCriteria` is set." Phase 49+ code adding a new flow trigger will omit this field without any signal that goal-aligned evaluation is silently disabled.
**Impact if unaddressed:** Future phases silently disable the Phase 48 feature with no error or warning.
**Fix:** Step 9 should add a JSDoc comment to `IFlowRunner.execute()` documenting the contract. Also add a `logDebug` warn-level log in `GateEvaluator` when `includeRequestCriteria` is `true` but no analysis is available.

---

## Gap Analysis Summary

### Pre-Implementation Blockers (must fix before Wave 1 code lands)

| Gap | Cluster | Severity |
| --- | --- | --- |
| 1: `FlowRunner` never calls `GateEvaluator` | Execution Path | 🔴 Critical |
| 2: Two divergent gate config schemas | Schema Contract | 🔴 Critical |
| 3: Criterion sets placed in wrong constant | Type Safety | 🔴 Critical |
| 4: `ExecutionLoop`/`PlanExecutor` wires wrong components in Step 8 | Execution Path | 🔴 Critical |
| 5: No data path from `ReflexiveAgent` to `ConfidenceScorer` | Data Flow | 🔴 Critical |
| 10: `requirementsFulfillment` type undefined | Schema Contract | 🟡 Feasibility |

### Design Decisions (resolve before Wave 2/3)

| Gap | Cluster | Severity |
| --- | --- | --- |
| 6: `ReflexiveAgent` per-request injection pattern | API Design | 🟡 Feasibility |
| 7: `sanitizeName()` undefined | Implementation Detail | 🟡 Feasibility |
| 8: Cap algorithm unspecified | Algorithm | 🟡 Feasibility |
| 9: `fromSpecification()` input availability | Scope | 🟡 Feasibility |

### Test Coverage (add before step implementations ship)

| Gap | Cluster | Severity |
| --- | --- | --- |
| 11: Missing boundary tests for `CriteriaGenerator` | Testing | 🟠 Testing |
| 12: No failure-mode tests for `GateEvaluator` + bad analysis | Testing | 🟠 Testing |
| 13: `ConfidenceScorer` numeric regression test missing | Testing | 🟠 Testing |
| 14: No old-plan E2E test | Testing | 🟠 Testing |

### Protocol (document before Phase 49 handoff)

| Gap | Cluster | Severity |
| --- | --- | --- |
| 15: Criterion-set naming convention | Convention | 🔵 Conceptual |
| 16: Constants dependency not enforced in success criteria | Convention | 🔵 Conceptual |
| 17: `IFlowRunner.execute()` contract undocumented | Contract | 🔵 Conceptual |

### Recommended Actions (ordered by blocking priority)

1. Fix `FlowRunner` gate-type dispatch and `requestAnalysis` forwarding chain (Gaps 1, 4)
2. Define `RequirementFulfillmentSchema` in a shared location before Wave 1 ends (Gap 10)
3. Reconcile `GateEvaluateSchema` ↔ `GateConfigSchema` — add conversion in `FlowRunner` (Gap 2)
4. Move new criterion sets to `CRITERION_SETS` (Gap 3)
5. Decide `ConfidenceScorer.assess()` signature extension for critique input (Gap 5)
6. Change Step 6 to inject `requestAnalysis` as `run()` parameter, not constructor config (Gap 6)
7. Specify `sanitizeName` implementation and cap-at-10 sort algorithm in Step 3 (Gaps 7, 8)
8. Add four missing test cases to Steps 3, 5, 7, 8 success criteria (Gaps 11–14)
9. Document the `IFlowRunner.execute()` analysis contract and criterion-set convention (Gaps 15–17)
