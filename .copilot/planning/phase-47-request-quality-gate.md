# Phase 47: Request Quality Gate & Clarification Protocol

## Status: PLANNING

Introduce a pre-execution quality gate that assesses whether incoming requests are well-specified enough to produce good results, with a protocol for requesting clarification or auto-enriching underspecified requests.

## Executive Summary

**Problem:**
Every request — regardless of quality — enters the same execution pipeline. A one-liner like *"make it work better"* is processed identically to a detailed specification with acceptance criteria, constraints, and context. The system has no mechanism to:

1. **Assess request quality** — Is this request actionable? Is it specific enough?

1.
1.

The existing `RequestEnricher` in `src/cli/helpers/request_enricher.ts` only enriches **metadata** (agent name, portal, priority from database records). It does not analyze or improve the request body itself.

**Solution:**
Add a `RequestQualityGate` service that scores incoming requests, optionally enriches underspecified ones via LLM, and supports a clarification-needed status for requests that require human input.

---

## Current State Analysis

### No Content-Level Request Validation

The `RequestParser` validates:

- ✅ File exists
- ✅ YAML frontmatter is well-formed
- ✅ `trace_id` is present
- ❌ Request body quality (not checked)
- ❌ Request body specificity (not checked)
- ❌ Request body actionability (not checked)

### No Clarification Mechanism

The `RequestStatus` enum in `src/shared/status/request_status.ts` has these states:

```text
PENDING → PLANNED → COMPLETED
                 → FAILED
                 → CANCELLED
```text

There is no `NEEDS_CLARIFICATION` or `ENRICHING` status. Once a request is `PENDING`, it will be processed regardless of quality.

### Request Enricher Is Metadata-Only

```typescript
// src/cli/helpers/request_enricher.ts
export async function enrichWithRequest<T extends IRequestEnrichable>(
  requestCommands: RequestCommands,
  metadata: T,
  idPlaceholder = "unknown",
): Promise<T> {
  // ... looks up request from DB, populates metadata fields:
  // request_subject, request_agent, request_portal, request_priority, etc.
  // DOES NOT touch request body content
}
```text

### PlanValidation Retry Is Reactive, Not Proactive

`RequestProcessor.processAgentRequest()` has a retry loop for `PlanValidationError`:

```typescript
while (attempts <= maxRetries) {
  try {
    return await this.writePlanAndReturnPath(result, metadata, filePath, traceLogger);
  } catch (error) {
    if (error instanceof PlanValidationError && attempts < maxRetries) {
      // re-prompt the agent with error feedback
    }
  }
}
```text

This catches **output** format issues but doesn't prevent wasted LLM calls on requests that were never going to produce good results.

---

## Goals

- [ ] Define `IRequestQualityAssessment` schema with quality score, issue categories, and enrichment suggestions.
- [ ] Implement `RequestQualityGate` service with heuristic and LLM-based assessment modes.
- [ ] Add `NEEDS_CLARIFICATION`, `REFINING`, and `ENRICHING` to `RequestStatus`.
- [ ] Implement request auto-enrichment via LLM for underspecified requests.
- [ ] Define `IClarificationSession`, `IClarificationRound`, `IClarificationQuestion`, and `IRequestSpecification` schemas.
- [ ] Implement iterative Q&A loop with planning agent (multi-turn conversation until both sides are satisfied).
- [ ] Ensure original request body is always preserved; refined body stored as structured `IRequestSpecification`.
- [ ] Implement session persistence as `_clarification.json` alongside request files.
- [ ] Integrate quality gate and Q&A loop into `RequestProcessor` pipeline before agent execution.
- [ ] Add CLI support: `exoctl request clarify <id>` with `--interactive`, `--answer`, `--proceed`, `--cancel` flags.
- [ ] Add TUI integration for inline Q&A display and quality score progression.
- [ ] Write tests for quality assessment, enrichment, Q&A loop rounds, and session persistence.

---

## Detailed Design

### 1. `IRequestQualityAssessment` Schema

```typescript
export interface IRequestQualityIssue {
  type: "vague" | "ambiguous" | "missing_context" | "conflicting" | "too_broad" | "no_acceptance_criteria";
  description: string;
  severity: "blocker" | "major" | "minor";
  suggestion: string;
}

export interface IRequestQualityAssessment {
  /** Overall quality score (0–100) */
  score: number;
  /** Quality level derived from score */
  level: "excellent" | "good" | "acceptable" | "poor" | "unactionable";
  /** Specific issues found */
  issues: IRequestQualityIssue[];
  /** Whether the request should proceed, be enriched, or need clarification */
  recommendation: "proceed" | "auto-enrich" | "needs-clarification" | "reject";
  /** If auto-enrich is recommended, the enriched version */
  enrichedBody?: string;
  /** Assessment metadata */
  metadata: {
    assessedAt: string;
    mode: "heuristic" | "llm";
    durationMs: number;
  };
}
```text

### 2. `RequestQualityGate` Service

```typescript
export interface IRequestQualityGateConfig {
  /** Whether quality gate is enabled */
  enabled: boolean;
  /** Assessment mode */
  mode: "heuristic" | "llm" | "hybrid";
  /** Score thresholds */
  thresholds: {
    /** Below this: needs clarification or reject */
    minimum: number;    // default: 20
    /** Below this: auto-enrich */
    enrichment: number; // default: 50
    /** Above this: proceed without intervention */
    proceed: number;    // default: 70
  };
  /** Whether to auto-enrich underspecified requests */
  autoEnrich: boolean;
  /** Whether to block unactionable requests */
  blockUnactionable: boolean;
}
```text

#### Heuristic Quality Signals

| Signal | Score Impact | Detection |
| -------- | ------------- | ----------- |
| Body < 20 characters | -40 | Length check |
| No action verbs (implement, fix, add, create, update, refactor, test) | -20 | Keyword scan |
| Contains only questions (no directives) | -15 | Sentence-type detection |
| No specific nouns (file names, feature names, component names) | -15 | NER-like heuristics |
| References specific files or code | +15 | Path/extension regex |
| Contains acceptance criteria keywords (should, must, expect, given-when-then) | +20 | Keyword scan |
| Multiple distinct requirements (numbered list, bullet points) | +15 | Structure detection |
| Contains technical specifics (API names, libraries, protocols) | +10 | Keyword scan |
| Has context section or background | +10 | Header detection |

### 3. New Request Statuses

Add to `RequestStatus`:

```typescript
export enum RequestStatus {
  PENDING = "pending",
  NEEDS_CLARIFICATION = "needs-clarification",  // NEW
  ENRICHING = "enriching",                        // NEW
  PLANNED = "planned",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}
```text

### 4. Request Enrichment via LLM

When quality score is between `minimum` and `enrichment` thresholds and `autoEnrich` is enabled:

```text
You are improving a task request to make it more actionable for an AI agent.

## Original Request
{body}

## Issues Found
{issues_list}

## Your Task
Rewrite this request to be:

1. Specific: Include concrete requirements, not vague wishes

1.
1.
1.

Preserve the original intent. Do not add requirements the user didn't imply.
Output ONLY the improved request body (no explanation).
```text

The enriched body replaces the original in `IParsedRequest.userPrompt`. The original body is preserved in metadata for audit.

### 5. Interactive Clarification Q&A Loop

The clarification protocol is not a single-shot "ask and wait" — it is an **iterative multi-turn conversation** between a planning agent and the user, repeated until both sides are satisfied with the refined request.

#### Design Principles

- **Original request is always preserved** — the original body is never overwritten; the refined version is stored alongside it.
- **Structured output** — the refined request body has explicit sections (Goals, Success Criteria, Scope, Constraints, Context) rather than free-form prose.
- **Both sides must agree** — the loop continues until the planning agent determines the request is well-specified AND the user confirms satisfaction (or explicitly says "proceed").
- **Configurable maximum rounds** — prevent infinite loops with a `maxClarificationRounds` setting (default: 5).

#### New Request Status: `REFINING`

Add `REFINING` in addition to `NEEDS_CLARIFICATION`:

```typescript
export enum RequestStatus {
  PENDING = "pending",
  NEEDS_CLARIFICATION = "needs-clarification",  // Awaiting user response
  REFINING = "refining",                          // In active Q&A loop
  ENRICHING = "enriching",                        // Auto-enrichment in progress
  PLANNED = "planned",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}
```text

#### Clarification Session Model

```typescript
export interface IClarificationRound {
  /** Round number (1-based) */
  round: number;
  /** Questions asked by the planning agent */
  questions: IClarificationQuestion[];
  /** User's answers (populated when user responds) */
  answers?: Record<string, string>;
  /** Timestamp when questions were generated */
  askedAt: string;
  /** Timestamp when user responded */
  answeredAt?: string;
}

export interface IClarificationQuestion {
  /** Unique question ID within this round */
  id: string;
  /** The question text */
  question: string;
  /** Why this question matters */
  rationale: string;
  /** Category of information being sought */
  category: "goal" | "scope" | "constraint" | "acceptance" | "context" | "priority";
  /** Whether answering this question is mandatory or optional */
  required: boolean;
}

export interface IClarificationSession {
  /** Request ID being refined */
  requestId: string;
  /** Original unmodified request body */
  originalBody: string;
  /** Current refined body (updated after each round) */
  refinedBody?: IRequestSpecification;
  /** All Q&A rounds */
  rounds: IClarificationRound[];
  /** Current status */
  status: "active" | "user-confirmed" | "agent-satisfied" | "max-rounds" | "user-cancelled";
  /** Quality assessment at each round (tracks improvement) */
  qualityHistory: Array<{ round: number; score: number; level: string }>;
}
```text

#### Request Specification Structure

When the planning agent compiles user answers into a refined request, it produces a structured **Request Specification** — the contract that drives execution and evaluation. This aligns with the **Specification-Driven Development (SDD)** methodology (see `.copilot/process/specification-driven-development.md`).

```typescript
export interface IRequestSpecification {
  /** Concise summary of what the user wants */
  summary: string;
  /** Explicit goals extracted from the conversation */
  goals: string[];
  /** Measurable success criteria */
  successCriteria: string[];
  /** What's in scope and what's explicitly out */
  scope: { includes: string[]; excludes: string[] };
  /** Technical or process constraints */
  constraints: string[];
  /** Additional context that aids execution */
  context: string[];
  /** Original body for reference */
  originalBody: string;
}
```text

#### Q&A Loop Flow

```text
Request File (.md)
  → RequestParser.parse()
  → RequestQualityGate.assess()
  → [if score < minimum AND clarification enabled]:
      1. Set status = REFINING
      1.
      1.
      1.
      1.
      1.
         a. Incorporates answers into refined body
         b. Re-assesses quality of the refined request
         c. If quality >= threshold OR user says "proceed" → finalize
         d. If quality < threshold AND rounds < max → generate next round questions
         e. If rounds >= max → finalize with warning, proceed with best effort
      1.
         - Store IRequestSpecification in request metadata
         - Set status = PENDING (re-enters normal pipeline)
         - Log clarification session to Activity Journal
  → [if auto-enrich] → enrich body, log original
  → [if proceed] → continue normally
  → RequestAnalyzer.analyze()          (Phase 45)
  → buildParsedRequest()
  → AgentRunner.run()
  → PlanWriter.writePlan()
```text

#### Planning Agent Role

The clarification Q&A is driven by a **planning agent** (reusing the `product-manager` blueprint or a dedicated `request-refiner` agent) that:

1. **Analyzes the request** to identify what's missing, vague, or ambiguous

1.
1.

```text
## Planning Agent Prompt (per round)

You are refining a task request through conversation with the user.

## Original Request
{originalBody}

## Previous Rounds
{rounds_history}

## Current Refined Understanding
{current_refined_body}

## Your Task

1. Review the conversation so far

1.
1.
1.

If the request is sufficiently clear, output { "satisfied": true, "refinedBody": ... }
If more clarification is needed, output { "satisfied": false, "questions": [...] }
```text

#### CLI Integration

```bash
# View pending clarification questions
exoctl request clarify <request-id>

# Answer questions interactively
exoctl request clarify <request-id> --interactive

# Answer specific questions
exoctl request clarify <request-id> --answer q1="Use PostgreSQL" --answer q2="Yes, include tests"

# Skip remaining questions and force proceed
exoctl request clarify <request-id> --proceed

# Cancel the refinement and go back to original
exoctl request clarify <request-id> --cancel
```text

#### TUI Integration

In the request detail view, when status is `REFINING` or `NEEDS_CLARIFICATION`:

- Show the current round's questions inline
- Provide input fields for answers
- Show quality score progression across rounds
- Show the evolving `IRequestSpecification` sections

#### Persistence

The clarification session is stored as `_clarification.json` alongside the request file:

```text
Workspace/Requests/
  ├── my-request.md              ← Original request (never modified)
  └── my-request_clarification.json  ← Clarification session state
```text

### 6. Integration into `RequestProcessor`

```text
Request File (.md)
  → RequestParser.parse()
  → **RequestQualityGate.assess()**        ← NEW STEP
  → [if refining] → enter Q&A loop (section 5 above)
  → [if auto-enrich] → enrich body, log original
  → [if proceed] → continue normally
  → RequestAnalyzer.analyze()               (Phase 45)
  → buildParsedRequest()                    (with IRequestSpecification if available)
  → AgentRunner.run()
  → PlanWriter.writePlan()
```text

---

## Step-by-Step Implementation Plan

### Step 1: Define `IRequestQualityAssessment` Zod Schema & Types

**What:** Create the Zod schema and inferred TypeScript types for quality assessment output in `src/shared/schemas/request_quality_assessment.ts`. Register the export in `src/shared/schemas/mod.ts`.

**Files to create/modify:**

- `src/shared/schemas/request_quality_assessment.ts` (NEW)
- `src/shared/schemas/mod.ts` (add export)

**Architecture notes:**

- Follow project schema convention: `XxxSchema` naming, `z.infer<typeof XxxSchema>` for types
- Sub-schemas: `RequestQualityIssueSchema`, `RequestQualityAssessmentSchema`
- Enum values (`type`, `severity`, `level`, `recommendation`) as Zod native enums
- `score` constrained to 0–100, `metadata.assessedAt` as ISO string
- Export both schemas and inferred types (`IRequestQualityAssessment`, `IRequestQualityIssue`)

**Success criteria:**

- [ ] `RequestQualityAssessmentSchema.safeParse(validData)` returns `{ success: true }`
- [ ] `RequestQualityAssessmentSchema.safeParse(invalidData)` returns `{ success: false }`
- [ ] Score constrained to 0–100 range
- [ ] All enum values validated (issue types, severity, level, recommendation)
- [ ] Schema re-exported through `src/shared/schemas/mod.ts` barrel
- [ ] No lint or type errors

**Planned tests** (`tests/shared/schemas/request_quality_assessment_test.ts`):

- `[RequestQualityAssessmentSchema] validates complete valid assessment`
- `[RequestQualityAssessmentSchema] rejects score outside 0-100`
- `[RequestQualityAssessmentSchema] validates all issue type enum values`
- `[RequestQualityAssessmentSchema] validates all severity enum values`
- `[RequestQualityAssessmentSchema] validates all level enum values`
- `[RequestQualityAssessmentSchema] validates all recommendation enum values`
- `[RequestQualityIssueSchema] validates individual issue`
- `[RequestQualityAssessmentSchema] validates metadata fields`

---

### Step 2: Define `IClarificationSession` and `IRequestSpecification` Zod Schemas

**What:** Create Zod schemas for the clarification Q&A loop data model in `src/shared/schemas/clarification_session.ts` and the request specification in `src/shared/schemas/request_specification.ts`. Register exports in barrel.

**Files to create/modify:**

- `src/shared/schemas/clarification_session.ts` (NEW)
- `src/shared/schemas/request_specification.ts` (NEW)
- `src/shared/schemas/mod.ts` (add exports)

**Architecture notes:**

- `ClarificationSessionSchema` includes: `IClarificationRound`, `IClarificationQuestion`, `IClarificationSession`
- `RequestSpecificationSchema` defines the structured output from the Q&A loop: `summary`, `goals[]`, `successCriteria[]`, `scope { includes[], excludes[] }`, `constraints[]`, `context[]`, `originalBody`
- `IClarificationSession.status` enum: `active`, `user-confirmed`, `agent-satisfied`, `max-rounds`, `user-cancelled`
- `IClarificationQuestion.category` enum: `goal`, `scope`, `constraint`, `acceptance`, `context`, `priority`
- Both schemas independent of each other (but session references specification in `refinedBody`)

**Success criteria:**

- [ ] `ClarificationSessionSchema.safeParse(validData)` returns `{ success: true }`
- [ ] `RequestSpecificationSchema.safeParse(validData)` returns `{ success: true }`
- [ ] All sub-schemas parseable independently
- [ ] Session status enum validated
- [ ] Question category enum validated
- [ ] `refinedBody` correctly typed as optional `IRequestSpecification`
- [ ] `qualityHistory` array validated
- [ ] Both schemas re-exported through barrel

**Planned tests** (`tests/shared/schemas/clarification_session_test.ts`, `tests/shared/schemas/request_specification_test.ts`):

- `[ClarificationSessionSchema] validates complete session`
- `[ClarificationSessionSchema] validates session with multiple rounds`
- `[ClarificationSessionSchema] validates all session status values`
- `[ClarificationQuestionSchema] validates all category values`
- `[ClarificationRoundSchema] validates round with and without answers`
- `[RequestSpecificationSchema] validates complete specification`
- `[RequestSpecificationSchema] validates scope includes/excludes`
- `[RequestSpecificationSchema] preserves originalBody`

---

### Step 3: Define `IRequestQualityGateService` Interface

**What:** Create the service interface in `src/shared/interfaces/i_request_quality_gate_service.ts`. Register in interface barrel.

**Files to create/modify:**

- `src/shared/interfaces/i_request_quality_gate_service.ts` (NEW)
- `src/shared/interfaces/mod.ts` (add export)

**Architecture notes:**

- Co-locate `IRequestQualityGateConfig` in the same file
- Methods: `assess(requestText, context?) → Promise<IRequestQualityAssessment>`, `enrich(requestText, issues) → Promise<string>`, `startClarification(requestId, body) → Promise<IClarificationSession>`, `submitAnswers(session, answers) → Promise<IClarificationSession>`, `isSessionComplete(session) → boolean`
- Config: `enabled`, `mode`, `thresholds { minimum, enrichment, proceed }`, `autoEnrich`, `blockUnactionable`, `maxClarificationRounds`

**Success criteria:**

- [ ] Interface exported through barrel
- [ ] Depends only on schema types (no concrete imports)
- [ ] Config structure matches design document
- [ ] TypeScript compiles with `deno check`

**Planned tests:** None (interface-only; validated by type system at compile time).

---

### Step 4: Add Quality Gate Constants

**What:** Add quality gate constants to `src/shared/constants.ts`.

**Files to modify:**

- `src/shared/constants.ts` (add new section)

**Architecture notes:**

- Follow existing sectioned pattern: `// === Request Quality Gate ===`
- Constants: `DEFAULT_QG_MINIMUM_THRESHOLD = 20`, `DEFAULT_QG_ENRICHMENT_THRESHOLD = 50`, `DEFAULT_QG_PROCEED_THRESHOLD = 70`, `DEFAULT_MAX_CLARIFICATION_ROUNDS = 5`, `DEFAULT_QG_MODE = "hybrid"`, action verb list, acceptance criteria keywords, hedging word list, vague pronoun list, body length thresholds
- Heuristic quality signal weights as named constants (not inline numbers)

**Success criteria:**

- [ ] All heuristic signal values/weights referenced from constants
- [ ] Constants grouped under `// === Request Quality Gate ===` header
- [ ] No magic numbers in assessor code

**Planned tests:** None (validated through usage in Step 5/6 tests).

---

### Step 5: Implement Heuristic Quality Assessor

**What:** Create `src/services/quality_gate/heuristic_assessor.ts` — a standalone module implementing zero-cost heuristic quality scoring based on text signals.

**Files to create:**

- `src/services/quality_gate/heuristic_assessor.ts` (NEW)

**Architecture notes:**

- Pure function module: export `assessHeuristic(requestText: string) → IRequestQualityAssessment`
- Zero LLM/network dependencies — sandboxed-safe
- Implements all heuristic quality signals from the design:
  - Body < 20 chars → -40 score
  - No action verbs → -20
  - Only questions → -15
  - No specific nouns → -15
  - References specific files → +15
  - Contains acceptance criteria keywords → +20
  - Multiple distinct requirements → +15
  - Technical specifics → +10
  - Has context section → +10
- Base score starts at 50; clamp to 0–100
- Generates `IRequestQualityIssue` entries for each negative signal
- Maps final score to `level` and `recommendation` based on threshold constants

**Success criteria:**

- [ ] Scores short/vague requests below minimum threshold
- [ ] Scores well-structured requests above proceed threshold
- [ ] Detects all negative signals (short body, no verbs, only questions, no specifics)
- [ ] Detects all positive signals (file refs, acceptance criteria, structure, tech terms)
- [ ] Generates appropriate `IRequestQualityIssue` per negative signal
- [ ] Maps score to correct level and recommendation
- [ ] Zero external dependencies
- [ ] Completes in <5ms

**Planned tests** (`tests/services/quality_gate/heuristic_assessor_test.ts`):

- `[HeuristicAssessor] scores vague one-liner as poor/unactionable`
- `[HeuristicAssessor] scores well-structured request as good/excellent`
- `[HeuristicAssessor] detects short body issue`
- `[HeuristicAssessor] detects missing action verbs`
- `[HeuristicAssessor] detects question-only request`
- `[HeuristicAssessor] positive: file references boost score`
- `[HeuristicAssessor] positive: acceptance criteria keywords boost score`
- `[HeuristicAssessor] positive: structured requirements boost score`
- `[HeuristicAssessor] maps score to correct recommendation`
- `[HeuristicAssessor] handles empty request text`
- `[HeuristicAssessor] score clamped to 0-100 range`

---

### Step 6: Implement LLM Quality Assessor

**What:** Create `src/services/quality_gate/llm_assessor.ts` — a module that uses an LLM to produce a detailed quality assessment.

**Files to create:**

- `src/services/quality_gate/llm_assessor.ts` (NEW)

**Architecture notes:**

- Class `LlmQualityAssessor` with constructor DI: `constructor(provider: IModelProvider, validator: OutputValidator)`
- Prompt template as private constant
- Validates LLM response against `RequestQualityAssessmentSchema`
- Falls back to heuristic assessment on LLM failure
- Only called for borderline scores in hybrid mode

**Success criteria:**

- [ ] Calls `provider.generate()` with quality assessment prompt
- [ ] Validates response against schema
- [ ] Returns full `IRequestQualityAssessment` with detailed issues
- [ ] Falls back gracefully on LLM failure
- [ ] Includes enriched body suggestion when auto-enrich recommended

**Planned tests** (`tests/services/quality_gate/llm_assessor_test.ts`):

- `[LlmQualityAssessor] parses valid LLM response`
- `[LlmQualityAssessor] handles invalid LLM JSON gracefully`
- `[LlmQualityAssessor] passes request text in prompt`
- `[LlmQualityAssessor] uses OutputValidator for parsing`
- `[LlmQualityAssessor] returns fallback on validation failure`

---

### Step 7: Implement Request Enrichment via LLM

**What:** Create `src/services/quality_gate/request_enricher_llm.ts` — a module that rewrites underspecified requests to be more actionable while preserving original intent.

**Files to create:**

- `src/services/quality_gate/request_enricher_llm.ts` (NEW)

**Architecture notes:**

- Export function: `enrichRequest(provider: IModelProvider, body: string, issues: IRequestQualityIssue[]) → Promise<string>`
- Prompt includes original body + issues found + enrichment instructions (specific, structured, bounded, testable, contextual)
- Instruction: "Preserve the original intent. Do not add requirements the user didn't imply."
- Returns enriched body text; original body preserved separately
- Falls back to original body if LLM fails

**Success criteria:**

- [ ] Calls LLM with enrichment prompt containing body + issues
- [ ] Returns enriched body string
- [ ] Original body is not lost (caller responsibility to preserve)
- [ ] Falls back to original body on LLM failure
- [ ] Enrichment adds structure (bullets, sections) without changing intent

**Planned tests** (`tests/services/quality_gate/request_enricher_llm_test.ts`):

- `[RequestEnricherLlm] returns enriched body from LLM`
- `[RequestEnricherLlm] includes issues in prompt`
- `[RequestEnricherLlm] falls back to original on LLM failure`

---

### Step 8: Add New Request Statuses

**What:** Add `NEEDS_CLARIFICATION`, `REFINING`, and `ENRICHING` values to the `RequestStatus` enum.

**Files to modify:**

- `src/shared/status/request_status.ts` (add new values)

**Architecture notes:**

- Additive enum values — existing code handles unknown statuses via `coerceRequestStatus()`
- `NEEDS_CLARIFICATION`: awaiting user response to questions
- `REFINING`: active Q&A loop in progress
- `ENRICHING`: auto-enrichment in progress
- Update `coerceRequestStatus()` to handle new values
- Update any status display/filtering logic in CLI and TUI

**Success criteria:**

- [ ] Three new statuses added to enum
- [ ] `coerceRequestStatus()` handles new values correctly
- [ ] Existing status transitions unaffected
- [ ] CLI status filters include new statuses
- [ ] TUI status display renders new statuses with appropriate colors

**Planned tests** (`tests/shared/status/request_status_test.ts`):

- `[RequestStatus] includes NEEDS_CLARIFICATION`
- `[RequestStatus] includes REFINING`
- `[RequestStatus] includes ENRICHING`
- `[coerceRequestStatus] handles new status values`

---

### Step 9: Implement `RequestQualityGate` Service (Orchestrator)

**What:** Create `src/services/quality_gate/request_quality_gate.ts` — the main service that orchestrates heuristic/LLM assessment, enrichment, and decision logic.

**Files to create/modify:**

- `src/services/quality_gate/request_quality_gate.ts` (NEW)
- `src/services/quality_gate/mod.ts` (NEW — barrel export)

**Architecture notes:**

- Class `RequestQualityGate` implements `IRequestQualityGateService`
- Constructor DI: `constructor(config: IRequestQualityGateConfig, provider?: IModelProvider, validator?: OutputValidator, db?: IDatabaseService)`
- `assess()` delegates to heuristic or LLM assessor based on mode (hybrid: heuristic first, LLM for borderline)
- `enrich()` calls `enrichRequest()` when recommendation is `auto-enrich`
- Decision logic: score < minimum → `needs-clarification` or `reject`; score < enrichment → `auto-enrich`; score >= proceed → `proceed`
- Logs `request.quality_assessed` to activity journal
- Populates `metadata.durationMs` and `metadata.mode`

**Success criteria:**

- [ ] `heuristic` mode calls only heuristic assessor
- [ ] `llm` mode calls only LLM assessor
- [ ] `hybrid` mode: heuristic first, LLM for borderline scores
- [ ] Correct recommendation based on thresholds
- [ ] Enrichment triggered when `autoEnrich` enabled and recommended
- [ ] Blocking when `blockUnactionable` enabled and score below minimum
- [ ] Logs activity to journal
- [ ] Implements `IRequestQualityGateService` interface
- [ ] Exported through barrel

**Planned tests** (`tests/services/quality_gate/request_quality_gate_test.ts`):

- `[RequestQualityGate] heuristic mode avoids LLM calls`
- `[RequestQualityGate] hybrid mode skips LLM for high scores`
- `[RequestQualityGate] hybrid mode calls LLM for borderline scores`
- `[RequestQualityGate] recommends proceed above threshold`
- `[RequestQualityGate] recommends auto-enrich in enrichment range`
- `[RequestQualityGate] recommends needs-clarification below minimum`
- `[RequestQualityGate] enriches request when autoEnrich enabled`
- `[RequestQualityGate] blocks unactionable when configured`
- `[RequestQualityGate] logs quality_assessed activity`
- `[RequestQualityGate] handles disabled gate (returns proceed)`

---

### Step 10: Implement Clarification Q&A Loop Engine

**What:** Create `src/services/quality_gate/clarification_engine.ts` — the engine that manages multi-turn clarification rounds between the planning agent and user.

**Files to create:**

- `src/services/quality_gate/clarification_engine.ts` (NEW)

**Architecture notes:**

- Class `ClarificationEngine` with constructor DI: `constructor(provider: IModelProvider, validator: OutputValidator, config: { maxRounds: number })`
- `startSession(requestId, body) → IClarificationSession`: creates initial session, generates Round 1 questions via planning agent prompt
- `processAnswers(session, answers) → IClarificationSession`: incorporates answers, synthesizes into `IRequestSpecification`, re-assesses quality, decides whether to generate another round or finalize
- `isComplete(session) → boolean`: checks status (`user-confirmed`, `agent-satisfied`, `max-rounds`, `user-cancelled`)
- Planning agent prompt (private constant): analyzes request + conversation history, identifies gaps, generates 3–5 categorized questions with rationale, or declares satisfaction
- LLM output schema for agent decision: `{ satisfied: boolean, refinedBody?: IRequestSpecification, questions?: IClarificationQuestion[] }`
- Quality score tracked per round in `qualityHistory`

**Success criteria:**

- [ ] `startSession` creates session with Round 1 questions
- [ ] `processAnswers` incorporates answers into refined body
- [ ] Quality score tracked across rounds
- [ ] Session finalizes when agent is satisfied (quality threshold met)
- [ ] Session finalizes when max rounds reached
- [ ] Session cancelable by user
- [ ] `IRequestSpecification` generated from accumulated Q&A
- [ ] Planning agent receives full conversation history per round
- [ ] Questions are categorized and include rationale

**Planned tests** (`tests/services/quality_gate/clarification_engine_test.ts`):

- `[ClarificationEngine] startSession generates Round 1 questions`
- `[ClarificationEngine] processAnswers incorporates answers`
- `[ClarificationEngine] tracks quality score across rounds`
- `[ClarificationEngine] finalizes when agent satisfied`
- `[ClarificationEngine] finalizes when max rounds reached`
- `[ClarificationEngine] supports user cancellation`
- `[ClarificationEngine] generates IRequestSpecification from Q&A`
- `[ClarificationEngine] questions include category and rationale`
- `[ClarificationEngine] handles LLM failure in question generation`

---

### Step 11: Implement Clarification Session Persistence

**What:** Add persistence for `IClarificationSession` as `_clarification.json` alongside request files.

**Files to create/modify:**

- `src/services/quality_gate/clarification_persistence.ts` (NEW)
- `src/services/quality_gate/mod.ts` (update barrel)

**Architecture notes:**

- Export functions: `saveClarification(requestFilePath, session)` and `loadClarification(requestFilePath) → IClarificationSession | null`
- Derives `_clarification.json` path from request `.md` path (matches `_analysis.json` pattern from Phase 45)
- Uses atomic write (write to `.tmp` then rename)
- Validates loaded JSON against `ClarificationSessionSchema`
- Session persists across CLI invocations — user can answer questions, exit, return later

**Success criteria:**

- [ ] Writes `_clarification.json` atomically
- [ ] Loads and validates against schema
- [ ] Returns `null` for missing or invalid file
- [ ] Derives correct path: `Workspace/Requests/req.md` → `Workspace/Requests/req_clarification.json`
- [ ] Session survives CLI session boundaries

**Planned tests** (`tests/services/quality_gate/clarification_persistence_test.ts`):

- `[ClarificationPersistence] saves session as JSON sibling file`
- `[ClarificationPersistence] loads previously saved session`
- `[ClarificationPersistence] returns null for missing file`
- `[ClarificationPersistence] returns null for corrupted file`
- `[ClarificationPersistence] uses atomic write`

---

### Step 12: Wire Quality Gate into `RequestProcessor` Pipeline

**What:** Integrate `RequestQualityGate` into `RequestProcessor.process()` after parsing but before the agent/flow routing split.

**Files to modify:**

- `src/services/request_processor.ts` (add quality gate call)
- `src/services/request_common.ts` (extend `buildParsedRequest` with specification)

**Architecture notes:**

- Quality gate runs in `process()` before `processRequestByKind()` — benefits both agent and flow paths
- Sequence: parse → **quality gate assess** → [if refining: enter Q&A loop, set status, return] → [if enriching: enrich body, log original] → [if proceed: continue] → analyze (Phase 45) → route
- When Q&A loop needed: set `status = REFINING`, persist session, return early (request re-enters pipeline when user completes Q&A)
- When enriched: replace `userPrompt` in `IParsedRequest` with enriched body; store original in `context.originalBody`
- `IRequestSpecification` from completed Q&A stored on `IParsedRequest.context.specification`
- `buildParsedRequest()` extended to accept optional `IRequestSpecification` and `IRequestQualityAssessment`

**Success criteria:**

- [ ] Quality gate runs for every request (both agent and flow kinds)
- [ ] Requests below minimum threshold enter clarification or are rejected
- [ ] Requests in enrichment range get auto-enriched when enabled
- [ ] Requests above proceed threshold pass through unchanged
- [ ] Q&A loop sets status to REFINING and returns early
- [ ] Enriched body replaces userPrompt; original preserved
- [ ] IRequestSpecification available in IParsedRequest.context
- [ ] Disabled gate passes all requests through
- [ ] No breaking changes to existing request processing

**Planned tests** (`tests/services/request_processor_quality_gate_test.ts`):

- `[RequestProcessor] quality gate runs before agent execution`
- `[RequestProcessor] proceeds for high-quality requests`
- `[RequestProcessor] enriches underspecified requests`
- `[RequestProcessor] enters Q&A loop for poor requests`
- `[RequestProcessor] preserves original body when enriching`
- `[RequestProcessor] passes IRequestSpecification to buildParsedRequest`
- `[RequestProcessor] handles disabled quality gate`
- `[RequestProcessor] gate failure does not block processing`

---

### Step 13: Add CLI: `exoctl request clarify`

**What:** Add CLI command for interactive clarification Q&A.

**Files to modify:**

- `src/cli/commands/request_commands.ts` (add `clarify` subcommand)

**Architecture notes:**

- `exoctl request clarify <request-id> [--interactive] [--answer q1="..." --answer q2="..."] [--proceed] [--cancel]`
- No flags: display current questions and status
- `--interactive`: enter interactive Q&A mode (prompt for each question)
- `--answer`: provide answers to specific questions by ID
- `--proceed`: accept current refined body and re-enter pipeline
- `--cancel`: cancel refinement, revert to original body
- Loads/saves session via clarification persistence (Step 11)
- After answers submitted: calls `ClarificationEngine.processAnswers()`, persists updated session
- When session complete: updates request status back to PENDING, logs to journal

**Success criteria:**

- [ ] `exoctl request clarify <id>` displays pending questions
- [ ] `--interactive` prompts for answers sequentially
- [ ] `--answer` provides answers by question ID
- [ ] `--proceed` finalizes and re-enters pipeline
- [ ] `--cancel` reverts to original body
- [ ] Session persisted across invocations
- [ ] Quality score shown after each round

**Planned tests** (`tests/cli/commands/request_clarify_test.ts`):

- `[request clarify] displays pending questions`
- `[request clarify] interactive mode prompts for answers`
- `[request clarify] answer flag submits specific answers`
- `[request clarify] proceed finalizes session`
- `[request clarify] cancel reverts session`
- `[request clarify] shows quality score progression`

---

### Step 14: Add TUI Integration for Clarification

**What:** Enhance the Request Manager TUI view to display clarification status, pending questions, and quality score progression when a request is in REFINING/NEEDS_CLARIFICATION status.

**Files to modify:**

- `src/tui/request_manager_view.ts` (add clarification rendering and input)

**Architecture notes:**

- When request status is `REFINING` or `NEEDS_CLARIFICATION`:
  - Show current round's questions inline in the detail panel
  - Show quality score progression across rounds (visual bar per round)
  - Show evolving `IRequestSpecification` sections (goals, criteria, scope)
  - Show `IRequestQualityAssessment` summary (score, level, issues count)
- Input fields for answering questions directly in TUI
- Action keybindings: `Enter` to submit answers, `p` to force proceed, `c` to cancel
- Load clarification session via `loadClarification()` when selecting a refining request

**Success criteria:**

- [ ] Detail panel shows clarification questions when status is REFINING
- [ ] Quality score bar shows progression across rounds
- [ ] IRequestSpecification sections displayed (goals, criteria, scope)
- [ ] Quality assessment summary visible (score, level, issues)
- [ ] Keybindings work (submit, proceed, cancel)
- [ ] Renders correctly for requests not in clarification

**Planned tests** (`tests/tui/request_clarification_view_test.ts`):

- `[RequestManagerView] displays clarification questions for refining request`
- `[RequestManagerView] shows quality score progression`
- `[RequestManagerView] displays specification sections`
- `[RequestManagerView] keybinding p forces proceed`
- `[RequestManagerView] keybinding c cancels refinement`
- `[RequestManagerView] renders normally for non-refining requests`

---

### Step 15: Add TOML Configuration for Quality Gate

**What:** Add `[quality_gate]` section to `exo.config.toml` schema so users can configure the quality gate globally.

**Files to modify:**

- `src/shared/schemas/config.ts` (extend `ConfigSchema`)
- `exo.config.toml` (add default section)

**Architecture notes:**

- New TOML section:
  ```toml
  [quality_gate]
  enabled = true
  mode = "hybrid"
  auto_enrich = true
  block_unactionable = false
  max_clarification_rounds = 5

  [quality_gate.thresholds]
  minimum = 20
  enrichment = 50
  proceed = 70
  ```text
- `RequestQualityGate` constructor reads config from `Config.quality_gate` to construct `IRequestQualityGateConfig`
- All fields optional with defaults from constants

**Success criteria:**

- [ ] Config schema validates new `[quality_gate]` section
- [ ] Nested `[quality_gate.thresholds]` validated
- [ ] All fields optional with sensible defaults
- [ ] `RequestQualityGate` uses config values
- [ ] Invalid config values produce clear errors

**Planned tests** (`tests/shared/schemas/config_quality_gate_test.ts`):

- `[ConfigSchema] validates quality_gate section`
- `[ConfigSchema] validates nested thresholds`
- `[ConfigSchema] uses defaults when quality_gate is absent`
- `[ConfigSchema] rejects invalid mode value`
- `[ConfigSchema] rejects threshold outside 0-100`

---

### Step 16: End-to-End Integration Test

**What:** Create an integration test that verifies the full quality gate pipeline from request file through assessment, enrichment, and clarification.

**Files to create:**

- `tests/integration/quality_gate_e2e_test.ts` (NEW)

**Architecture notes:**

- Uses `TestEnvironment.create()` for full workspace setup
- Test scenarios: (1) well-specified request proceeds directly, (2) underspecified request gets enriched, (3) vague request enters Q&A loop, (4) Q&A loop completes and re-enters pipeline
- For Q&A scenario: mock user answers, verify multi-round quality progression, verify `IRequestSpecification` output
- Tests both heuristic and hybrid modes

**Success criteria:**

- [ ] Well-specified request passes through quality gate untouched
- [ ] Underspecified request auto-enriched with preserved original
- [ ] Vague request enters clarification loop
- [ ] Q&A loop produces `IRequestSpecification` after answers
- [ ] Quality score improves across rounds
- [ ] Session persistence survives simulated re-entry
- [ ] Pipeline degrades gracefully when LLM unavailable

**Planned tests:**

- `[E2E] well-specified request proceeds through quality gate`
- `[E2E] underspecified request auto-enriched`
- `[E2E] vague request enters Q&A loop`
- `[E2E] Q&A loop produces IRequestSpecification`
- `[E2E] quality score improves across rounds`
- `[E2E] clarification session persists and resumes`
- `[E2E] disabled quality gate passes all requests`

---

### Step 17: Update `ARCHITECTURE.md`

**What:** Update the architecture document to reflect the new Quality Gate layer, clarification protocol, and new request statuses.

**Files to modify:**

- `ARCHITECTURE.md`

**Sections to update:**

1. **"Request Processing Flow"** — Insert quality gate step in pipeline diagram:
   ```text
   Request File (.md)
     → RequestParser.parse()
     → RequestQualityGate.assess()     ← Phase 47 (NEW)
     → [Q&A loop if needed]
     → RequestAnalyzer.analyze()        ← Phase 45
     → RequestRouter (agent or flow)
   ```text

1.
   ```text
   PENDING → REFINING → NEEDS_CLARIFICATION → PENDING → PLANNED → ...
   PENDING → ENRICHING → PENDING → PLANNED → ...
   ```text

1.

1.

1.
   - Three-tier quality assessment (heuristic/LLM/hybrid)
   - Score thresholds and recommendations
   - Auto-enrichment flow
   - Q&A clarification loop protocol
   - Clarification session lifecycle
   - IRequestSpecification as the SDD contract

1.

**Success criteria:**

- [ ] Pipeline diagram includes quality gate step
- [ ] New statuses documented with transitions
- [ ] New schemas listed
- [ ] Quality gate subsection with threshold table
- [ ] Q&A loop protocol documented
- [ ] Activity events documented

**Planned tests:** None (documentation-only).

---

### Step 18: Update User-Facing Documentation in `docs/`

**What:** Update user guide, technical spec, and developer docs to cover the quality gate and clarification protocol.

**Files to modify:**

- `docs/ExoFrame_User_Guide.md`
- `docs/dev/ExoFrame_Technical_Spec.md`
- `docs/dev/ExoFrame_Testing_and_CI_Strategy.md`

**Updates per file:**

1. **`docs/ExoFrame_User_Guide.md`:**
   - Add section on request quality: what it checks, score meaning, how to improve request quality
   - Document `exoctl request clarify` command with all flags and interactive workflow
   - Explain auto-enrichment: what happens, how original is preserved
   - Explain `[quality_gate]` config section with TOML examples
   - New statuses: what REFINING, NEEDS_CLARIFICATION, ENRICHING mean in request list

1.
   - Add quality assessment schema specification
   - Document clarification session model
   - Document `IRequestSpecification` schema
   - Document quality gate service API

1.
   - Add quality gate test categories
   - Document heuristic assessor tests, LLM assessor tests, Q&A loop tests, persistence tests

**Success criteria:**

- [ ] User guide explains quality gate in accessible language
- [ ] CLI `clarify` command documented with examples
- [ ] Config section documented
- [ ] Technical spec includes all new schemas
- [ ] Test strategy covers new categories

**Planned tests:** None (documentation-only).

---

### Step 19: Update `.copilot/` Agent Documentation

**What:** Update AI agent guidance docs to reflect the new quality gate components.

**Files to modify:**

- `.copilot/source/exoframe.md`
- `.copilot/cross-reference.md`
- `.copilot/manifest.json`

**Updates:**

1. **`.copilot/source/exoframe.md`:**
   - Add `RequestQualityGate` and `ClarificationEngine` to services section
   - Add all new schemas to schemas section
   - Document `src/services/quality_gate/` directory structure
   - Update request processing pipeline to include quality gate

1.
   - Add row: `quality gate / request quality / clarification` → `source/exoframe.md` + `planning/phase-47-request-quality-gate.md`
   - Add topic index entries: `quality-gate`, `clarification`, `request-specification`

1.
   - Regenerate via `deno run --allow-read --allow-write scripts/build_agents_index.ts`

**Success criteria:**

- [ ] `.copilot/source/exoframe.md` lists quality gate services
- [ ] `.copilot/cross-reference.md` has quality gate task row
- [ ] `manifest.json` is fresh

**Planned tests:** `deno task check:docs` passes.

---

### Implementation Order & Dependencies

```text
Step  1: Quality assessment schema    ← foundation, no dependencies
Step  2: Clarification + spec schemas ← foundation, no dependencies
Step  3: Interface                    ← depends on Steps 1, 2
Step  4: Constants                    ← can parallel with Steps 1-3
Step  5: Heuristic assessor           ← depends on Steps 1, 4
Step  6: LLM assessor                 ← depends on Steps 1, 4
Step  7: Request enricher LLM         ← depends on Step 1
Step  8: New request statuses         ← independent, can parallel
Step  9: Quality gate service         ← depends on Steps 3, 5, 6, 7
Step 10: Clarification engine         ← depends on Steps 2, 3
Step 11: Clarification persistence    ← depends on Step 2
Step 12: RequestProcessor wiring      ← depends on Steps 8, 9, 10, 11
Step 13: CLI clarify command          ← depends on Steps 10, 11
Step 14: TUI integration             ← depends on Steps 10, 11, 12
Step 15: TOML config                  ← depends on Step 9
Step 16: E2E test                     ← depends on all above
Step 17: ARCHITECTURE.md             ← depends on Steps 12, 14
Step 18: User & dev docs              ← depends on Steps 13, 15
Step 19: .copilot/ agent docs        ← depends on Step 17
```text

**Parallel waves:**

| Wave | Steps | Description |
| ------ | ------- | ------------- |
| 1 | 1, 2, 4, 8 | Schemas, constants, new statuses (no runtime code) |
| 2 | 3, 5, 6, 7 | Interface + independent strategy modules |
| 3 | 9, 10, 11 | Gate service + clarification engine + persistence |
| 4 | 12, 13, 15 | Pipeline wiring + CLI + config |
| 5 | 14 | TUI integration (depends on pipeline) |
| 6 | 16 | E2E validation |
| 7 | 17, 18, 19 | Documentation (after implementation stabilizes) |

---

## Methodology: Specification-Driven Development

This phase implements the core principles of **Specification-Driven Development (SDD)** as adapted for AI agent orchestration. The Q&A loop produces an `IRequestSpecification` — a structured contract that defines *what* the agent must deliver — before any execution begins. This specification then flows downstream as the evaluation rubric (Phase 48), the reflexive agent's critique target (Phase 49), and the confidence scorer's goal reference.

See `.copilot/process/specification-driven-development.md` for the full SDD analysis and how Phases 45–49 map to SDD principles.

**Key SDD alignment in this phase:**

- **Spec before code** — the Q&A loop produces a specification *before* committing LLM tokens to execution
- **Iterate on the spec, not on code** — refinement rounds improve the specification, not the output
- **Spec as contract** — `IRequestSpecification` is preserved, never overwritten, and used as ground truth for evaluation
- **Assisted specification** — unlike pure SDD, the planning agent *collaborates* with the user to build the spec, lowering the barrier for non-technical users

---

## Dependencies

- `src/services/request_processor.ts` — Integration point
- `src/shared/status/request_status.ts` — New status values (`NEEDS_CLARIFICATION`, `REFINING`, `ENRICHING`)
- `src/services/request_processing/request_parser.ts` — Quality assessment after parsing
- **Phase 45** (optional) — Request analysis can feed into quality assessment
- **Phase 46** (optional) — Portal codebase knowledge can inform question generation and auto-enrichment
- `src/cli/` — CLI commands for clarification protocol (`exoctl request clarify`)
- `Blueprints/Agents/product-manager.md` — Reusable as the planning agent for the Q&A loop
- `src/services/memory_bank.ts` — For persisting clarification sessions (via `IProjectMemory` or dedicated storage)

## Risks & Mitigations

| Risk | Mitigation |
| ------ | ----------- |
| Quality gate blocks legitimate terse requests | Configurable thresholds; `enabled: false` to bypass |
| Auto-enrichment changes user intent | Preserve original; enrichment is additive, not rewriting |
| Clarification loop delays automation | Configurable `maxClarificationRounds`; `autoEnrich` handles most cases without human input; `--proceed` flag to skip |
| Infinite clarification loop | Hard cap on rounds (default: 5); user can `--proceed` or `--cancel` at any time |
| Planning agent generates irrelevant questions | Categorized questions with rationale; quality score tracks improvement — stops when no more gain |
| LLM-based assessment adds cost | Hybrid mode: heuristic first, LLM only for borderline scores |
| New statuses break existing CLI/TUI | Additive enum values; existing code handles unknown statuses gracefully via `coerceRequestStatus()` |
| User abandons mid-clarification | Session persisted in `_clarification.json`; can resume or cancel at any time |

## Open Questions

- Should the quality gate be configurable in `exo.config.toml` or only via service config?
- Should enriched requests be saved as new files or modify the original in-place?
- How should the TUI surface `NEEDS_CLARIFICATION` / `REFINING` status? (Notification? Inline Q&A? Dedicated panel?)
- Should there be a "force proceed" option that bypasses the quality gate entirely?
- What is the right default threshold? (Too strict → friction; too loose → no value.)
- Should the planning agent be a dedicated `request-refiner` blueprint or reuse `product-manager`?
- Should the `IRequestSpecification` be rendered as enhanced Markdown frontmatter or kept as a separate JSON artifact?
- When portal codebase knowledge is available (Phase 46), should it automatically feed into the planning agent's question generation?
- Should a "return to refinement" path be supported from execution phase (e.g., when `ReflexiveAgent` discovers a requirement is infeasible, re-enter the Q&A loop to revise the specification)? This would complete the SDD feedback cycle but adds significant complexity — consider as a future phase.

---

## Flow Request Coverage

**Gap identified:** The quality gate and Q&A loop integrate into `RequestProcessor` before the agent/flow routing split. However, the resulting `IRequestSpecification` is designed to be carried by `IParsedRequest` — and `processFlowRequest` doesn't use `IParsedRequest` or call `buildParsedRequest()`. The spec needs to reach `FlowRunner` and its individual step agents.

### Required Changes for Flow Requests

1. **Quality gate runs before the routing split — already correct.** The quality gate assesses request body quality regardless of execution path. The integration point in `RequestProcessor.process()` is before `processRequestByKind()`, so flow requests benefit from quality assessment, enrichment, and the Q&A loop.

1.

```typescript
async execute(
  flow: IFlow,
  request: {
    userPrompt: string;
    traceId?: string;
    requestId?: string;
    /** Specification from Q&A loop (Phase 47) */
    specification?: IRequestSpecification;
  },
): Promise<IFlowResult>;
```text

1.

```typescript
return {
  userPrompt,
  context: {
    ...(specification ? {
      goals: specification.goals.join("; "),
      successCriteria: specification.successCriteria.join("; "),
      scope: JSON.stringify(specification.scope),
    } : {}),
  },
  traceId: originalRequest.traceId,
  requestId: originalRequest.requestId,
  skills,
};
```text

1.

```
