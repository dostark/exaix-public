# Phase 47: Request Quality Gate & Clarification Protocol

## Version: 1.0

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
```

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
```

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
```

This catches **output** format issues but doesn't prevent wasted LLM calls on requests that were never going to produce good results.

---

## Goals

- [x] Define `IRequestQualityAssessment` schema with quality score, issue categories, and enrichment suggestions.
- [x] Implement `RequestQualityGate` service with heuristic and LLM-based assessment modes.
- [x] Add `NEEDS_CLARIFICATION`, `REFINING`, and `ENRICHING` to `RequestStatus`.
- [x] Implement request auto-enrichment via LLM for underspecified requests.
- [x] Define `IClarificationSession`, `IClarificationRound`, `IClarificationQuestion`, and `IRequestSpecification` schemas.
- [x] Implement iterative Q&A loop with planning agent (multi-turn conversation until both sides are satisfied).
- [x] Ensure original request body is always preserved; refined body stored as structured `IRequestSpecification`.
- [x] Implement session persistence as `_clarification.json` alongside request files.
- [x] Integrate quality gate and Q&A loop into `RequestProcessor` pipeline before agent execution.
- [x] Add CLI support: `exoctl request clarify <id>` with `--interactive`, `--answer`, `--proceed`, `--cancel` flags.
- [ ] Add TUI integration for inline Q&A display and quality score progression.
- [x] Write tests for quality assessment, enrichment, Q&A loop rounds, and session persistence.

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
```

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
```

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
```

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
```

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
```

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
```

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
```

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
```

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
```

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
```

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
```

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
```

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

- [x] `RequestQualityAssessmentSchema.safeParse(validData)` returns `{ success: true }`
- [x] `RequestQualityAssessmentSchema.safeParse(invalidData)` returns `{ success: false }`
- [x] Score constrained to 0–100 range
- [x] All enum values validated (issue types, severity, level, recommendation)
- [x] Schema re-exported through `src/shared/schemas/mod.ts` barrel
- [x] No lint or type errors

**Planned tests** (`tests/schemas/request_quality_assessment_test.ts`):

- ✅ `[RequestQualityAssessmentSchema] validates complete valid assessment`
- ✅ `[RequestQualityAssessmentSchema] rejects score outside 0-100`
- ✅ `[RequestQualityAssessmentSchema] validates all issue type enum values`
- ✅ `[RequestQualityAssessmentSchema] validates all severity enum values`
- ✅ `[RequestQualityAssessmentSchema] validates all level enum values`
- ✅ `[RequestQualityAssessmentSchema] validates all recommendation enum values`
- ✅ `[RequestQualityIssueSchema] validates individual issue`
- ✅ `[RequestQualityAssessmentSchema] validates metadata fields`

**✅ IMPLEMENTED** — `src/shared/schemas/request_quality_assessment.ts`, 17/17 tests passing

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

- [x] `ClarificationSessionSchema.safeParse(validData)` returns `{ success: true }`
- [x] `RequestSpecificationSchema.safeParse(validData)` returns `{ success: true }`
- [x] All sub-schemas parseable independently
- [x] Session status enum validated
- [x] Question category enum validated
- [x] `refinedBody` correctly typed as optional `IRequestSpecification`
- [x] `qualityHistory` array validated
- [x] Both schemas re-exported through barrel

**Planned tests** (`tests/schemas/clarification_session_test.ts`, `tests/schemas/request_specification_test.ts`):

- ✅ `[ClarificationSessionSchema] validates complete session`
- ✅ `[ClarificationSessionSchema] validates session with multiple rounds`
- ✅ `[ClarificationSessionSchema] validates all session status values`
- ✅ `[ClarificationQuestionSchema] validates all category values`
- ✅ `[ClarificationRoundSchema] validates round with and without answers`
- ✅ `[RequestSpecificationSchema] validates complete specification`
- ✅ `[RequestSpecificationSchema] validates scope includes/excludes`
- ✅ `[RequestSpecificationSchema] preserves originalBody`

**✅ IMPLEMENTED** — `src/shared/schemas/clarification_session.ts`, `src/shared/schemas/request_specification.ts`, 19/19 tests passing

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

- [x] Interface exported through barrel
- [x] Depends only on schema types (no concrete imports)
- [x] Config structure matches design document
- [x] TypeScript compiles with `deno check`

**Planned tests:** None (interface-only; validated by type system at compile time).

**✅ IMPLEMENTED** — `src/shared/interfaces/i_request_quality_gate_service.ts`

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

- [x] All heuristic signal values/weights referenced from constants
- [x] Constants grouped under `// === Request Quality Gate ===` header
- [x] No magic numbers in assessor code

**Planned tests:** None (validated through usage in Step 5/6 tests).

**✅ IMPLEMENTED** — `src/shared/constants.ts` (Request Quality Gate section added)

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

- [x] Scores short/vague requests below minimum threshold
- [x] Scores well-structured requests above proceed threshold
- [x] Detects all negative signals (short body, no verbs, only questions, no specifics)
- [x] Detects all positive signals (file refs, acceptance criteria, structure, tech terms)
- [x] Generates appropriate `IRequestQualityIssue` per negative signal
- [x] Maps score to correct level and recommendation
- [x] Zero external dependencies
- [x] Completes in <5ms

**Planned tests** (`tests/services/quality_gate/heuristic_assessor_test.ts`):

- ✅ `[HeuristicAssessor] scores vague one-liner as poor/unactionable`
- ✅ `[HeuristicAssessor] scores well-structured request as good/excellent`
- ✅ `[HeuristicAssessor] detects short body issue`
- ✅ `[HeuristicAssessor] detects missing action verbs`
- ✅ `[HeuristicAssessor] detects question-only request`
- ✅ `[HeuristicAssessor] positive: file references boost score`
- ✅ `[HeuristicAssessor] positive: acceptance criteria keywords boost score`
- ✅ `[HeuristicAssessor] positive: structured requirements boost score`
- ✅ `[HeuristicAssessor] maps score to correct recommendation`
- ✅ `[HeuristicAssessor] handles empty request text`
- ✅ `[HeuristicAssessor] score clamped to 0-100 range`

**✅ IMPLEMENTED** — `src/services/quality_gate/heuristic_assessor.ts`, 13/13 tests passing

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

- [x] Calls `provider.generate()` with quality assessment prompt
- [x] Validates response against schema
- [x] Returns full `IRequestQualityAssessment` with detailed issues
- [x] Falls back gracefully on LLM failure
- [x] Includes enriched body suggestion when auto-enrich recommended

**Planned tests** (`tests/services/quality_gate/llm_assessor_test.ts`):

- ✅ `[LlmQualityAssessor] parses valid LLM response`
- ✅ `[LlmQualityAssessor] handles invalid LLM JSON gracefully`
- ✅ `[LlmQualityAssessor] passes request text in prompt`
- ✅ `[LlmQualityAssessor] uses OutputValidator for parsing`
- ✅ `[LlmQualityAssessor] returns fallback on validation failure`

**✅ IMPLEMENTED** — `src/services/quality_gate/llm_assessor.ts`, 5/5 tests passing

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

- [x] Calls LLM with enrichment prompt containing body + issues
- [x] Returns enriched body string
- [x] Original body is not lost (caller responsibility to preserve)
- [x] Falls back to original body on LLM failure
- [x] Enrichment adds structure (bullets, sections) without changing intent

**Planned tests** (`tests/services/quality_gate/request_enricher_llm_test.ts`):

- ✅ `[RequestEnricherLlm] returns enriched body from LLM`
- ✅ `[RequestEnricherLlm] includes issues in prompt`
- ✅ `[RequestEnricherLlm] falls back to original on LLM failure`
- ✅ `[RequestEnricherLlm] includes original body in prompt`
- ✅ `[RequestEnricherLlm] returns non-empty string on success`

**✅ IMPLEMENTED** — `src/services/quality_gate/request_enricher_llm.ts`, 5/5 tests passing

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

- [x] Three new statuses added to enum
- [x] `coerceRequestStatus()` handles new values correctly
- [x] Existing status transitions unaffected
- [x] CLI status filters include new statuses
- [ ] TUI status display renders new statuses with appropriate colors

**Planned tests** (`tests/shared/status/request_status_test.ts`):

- ✅ `[RequestStatus] includes NEEDS_CLARIFICATION`
- ✅ `[RequestStatus] includes REFINING`
- ✅ `[RequestStatus] includes ENRICHING`
- ✅ `[coerceRequestStatus] handles new status values`
- ✅ `[RequestStatus] includes all original values`
- ✅ `[REQUEST_STATUS_VALUES] includes all new status values`
- ✅ `[isRequestStatus] recognises new status values`
- ✅ `[isRequestStatus] rejects unknown values`
- ✅ `[coerceRequestStatus] falls back for unknown values`

**CLI filter tests** (`tests/cli/request_commands_test.ts`):

- ✅ `[RequestCommands] list > should filter by NEEDS_CLARIFICATION status`
- ✅ `[RequestCommands] list > should filter by REFINING status`
- ✅ `[RequestCommands] list > should filter by ENRICHING status`
- ✅ `[RequestCommands] list > should not include REFINING requests when filtering for PENDING`

**✅ IMPLEMENTED** — `src/shared/status/request_status.ts`, `src/cli/command_builders/request_actions.ts`, `src/cli/exoctl.ts`, 9+4 = 13 tests passing

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

- [x] `heuristic` mode calls only heuristic assessor
- [x] `llm` mode calls only LLM assessor
- [x] `hybrid` mode: heuristic first, LLM for borderline scores
- [x] Correct recommendation based on thresholds
- [x] Enrichment triggered when `autoEnrich` enabled and recommended
- [x] Blocking when `blockUnactionable` enabled and score below minimum
- [x] Logs activity to journal
- [x] Implements `IRequestQualityGateService` interface
- [x] Exported through barrel

**Planned tests** (`tests/services/quality_gate/request_quality_gate_test.ts`):

- ✅ `[RequestQualityGate] heuristic mode avoids LLM calls`
- ✅ `[RequestQualityGate] hybrid mode skips LLM for high scores`
- ✅ `[RequestQualityGate] hybrid mode calls LLM for borderline scores`
- ✅ `[RequestQualityGate] recommends proceed above threshold`
- ✅ `[RequestQualityGate] recommends auto-enrich in enrichment range`
- ✅ `[RequestQualityGate] recommends needs-clarification below minimum`
- ✅ `[RequestQualityGate] enriches request when autoEnrich enabled`
- ✅ `[RequestQualityGate] blocks unactionable when configured`
- ✅ `[RequestQualityGate] logs quality_assessed activity`
- ✅ `[RequestQualityGate] handles disabled gate (returns proceed)`

**✅ IMPLEMENTED** — `src/services/quality_gate/request_quality_gate.ts`, `src/services/quality_gate/mod.ts`, 10/10 tests passing

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

- [x] `startSession` creates session with Round 1 questions
- [x] `processAnswers` incorporates answers into refined body
- [x] Quality score tracked across rounds
- [x] Session finalizes when agent is satisfied (quality threshold met)
- [x] Session finalizes when max rounds reached
- [x] Session cancelable by user
- [x] `IRequestSpecification` generated from accumulated Q&A
- [x] Planning agent receives full conversation history per round
- [x] Questions are categorized and include rationale

**Planned tests** (`tests/services/quality_gate/clarification_engine_test.ts`):

- ✅ `[ClarificationEngine] startSession generates Round 1 questions`
- ✅ `[ClarificationEngine] processAnswers incorporates answers`
- ✅ `[ClarificationEngine] tracks quality score across rounds`
- ✅ `[ClarificationEngine] finalizes when agent satisfied`
- ✅ `[ClarificationEngine] finalizes when max rounds reached`
- ✅ `[ClarificationEngine] supports user cancellation`
- ✅ `[ClarificationEngine] generates IRequestSpecification from Q&A`
- ✅ `[ClarificationEngine] questions include category and rationale`
- ✅ `[ClarificationEngine] handles LLM failure in question generation`

**✅ IMPLEMENTED** — `src/services/quality_gate/clarification_engine.ts`, 9/9 tests passing

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

- [x] Writes `_clarification.json` atomically
- [x] Loads and validates against schema
- [x] Returns `null` for missing or invalid file
- [x] Derives correct path: `Workspace/Requests/req.md` → `Workspace/Requests/req_clarification.json`
- [x] Session survives CLI session boundaries

**Planned tests** (`tests/services/quality_gate/clarification_persistence_test.ts`):

- ✅ `[ClarificationPersistence] saves session as JSON sibling file`
- ✅ `[ClarificationPersistence] loads previously saved session`
- ✅ `[ClarificationPersistence] returns null for missing file`
- ✅ `[ClarificationPersistence] returns null for corrupted file`
- ✅ `[ClarificationPersistence] uses atomic write`

**✅ IMPLEMENTED** — `src/services/quality_gate/clarification_persistence.ts`, 5/5 tests passing

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

- [x] Quality gate runs for every request (both agent and flow kinds)
- [x] Requests below minimum threshold enter clarification or are rejected
- [x] Requests in enrichment range get auto-enriched when enabled
- [x] Requests above proceed threshold pass through unchanged
- [x] Q&A loop sets status to REFINING and returns early
- [x] Enriched body replaces userPrompt; original preserved
- [x] IRequestSpecification available in IParsedRequest.context
- [x] Disabled gate passes all requests through
- [x] No breaking changes to existing request processing

**Planned tests** (`tests/services/request_processor_quality_gate_test.ts`):

- ✅ `[RequestProcessor] quality gate runs before agent execution`
- ✅ `[RequestProcessor] proceeds for high-quality requests`
- ✅ `[RequestProcessor] enriches underspecified requests`
- ✅ `[RequestProcessor] enters Q&A loop for poor requests`
- ✅ `[RequestProcessor] preserves original body when enriching`
- ✅ `[RequestProcessor] passes IRequestSpecification to buildParsedRequest`
- ✅ `[RequestProcessor] handles disabled quality gate`
- ✅ `[RequestProcessor] gate failure does not block processing`

**✅ IMPLEMENTED** — `src/services/request_processor.ts`, 8/8 tests passing

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

- [x] `exoctl request clarify <id>` displays pending questions
- [x] `--interactive` prompts for answers sequentially
- [x] `--answer` provides answers by question ID
- [x] `--proceed` finalizes and re-enters pipeline
- [x] `--cancel` reverts to original body
- [x] Session persisted across invocations
- [x] Quality score shown after each round

**Planned tests** (`tests/cli/commands/request_clarify_test.ts`):

- ✅ `[request clarify] displays pending questions`
- ✅ `[request clarify] interactive mode prompts for answers`
- ✅ `[request clarify] interactive mode skips null/empty answers`
- ✅ `[request clarify] answer flag submits specific answers`
- ✅ `[request clarify] proceed finalizes session`
- ✅ `[request clarify] cancel reverts session`
- ✅ `[request clarify] shows quality score progression`

**✅ IMPLEMENTED** — `src/cli/handlers/request_clarify_handler.ts`, 8/8 tests passing

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
  ```

- `RequestQualityGate` constructor reads config from `Config.quality_gate` to construct `IRequestQualityGateConfig`
- All fields optional with defaults from constants

**Success criteria:**

- [x] Config schema validates new `[quality_gate]` section
- [x] Nested `[quality_gate.thresholds]` validated
- [x] All fields optional with sensible defaults
- [x] `RequestQualityGate` uses config values
- [x] Invalid config values produce clear errors

**Planned tests** (`tests/shared/schemas/config_quality_gate_test.ts`):

- ✅ `[ConfigSchema] validates quality_gate section`
- ✅ `[ConfigSchema] validates nested thresholds`
- ✅ `[ConfigSchema] uses defaults when quality_gate is absent`
- ✅ `[ConfigSchema] rejects invalid mode value`
- ✅ `[ConfigSchema] rejects threshold outside 0-100`

**Additional tests** (`tests/services/quality_gate/request_quality_gate_test.ts`):

- ✅ `[buildQualityGateConfig] maps enabled flag from config`
- ✅ `[buildQualityGateConfig] maps mode from config`
- ✅ `[buildQualityGateConfig] maps auto_enrich → autoEnrich`
- ✅ `[buildQualityGateConfig] maps block_unactionable → blockUnactionable`
- ✅ `[buildQualityGateConfig] maps max_clarification_rounds → maxClarificationRounds`
- ✅ `[buildQualityGateConfig] maps thresholds from config`
- ✅ `[buildQualityGateConfig] uses defaults when fields absent`

**Integration test** (`tests/services/request_processor_quality_gate_test.ts`):

- ✅ `[RequestProcessor] builds quality gate from TOML config when none injected`

**✅ IMPLEMENTED** — `src/shared/schemas/config.ts`, `src/services/quality_gate/request_quality_gate.ts` (`buildQualityGateConfig`), `src/services/request_processor.ts`, 13 tests passing

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

- [x] Well-specified request passes through quality gate untouched
- [x] Underspecified request auto-enriched with preserved original
- [x] Vague request enters clarification loop
- [x] Q&A loop produces `IRequestSpecification` after answers
- [x] Quality score improves across rounds
- [x] Session persistence survives simulated re-entry
- [x] Pipeline degrades gracefully when LLM unavailable

**Planned tests:**

- ✅ `[E2E] well-specified request proceeds through quality gate`
- ✅ `[E2E] underspecified request auto-enriched`
- ✅ `[E2E] vague request enters Q&A loop`
- ✅ `[E2E] Q&A loop produces IRequestSpecification`
- ✅ `[E2E] quality score improves across rounds`
- ✅ `[E2E] clarification session persists and resumes`
- ✅ `[E2E] disabled quality gate passes all requests`
- ✅ `[E2E] Pipeline degrades gracefully when LLM unavailable`

**✅ IMPLEMENTED** — `tests/integration/33_quality_gate_e2e_test.ts`, 8/8 steps passing

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
   ```

1.

  ```text
   PENDING → REFINING → NEEDS_CLARIFICATION → PENDING → PLANNED → ...
   PENDING → ENRICHING → PENDING → PLANNED → ...
  ```

1.
   - Three-tier quality assessment (heuristic/LLM/hybrid)
   - Score thresholds and recommendations
   - Auto-enrichment flow
   - Q&A clarification loop protocol
   - Clarification session lifecycle
   - IRequestSpecification as the SDD contract

1.

**Success criteria:**

- [x] Pipeline diagram includes quality gate step
- [x] New statuses documented with transitions
- [x] New schemas listed
- [x] Quality gate subsection with threshold table
- [x] Q&A loop protocol documented
- [x] Activity events documented

**Planned tests:** None (documentation-only).

**✅ IMPLEMENTED** — `ARCHITECTURE.md`, all sections updated

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

- [x] User guide explains quality gate in accessible language
- [x] CLI `clarify` command documented with examples
- [x] Config section documented
- [x] Technical spec includes all new schemas
- [x] Test strategy covers new categories

**Planned tests:** None (documentation-only).

**✅ IMPLEMENTED** — `docs/ExoFrame_User_Guide.md` (Key Concepts, Request Quality Gate section, `[quality_gate]` config), `docs/dev/ExoFrame_Technical_Spec.md` (§7.4 Request Quality Gate), `docs/dev/ExoFrame_Testing_and_CI_Strategy.md` (Phase 47 test files)

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

- [x] `.copilot/source/exoframe.md` lists quality gate services
- [x] `.copilot/cross-reference.md` has quality gate task row
- [x] `manifest.json` is fresh

**Planned tests:** `deno task check:docs` passes.

**✅ IMPLEMENTED** — `.copilot/source/exoframe.md` (Project Structure + System Constraints), `.copilot/cross-reference.md` (task row + topic entries: `quality-gate`, `clarification`, `request-specification`), `manifest.json` regenerated

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
```

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
```

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
```

1.

---

## Gap Analysis & Critique

> **Status:** Identified — to be addressed before implementation begins.
> Critical architectural gaps (§1–§4) are blocking: they cause the Q&A loop to be a dead end (requests never execute after clarification) or status corruption (new statuses silently coerced to `pending`). Feasibility and design gaps (§5–§11) produce incorrect or unexpectedly expensive behaviour if left to implementer judgment. Testing gaps (§12–§14) leave the highest-value execution path and backward-compatibility regression entirely uncovered. Conceptual gaps (§15–§17) create undocumented cross-phase protocols that Phases 48 and 49 will need to guess at.

---

### Critical Architectural Gaps

#### Gap 1: `shouldSkipRequest()` semantics for all three new statuses are undefined

`RequestProcessor.shouldSkipRequest()` currently skips `PLANNED`, `COMPLETED`, `FAILED`, and `CANCELLED`. The plan adds `NEEDS_CLARIFICATION`, `REFINING`, and `ENRICHING` in Step 8 without specifying their skip semantics. Three options exist for each:

- **Skip (terminal):** request never re-enters the pipeline — correct for `NEEDS_CLARIFICATION` (awaiting user), but then `exoctl request clarify --proceed` must explicitly write `status: pending` back to the `.md` frontmatter to re-trigger execution
- **Process (active):** request runs the quality gate again — correct for `ENRICHING` (short-lived), dangerous for `NEEDS_CLARIFICATION` (infinite re-trigger loop)
- **Skip without forwarding to terminal checklist:** breaks the future re-entry path

If `shouldSkipRequest()` processes `NEEDS_CLARIFICATION` requests, every FileWatcher event re-enters the quality gate and immediately generates a new clarification session, producing an infinite Q&A loop for every re-watch. If it skips, requests in that state never execute unless the re-entry write is explicitly implemented. The plan is silent on all three cases.

**Impact:** without defined skip semantics, the clarification feature delivers no execution value — clarified requests never reach an agent.

> **To fix:** Add to Step 8 architecture notes: `NEEDS_CLARIFICATION` → skip (awaiting user response; re-entry via `--proceed` writing `status: pending` to frontmatter); `REFINING` → skip (engine is mid-round; FileWatcher must not interrupt an active session); `ENRICHING` → do NOT skip (synchronous transient state, completes within the same process call — may be removed per Gap §3). Step 20 (new) specifies the `finalizeAndWritePending()` contract for the re-entry write. Step 8 success criteria must include all three status skip-resolution tests.

---

#### Gap 2: Request re-entry mechanism after Q&A completion is critically underspecified

Step 12 states: "Set status = REFINING, persist session, return early (request re-enters pipeline when user completes Q&A)." This statement implies a mechanism that does not exist:

- The `FileWatcher` fires on `.md` file change events — it does **not** watch `_clarification.json` changes
- If only `_clarification.json` is updated when the user submits answers, FileWatcher never fires
- If `status = REFINING` is written to the `.md` frontmatter, FileWatcher fires — but `shouldSkipRequest()` must then NOT skip `REFINING` for re-entry to work, directly conflicting with Gap §1 (which requires skipping it to prevent loop re-entry)

The only viable re-entry path: `exoctl request clarify --proceed` (and TUI proceed action) writes `status: pending` back to the `.md` frontmatter, triggering FileWatcher. But the plan never says this write happens, which file-system operation performs it, or which module owns the write.

**Impact:** this is the most critical missing piece — the entire Q&A loop has no value if clarified requests never reach agent execution.

> **To fix:** Specify the re-entry contract explicitly: `exoctl request clarify --proceed` (Step 13) calls `finalizeAndWritePending(requestFilePath, session, spec)`, which reads the `.md` frontmatter via `RequestParser`, replaces `status: pending`, sets `assessed_at: ISO timestamp`, and writes back atomically. FileWatcher picks up the `.md` change and re-triggers normally. Step 10 (`ClarificationEngine.finalize()`) returns `IRequestSpecification` but does **not** write to `.md` — that is the CLI/TUI's responsibility. Add a `finalizeAndWritePending()` function to the persistence module (Step 11) and make Step 20 the explicit contract for this end-to-end path.

---

#### Gap 3: `ENRICHING` status is vestigial — no described code path ever sets it

The plan adds `ENRICHING` as a status sibling of `NEEDS_CLARIFICATION` and `REFINING`. However:

- Auto-enrichment in Step 9 (`RequestQualityGate.enrich()`) is described as synchronous: "enriched body replaces the original in `IParsedRequest.userPrompt`"
- Step 12 pipeline says "if auto-enrich → enrich body, then continue" — no async pause, no visible delay, no status write
- No code path in Steps 9, 12, or 13 ever sets `status = ENRICHING` on the request file

A status that exists in the enum but is never emitted by any code path creates confusion in the TUI `STATUS_ICONS`/`STATUS_COLORS` maps (returns `undefined`), in CLI filter logic, and in documentation.

**Impact:** the `ENRICHING` value in `STATUS_ICONS` silently renders with no icon. Developers implementing Step 14 (TUI) will add a display case for a status that is never reached. TypeScript switch exhaustiveness checks on `RequestStatus` will require a dead `ENRICHING` branch forever.

> **To fix:** Remove `ENRICHING` from the new-statuses list in Step 8. Auto-enrichment is synchronous and needs no observable intermediate state. The plan's "synchronous enrichment in pipeline" model is fundamentally incompatible with a status value that requires an intermediate file write and re-read. Document the removal decision in Step 8 architecture notes. If an async enrichment mode is added in a future phase, `ENRICHING` can be restored at that time.

---

#### Gap 4: `IRequestFrontmatter` is never listed in any step's "Files to modify" — new statuses silently corrupt on re-read

The plan writes `status = NEEDS_CLARIFICATION` and `status = REFINING` to request files, but `src/services/request_processing/types.ts` (`IRequestFrontmatter`) is absent from every step's file list. `RequestParser.parse()` calls `coerceRequestStatus(frontmatter.status)` which coerces any value not in `REQUEST_STATUS_VALUES` to `"pending"`. Until `REQUEST_STATUS_VALUES` is extended (Step 8), any file written with `NEEDS_CLARIFICATION` will be coerced back to `PENDING` on next re-read — silently erasing the Q&A state.

**Compounding effect:** `STATUS_ICONS` and `STATUS_COLORS` in `src/tui/request_manager_view.ts` are exhaustive over current statuses. Missing entries return `undefined`, producing blank status icons in the TUI for every request in a clarification state.

> **To fix:** Add `src/services/request_processing/types.ts` to Step 8's "Files to modify." Add `quality_score?: number` and `clarification_session_path?: string` optional fields to `IRequestFrontmatter` so the quality state is visible without reading the sidecar. Add `src/tui/request_manager_view.ts` to Step 8's "Files to modify" with the explicit requirement to add `STATUS_ICONS` and `STATUS_COLORS` entries for `NEEDS_CLARIFICATION` and `REFINING`.

---

### Feasibility & Design Gaps

#### Gap 5: `IRequestQualityAssessment.enrichedBody` conflates assessment and enrichment responsibilities

The plan's `IRequestQualityAssessment` schema includes `enrichedBody?: string`. This conflates two separate concerns:

- **Assessment** determines whether the request meets quality thresholds (`score`, `level`, `issues[]`, `recommendation`)
- **Enrichment** produces an improved version of the request (`enrichedBody`)

In `heuristic` mode, `enrichedBody` is always absent (no LLM call). In `hybrid`/`llm` mode, obtaining it would require bundling an enrichment LLM call inside the assessment call, or making two calls. Step 7 implements enrichment as a separate `enrichRequest()` function — correctly separating concerns — but Step 6 (`LlmQualityAssessor`) says "includes enriched body suggestion when auto-enrich recommended", implying one combined call. Step 9 orchestration is then ambiguous: does `assess()` sometimes return `enrichedBody` and sometimes not, depending on mode? Callers cannot reliably check for its presence.

**Impact:** `IRequestQualityAssessment` becomes a variable-shape type; TypeScript's `?.` check is not sufficient — callers must also know which mode was used to know whether `enrichedBody` was attempted.

> **To fix:** Remove `enrichedBody` from `IRequestQualityAssessmentSchema` in Step 1. Enrichment is a separate action triggered by `recommendation === "auto-enrich"`, returned exclusively from `RequestQualityGate.enrich()`. The assessment return value never includes an enriched body. Update Step 6 (`LlmQualityAssessor` success criteria) to remove "includes enriched body suggestion" — its only job is scoring and issue identification. Update Step 9 orchestration to call `enrich()` as a second step only when needed.

---

#### Gap 6: Hybrid mode cascades up to three sequential LLM calls before agent execution

For a borderline request with `auto-enrich` recommendation in `hybrid` mode:

1. Heuristic assess (fast, free) → borderline score → escalate to LLM
1. LLM assess → returns `recommendation: "auto-enrich"`
1. `enrich()` → second LLM call for request rewrite

That is two LLM calls just for quality gating, before the agent runs a single token. For a simple one-or-two-step feature request, quality-gate LLM cost equals or exceeds execution cost. No cost guard, combined-call strategy, nor mode-specific short-circuit is defined.

> **To fix:** Add to Step 9 architecture notes: (a) in `hybrid` mode, if heuristic score exceeds the `enrichment` threshold, skip LLM assessment entirely and call `enrich()` directly if `recommendation = "auto-enrich"` (one LLM call maximum); (b) if heuristic score is between `minimum` and `enrichment`, combine assessment and enrichment into a single LLM prompt that returns `{ score, issues, enrichedBody }` using a combined output schema (one LLM call total). Add `DEFAULT_QG_COMBINED_ASSESS_ENRICH = true` constant to Step 4. Add to Step 9 success criteria: "hybrid mode triggers at most one LLM call per request."

---

#### Gap 7: `IClarificationQuestion.id` uniqueness is undefined — CLI `--answer` arguments become ambiguous across rounds

The data model uses `id: string` on `IClarificationQuestion` and `answers: Record<string, string>` on `IClarificationRound`. Within a round, IDs are unique (e.g., `q1`, `q2`). But the CLI `--answer` syntax (`exoctl request clarify <id> --answer q1="..."`) provides no round qualifier. If Round 1 has `q1: "What is the target file?"` and Round 2 also has `q1: "Should tests be included?"`, `--answer q1="src/main.ts"` is ambiguous and will silently update the wrong round.

**Impact:** multi-round sessions with `--answer` flags may silently supply answers to a prior round's questions, producing a corrupted `IClarificationSession` that cannot synthesise a correct `IRequestSpecification`.

> **To fix:** Specify in Step 10 that question IDs are globally unique within a session, formatted as `r{round}q{index}` (e.g., `r1q1`, `r1q2`, `r2q1`). `ClarificationEngine.startSession()` and `processAnswers()` generate IDs in this format. The CLI `--answer` flag accepts `r1q1="..."` syntax. Add to Step 10 success criteria: "question IDs are session-globally unique in `r{R}q{N}` format." Add to Step 13 success criteria: "`--answer` accepts `r{R}q{N}` key format."

---

#### Gap 8: Maximum-rounds exhaustion outcome is unspecified

Step 10 says "if rounds >= max → finalize with warning, proceed with best effort." But "finalize" is ambiguous:

- `session.status = "max-rounds"` (plan confirms this)
- Does the request status become `PENDING` (to execute with partial spec) or `FAILED`?
- Is the unrefined body used, or the best available partial `IRequestSpecification`?
- Where does the warning appear (TUI? CLI? activity journal only)?

Without this specification, Steps 11 (persistence), 12 (pipeline), and 13 (CLI) cannot consistently handle the exhaustion case. A request that hits max rounds may remain permanently stuck in `REFINING` with no execution path.

> **To fix:** Specify in Step 10: when max rounds is reached, `session.status = "max-rounds"`, `ClarificationEngine.finalize()` returns the best available `IRequestSpecification` (even if `successCriteria` is empty). The caller (Step 12 pipeline, Step 13 CLI) writes `status: pending` to the `.md` frontmatter with `assessed_at` set, injects the partial spec into `context[REQUEST_SPECIFICATION_KEY]`, and sets `context.clarificationComplete = false` as a downstream signal. Activity journal logs `"request.quality_gate.clarification_max_rounds"`. Add max-rounds path to Step 10 success criteria, Step 12 planned tests, and the E2E Step 16 scenarios.

---

#### Gap 9: `ClarificationEngine.startSession()` makes an LLM call synchronously inside the "early-return" code path

Step 12 says: "set `status = REFINING`, persist session, return early." Step 10 says `startSession()` generates Round 1 questions via the planning agent prompt — an LLM call. This means the "early-return" path blocks the FileWatcher event loop for 5–15 seconds while waiting for Round 1 questions before returning to the caller.

**Impact:** every vague request submitted via FileWatcher freezes all event processing for ~10 seconds. Subsequent `.md` events are delayed. The user experience is: submit a request → 10-second stall before any feedback.

> **To fix:** Redesign `startSession()` as two-phase: (a) synchronous phase — create session record, set `session.status = "active"`, set `round1.generatingQuestions = true`, write session to `_clarification.json`, return immediately; (b) async phase — `generateRound1Questions()` fires as a detached Promise that writes questions to `session.rounds[0]` and flushes the session file. The TUI/CLI shows "Generating clarification questions…" while `generatingQuestions` is `true`, and refreshes when the file is updated. Add `generatingQuestions: boolean` field to `IClarificationRound` schema in Step 2 and to Step 10 architecture notes. Add to Step 10 success criteria: "`startSession()` returns within 50ms regardless of LLM latency."

---

#### Gap 10: `IRequestQualityGateConfig.mode` collides semantically with `AnalysisMode` from Phase 45

Phase 45 defines `export enum AnalysisMode { HEURISTIC = "heuristic", LLM = "llm", HYBRID = "hybrid" }` in `src/shared/enums.ts`. Phase 47's `IRequestQualityGateConfig` uses `mode: "heuristic" | "llm" | "hybrid"` as a plain string union. Two risks arise:

- Implementers may accidentally import `AnalysisMode` from Phase 45 and use it for the quality gate config — creating hidden coupling where toggling `AnalysisMode` also affects quality gate mode
- ConfigSchema validation uses `z.enum([...])` string literals for the quality gate `mode` field, inconsistent with the project convention of `z.nativeEnum(SomeEnum)` for all other mode-type fields (see `AnalysisMode`, `PortalAnalysisMode`, `McpTransportType`, `LogLevel`)

**Impact:** when an engineer searches for all usages of `AnalysisMode` to diagnose a hybrid-mode bug, they will miss quality gate invocations that passed the `AnalysisMode` enum. Code review tools and semantic search both fail silently.

> **To fix:** Add `QualityGateMode` enum to `src/shared/enums.ts` with `HEURISTIC = "heuristic"`, `LLM = "llm"`, `HYBRID = "hybrid"` values — explicitly separate from `AnalysisMode`. Update `IRequestQualityGateConfig.mode` in Step 3 to use `QualityGateMode`. Update ConfigSchema in Step 15 to use `z.nativeEnum(QualityGateMode)`. Step 21 (new) tracks this as an explicit deliverable.

---

#### Gap 11: Quality gate heuristic scorer duplicates Phase-45 `actionabilityScore` computation

`RequestProcessor.process()` already calls `analyzer.analyze()` (Phase 45) before the quality gate, producing `analysis.actionabilityScore` (0–100) from the same request text. Phase 47's `HeuristicAssessor` then runs its own 9-signal pass over the same body — scanning for the same action verbs, acceptance criteria keywords, and structural patterns. This is redundant computation on every request.

More critically, there are now **two different quality scores** for the same request: `analysis.actionabilityScore` (Phase 45) and `qualityAssessment.score` (Phase 47). They may diverge when the two scoring formulas produce different results from the same input. Phases 48 and 49 receive both and have no guidance on which to trust for gating decisions.

> **To fix:** Specify in Step 5 and Step 9: `HeuristicAssessor.assess()` accepts an optional `existingAnalysis?: IRequestAnalysis` parameter. When provided: use `existingAnalysis.actionabilityScore` as the base quality score; map `existingAnalysis.ambiguities[]` to `IRequestQualityIssue[]` entries of type `"ambiguous"`; run only the supplementary signals that Phase 45 does not cover (file-reference detection, multi-requirement structure, context-section header). When absent: run the full 9-signal pass. Step 9 orchestration passes the already-available `analysis` result to the assessor. Add to Step 5 success criteria: "uses Phase-45 `actionabilityScore` as base score when analysis is provided."

---

### Testing Gaps

#### Gap 12: Post-clarification re-entry execution path is uncovered by any planned test

Step 16 E2E scenarios include "Q&A loop completes and re-enters pipeline" verbally, but the planned test list only has `[E2E] Q&A loop produces IRequestSpecification after answers`. No test verifies the complete re-entry chain:

1. `finalizeAndWritePending()` writes `status: pending` to the `.md` frontmatter
1. FileWatcher event fires on the updated `.md`
1. Second `RequestProcessor.process()` call reads `_clarification.json` and injects `IRequestSpecification`
1. `IParsedRequest.context[REQUEST_SPECIFICATION_KEY]` is populated
1. `agentRunner.run()` receives a prompt containing the structured goals and success criteria

This is the highest-value end-to-end path for the entire feature — and it is completely untested.

> **To fix:** Add to Step 16 planned tests: `[E2E] specification persists through re-entry and appears in agent prompt` (covers the full 5-step chain above); `[E2E] max-rounds request executes with partial specification after exhaustion`. Add to Step 12 planned tests: `[RequestProcessor] second invocation loads IRequestSpecification from _clarification.json`.

---

#### Gap 13: No backward-compatibility regression test — existing requests must not enter the Q&A loop

Any request file created before Phase 47 has no quality gate history. If `RequestQualityGate` scores an old, previously-accepted request below the `minimum` threshold (e.g., a brief but legitimate one-liner), the user will unexpectedly be prompted for clarification on a request they already submitted and expected to execute. No planned test verifies that:

- Requests with an `assessed_at` field in frontmatter (from a prior quality-gate pass) bypass re-assessment
- Requests explicitly marked `proceed` skip gate
- The `enabled: false` config genuinely bypasses all gate logic with no side effects

> **To fix:** Add `assessed_at?: string` to `IRequestFrontmatter` in Step 8 as Re-assessment bypass marker — if present and `config.quality_gate.force !== true`, skip the quality gate call entirely in `RequestProcessor.process()`. Add to Step 12 planned tests: `[RequestProcessor] does not re-trigger quality gate when assessed_at present in frontmatter` and `[RequestProcessor] disabled gate passes all requests through with no side effects`.

---

#### Gap 14: Portal-knowledge-aware question generation path is not tested

Step 10 describes that `ClarificationEngine` can use `IPortalKnowledgeService.getOrAnalyze()` to ground questions in real codebase facts (e.g., "Did you mean `src/services/portal_service.ts`?" rather than "Which file should be modified?"). No planned test in any step verifies:

- Questions are enriched when portal knowledge is available
- Graceful fallback (generic questions) when portal knowledge is absent or `null`
- Question text changes when different portal knowledge is injected (question quality regression)

> **To fix:** Add to Step 10 planned tests: `[ClarificationEngine] enriches questions with portal knowledge file references when available` and `[ClarificationEngine] generates general questions when portal knowledge is absent`. Add an integration test to Step 16: `[E2E] clarification questions reference actual portal files when knowledge is available`.

---

### Conceptual Gaps

#### Gap 15: `IRequestSpecification` context key for cross-phase consumption is undeclared

Step 12 says "IRequestSpecification stored in `IParsedRequest.context`" — but never names the key. Phase 48 (Acceptance Criteria Propagation) and Phase 49 (Reflexive Agent Critique) both need to read this specification from `IParsedRequest.context`. Without a declared constant, each phase's implementer invents their own key name (e.g., `"specification"`, `"requestSpec"`, `"clarificationResult"`), producing silent cross-phase incompatibilities that only surface at integration time.

The existing pattern in `src/services/prompt_context.ts` is explicit: `PORTAL_CONTEXT_KEY`, `PORTAL_KNOWLEDGE_KEY`, `ANALYSIS_KEY` — all declared string constants.

> **To fix:** Add `REQUEST_SPECIFICATION_KEY = "requestSpecification"` and `REQUEST_QUALITY_ASSESSMENT_KEY = "qualityAssessment"` to `src/shared/constants.ts` under `// === Request Quality Gate ===` in Step 4. Step 12 uses these constants in `applyQualityGateResult()`. Step 17 documents both keys in `ARCHITECTURE.md`. Step 21 (new) tracks this as an explicit deliverable.

---

#### Gap 16: Planning agent model selection for the Q&A loop is unspecified

Step 10 describes `ClarificationEngine` constructor DI: `constructor(provider: IModelProvider, ...)` — but does not specify which blueprint system prompt, which config model key (`default`, `fast`, `local`), or how these are configurable. The choice matters:

- `fast` model: lower cost per round, may produce generic/low-quality questions
- `default` model: higher cost, but each round is meaningful — Q&A becomes as expensive as execution
- `product-manager` blueprint system prompt vs. a dedicated `request-clarifier` blueprint changes both question tone and the reliability of structured JSON output

Without specification, the implementer makes an arbitrary choice that is then hardcoded and may not be tunable without code changes.

> **To fix:** Add `DEFAULT_CLARIFICATION_MODEL_KEY = "fast"` constant to Step 4. Add `clarificationModel?: string` (default: `"fast"`) to `IRequestQualityGateConfig` in Step 3. Step 10 architecture notes specify: Q&A loop uses `config.clarificationModel` to select the provider; default is the `fast` model. Specify the blueprint: `Blueprints/Agents/product-manager.md` is the planning agent system prompt for Round N question generation (reuse reduces maintenance cost). Add `clarificationModel` field to the TOML `[quality_gate]` section in Step 15.

---

#### Gap 17: `userPrompt` replacement strategy after Q&A completion is underspecified

Step 12 says "enriched body replaces `userPrompt` in `IParsedRequest.userPrompt`; original body preserved in `context.originalBody`." But for the Q&A path specifically:

- If `userPrompt` is set to `IRequestSpecification.summary` only (one sentence), the agent loses goals, constraints, success criteria, and scope
- If `userPrompt` is set to the raw JSON `IRequestSpecification`, it is unreadable to current prompt templates
- If `userPrompt` is left as the original body after Q&A, then specification sections are never visible to the agent

**Impact:** the structured value of the Q&A loop is silently wasted — the agent prompt may not contain the carefully-gathered success criteria and scope that justify the Q&A cost.

> **To fix:** Define a `renderSpecificationAsPrompt(spec: IRequestSpecification): string` function (Step 11 or Step 12) that produces structured Markdown:
>
> ```markdown
> ## Summary
> {spec.summary}
>
> ## Goals
> - {goal 1}
> - {goal 2}
>
> ## Success Criteria
> - [ ] {criterion 1}
>
> ## Scope
> **In scope:** {includes}  **Out of scope:** {excludes}
>
> ## Constraints
> - {constraint 1}
> ```
>
> After Q&A: `request.userPrompt = renderSpecificationAsPrompt(spec)`. After auto-enrich: `request.userPrompt = enrichedBody` (plain string). Both paths write `context.originalBody = original`. Add `renderSpecificationAsPrompt` to Step 11 (clarification persistence) success criteria and planned tests.

---

### Overall Assessment

Phase 47 is well-scoped conceptually: the three-tier quality assess/enrich/clarify pipeline is sound, and the SDD alignment is a strong architectural anchor. The gaps identified fall into three clusters:

**Cluster A — Pipeline coherence (Gaps §1–§4):** The new request statuses lack defined skip/resume semantics; the Q&A return-to-pipeline mechanism is entirely missing; `ENRICHING` is a vestigial status that no code path ever sets; `IRequestFrontmatter` is unmodified despite writing new status values to file. These four gaps combine to make the clarification feature a dead end: requests that enter the Q&A loop will never execute unless they are explicitly addressed before Steps 8, 10, and 12 are coded.

**Cluster B — Schema integrity and data flow (Gaps §5, §11, §15, §17):** `IRequestQualityAssessment.enrichedBody` conflates assessment and enrichment roles; the quality gate duplicates Phase-45 scoring producing two divergent scores for the same request; the `IRequestSpecification` context key is undeclared creating a silent cross-phase compatibility hazard; and the `userPrompt` replacement strategy after Q&A is opaque, risking that the carefully-gathered specification never reaches the agent.

**Cluster C — Implementation precision (Gaps §6–§10, §16):** Hybrid mode's potential two-LLM-call cascade, question ID ambiguity in multi-round sessions, unspecified max-rounds recovery, synchronous LLM call in the early-return path, `QualityGateMode` enum collision with `AnalysisMode`, and planning agent model selection are all underdefined details. Left to implementer judgment, each will produce either incorrect, expensive, or inconsistent behaviour.

Gaps §12–§14 (testing gaps) leave the highest-value path (post-clarification execution), backward-compatibility regression, and portal-knowledge-enriched questions entirely untested — creating silent regressions when Phases 48 and 49 are integrated.

---

### Step 20: Define Q&A Re-Entry Contract and `finalizeAndWritePending()` Helper

**What:** Specify and implement the mechanism for transitioning a clarified request back to `PENDING` so it re-enters the execution pipeline. Directly addresses Gaps §1 (skip semantics) and §2 (re-entry mechanism).

**Files to create/modify:**

- `src/services/quality_gate/clarification_persistence.ts` (extend with `finalizeAndWritePending()`)
- `src/services/request_processing/types.ts` (add `assessed_at?: string`, `clarification_session_path?: string` to `IRequestFrontmatter`)
- `src/services/request_processor.ts` (extend `shouldSkipRequest()` and add re-assessment bypass)

**Architecture notes:**

- `finalizeAndWritePending(requestFilePath, session, spec)` reads the existing `.md` YAML frontmatter via `RequestParser`, sets `status: "pending"`, sets `assessed_at: new Date().toISOString()`, rewrites the frontmatter atomically (write `.tmp` then `Deno.rename`). Optionally updates `subject` to `spec.summary` for TUI display.
- `shouldSkipRequest()` extended: `NEEDS_CLARIFICATION → true` (awaiting user); `REFINING → true` (do not interrupt active session); `ENRICHING → false` (synchronous transient state — if kept, should complete in same process call)
- `RequestProcessor.process()` checks `frontmatter.assessed_at` — if present and `config.quality_gate.force !== true`, skip the quality gate call and reuse `IRequestQualityAssessment` from `_clarification.json` (loaded via `loadClarification()`)
- Re-entry triggered by FileWatcher picking up the `.md` frontmatter change written by `finalizeAndWritePending()`

**Success criteria:**

- [ ] `finalizeAndWritePending()` writes `status: "pending"` and `assessed_at` to `.md` frontmatter atomically
- [ ] FileWatcher event fires after `finalizeAndWritePending()` completes
- [ ] `shouldSkipRequest()` returns `true` for `NEEDS_CLARIFICATION` and `REFINING`
- [ ] `shouldSkipRequest()` returns `false` for `ENRICHING` (or `ENRICHING` is removed per Gap §3)
- [ ] `process()` skips quality gate when `frontmatter.assessed_at` is present and `!force`
- [ ] After `finalizeAndWritePending()`, second `process()` call successfully executes the request with `IRequestSpecification` in context

**Planned tests** (`tests/services/quality_gate/clarification_re_entry_test.ts`):

- `[ClarificationReEntry] finalizeAndWritePending writes status: pending to frontmatter`
- `[ClarificationReEntry] finalizeAndWritePending is atomic (uses .tmp rename)`
- `[ClarificationReEntry] shouldSkipRequest returns true for NEEDS_CLARIFICATION`
- `[ClarificationReEntry] shouldSkipRequest returns true for REFINING`
- `[ClarificationReEntry] shouldSkipRequest returns false for ENRICHING`
- `[ClarificationReEntry] RequestProcessor skips quality gate re-assessment when assessed_at present`
- `[ClarificationReEntry] second process() call injects IRequestSpecification from _clarification.json`

---

### Step 21: Add `QualityGateMode` Enum and Cross-Phase Context Key Constants

**What:** Add the `QualityGateMode` enum (separate from Phase-45 `AnalysisMode`) and the cross-phase context key constants that wire the quality gate output to Phases 48 and 49. Directly addresses Gaps §10 and §15.

**Files to modify:**

- `src/shared/enums.ts` (add `QualityGateMode` enum)
- `src/shared/constants.ts` (add `REQUEST_SPECIFICATION_KEY`, `REQUEST_QUALITY_ASSESSMENT_KEY`, `DEFAULT_CLARIFICATION_MODEL_KEY` under `// === Request Quality Gate ===`)

**Architecture notes:**

- `QualityGateMode` in `src/shared/enums.ts`: `HEURISTIC = "heuristic"`, `LLM = "llm"`, `HYBRID = "hybrid"` — mirrors `AnalysisMode` values but is a distinct enum to prevent cross-import confusion
- `REQUEST_SPECIFICATION_KEY = "requestSpecification"` — `IParsedRequest.context` key for `IRequestSpecification`; used by Phases 48 and 49
- `REQUEST_QUALITY_ASSESSMENT_KEY = "qualityAssessment"` — `IParsedRequest.context` key for `IRequestQualityAssessment`
- `DEFAULT_CLARIFICATION_MODEL_KEY = "fast"` — config model key for the Q&A planning agent
- Update `IRequestQualityGateConfig.mode` (Step 3) to `QualityGateMode` nativeEnum
- Update ConfigSchema `quality_gate.mode` (Step 15) to `z.nativeEnum(QualityGateMode)`
- Update Step 12's `applyQualityGateResult()` function to use both context key constants

**Success criteria:**

- [x] `QualityGateMode` exported from `src/shared/enums.ts`; does not import or reference `AnalysisMode`
- [x] `REQUEST_SPECIFICATION_KEY` and `REQUEST_QUALITY_ASSESSMENT_KEY` exported from constants
- [x] `DEFAULT_CLARIFICATION_MODEL_KEY` exported from constants
- [x] `IRequestQualityGateConfig.mode` typed as `QualityGateMode`
- [x] ConfigSchema `quality_gate.mode` uses `z.nativeEnum(QualityGateMode)`
- [x] No lint or type errors; `deno check` passes

**Planned tests:** None (validated by TypeScript's type system; `deno check` enforces separation between `QualityGateMode` and `AnalysisMode`).

**✅ IMPLEMENTED** — `src/shared/constants.ts` (3 constants added), `deno check` clean

---

### Step 22: Integrate Phase-45 `actionabilityScore` into Heuristic Assessor

**What:** Extend `HeuristicAssessor.assess()` to optionally consume an existing `IRequestAnalysis` from Phase 45, avoiding double-scoring and preventing two divergent quality scores from being produced for the same request. Directly addresses Gap §11.

**Files to modify:**

- `src/services/quality_gate/heuristic_assessor.ts` (extend signature with optional `existingAnalysis` parameter)
- `src/services/quality_gate/request_quality_gate.ts` (pass existing analysis from `RequestProcessor` scope to assessor)

**Architecture notes:**

- Extended signature: `assessHeuristic(requestText: string, existingAnalysis?: IRequestAnalysis): IRequestQualityAssessment`
- When `existingAnalysis` is provided: use `existingAnalysis.actionabilityScore` as the base score (bypasses the full 9-signal computation); map `existingAnalysis.ambiguities[]` to `IRequestQualityIssue[]` entries (type: `"ambiguous"`, severity: proportional to ambiguity `impact`); still run the supplementary signals that Phase 45 does not cover: specific file references (`+15`), multi-requirement structure (`+15`), has context section header (`+10`)
- When `existingAnalysis` is absent: run full 9-signal heuristic pass (backward compatible for heuristic-only mode)
- `RequestQualityGate.assess()` in Step 9 passes the `analysis` result (already in `RequestProcessor`'s scope at the injection point, from Step 12) to the assessor

**Success criteria:**

- [x] Accepts optional `IRequestAnalysis` parameter (backward-compatible — existing calls without analysis still work)
- [x] Uses `existingAnalysis.actionabilityScore` as base score when provided
- [x] Maps `existingAnalysis.ambiguities[]` to `IRequestQualityIssue[]` with type `"ambiguous"`
- [x] Runs supplementary signal checks even when base score is provided
- [x] Falls back to full 9-signal scan when no existing analysis provided
- [x] Produces a single quality score consistent with `actionabilityScore` (no divergence > ±15 for the same input)
- [x] No double-counting of signals already embedded in `actionabilityScore`

**Planned tests** (added to `tests/services/quality_gate/heuristic_assessor_test.ts`):

- ✅ `[HeuristicAssessor] uses Phase-45 actionabilityScore as base when analysis provided`
- ✅ `[HeuristicAssessor] maps Phase-45 ambiguities to quality issues with type "ambiguous"`
- ✅ `[HeuristicAssessor] runs supplementary checks on top of Phase-45 base score`
- ✅ `[HeuristicAssessor] falls back to full scan when no existing analysis`
- ✅ `[HeuristicAssessor] score is consistent with Phase-45 actionabilityScore within tolerance`

**✅ IMPLEMENTED** — `src/services/quality_gate/heuristic_assessor.ts` (signature + Phase-45 integration), `tests/services/quality_gate/heuristic_assessor_test.ts` (5 new tests, 18/18 passing)

---

### Step 23: Define `renderSpecificationAsPrompt()` and `userPrompt` Replacement Contract

**What:** Create the canonical function for converting an `IRequestSpecification` into an agent-ready `userPrompt` string, and specify the exact `userPrompt` replacement contract for both the Q&A and auto-enrich paths. Directly addresses Gap §17.

**Files to create/modify:**

- `src/services/quality_gate/clarification_persistence.ts` (add `renderSpecificationAsPrompt()` export)
- `src/services/quality_gate/request_quality_gate.ts` (document replacement contract in `applyQualityGateResult()`)

**Architecture notes:**

- `renderSpecificationAsPrompt(spec: IRequestSpecification): string` produces structured Markdown:

  ```markdown
  ## Summary
  {spec.summary}

  ## Goals
  - {spec.goals[0]}
  - ...

  ## Success Criteria
  - [ ] {spec.successCriteria[0]}
  - ...

  ## Scope
  **In scope:** {spec.scope.includes.join(", ")}
  **Out of scope:** {spec.scope.excludes.join(", ")}

  ## Constraints
  - {spec.constraints[0]}
  - ...

  ## Context
  - {spec.context[0]}
  - ...
  ```

  Sections with empty arrays are omitted entirely. `summary` is always present.

- **Q&A path:** `request.userPrompt = renderSpecificationAsPrompt(spec)` (full structured prompt)
- **Auto-enrich path:** `request.userPrompt = enrichedBody` (plain string from LLM rewrite)
- **Both paths:** `request.context.originalBody = originalRequestText` (preserved for audit)
- `applyQualityGateResult(request, assessment, spec?, enrichedBody?)` helper mirrors existing `applyAnalysisToRequest()` pattern in `request_common.ts`

**Success criteria:**

- [x] `renderSpecificationAsPrompt()` produces valid Markdown with all non-empty sections
- [x] Empty arrays produce omitted sections (no empty bullet lists)
- [x] `summary` always present even when all other arrays are empty
- [ ] Q&A path: `request.userPrompt` is the rendered specification *(Phase 48 integration)*
- [ ] Auto-enrich path: `request.userPrompt` is the plain enriched body string *(Phase 48 integration)*
- [ ] Both paths: `request.context.originalBody` contains the unmodified original *(Phase 48 integration)*
- [ ] `context[REQUEST_SPECIFICATION_KEY]` set when Q&A path taken *(Phase 48 integration)*
- [ ] `context[REQUEST_QUALITY_ASSESSMENT_KEY]` set when assessment is available *(Phase 48 integration)*

**Planned tests** (added to `tests/services/quality_gate/clarification_persistence_test.ts`):

- ✅ `[clarification_persistence] renderSpecificationAsPrompt produces all sections for full spec`
- ✅ `[clarification_persistence] renderSpecificationAsPrompt omits empty sections`
- ✅ `[clarification_persistence] renderSpecificationAsPrompt always includes summary`
- ✅ `[clarification_persistence] renderSpecificationAsPrompt handles minimal spec (summary only)`

**✅ IMPLEMENTED** — `src/services/quality_gate/clarification_persistence.ts` (`renderSpecificationAsPrompt` added), `tests/services/quality_gate/clarification_persistence_test.ts` (4 new tests, 9/9 passing)
