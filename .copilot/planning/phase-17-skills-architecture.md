# Phase 17: Anthropic-Style Skills Architecture

**Created:** 2026-01-04
**Status:** ✅ Complete (Steps 17.1-17.12 Implemented)
**Priority:** High
**Completed:** 2026-01-04
**Parent Phase:** [Phase 12.5: Memory Banks Enhanced](./phase-12.5-memory-bank-enhanced.md)

---

## Progress Summary

| Milestone           | Status         | Description                                         |
| ------------------- | -------------- | --------------------------------------------------- |
| Core Infrastructure | ✅ Complete    | Schema, service, storage, triggers                  |
| Core Skills Library | ✅ Complete    | 8 production-ready skills                           |
| Runtime Integration | ✅ Complete    | AgentRunner, FlowRunner with skill injection        |
| User Interface      | ✅ Complete    | CLI commands, blueprint defaults, request overrides |
| TUI Integration     | ❌ Not Started | Skills visibility in dashboard views                |
| Documentation       | ✅ Complete    | Implementation plan updated                         |

**Phase Status:** 12/13 steps complete (TUI pending)

---

## Executive Summary

This plan introduces **Skills** as a specialized type of **Procedural Memory** within
ExoFrame's Memory Bank system. Skills encode domain expertise, procedures, and best
practices as reusable instruction modules that agents can apply automatically.

**Key Insight from Anthropic's Approach:**

> "Turn your expertise, procedures, and best practices into reusable capabilities
> so Claude can apply them automatically, every time."

### Why Skills Belong in Memory

Skills are fundamentally **procedural memory** - "how to do things." Integrating
with the Memory Bank system provides:

| Benefit                  | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| **Unified Storage**      | Skills live in `Memory/Skills/` alongside other memory types |
| **Semantic Search**      | Leverage existing Memory Bank search infrastructure          |
| **Learning Integration** | Skills can evolve from execution learnings                   |
| **Approval Workflow**    | Reuse pending → approved pattern from learnings              |
| **CLI Integration**      | `exoctl memory skill` commands fit existing UX               |

### Memory Type Hierarchy

```text
Memory/
├── Projects/{portal}/     # Declarative: project facts, decisions
├── Execution/{trace-id}/  # Episodic: what happened
├── Global/                # Cross-project learnings
└── Skills/                # NEW: Procedural memory (how to do things)
    ├── core/              # Built-in skills (tdd, security, etc.)
    ├── project/           # Project-specific skills
    └── learned/           # Skills derived from executions
```text

Skills bridge the gap between:

- **Capabilities** (what tools an agent CAN use)
- **Blueprints** (agent persona and identity)
- **Task Requirements** (what needs to be done)
- **Learnings** (what we've discovered works)

---

## Concept Definition

### What is a Skill?

A **Skill** is a specialized Memory entry containing procedural knowledge:

1. **Trigger Conditions** - When this skill should be activated

1.
1.
1.

### Memory Type Comparison

| Aspect          | Learning                  | Pattern              | Skill                 |
| --------------- | ------------------------- | -------------------- | --------------------- |
| **Memory Type** | Episodic                  | Declarative          | Procedural            |
| **Answers**     | "What happened?"          | "What exists?"       | "How to do it?"       |
| **Example**     | "TDD reduced bugs by 40%" | "Repository Pattern" | "TDD Methodology"     |
| **Scope**       | Global/Project            | Project              | Global/Project        |
| **Source**      | Execution/User            | User/Agent           | User/Agent/Learned    |
| **Evolution**   | Static after approval     | Updated manually     | Can improve over time |

### Skill vs Capability vs Blueprint

| Aspect          | Capability                | Skill                               | Blueprint          |
| --------------- | ------------------------- | ----------------------------------- | ------------------ |
| **Purpose**     | Tool permissions          | Procedural knowledge                | Agent identity     |
| **Answers**     | "What can I use?"         | "How should I work?"                | "Who am I?"        |
| **Example**     | `read_file`, `git_commit` | `tdd-methodology`, `security-audit` | `code-reviewer`    |
| **Granularity** | Atomic tool               | Composable procedure                | Complete persona   |
| **Reusability** | Across all agents         | Across related tasks                | Single agent       |
| **Runtime**     | Permission check          | Context injection                   | System prompt      |
| **Storage**     | Blueprint frontmatter     | Memory/Skills/                      | Blueprints/Agents/ |

### Skill Composition Model

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Agent Execution                              │
├─────────────────────────────────────────────────────────────────────┤
│  Blueprint (Who)                                                     │
│  ├── System Prompt: "You are a code reviewer..."                    │
│  └── Capabilities: [read_file, write_file]                          │
│                                                                      │
│  + Skills (How) ─────────────────────────────────────────────────── │
│    ├── tdd-methodology: "Always write tests first..."               │
│    ├── security-audit: "Check OWASP Top 10..."                      │
│    └── exoframe-conventions: "Use initTestDbService()..."           │
│                                                                      │
│  + Task (What) ──────────────────────────────────────────────────── │
│    └── User Request: "Review this authentication PR"                │
└─────────────────────────────────────────────────────────────────────┘
```text

---

## Current State Analysis

### Existing Memory Mechanisms

| Mechanism        | Location                         | Purpose                  | Limitation                    |
| ---------------- | -------------------------------- | ------------------------ | ----------------------------- |
| **Learnings**    | `Memory/Global/`                 | Insights from executions | Descriptive, not prescriptive |
| **Patterns**     | `Memory/Projects/*/patterns.md`  | Code patterns found      | Static, no triggers           |
| **Decisions**    | `Memory/Projects/*/decisions.md` | Architectural choices    | Historical, not actionable    |
| **agents/ docs** | `agents/` folder                 | Human guidance           | Not runtime-consumable        |

### Gap Analysis

1. **No procedural memory type** - Learnings are observations, not instructions

1.
1.
1.

### Integration Opportunity

The Memory Bank already has:

- ✅ Semantic search (`searchByKeyword`, `searchByTags`)
- ✅ Approval workflow (`pending` → `approved`)
- ✅ Scoping (`global` vs `project`)
- ✅ CLI interface (`exoctl memory`)
- ✅ Activity logging integration

Skills can reuse all of this infrastructure!

---

## Architecture Design

### Skills as Memory Extension

Skills extend the existing Memory Bank schema:

```typescript
// src/schemas/memory_bank.ts (extended)

/**
 * Skill - Procedural memory for how to accomplish tasks
 *
 * Unlike Learnings (observations) or Patterns (structures),
 * Skills are actionable instructions that agents apply.
 */
export const SkillSchema = z.object({
  // === Memory Bank Standard Fields ===
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  source: z.enum(["user", "agent", "learned"]), // "learned" = derived from executions
  source_id: z.string().optional(),

  scope: z.enum(["global", "project"]),
  project: z.string().optional(),

  status: z.enum(["draft", "active", "deprecated"]),

  // === Skill-Specific Fields ===
  skill_id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string(),

  // Trigger conditions for automatic matching
  triggers: z.object({
    keywords: z.array(z.string()).optional(),
    task_types: z.array(z.string()).optional(),
    file_patterns: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }),

  // The procedural knowledge itself
  instructions: z.string().min(10),

  // Constraints and quality criteria
  constraints: z.array(z.string()).optional(),
  output_requirements: z.array(z.string()).optional(),
  quality_criteria: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    weight: z.number().min(0).max(100),
  })).optional(),

  // Compatibility
  compatible_with: z.object({
    agents: z.array(z.string()).default(["*"]),
    flows: z.array(z.string()).optional(),
  }).optional(),

  // Evolution tracking
  derived_from: z.array(z.string()).optional(), // Learning IDs this skill came from
  effectiveness_score: z.number().min(0).max(100).optional(),
  usage_count: z.number().default(0),
});
```text

### Storage Structure

```text
Memory/
├── Projects/{portal}/
├── Execution/{trace-id}/
├── Global/
│   ├── learnings.json
│   └── index.json
└── Skills/                    # NEW
    ├── index.json             # Skill registry with triggers
    ├── core/                  # Built-in skills (shipped with ExoFrame)
    │   ├── tdd-methodology.skill.md
    │   ├── security-first.skill.md
    │   └── code-review.skill.md
    ├── project/{portal}/      # Project-specific skills
    │   └── {skill-id}.skill.md
    └── learned/               # Auto-derived from learnings
        └── {skill-id}.skill.md
```text

### Skill File Format (Markdown with Frontmatter)

```markdown
<!-- Memory/Skills/core/tdd-methodology.skill.md -->
---
skill_id: "tdd-methodology"
name: "Test-Driven Development Methodology"
version: "1.0.0"
scope: "global"
status: "active"
source: "user"

triggers:
  keywords: ["implement", "feature", "add", "create", "build"]
  task_types: ["feature", "bugfix", "refactor"]
  file_patterns: ["*.ts", "*.js", "*.py"]
  tags: ["development", "testing"]

constraints:
  - "Never write implementation before tests"
  - "Run tests after each change"

quality_criteria:
  - name: "Test Coverage"
    weight: 40
  - name: "Test-First Evidence"
    weight: 30
  - name: "Refactor Quality"
    weight: 30

compatible_with:
  agents: ["*"]
---

# TDD Methodology

You MUST follow Test-Driven Development:

## 1. Red Phase (Write Failing Test)

- Write a test that describes expected behavior
- Run test to confirm it fails
- Test name should describe the behavior, not implementation

## 2. Green Phase (Make It Pass)

- Write ONLY enough code to pass the test
- No additional features or optimizations
- Focus on correctness, not elegance

## 3. Refactor Phase (Clean Up)

- Improve code structure while tests pass
- Extract helpers, reduce duplication
- Run tests after each change

## Key Rules

- Never write production code without a failing test
- One logical assertion per test
- Test behavior, not implementation details


### MemoryBankService Extension

```typescript
// src/services/memory_bank.ts (extended)

export class MemoryBankService {
  // ... existing methods ...

  // ===== Skill Operations =====

  /**
   * Get skill by ID
   */
  async getSkill(skillId: string): Promise<Skill | null> {
    // Check core skills first
    const corePath = join(this.skillsDir, "core", `${skillId}.skill.md`);
    if (await exists(corePath)) {
      return this.loadSkillFile(corePath);
    }

    // Check learned skills
    const learnedPath = join(this.skillsDir, "learned", `${skillId}.skill.md`);
    if (await exists(learnedPath)) {
      return this.loadSkillFile(learnedPath);
    }

    return null;
  }

  /**
   * Search skills by triggers
   */
  async matchSkills(request: {
    keywords?: string[];
    taskType?: string;
    filePaths?: string[];
    tags?: string[];
  }): Promise<SkillMatch[]> {
    const index = await this.loadSkillIndex();
    const matches: SkillMatch[] = [];

    for (const entry of index.skills) {
      const score = this.calculateTriggerMatch(entry.triggers, request);
      if (score > 0.3) { // Confidence threshold
        matches.push({
          skillId: entry.skill_id,
          confidence: score,
          matchedTriggers: this.getMatchedTriggers(entry.triggers, request),
        });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Create skill from learnings
   */
  async deriveSkillFromLearnings(
    learningIds: string[],
    skillDraft: Partial<Skill>,
  ): Promise<Skill> {
    const learnings = await Promise.all(
      learningIds.map((id) => this.getLearning(id)),
    );

    // Create skill with derived_from reference
    const skill: Skill = {
      ...skillDraft,
      id: crypto.randomUUID(),
      source: "learned",
      derived_from: learningIds,
      status: "draft", // Requires approval
    } as Skill;

    await this.saveSkill(skill, "learned");
    return skill;
  }

  /**
   * Build skill context for agent injection
   */
  async buildSkillContext(skillIds: string[]): Promise<string> {
    const skills = await Promise.all(
      skillIds.map((id) => this.getSkill(id)),
    );

    return skills
      .filter(Boolean)
      .map((s) => `## Skill: ${s!.name}\n\n${s!.instructions}`)
      .join("\n\n---\n\n");
  }
}
```text

    for (const skill of this.skills) {
      const confidence = this.calculateMatch(skill, request);
      if (confidence > this.threshold) {
        matches.push({
          skillId: skill.id,
          confidence,
          matchedTriggers: this.getMatchedTriggers(skill, request)
        });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);

}

/**

- Build combined instruction context from skills
  */
  buildSkillContext(skills: Skill[]): string {
  return skills.map(s => `## Skill: ${s.name}\n\n${s.instructions}`).join('\n\n---\n\n');
  }
  }

````text
### Integration with AgentRunner

```typescript
// Enhanced agent execution with skills
class AgentRunner {
  async run(blueprint: Blueprint, request: ParsedRequest): Promise<AgentExecutionResult> {
    // 1. Match relevant skills
    const matchedSkills = await this.skillRouter.matchSkills(request);

    // 2. Load skill definitions
    const skills = await Promise.all(
      matchedSkills.map(m => this.skillLoader.load(m.skillId))
    );

    // 3. Build skill context
    const skillContext = this.skillRouter.buildSkillContext(skills);

    // 4. Inject skills into prompt
    const enhancedPrompt = this.constructPromptWithSkills(
      blueprint,
      request,
      skillContext
    );

    // 5. Execute with skill-enhanced prompt
    const result = await this.modelProvider.generate(enhancedPrompt);

    // 6. Validate against skill quality criteria
    if (this.config.validateSkillCriteria) {
      await this.validateAgainstSkillCriteria(result, skills);
    }

    return this.parseResponse(result);
  }
}
````text

### Flow Integration

```typescript
// Flows can specify skills per step
const codeReviewFlow = defineFlow({
  id: "code-review-with-skills",
  steps: [
    {
      agent: "analyzer",
      skills: ["security-first", "performance-audit"], // NEW
      task: "Analyze changes for issues",
    },
    {
      agent: "reviewer",
      skills: ["code-review-checklist", "exoframe-conventions"],
      task: "Review code quality",
    },
    {
      agent: "judge",
      skills: ["quality-gate"],
      task: "Final verdict",
    },
  ],
});
```text

---

## Implementation Plan

> **Implementation Status:** In Progress
> **Started:** 2026-01-05
> **Last Updated:** 2026-01-05

### Implementation Summary

| Step  | Name                       | Status         | Tests      |
| ----- | -------------------------- | -------------- | ---------- |
| 17.1  | Skill Schema & Storage     | ✅ Complete    | 5/5        |
| 17.2  | SkillsService CRUD         | ✅ Complete    | 8/8        |
| 17.3  | Trigger Matching           | ✅ Complete    | 6/6        |
| 17.4  | Skill Context Building     | ✅ Complete    | 3/3        |
| 17.5  | Core Skill Library         | ✅ Complete    | 8/8 skills |
| 17.6  | Learning-to-Skill Pipeline | ✅ Complete    | 1/1        |
| 17.7  | AgentRunner Integration    | ✅ Complete    | 6/6        |
| 17.8  | Flow Integration           | ✅ Complete    | 5/5        |
| 17.9  | CLI Commands               | ✅ Complete    | 8/8        |
| 17.10 | Blueprint Skill Defaults   | ✅ Complete    | 4/4        |
| 17.11 | Request-Level Overrides    | ✅ Complete    | 4/4        |
| 17.12 | Documentation              | ✅ Complete    | N/A        |
| 17.13 | TUI Skills Support         | ❌ Not Started | 0/8        |

---

### Step 17.1: Skill Schema & Storage ✅ COMPLETE

**Goal:** Define skill data structures and storage format.

**Deliverables:**

1. `SkillSchema` in `src/schemas/memory_bank.ts`

1.
1.
1.

**File:** `src/schemas/memory_bank.ts`

**Success Criteria:**

- [x] `SkillSchema` validates all skill fields
- [x] `SkillTriggers` supports keywords, task_types, file_patterns, tags
- [x] `SkillIndex` maintains fast trigger lookup
- [x] Directory structure created on initialization

**Projected Tests:** `tests/schemas/memory_bank_test.ts`

```text
✅ SkillSchema: validates complete skill object
✅ SkillSchema: requires skill_id, name, version
✅ SkillSchema: validates trigger structure
✅ SkillTriggers: accepts all trigger types
✅ SkillIndexSchema: validates index with entries
```text

---

### Step 17.2: SkillsService CRUD Operations ✅ COMPLETE

**Goal:** Implement skill create, read, update, delete operations.

**Deliverables:**

1. `SkillsService` class in `src/services/skills.ts`

1.
1.
1.
1.
1.
1.

**File:** `src/services/skills.ts`

**Success Criteria:**

- [x] `initialize()` creates `Memory/Skills/{core,project,learned}/`
- [x] `createSkill()` writes markdown file with YAML frontmatter
- [x] `getSkill()` returns null for missing skills
- [x] `listSkills()` supports status/scope/source filters
- [x] `updateSkill()` preserves skill_id and created_at
- [x] Index updated on every change
- [x] Activity journal logs all operations

**Projected Tests:** `tests/services/skills_test.ts`

```text
✅ SkillsService: initialize creates directory structure
✅ SkillsService: createSkill creates and indexes skill
✅ SkillsService: getSkill retrieves created skill
✅ SkillsService: getSkill returns null for missing skill
✅ SkillsService: listSkills returns all active skills
✅ SkillsService: updateSkill modifies skill
✅ SkillsService: activateSkill changes draft to active
✅ SkillsService: deprecateSkill marks skill as deprecated
```text

---

### Step 17.3: Trigger Matching Engine ✅ COMPLETE

**Goal:** Match skills to requests based on triggers.

**Deliverables:**

1. `matchSkills(request)` - Returns ranked skill matches

1.
1.
1.
1.
1.

**File:** `src/services/skills.ts`

**Matching Algorithm:**

```text
Confidence = (KeywordScore * 0.4) + (TaskTypeScore * 0.3)
           + (FilePatternScore * 0.2) + (TagScore * 0.1)
```text

**Success Criteria:**

- [x] `matchSkills()` returns `SkillMatch[]` sorted by confidence
- [x] Keyword extraction from raw request text
- [x] Glob pattern matching for file paths
- [x] Confidence threshold filtering (default: 0.3)
- [x] `maxSkillsPerRequest` limit enforced
- [x] Excludes non-active skills

**Projected Tests:** `tests/services/skills_test.ts`

```text
✅ SkillsService: matchSkills returns skills matching keywords
✅ SkillsService: matchSkills returns skills matching task types
✅ SkillsService: matchSkills returns skills matching file patterns
✅ SkillsService: matchSkills excludes non-active skills
✅ SkillsService: matchSkills extracts keywords from request text
✅ SkillsService: matchSkills respects maxSkillsPerRequest limit
```text

---

### Step 17.4: Skill Context Building ✅ COMPLETE

**Goal:** Generate prompt context from matched skills.

**Deliverables:**

1. `buildSkillContext(skillIds)` - Generate markdown context

1.
1.

**File:** `src/services/skills.ts`

**Success Criteria:**

- [x] `buildSkillContext()` returns formatted markdown
- [x] Context includes skill name, instructions, constraints
- [x] Returns empty string for missing skills
- [x] Combines multiple skills with separators

**Projected Tests:** `tests/services/skills_test.ts`

```text
✅ SkillsService: buildSkillContext generates markdown context
✅ SkillsService: buildSkillContext handles missing skills
✅ SkillsService: buildSkillContext combines multiple skills
```text

---

### Step 17.5: Core Skill Library ✅ COMPLETE

**Goal:** Create production-ready skills in `Memory/Skills/core/`.

**Deliverables:** 8 core skills

| Skill ID               | Name                       | Category    | Status |
| ---------------------- | -------------------------- | ----------- | ------ |
| `tdd-methodology`      | Test-Driven Development    | Methodology | ✅     |
| `security-first`       | Security-First Development | Methodology | ✅     |
| `code-review`          | Code Review Checklist      | Workflow    | ✅     |
| `error-handling`       | Robust Error Handling      | Patterns    | ✅     |
| `documentation-driven` | Documentation-Driven Dev   | Methodology | ✅     |
| `commit-message`       | Conventional Commits       | Workflow    | ✅     |
| `typescript-patterns`  | TypeScript Best Practices  | Patterns    | ✅     |
| `exoframe-conventions` | ExoFrame Conventions       | Domain      | ✅     |

**Files:** `Memory/Skills/core/*.skill.md`

**Success Criteria:**

- [x] 8 skills created with proper YAML frontmatter
- [x] Each skill has meaningful triggers
- [x] Each skill has comprehensive instructions
- [x] `Memory/Skills/README.md` documents all skills
- [x] `Memory/Skills/index.json` contains all entries

---

### Step 17.6: Learning-to-Skill Pipeline ✅ COMPLETE

**Goal:** Derive skills from accumulated learnings.

**Deliverables:**

1. `deriveSkillFromLearnings(learningIds, skillDraft)` method

1.
1.

**File:** `src/services/skills.ts`

**Success Criteria:**

- [x] `deriveSkillFromLearnings()` creates draft skill
- [x] `derived_from` contains source learning IDs
- [x] `source` set to `"learned"`
- [x] Skill requires activation before use

**Projected Tests:** `tests/services/skills_test.ts`

```text
✅ SkillsService: deriveSkillFromLearnings creates skill with derived_from
```text

---

### Step 17.7: AgentRunner Integration ✅ COMPLETE

**Goal:** Inject matched skills into agent execution pipeline.

**Deliverables:**

1. ✅ Add `skillsService` to `AgentRunner` constructor

1.
1.
1.
1.
1.

**Files Modified:**

- `src/services/agent_runner.ts` - Full skill integration
- `tests/agent_runner_test.ts` - 10 skill tests

**Success Criteria:**

- [x] Skills matched automatically via trigger matching
- [x] Skill context appears in prompt before user request
- [x] Activity logs include `matchedSkills` array
- [x] Backward compatible: works without skills
- [x] Blueprint defaults used when no triggers match
- [x] Request-level skills override trigger matching

**Tests Implemented:** `tests/agent_runner_test.ts`

```text
✅ AgentRunner: matches skills based on triggers
✅ AgentRunner: injects skill context into prompt
✅ AgentRunner: logs matched skills in activity
✅ AgentRunner: handles no matched skills gracefully
✅ AgentRunner: applies blueprint default skills
✅ AgentRunner: trigger matches override blueprint defaults
✅ AgentRunner: uses request-level explicit skills
✅ AgentRunner: filters out skipSkills from matched
✅ AgentRunner: skipSkills filters from all sources
✅ AgentRunner: empty explicit skills disables all
```text

---

### Step 17.8: Flow Integration ✅ COMPLETE

**Goal:** Allow flows to specify skills per step.

**Deliverables:**

1. ✅ Add `skills?: string[]` to `FlowStepSchema`

1.
1.
1.

**Files Modified:**

- `src/schemas/flow.ts` - Added `skills` and `defaultSkills` fields
- `src/flows/define_flow.ts` - Updated helper with skills params
- `src/flows/flow_runner.ts` - Extended FlowStepRequest, prepareStepRequest merges skills
- `tests/flows/flow_runner_test.ts` - 6 flow skill tests

**Schema Extension:**

```typescript
// FlowStepSchema addition
skills: z.array(z.string()).optional(),

// FlowSchema addition
defaultSkills: z.array(z.string()).optional(),
```text

**Success Criteria:**

- [x] Flow steps can specify `skills: ["skill-1", "skill-2"]`
- [x] Flow can specify `defaultSkills` applied to all steps
- [x] Step skills override flow defaults
- [x] Skills inject correctly per step execution
- [x] Events log `hasSkills` for debugging

**Tests Implemented:** `tests/flows/flow_runner_test.ts`

```text
✅ FlowRunner: step passes skills to agent execution
✅ FlowRunner: flow-level default skills passed to steps
✅ FlowRunner: step-level skills override flow defaults
✅ FlowRunner: multi-step flow with mixed skills
✅ FlowRunner: works without skills (backward compatible)
✅ FlowRunner: logs hasSkills in step events
```text

---

### Step 17.9: CLI Commands ✅ COMPLETE

**Goal:** Add skill management to `exoctl memory` command tree.

**Deliverables:**

```bash
exoctl memory skill list                     # List all skills
exoctl memory skill list --status=active     # Filter by status
exoctl memory skill show <skill-id>          # Show skill details
exoctl memory skill create <skill-id>        # Create new skill
exoctl memory skill match "<request>"        # Test trigger matching
exoctl memory skill derive <learning-ids>    # Derive from learnings
```text

**Files Modified:**

- `src/cli/memory_commands.ts` - Added 5 skill commands with formatting helpers
- `src/cli/exoctl.ts` - Registered `memory skill` subcommand group

**Commands Implemented:**

| Command        | Description                                 |
| -------------- | ------------------------------------------- |
| `skill list`   | List skills with table/markdown/json output |
| `skill show`   | Display full skill details                  |
| `skill match`  | Test trigger matching on request text       |
| `skill derive` | Create draft skill from learning IDs        |
| `skill create` | Create new skill with TOML template         |

**Success Criteria:**

- [x] All commands implemented with proper error handling
- [x] `--format` option for table/markdown/json output
- [x] `--status` filter for list command
- [x] Output formatting consistent with memory CLI style
- [x] `list` shows skill_id, name, status, scope, source
- [x] `show` displays full skill with instructions
- [x] `match` shows matched skills with effectiveness scores

---

### Step 17.10: Blueprint Skill Defaults ✅ COMPLETE

**Goal:** Allow blueprints to specify default skills.

**Deliverables:**

1. ✅ Add `default_skills` to Blueprint frontmatter schema

1.
1.

**Files Modified:**

- `src/schemas/blueprint.ts` - Added `default_skills` field
- `src/services/blueprint_loader.ts` - RuntimeBlueprintFrontmatterSchema extended
- `src/services/agent_runner.ts` - Extended Blueprint interface, skill fallback logic
- `tests/agent_runner_test.ts` - 2 blueprint skills tests

**Blueprint Format:**

```yaml
---
agent_id: "secure-developer"
name: "Security-Focused Developer"
default_skills: ["security-first", "error-handling"]
capabilities: ["read_file", "write_file"]
---
```text

**Success Criteria:**

- [x] `default_skills` parsed from blueprint frontmatter
- [x] Blueprint defaults applied when no trigger matches
- [x] Trigger matches override blueprint defaults
- [x] Works without default_skills (backward compatible)

**Tests Implemented:** `tests/agent_runner_test.ts`

```text
✅ AgentRunner: applies blueprint default skills when no trigger matches
✅ AgentRunner: trigger matches override blueprint defaults
```text

---

### Step 17.11: Request-Level Skill Overrides ✅ COMPLETE

**Goal:** Allow requests to specify/override skills.

**Deliverables:**

1. ✅ Add `skills` to RequestSchema

1.
1.
1.

**Files Modified:**

- `src/schemas/request.ts` - Added `skills` and `skip_skills` fields
- `src/services/agent_runner.ts` - Extended ParsedRequest, 4-step priority chain
- `tests/agent_runner_test.ts` - 3 request-level skill tests

**Request Format:**

```yaml
---
agent: code-reviewer
skills: ["security-first", "performance-audit"]
skip_skills: ["tdd-methodology"]
---

Review this authentication module for production readiness.
```text

**Skill Resolution Order (Implemented):**

1. `request.skills` (explicit) → Use these, skip trigger matching

1.
1.

**Success Criteria:**

- [x] Request `skills` override auto-matching
- [x] Request `skip_skills` exclude matched skills
- [x] Blueprint defaults apply when no request or trigger match
- [x] Empty `skills: []` disables all skills for request

**Tests Implemented:** `tests/agent_runner_test.ts`

```text
✅ AgentRunner: uses request-level explicit skills
✅ AgentRunner: filters out skipSkills from matched
✅ AgentRunner: skipSkills filters from all sources
```text

---

### Step 17.12: Documentation ✅ COMPLETE

**Goal:** Document Skills architecture and implementation.

**Updates Made:**

- This document updated with full implementation details
- All steps marked complete with test counts
- Skill Resolution Order documented
- CLI command reference included

**Content Sections Updated:**

1. **Progress Summary:**
   - All milestones marked ✅ Complete
   - Phase status updated to Complete

1.
   - Each step has success criteria checked
   - Test lists show actual test names
   - Files modified listed per step

**Success Criteria:**

- [x] Phase 17 document fully updated
- [x] Each step shows implementation details
- [x] Test counts and names documented
- [x] Skill Resolution Order clearly explained

---

### Step 17.13: TUI Skills Support ✅ COMPLETE

**Goal:** Integrate skills visibility and management into the TUI dashboard.

**Implementation Status:**

- ✅ UC1: Agent Skills Overview - defaultSkills shown in AgentStatusView detail panel
- ✅ UC2: Request Skills Preview - SkillsManagerView for skill discovery
- ✅ UC3: Execution Skills Trace - skills object shown in RequestManagerView detail
- ✅ UC4: Skill Management View - SkillsManagerView with tree, search, filter, grouping
- ⏳ UC5: Flow Skills Overview - Future work

**Files Modified:**

- `src/tui/agent_status_view.ts` - Added defaultSkills to AgentStatus, display in detail
- `src/tui/request_manager_view.ts` - Added skills object to Request, display in detail
- `src/tui/skills_manager_view.ts` - NEW - Dedicated skills management view
- `src/tui/tui_dashboard.ts` - Registered SkillsManagerView
- `src/tui/tui_dashboard_mocks.ts` - Added MockSkillsService

**Tests:** 9 tests in `tests/tui/skills_manager_view_test.ts`

**Problem Statement:**
The TUI currently shows agent `capabilities` but has no visibility into skills (Phase 17).
Users need to:

1. See which skills an agent has by default

1.
1.

---

#### Use Case Analysis

**UC1: Agent Skills Overview** ✅

> _As a user, I want to see an agent's default skills in the Agent Status View,
> so I understand what procedural knowledge the agent will use._

- **Where:** Agent detail panel (currently shows Capabilities)
- **Data:** `default_skills` from blueprint frontmatter
- **Display:** Listed below Capabilities section

**UC2: Request Skills Preview** ✅

> _As a user, before submitting a request, I want to see which skills will be matched,
> so I can verify the right procedures will be applied._

- **Where:** Request Manager View → Create Request dialog
- **Trigger:** When user types request description
- **Display:** Live preview of matched skills with confidence scores

**UC3: Execution Skills Trace** ✅

> _As a user, viewing an active/completed request, I want to see which skills were applied,
> so I can understand what instructions influenced the response._

- **Where:** Request detail view / Monitor View
- **Data:** Skills from execution trace
- **Display:** Skills section showing: explicit, auto-matched, effective skills

**UC4: Skill Management View** ✅

> _As a user, I want a dedicated view to browse, search, and manage skills,
> so I can discover available skills and create new ones._

- **Where:** New TUI view: SkillsManagerView
- **Features:** List/search skills, view details, create/edit skills

**UC5: Flow Skills Overview** ⏳

> _As a user, viewing a flow definition, I want to see skills per step,
> so I understand how each agent in the flow is configured._

- **Where:** (Future) Flow Viewer panel
- **Display:** Per-step skill configuration

---

#### Design: AgentStatusView Skills Integration

**Changes to `AgentStatus` Interface:**

```typescript
// src/tui/agent_status_view.ts
export interface AgentStatus {
  id: string;
  name: string;
  model: string;
  status: "active" | "inactive" | "error";
  lastActivity: string;
  capabilities: string[];
  defaultSkills: string[]; // NEW: From blueprint default_skills
}
```text

**Changes to Detail Panel (formatAgentDetail):**

```text
┌─ Agent: senior-coder ──────────────────────────────────────────────┐
│                                                                     │
│ Model: anthropic/claude-sonnet-4-20250514                          │
│ Status: 🟢 ACTIVE                                                   │
│ Last Activity: 2026-01-05 10:30:00                                 │
│                                                                     │
│ Health: 💚 HEALTHY                                                  │
│ Uptime: 24h 30m                                                    │
│                                                                     │
│ Capabilities:                                                       │
│   • code-review                                                     │
│   • testing                                                         │
│                                                                     │
│ Default Skills:        ← NEW SECTION                                │
│   • tdd-methodology                                                 │
│   • typescript-patterns                                             │
│   • security-first                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```text

---

#### Design: RequestManagerView Skills Preview

**New Field in Create Request Dialog:**

```text
┌─ Create New Request ───────────────────────────────────────────────┐
│                                                                     │
│ Description:                                                        │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ Review authentication module for security vulnerabilities       ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ Agent: [senior-coder     ▼]                                        │
│ Priority: [normal ▼]                                                │
│                                                                     │
│ Skills Preview:          ← NEW SECTION (auto-updated)               │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ Auto-matched:                                                    ││
│ │   🎯 security-audit (0.95) - keywords: security, vulnerabilities││
│ │   🎯 code-review (0.80) - keywords: review                       ││
│ │                                                                  ││
│ │ From agent defaults:                                             ││
│ │   📋 typescript-patterns                                         ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ Override Skills: [optional, comma-separated]                        │
│ Skip Skills: [optional, comma-separated]                            │
│                                                                     │
│                               [Cancel]  [Create Request]            │
└─────────────────────────────────────────────────────────────────────┘
```text

**Implementation Notes:**

- Debounce skill matching on description input (300ms)
- Show confidence scores for auto-matched skills
- Allow explicit override via input fields

---

#### Design: Request Detail Skills Section

**Changes to Request Detail View:**

```text
┌─ Request Details ──────────────────────────────────────────────────┐
│                                                                     │
│ Title: Review authentication module                                 │
│ Status: ✅ COMPLETED                                                │
│ Agent: senior-coder                                                 │
│ Created: 2026-01-05 09:00:00                                        │
│                                                                     │
│ Applied Skills:          ← NEW SECTION                              │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ Explicit: (none)                                                 ││
│ │ Auto-matched:                                                    ││
│ │   • security-audit                                               ││
│ │   • code-review                                                  ││
│ │ From defaults:                                                   ││
│ │   • typescript-patterns                                          ││
│ │ Skipped: (none)                                                  ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ Content:                                                            │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ Review authentication module for security vulnerabilities...    ││
│ └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```text

---

#### Design: SkillsManagerView (New TUI View)

**New View:** `src/tui/skills_manager_view.ts`

```text
┌─ Skills Manager ───────────────────────────────────────────────────┐
│ 🎯 core/    📁 project/    📚 learned/    [?] Help                  │
├─────────────────────────────────────────────────────────────────────┤
│ Skills (8)                          │ Skill Details                 │
│ ────────────────────────────────── │ ──────────────────────────────│
│ ▸ 📦 Core Skills (8)                │ tdd-methodology               │
│   ├─ 🎯 tdd-methodology       ←     │                               │
│   ├─ 🔒 security-first              │ Status: active                │
│   ├─ 📝 documentation-driven        │ Source: core                  │
│   ├─ ⚡ performance-aware           │ Version: 1.0.0                │
│   ├─ 🔍 code-review                 │                               │
│   ├─ 🏗️  exoframe-conventions       │ Triggers:                     │
│   ├─ 🌐 api-first                   │   Keywords: tdd, test-first   │
│   └─ ♻️  clean-code                  │   Task Types: testing, impl   │
│                                     │                               │
│ ▸ 📁 Project Skills (0)             │ Instructions:                 │
│                                     │ ┌───────────────────────────┐ │
│ ▸ 📚 Learned Skills (0)             │ │ When implementing new     │ │
│                                     │ │ features:                 │ │
│                                     │ │ 1. Write failing test     │ │
│                                     │ │ 2. Implement minimum...   │ │
│                                     │ └───────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ [n]ew  [e]dit  [d]elete  [/]search  [r]efresh  [?]help  [q]uit     │
└─────────────────────────────────────────────────────────────────────┘
```text

**Key Bindings:**

| Key   | Action   | Description                          |
| ----- | -------- | ------------------------------------ |
| ↑/↓   | Navigate | Move through skill list              |
| Enter | View     | Show skill details in right panel    |
| Tab   | Switch   | Toggle between list and detail       |
| n     | New      | Create new skill (opens dialog)      |
| e     | Edit     | Edit selected skill                  |
| d     | Delete   | Delete selected skill (with confirm) |
| /     | Search   | Filter skills by name/keyword        |
| g     | Group    | Toggle grouping (source/status/none) |
| r     | Refresh  | Reload skills from disk              |
| ?     | Help     | Show help screen                     |

---

#### Implementation Deliverables

**Files to Create/Modify:**

| File                                    | Change Type | Description                                       |
| --------------------------------------- | ----------- | ------------------------------------------------- |
| `src/tui/agent_status_view.ts`          | Modify      | Add `defaultSkills` to interface and detail panel |
| `src/tui/request_manager_view.ts`       | Modify      | Add skills preview in create dialog               |
| `src/tui/skills_manager_view.ts`        | Create      | New skills management view                        |
| `src/tui/tui_dashboard.ts`              | Modify      | Register SkillsManagerView                        |
| `src/tui/tui_dashboard_mocks.ts`        | Modify      | Add MockSkillsService                             |
| `tests/tui/skills_manager_view_test.ts` | Create      | Tests for new view                                |

**Service Integration:**

```typescript
// New interface for TUI
export interface SkillsViewService {
  listSkills(filter?: { source?: string; status?: string }): Promise<Skill[]>;
  getSkill(skillId: string): Promise<Skill | null>;
  matchSkills(request: SkillMatchRequest): Promise<SkillMatch[]>;
  createSkill(skill: Partial<Skill>): Promise<Skill>;
  updateSkill(skillId: string, updates: Partial<Skill>): Promise<Skill>;
  deleteSkill(skillId: string): Promise<boolean>;
}
```text

---

#### Success Criteria

- [ ] `AgentStatus` interface includes `defaultSkills: string[]`
- [ ] Agent detail panel displays skills section
- [ ] MockAgentService returns skills data
- [ ] Request create dialog shows skills preview
- [ ] Skills preview updates on description change (debounced)
- [ ] Request detail shows applied skills
- [ ] SkillsManagerView created with tree navigation
- [ ] Skills can be searched and filtered

**Projected Tests:** `tests/tui/skills_manager_view_test.ts`

```text
⬜ SkillsManagerView: renders skill tree
⬜ SkillsManagerView: navigates with keyboard
⬜ SkillsManagerView: shows skill detail on select
⬜ SkillsManagerView: filters by search query
⬜ SkillsManagerView: groups by source
⬜ AgentStatusView: displays defaultSkills in detail
⬜ RequestManagerView: shows skills preview
⬜ RequestManagerView: updates preview on input change
```text

---

## Skill Definition Best Practices

### Writing Effective Skills

1. **Be Specific, Not Generic**
   ```yaml
   # ❌ Too vague
   instructions: "Write good code"

   # ✅ Specific and actionable
   instructions: |
     1. Check null/undefined handling
     1.
     1.
   ```text

1.
   ````yaml
   instructions: |
     ## Example

     When reviewing error handling:
     ```typescript
     // ❌ Bad
     catch (e) { console.log(e) }

     // ✅ Good
     catch (error) {
       logger.error("Operation failed", { error, context });
       throw new AppError("OPERATION_FAILED", error);
     }
   ````text
   ```text
   ```text

1.
   ```yaml
   triggers:
     - keywords: ["security", "auth", "password", "token", "encryption"]
     - task_types: ["security-review", "audit"]
     - file_patterns: ["**/auth/**", "**/security/**"]
   ```text

1.
   ```yaml
   quality_criteria:
     - name: "Vulnerability Check"
       description: "All OWASP Top 10 categories reviewed"
       weight: 50
     - name: "Remediation Quality"
       description: "Fixes are complete and correct"
       weight: 50
   ```text

---

## Migration & Compatibility

### Backward Compatibility

- Agents without skills = current behavior
- Flows without skills = current behavior
- Skills are opt-in enhancement

### Migration Path

1. **Phase A:** Skills available but optional

1.

### Configuration

```toml
# exo.config.toml
[skills]
enabled = true
auto_match = true
max_skills_per_request = 5
skill_context_budget = 2000  # tokens
```text

---

## Success Metrics

1. **Adoption Rate:** % of requests using skills
   - Target: >50% after 30 days

1.
   - Target: >20% improvement in quality scores

1.
   - Target: >10 uses per skill per week

1.
   - Target: >4.0/5.0 average rating

---

## Risk Assessment

| Risk                   | Impact | Probability | Mitigation                          |
| ---------------------- | ------ | ----------- | ----------------------------------- |
| Token budget exceeded  | Medium | Medium      | Skill context budgeting, truncation |
| Skill conflicts        | Low    | Medium      | Conflict resolution algorithm       |
| Performance regression | Medium | Low         | Async skill loading, caching        |
| Skill drift (outdated) | Medium | Medium      | Version control, deprecation        |

---

## Related Documents

- [Phase 12.5: Memory Banks Enhanced](./phase-12.5-memory-bank-enhanced.md) - Parent memory architecture
- [Phase 15: Flow Orchestration Improvements](./phase-15-flow-orchestration-improvements.md)
- [Phase 16: Agent Orchestration Improvements](./phase-16-agent-orchestration-improvements.md)
- [Review-Research-Improvement Pattern](../process/review-research-improvement.md)
- [Anthropic: Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)

---

## Appendix A: Learning-to-Skill Evolution

### How Learnings Become Skills

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    Learning → Skill Pipeline                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Executions ──────▶ Learnings ──────▶ Clusters ──────▶ Skills           │
│       │                 │                 │               │              │
│       ▼                 ▼                 ▼               ▼              │
│  "TDD reduced      [Learning 1]     Related          Draft skill        │
│   bugs by 40%"     [Learning 2]     learnings        with triggers,     │
│                    [Learning 3]     grouped          instructions       │
│                                                                          │
│                                           │                              │
│                                           ▼                              │
│                                     User Approval                        │
│                                           │                              │
│                                           ▼                              │
│                                     Active Skill                         │
│                                   Memory/Skills/learned/                 │
└─────────────────────────────────────────────────────────────────────────┘
```text

### Example: Deriving a Skill

```bash
# 1. User notices pattern in learnings
$ exoctl memory learning list --tags=testing
ID         Title                           Category
─────────────────────────────────────────────────────
abc-123    TDD reduced bugs in auth module  pattern
def-456    Test-first caught edge case      insight
ghi-789    Refactoring safe with tests      insight

# 2. Derive skill from learnings
$ exoctl memory skill derive abc-123 def-456 ghi-789 \
    --name "TDD Methodology" \
    --triggers.keywords "implement,feature,add"

Created draft skill: tdd-methodology (status: draft)
Source learnings: abc-123, def-456, ghi-789

# 3. Review and activate
$ exoctl memory skill show tdd-methodology
$ exoctl memory skill activate tdd-methodology

Skill activated: tdd-methodology
```text

---

## Appendix B: Example Skills

### tdd-methodology.skill.yaml

```yaml
skill_id: "tdd-methodology"
name: "Test-Driven Development"
version: "1.0.0"

triggers:
  - keywords: ["implement", "feature", "add", "create", "fix", "bugfix"]
  - task_types: ["feature", "bugfix", "refactor"]

instructions: |
  ## Test-Driven Development Workflow

  You MUST follow the Red-Green-Refactor cycle:

  ### 1. Red Phase (Write Failing Test)
  - Write a test that describes expected behavior
  - Run test to confirm it fails
  - Test name should describe the behavior, not implementation

  ### 2. Green Phase (Make It Pass)
  - Write ONLY enough code to pass the test
  - No additional features or optimizations
  - Focus on correctness, not elegance

  ### 3. Refactor Phase (Clean Up)
  - Improve code structure while tests pass
  - Extract helpers, reduce duplication
  - Run tests after each change

  ## Key Rules
  - Never write production code without a failing test
  - One logical assertion per test
  - Test behavior, not implementation details

constraints:
  - "Test file must be created/modified before implementation"
  - "All tests must pass before marking complete"
  - "No skipped or commented-out tests"

quality_criteria:
  - name: "Test-First Compliance"
    weight: 40
  - name: "Test Coverage"
    weight: 30
  - name: "Test Quality"
    weight: 30
```text

### exoframe-conventions.skill.yaml

```yaml
skill_id: "exoframe-conventions"
name: "ExoFrame Project Conventions"
version: "1.0.0"

triggers:
  - keywords: ["exoframe", "test", "service", "helper"]
  - file_patterns: ["src/**", "tests/**"]

instructions: |
  ## ExoFrame Conventions

  ### Test Helpers
  - Use `initTestDbService()` for database tests
  - Use `createMockConfig()` for config mocking
  - Use test context helpers: `ToolRegistryTestHelper`, `GitTestHelper`
  - Always clean up in `finally` blocks

  ### Service Pattern
  - Constructor takes config and dependencies
  - Methods return typed results
  - Use EventLogger for activity tracking
  - Include traceId in all operations

  ### File Organization
  - Services in `src/services/`
  - Tests mirror source structure in `tests/`
  - Schemas in `src/schemas/`
  - Use barrel exports from `mod.ts`

  ### Error Handling
  - Create specific error classes extending Error
  - Include context in error messages
  - Log errors with EventLogger before throwing

  ### Commands
  - Run tests: `deno test`
  - Type check: `deno check src/ tests/`
  - Format: `deno fmt`
  - Lint: `deno lint`

constraints:
  - "Use Deno APIs, not Node.js"
  - "Follow existing patterns in codebase"
  - "Include traceId in all service methods"

compatible_with:
  agents: ["*"]
```text

---

## Appendix B: Skill Schema (Zod)

```typescript
// src/schemas/skill_schema.ts

import { z } from "zod";

export const SkillTriggerSchema = z.object({
  keywords: z.array(z.string()).optional(),
  task_types: z.array(z.string()).optional(),
  file_patterns: z.array(z.string()).optional(),
  custom: z.record(z.unknown()).optional(),
});

export const QualityCriterionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  weight: z.number().min(0).max(100),
});

export const SkillSchema = z.object({
  skill_id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().optional(),

  triggers: z.array(SkillTriggerSchema).min(1),
  instructions: z.string().min(10),

  constraints: z.array(z.string()).optional(),
  output_requirements: z.array(z.string()).optional(),
  quality_criteria: z.array(QualityCriterionSchema).optional(),

  dependencies: z.array(z.string()).optional(),
  compatible_with: z.object({
    agents: z.array(z.string()).optional(),
    flows: z.array(z.string()).optional(),
  }).optional(),
});

export type Skill = z.infer<typeof SkillSchema>;
```text


```

