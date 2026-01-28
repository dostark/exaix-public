---
agent: claude
scope: dev
title: "Phase 33: Code Duplication Refactoring & Architecture Improvement"
short_summary: "Systematic refactoring to reduce code duplication from 4.06% to <2% while improving overall architecture quality through SOLID principles, design patterns, and measurable metrics."
version: "1.0"
topics: ["refactoring", "architecture", "code-quality", "design-patterns", "testing", "metrics"]
---

**Goal:** Reduce code duplication from 4.06% to <2% while improving architecture quality through SOLID principles, design patterns (MVC, Builder, Factory, Command, Strategy, Observer, Middleware, Circuit Breaker), and measurable improvements in complexity, coupling, cohesion, and maintainability.

**Status:** [/] IN PROGRESS - TUI View refactoring ongoing
**Timebox:** 5-6 weeks
**Entry Criteria:** Code duplication analysis complete (jscpd), baseline metrics established
**Exit Criteria:** Duplication <2%, complexity <10, coupling <5, cohesion >0.8, maintainability >80

## References

- **Related Phase:** [Phase 14: Code Deduplication](./phase-14-code-deduplication.md)
- **Related Phase:** [Phase 22: Architecture and Quality Improvement](./phase-22-architecture-and-quality-improvement.md)
- **Analysis Tool:** jscpd v4.0.7
- **Measurement Tools:** complexity-report, madge, ts-complex, deno coverage

---

## Problem Statement

### Analysis Results

**Tool:** jscpd v4.0.7 (2026-01-28)

- **Files analyzed:** 373 TypeScript files
- **Total lines:** 122,430
- **Clones found:** 425 instances
- **Duplicated lines:** 4,973 (4.06%)
- **Duplicated tokens:** 47,920 (4.85%)

### Current Architecture Metrics

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Code Duplication | 4.06% | <2% | -2.06% |
| Avg Cyclomatic Complexity | 12-18 | <10 | -2 to -8 |
| Coupling (avg) | 6-10 | <5 | -1 to -5 |
| Cohesion (LCOM) | 0.6 | >0.8 | +0.2 |
| Maintainability Index | 65-75 | >80 | +5 to +15 |
| Test Coverage | 85% | >90% | +5% |
| Tech Debt Ratio | 8% | <5% | -3% |

### Problem Areas

1. **TUI Views** - 200-300 lines duplicated, high complexity (15-25)
2. **Test Helpers** - 150-200 lines duplicated, slow setup (200-500ms)
3. **CLI Commands** - 100-150 lines duplicated, inconsistent validation
4. **Provider Factories** - 80-120 lines duplicated, slow init (50-150ms)
5. **Services** - 60-100 lines duplicated, low error recovery (50%)

---

## Architecture Design

### Refactoring Priorities

```
┌────────────────────────────────────────────────────────────────┐
│                    Priority Matrix                              │
├────────────────────────────────────────────────────────────────┤
│  HIGH PRIORITY (Weeks 1-2)                                     │
│  ├─ TUI Views: 200-300 lines, complexity 15-25                │
│  └─ Test Helpers: 150-200 lines, setup time 200-500ms         │
│                                                                 │
│  MEDIUM PRIORITY (Weeks 3-4)                                   │
│  ├─ CLI Commands: 100-150 lines, complexity 12-18             │
│  └─ Provider Factories: 80-120 lines, init time 50-150ms      │
│                                                                 │
│  LOWER PRIORITY (Week 5)                                       │
│  └─ Services: 60-100 lines, error recovery 50%                │
└────────────────────────────────────────────────────────────────┘
```

### Design Patterns to Apply

| Pattern | Module | Purpose |
|---------|--------|---------|
| **MVC/MVVM** | TUI Views | Separate view/business logic |
| **Observer** | TUI Views | Event-driven updates |
| **Builder** | Test Helpers | Fluent test data creation |
| **Factory** | Test Helpers, Providers | Consistent object creation |
| **Object Mother** | Test Helpers | Predefined fixtures |
| **Command** | CLI Commands | Standardized command interface |
| **Chain of Responsibility** | CLI Commands | Validation pipeline |
| **Strategy** | CLI Commands, Services | Error handling strategies |
| **Abstract Factory** | Provider Factories | Provider creation abstraction |
| **Registry** | Provider Factories | Provider lookup |
| **Lazy Initialization** | Provider Factories | Performance optimization |
| **Middleware** | Services | Request processing pipeline |
| **Decorator** | Services | Cross-cutting concerns |
| **Circuit Breaker** | Services | Fault tolerance |

---

## Implementation Plan

### Implementation Summary

| Phase | Module | Duration | Duplication Target | Complexity Target |
|-------|--------|----------|-------------------|-------------------|
| 33.1 | TUI Views | Week 1 | -1.5% to -2% | -40% |
| 33.2 | Test Helpers | Week 2 | -1% | -50% test time |
| 33.3 | CLI Commands | Week 3 | -0.8% | -35% |
| 33.4 | Provider Factories | Week 4 | -0.6% | -60% init time |
| 33.5 | Services & Final | Week 5 | -0.5% | 99% uptime |
| 33.6 | Metrics & CI/CD | Week 6 | Monitoring | Continuous |

---

## Phase 33.1: TUI Views Refactoring [/] IN PROGRESS

**Goal:** Reduce duplication by 200-300 lines, reduce complexity from 15-25 to <10

**Files affected:**
- `src/tui/plan_reviewer_view.ts`
- `src/tui/portal_manager_view.ts`
- `src/tui/monitor_view.ts`
- `src/tui/skills_manager_view.ts`
- `src/tui/structured_log_viewer.ts`

**Architecture improvements:**
1. Create `src/tui/base/base_view.ts` - Abstract base class with MVC pattern
2. Create `src/tui/utils/event_handlers.ts` - Event delegation utilities
3. Create `src/tui/utils/render_utils.ts` - Common rendering helpers
4. Create `src/tui/utils/view_state.ts` - State management

**SOLID principles:**
- **S**: Separate rendering, state, events into distinct classes
- **O**: Extensible base view for new views
- **L**: All views inherit from base without breaking behavior
- **I**: Focused interfaces for rendering, events, state
- **D**: Depend on view abstractions, not concrete implementations

**Success criteria:**
- [x] Cyclomatic complexity <10 per method <!-- reduced by centralizing key handling -->
- [x] Coupling <5 dependencies <!-- streamlined via BaseTreeView inheritance -->
- [x] Cohesion (LCOM) >0.8
- [x] Duplication <50 lines <!-- eliminated duplicate handleKey logic in 9 views -->
- [x] Test coverage maintained >85% <!-- 996 tests passing -->

---

## Phase 33.2: Test Helpers Refactoring [/] IN PROGRESS

**Goal:** Reduce duplication by 150-200 lines, reduce test setup time by 50%

**Files affected:**
- `tests/cli/memory_commands_test.ts`
- `tests/cli/memory_commands_pending_test.ts`
- `tests/cli/memory_commands_global_test.ts`
- `tests/cli/memory_commands_coverage_test.ts`
- `tests/helpers/git_test_helper.ts`

**Architecture improvements:**
1. Create `tests/helpers/memory_test_helper.ts` - Common setup functions
2. Create `tests/fixtures/memory_builder.ts` - Builder pattern for test data
3. Create `tests/fixtures/test_environment_factory.ts` - Factory pattern
4. Create `tests/helpers/custom_assertions.ts` - Domain-specific assertions

**Design patterns:**
- **Builder**: Fluent API for test data creation
- **Factory**: Consistent test environment setup
- **Object Mother**: Predefined test fixtures

**Success criteria:**
- [ ] Test setup time <100ms (from 200-500ms)
- [ ] Code reuse >70% (from 30%)
- [ ] Maintainability index >80 (from 65-70)
- [ ] Duplication <30 lines

---

## Phase 33.3: CLI Commands Refactoring 📋 PLANNED

**Goal:** Reduce duplication by 100-150 lines, reduce complexity by 35%

**Files affected:**
- `src/cli/changeset_commands.ts`
- `src/cli/plan_commands.ts`
- `src/cli/request_commands.ts`
- `src/cli/daemon_commands.ts`
- `src/cli/blueprint_commands.ts`

**Architecture improvements:**
1. Create `src/cli/base/command.ts` - Command pattern interface
2. Create `src/cli/validation/validation_chain.ts` - Chain of responsibility
3. Create `src/cli/errors/error_strategy.ts` - Strategy pattern for errors
4. Create `src/cli/utils/command_utils.ts` - Shared utilities

**Design patterns:**
- **Command**: Standardized command interface
- **Chain of Responsibility**: Validation pipeline
- **Strategy**: Error handling strategies

**Success criteria:**
- [ ] Command complexity <8 (from 12-18)
- [ ] Error handling coverage >90% (from 60%)
- [ ] Validation consistency 100%
- [ ] Duplication <25 lines

---

## Phase 33.4: Provider Factories Refactoring 📋 PLANNED

**Goal:** Reduce duplication by 80-120 lines, reduce init time by 60%

**Files affected:**
- `src/ai/provider_factory.ts`
- `tests/ai/provider_factory_test.ts`
- `tests/ai/provider_selector_test.ts`
- `tests/ai/provider_registry_test.ts`

**Architecture improvements:**
1. Create `src/ai/factories/abstract_provider_factory.ts` - Abstract factory
2. Create `src/ai/registry/provider_registry.ts` - Registry pattern
3. Create `src/ai/providers/lazy_provider.ts` - Lazy initialization
4. Create `tests/helpers/provider_test_helper.ts` - Test utilities

**Design patterns:**
- **Abstract Factory**: Provider creation abstraction
- **Registry**: Provider lookup and management
- **Lazy Initialization**: Defer creation until first use

**Success criteria:**
- [ ] Factory complexity <10 (from 15-20)
- [ ] Provider coupling <4 (from 8-10)
- [ ] Initialization time <30ms (from 50-150ms)
- [ ] Duplication <20 lines

---

## Phase 33.5: Services Refactoring 📋 PLANNED

**Goal:** Reduce duplication by 60-100 lines, improve resilience to 99%

**Files affected:**
- `src/services/request_processor.ts`
- `src/services/reflexive_agent.ts`
- `src/services/health_check_service.ts`
- `src/services/db.ts`
- `src/services/confidence_scorer.ts`

**Architecture improvements:**
1. Create `src/services/middleware/middleware.ts` - Middleware pattern
2. Create `src/services/decorators/logging_decorator.ts` - Decorator pattern
3. Create `src/services/resilience/circuit_breaker.ts` - Circuit breaker
4. Create `src/services/utils/error_utils.ts` - Error handling utilities

**Design patterns:**
- **Middleware**: Request processing pipeline
- **Decorator**: Cross-cutting concerns (logging, metrics)
- **Circuit Breaker**: Fault tolerance and resilience

**Success criteria:**
- [ ] Service coupling <4 (from 6-8)
- [ ] Error recovery >85% (from 50%)
- [ ] Logging consistency >95% (from 65%)
- [ ] Duplication <15 lines
- [ ] System uptime 99%

---

## Phase 33.6: Metrics & CI/CD Integration 📋 PLANNED

**Goal:** Establish continuous monitoring and quality gates

**CI/CD integration:**

```yaml
# .github/workflows/code-quality.yml
- name: Check duplication
  run: npx jscpd src/ tests/ --threshold 2

- name: Check complexity
  run: npx complexity-report src/ --threshold 10

- name: Check coupling
  run: npx madge --circular src/ --no-spinner

- name: Generate metrics dashboard
  run: npm run metrics:generate
```

**Measurement commands:**

```bash
# Code duplication
npx jscpd src/ tests/ --min-lines 5 --threshold 2

# Complexity analysis
npx complexity-report src/ --threshold 10

# Coupling analysis
npx madge --circular --extensions ts src/

# Maintainability
npx ts-complex src/

# Test coverage
deno test --coverage=coverage/
deno coverage coverage/ --lcov > coverage.lcov
```

**Success criteria:**
- [ ] CI/CD pipeline includes quality gates
- [ ] Metrics dashboard automated
- [ ] Threshold violations fail builds
- [ ] Weekly metrics reports generated

---

## Implementation Checklist

- [ ] **33.1** TUI Views Refactoring
  - [x] Create/Enhance base view class <!-- standardized handleKey in BaseTreeView -->
  - [x] Extract event handlers <!-- handleNavigationKeys, handleDialogKeys, handleHelpKeys -->
  - [ ] Extract rendering utilities
  - [x] Refactor all views <!-- standardized handleKey in 9 views -->
  - [x] Update tests <!-- updated all TUI tests -->
- [ ] **33.2** Test Helpers Refactoring
  - [ ] Create builder pattern
  - [ ] Create factory pattern
  - [ ] Create custom assertions
  - [ ] Refactor all test files
  - [ ] Verify test performance
- [ ] **33.3** CLI Commands Refactoring
  - [ ] Implement command pattern
  - [ ] Create validation chain
  - [ ] Implement error strategies
  - [ ] Refactor all commands
  - [ ] Update tests
- [ ] **33.4** Provider Factories Refactoring
  - [ ] Implement abstract factory
  - [ ] Create provider registry
  - [ ] Add lazy initialization
  - [ ] Refactor provider tests
  - [ ] Verify performance
- [ ] **33.5** Services Refactoring
  - [ ] Implement middleware pattern
  - [ ] Add logging decorators
  - [ ] Create circuit breakers
  - [ ] Refactor services
  - [ ] Update tests
- [ ] **33.6** Metrics & CI/CD
  - [ ] Set up measurement tools
  - [ ] Configure CI/CD pipeline
  - [ ] Create metrics dashboard
  - [ ] Document processes

---

## Success Metrics

### Code Quality Targets

- **Duplication:** <2% (from 4.06%)
- **Complexity:** <10 avg (from 12-18)
- **Coupling:** <5 avg (from 6-10)
- **Cohesion:** >0.8 (from 0.6)
- **Maintainability:** >80 (from 65-75)

### Performance Targets

- **Test execution:** 50% faster
- **Provider init:** 60% faster
- **Command response:** <100ms

### Architecture Targets

- **SOLID compliance:** 100%
- **Design patterns:** 8+ implemented
- **Tech debt:** <5% (from 8%)
- **Test coverage:** >90% (from 85%)

---

## Risk Assessment

**Medium Risk:** Large-scale refactoring across multiple modules with potential for regressions.

**Potential Issues:**

- Breaking existing functionality during refactoring
- Over-abstraction leading to complexity
- Team resistance to architectural changes
- Time overruns due to scope creep

**Mitigations:**

- Comprehensive test coverage before refactoring
- Incremental refactoring with continuous testing
- Keep abstractions simple and focused
- Document benefits and provide examples
- Strict adherence to 5-week timeline
- Weekly progress reviews

---

## Lessons Learned

*(To be filled in during implementation)*

### What Went Well

- TBD

### Challenges

- TBD

### Best Practices Established

- TBD

---

**Phase Status:** [/] IN PROGRESS
**Start Date:** TBD
**Target Completion:** TBD (5-6 weeks)
**Dependencies:** Code duplication analysis complete
