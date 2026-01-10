---
agent: copilot
scope: architecture
phase: 23
title: Skills Blueprint Migration - Moving Core Skills to Blueprints
version: 1.0
date: 2026-01-09
status: COMPLETED
priority: MEDIUM
topics:
  - architecture
  - organization
  - blueprints
  - skills
estimated_effort: 4-6 hours
---

# Phase 23: Skills Blueprint Migration

**Created:** 2026-01-09
**Status:** 📋 **PLANNED**
**Priority:** Medium
**Estimated Duration:** 4-6 hours
**Parent Phase:** [Phase 22: Architecture & Quality](./phase-22-architecture-and-quality-improvement.md)

---

## Progress Summary

| Milestone | Status | Description |
|-----------|--------|-------------|
| Analysis | ✅ Completed | Audit current skill usage and references |
| Design | ✅ Completed | Define new Blueprints/Skills structure |
| Migration | ✅ Completed | Move core skills to Blueprints/Skills |
| Reference Updates | ✅ Completed | Update all skill references in agents/flows |
| Validation | ✅ Completed | Verify all references work correctly |
| Documentation | ✅ Completed | Update docs and READMEs |
| Testing | ✅ Completed | Run full test suite |

---

## Executive Summary

The core skills currently located in `Memory/Skills/core/` are fundamentally blueprints - predefined templates for capabilities, patterns, and behaviors. They belong in the `Blueprints/` directory alongside agent and flow blueprints, not in the `Memory/` directory which should contain learned/adapted knowledge.

### Key Problems

| Problem | Impact | Current Location |
|---------|--------|------------------|
| **Misplaced Blueprints** | Core skills are templates, not learned memory | `Memory/Skills/core/` |
| **Conceptual Confusion** | Skills vs Memory distinction unclear | Mixed concerns |
| **Organization Inconsistency** | Skills referenced by blueprints but stored elsewhere | `Blueprints/` references `Memory/` |
| **Maintenance Burden** | Related concepts split across directories | Harder to maintain |

### Key Goals

| Goal | Description |
|------|-------------|
| **Logical Grouping** | All blueprint templates in one location |
| **Clear Separation** | Blueprints (templates) vs Memory (learned knowledge) |
| **Consistent References** | Skills referenced by blueprints stored with blueprints |
| **Better Discoverability** | Related concepts grouped together |

---

## Current State Analysis

### Core Skills Inventory

Located in `Memory/Skills/core/`:

```
Memory/Skills/core/
├── code-review.skill.md          # Code review methodology blueprint
├── commit-message.skill.md       # Commit message best practices
├── documentation-driven.skill.md # Documentation-first approach
├── error-handling.skill.md       # Error handling patterns
├── exoframe-conventions.skill.md # ExoFrame-specific conventions
├── security-first.skill.md       # Security-first development
├── tdd-methodology.skill.md      # Test-driven development approach
└── typescript-patterns.skill.md  # TypeScript best practices
```

### Skill Reference Analysis

**Agents referencing core skills:**
- `Blueprints/Agents/senior-coder.md`: `["typescript-patterns", "error-handling", "code-review"]`
- `Blueprints/Agents/code-analyst.md`: References various skills
- `Blueprints/Agents/quality-judge.md`: References code review skills

**Flows referencing core skills:**
- `Blueprints/Flows/code_review.flow.ts`: `defaultSkills: ["code-review"]`
- Various other flows reference core skills

### Blueprint Structure Analysis

Current `Blueprints/` structure:
```
Blueprints/
├── Agents/          # Agent configuration blueprints
├── Flows/           # Flow orchestration blueprints
└── src/             # Flow implementation code
```

**Proposed new structure:**
```
Blueprints/
├── Agents/          # Agent configuration blueprints
├── Flows/           # Flow orchestration blueprints
├── Skills/          # ← NEW: Skill capability blueprints
└── src/             # Flow implementation code
```

---

## Proposed Solution

### Target Structure

```
Blueprints/
├── Agents/
│   ├── senior-coder.md     # References "typescript-patterns" skill
│   └── ...
├── Flows/
│   ├── code_review.flow.ts # Uses "code-review" skill
│   └── ...
├── Skills/                 # ← Core skills moved here
│   ├── code-review.skill.md
│   ├── typescript-patterns.skill.md
│   ├── error-handling.skill.md
│   ├── tdd-methodology.skill.md
│   ├── security-first.skill.md
│   ├── commit-message.skill.md
│   ├── documentation-driven.skill.md
│   └── exoframe-conventions.skill.md
└── src/
    └── flows/
```

### Migration Strategy

#### Phase 1: Preparation (1 hour)
- [x] Create `Blueprints/Skills/` directory
- [x] Create `Blueprints/Skills/README.md` explaining purpose
- [x] Audit all skill references in codebase
- [x] Document current skill usage patterns

#### Phase 2: Migration (2 hours)
- [x] Move all files from `Memory/Skills/core/` to `Blueprints/Skills/`
- [x] Update skill loading logic to check both locations during transition
- [x] Verify file integrity after move
- [x] Update any hardcoded paths in code

#### Phase 3: Reference Updates (1 hour)
- [x] Update skill loading code to prioritize `Blueprints/Skills/`
- [x] Add fallback to `Memory/Skills/core/` for backward compatibility
- [x] Update any documentation references
- [x] Test that all agent/flow references still work

#### Phase 4: Cleanup (1 hour)
- [x] Remove `Memory/Skills/core/` directory after verification
- [x] Update `Memory/Skills/README.md` to clarify purpose
- [x] Update main project README with new structure
- [x] Run full test suite to ensure no regressions

---

## Implementation Plan

### Phase 1: Directory Structure Setup

**Objective:** Create new Skills blueprint directory and documentation

**Tasks:**
1. [x] Create `Blueprints/Skills/` directory
2. [x] Create `Blueprints/Skills/README.md` with purpose and structure
3. [x] Update `Blueprints/README.md` to include Skills section

**Success Criteria:**
- `Blueprints/Skills/` directory exists
- Skills README explains purpose and structure
- Main Blueprints README updated

### Phase 2: Skill Migration

**Objective:** Move core skills to blueprint location

**Tasks:**
1. [x] Move all `.skill.md` files from `Memory/Skills/core/` to `Blueprints/Skills/`
2. [x] Preserve file metadata and permissions
3. [x] Verify file integrity with checksums

**Success Criteria:**
- All 8 core skill files moved successfully
- File contents unchanged (verified with diff)
- File permissions preserved

### Phase 3: Code Reference Updates

**Objective:** Update skill loading logic to use new location

**Tasks:**
1. [x] Locate skill loading code in `src/services/memory_bank.ts` or similar
2. [x] Update path resolution to check `Blueprints/Skills/` first
3. [x] Add fallback to old location during transition
4. [x] Update any hardcoded skill paths

**Success Criteria:**
- Skill loading prioritizes `Blueprints/Skills/`
- Fallback to old location works
- No hardcoded paths remain

### Phase 4: Validation and Testing

**Objective:** Ensure all references work with new structure

**Tasks:**
1. [x] Test agent loading with skill references
2. [x] Test flow execution with skill dependencies
3. [x] Run skill-related tests
4. [x] Verify no broken references

**Success Criteria:**
- All agents load successfully
- All flows execute without skill errors
- Skill-related tests pass
- No console errors about missing skills

### Phase 5: Documentation and Cleanup

**Objective:** Update documentation and remove old structure

**Tasks:**
1. [x] Update project README with new structure
2. [x] Update developer documentation
3. [x] Remove `Memory/Skills/core/` directory
4. [x] Update Memory README to clarify purpose

**Success Criteria:**
- Project documentation updated
- Old directory removed safely
- Memory purpose clearly documented

---

## Verification Commands

```bash
# Verify directory structure
find Blueprints/ -name "*.skill.md" | head -10
# Should show skills in Blueprints/Skills/

# Test skill loading
deno run -A scripts/test-skill-loading.ts
# Should load skills from new location

# Test agent references
deno run -A scripts/test-agent-skills.ts
# Should resolve skill references correctly

# Test flow execution
deno run -A scripts/test-flow-skills.ts
# Should execute flows with skill dependencies

# Verify no old references
grep -r "Memory/Skills/core" src/ docs/
# Should return no results
```

---

## Success Criteria

### Functional Requirements
- All core skills moved to `Blueprints/Skills/`
- All agent skill references resolve correctly
- All flow skill dependencies work
- Skill loading prioritizes blueprint location
- Backward compatibility maintained during transition

### Non-Functional Requirements
- Clear separation between blueprints and memory
- Consistent directory structure
- Improved discoverability of related concepts
- No performance impact on skill loading
- Documentation updated and accurate

### Quality Metrics
- All skill files present and intact
- No broken skill references in agents/flows
- Test coverage maintained for skill functionality
- Documentation reflects new structure
- No regressions in existing functionality

---

## Dependencies

- Requires `src/services/memory_bank.ts` skill loading logic
- May need updates to skill resolution in agent/flow loading
- Depends on current skill reference patterns in blueprints

---

## Rollback Plan

- Restore files from backup to `Memory/Skills/core/`
- Revert skill loading path changes
- Keep `Blueprints/Skills/` as symlink during transition
- Gradual migration with feature flags

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Broken skill references | Medium | High | Test thoroughly, maintain fallbacks |
| Missing skill files | Low | High | Use file integrity checks, backups |
| Performance regression | Low | Medium | Benchmark skill loading before/after |
| Documentation confusion | Medium | Low | Update all docs, clear communication |

---

## Conclusion

Moving core skills from `Memory/Skills/core/` to `Blueprints/Skills/` aligns with the logical separation of concerns:

- **Blueprints/**: Predefined templates and configurations (Agents, Flows, Skills)
- **Memory/**: Learned and adapted knowledge from actual usage

This change improves code organization, reduces confusion, and makes the relationship between blueprints and their referenced skills more obvious. The migration is straightforward with clear success criteria and comprehensive testing requirements.
