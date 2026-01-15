# Phase 27: ExoFrame Magic Number & Magic Word Externalization for True Configurability

## Executive Summary

This phase aims to make ExoFrame fully user-configurable by externalizing all hardcoded magic numbers, magic words, and lists from the source code. The goal is to move all user-facing configuration (timeouts, limits, model names, provider lists, etc.) into TOML configuration files (primarily `exo.config.toml` and `exo.config.sample.toml`), and all internal constants into dedicated `constants.ts` modules. For CLI/TUI-specific constants, separate config files will be considered. This will empower users to adapt ExoFrame to their needs without modifying source code, improving maintainability, portability, and user experience.

**Current Status:** Phase 4 (Configuration Migration) partially completed. Provider implementations use constants, but extensive hardcoded strings remain. Updated discovery run shows 200+ instances of magic words still in code. Phase 5 (Testing/Validation) and Phase 6 (Documentation) remain, plus significant additional work needed.

---

## Updated Magic Word Discovery Results (2026-01-14)

Re-ran the magic word discovery command and found 200+ instances of hardcoded strings that still need externalization:

### Key Categories Still Needing Work:

#### 1. Provider Names & Model Configurations

- **Location:** `src/ai/provider_registry.ts`, `src/ai/provider_factory.ts`
- **Issues:** Hardcoded provider arrays like `["ollama"]`, `["llama"]`, `["anthropic"]`, etc.
- **Impact:** Users cannot customize provider fallback chains without code changes

#### 2. Status Strings

- **Location:** Throughout services, schemas, CLI, TUI
- **Issues:** Status literals like `"pending"`, `"active"`, `"completed"`, `"failed"`, `"approved"`, `"rejected"`
- **Impact:** Status values scattered across codebase, inconsistent usage

#### 3. Agent/Model Names

- **Location:** `src/cli/`, `src/main.ts`, `src/config/`
- **Issues:** Default agent `"default"`, hardcoded model references
- **Impact:** Cannot customize default agents or models via config

#### 4. Schema Enums

- **Location:** `src/schemas/`, `src/services/`
- **Issues:** Zod enums with hardcoded string arrays instead of using TypeScript enums
- **Impact:** Type safety issues, cannot extend without code changes

#### 5. TUI/CLI Constants

- **Location:** `src/tui/`, `src/cli/`
- **Issues:** Hardcoded display strings, status mappings, grouping options
- **Impact:** UI behavior cannot be customized

### Sample Findings:

```
src/ai/provider_registry.ts:246:    return ["ollama"];
src/services/execution_loop.ts:38:  status: "pending" | "active" | "completed" | "failed";
src/cli/request_commands.ts:116:    const agent = options.agent || "default";
src/schemas/input_validation.ts:90:  provider: z.enum(["openai", "anthropic", "google", "ollama", "mock"]),
```

### Next Steps Required:

1. Convert remaining Zod string enums to use TypeScript enums
2. Externalize provider fallback chains to config
3. Create status enums for consistent status handling
4. Move default agent/model names to config
5. Create TUI/CLI configuration files for UI constants

---

## Prioritized Action Items (Updated 2026-01-14)

### High Priority (Blockers for User Configurability):

1. **Provider Fallback Chains** - Convert hardcoded arrays in `provider_registry.ts` to config-driven
2. **Status Enum Creation** - Create comprehensive status enums for requests, plans, executions, etc.
3. **Schema Enum Migration** - Convert all Zod string enums to use TypeScript enums
4. **Default Agent/Model Config** - Move `"default"` agent and model defaults to config

### Medium Priority (User Experience):

5. **TUI Constants Externalization** - Create `tui.config.ts` for display strings and behaviors
6. **CLI Constants Externalization** - Create `cli.config.ts` for command defaults
7. **Memory/Skill Status Enums** - Standardize status handling across memory bank and skills

### Low Priority (Polish):

8. **Icon/Color Mappings** - Externalize TUI display mappings
9. **Error Message Templates** - Move hardcoded error strings to constants
10. **Validation Rules** - Externalize schema validation parameters

## Goals

- Eliminate all hardcoded magic numbers and magic words from the codebase.
- Move user-facing configuration to `exo.config.sample.toml` (and `exo.config.toml`).
- Move internal-only constants to `src/constants.ts` (or module-specific constants files).
- For CLI/TUI, consider `cli.config.ts` and `tui.config.ts` for user-tunable UI/UX constants.
- Move all model/provider names, fallback chains, and task routing lists to configuration.
- Document all new config options with sensible defaults and comments.
- Ensure backward compatibility and provide migration guidance.

---

## Scope

- All modules in `src/` (TypeScript/JavaScript).
- All CLI and TUI modules.
- All configuration and provider strategy logic.
- Excludes test files and mock/test-only constants.

---

## Implementation Steps

### 1. Magic Number & Word Discovery ✅ **COMPLETED**

- Used the following shell command to identify hardcoded numbers (excluding 0, 1, -1, booleans):

  ```sh
  grep -rEn --include='*.ts' --include='*.js' --include='*.tsx' --include='*.jsx' --exclude-dir='tests' --exclude-dir='test' --exclude-dir='__tests__' --exclude-dir='node_modules' '([^a-zA-Z_]|^)([2-9][0-9]*|[1-9][0-9]{2,}|0\.[0-9]+|[1-9]\.[0-9]+|-[2-9][0-9]*|-[1-9][0-9]{2,})' src/
  ```

- Command executed successfully (Exit Code: 0). Results saved to `magic_numbers.txt`.
- Used similar grep commands to find magic words and lists (e.g., model names, provider names, status strings):

  ```sh
  grep -rEn --include='*.ts' --include='*.js' --include='*.tsx' --include='*.jsx' --exclude-dir='tests' --exclude-dir='test' --exclude-dir='__tests__' --exclude-dir='node_modules' '"(ollama|anthropic|openai|google|gpt|claude|gemini|llama|sonnet|opus|haiku|pro|flash|default|fast|local|premium|simple|medium|complex|code_generation|approved|pending|rejected|active|archive|plan|request|report|token|quota|timeout|limit|chain|budget|task|agent|flow|portal|memory|journal|watcher|debounce|ms|sec|minute|hour|day|month|year|true|false)"' src/
  ```

- Results saved to `magic_words.txt`.
- Created classification spreadsheet (`classification_spreadsheet.md`) reviewing all matches and classifying them as:
  - User-facing configuration (should go to TOML)
  - Internal constant (should go to `constants.ts`)
  - Enum (should go to enums)
  - Keep as-is (e.g., HTTP codes)

### 1.1. Review and Prioritization ✅ **COMPLETED**

- Reviewed findings and prioritized high-impact items:
  - High priority: timeouts, retry parameters, model names, provider defaults
  - Medium priority: task complexity, pricing tiers, status enums
  - Low priority: hash constants, minor numbers
- Estimated effort: Low for externalizing to config, medium for creating enums
- Created backlog based on classification spreadsheet

### 2. Refactoring Plan ✅ **COMPLETED**

#### 2.1. Enum Creation ✅ **COMPLETED**

- Created `src/enums.ts` with enums for:
  - `ProviderType`: "ollama", "anthropic", "openai", "google", "mock"
  - `TaskComplexity`: "simple", "medium", "complex"
  - `PricingTier`: "local", "free", "low", "medium", "high"
  - `SecuritySeverity`: "low", "medium", "high", "critical"
  - `ExecutionStatus`: "pending", "active", "completed", "failed"
  - `ConfidenceLevel`: "low", "medium", "high"
  - `PriorityLevel`: numeric priorities for sorting

#### 2.2. Constants Creation ✅ **COMPLETED**

- Created `src/constants.ts` with internal constants:
  - HTTP status codes (401, 403, 429, 500)
  - Default retry parameters (maxAttempts: 3, backoffBaseMs: 1000)
  - Mock provider defaults (delay: 500ms, tokens: 100/50)
  - Health check timeout (5000ms)

#### 2.3. Code Migration ✅ **COMPLETED**

- Updated `src/ai/providers.ts` to use `ProviderType` enum in switch statements
- Updated `src/ai/provider_common_utils.ts` to use HTTP constants and default retry parameters
- Updated `src/ai/provider_registry.ts` to use `PricingTier` enum and `PriorityLevel` enum
- Updated `src/ai/providers/mock_llm_provider.ts` to use mock constants
- Updated all test files to use enum values instead of string literals
- All changes maintain backward compatibility and pass existing tests
- Full test suite passes: 2855 tests passed, 0 failed

### Phase 4: Configuration Migration (Days 3-4) 🔄 **PARTIALLY COMPLETED**

**Status:** Basic configuration migration started but extensive hardcoded strings remain. Provider implementations use constants, but 200+ magic words still need externalization.

**Completed:**
- Basic enum creation and constants setup
- Provider implementations migrated to use constants
- Initial config schema updates

**Remaining Work:**
1. **Update exo.config.sample.toml**
   - Add new sections for user-facing config (e.g., `[system]`, `[provider_strategy]`, `[cli]`, `[tui]`).
   - Add comments and defaults for each option.
   - Example additions:

    ```toml
     [system]
     debounce_ms = 200
     watcher_timeout_sec = 60

     [provider_strategy]
     supported_models = ["ollama", "anthropic", "openai", "google"]
     fallback_chains = { free = ["ollama", "mock"], paid = ["anthropic", "openai"] }
     task_routing = { simple = ["ollama"], complex = ["anthropic"] }
    ```

2. **Update Config Schema**
   - Modify `src/config/schema.ts` to include new config options.
   - Add validation rules.

3. **Update Config Loading**
   - Modify `src/config/ai_config.ts` to load new options with defaults.
   - Ensure backward compatibility.

4. **Replace Code with Config Reads**
   - Update code to read from config instead of hardcoded values.
   - Example: Replace `const timeout = 30000;` with `const timeout = config.system.watcher_timeout_sec * 1000;`.

### Phase 4.1: Status Enum Creation (Additional) 🔄 **REQUIRED**

**New Phase Added:** Create comprehensive status enums to replace scattered status strings.

1. **Create Status Enums**
   - `RequestStatus`: "pending", "in_progress", "completed", "failed"
   - `PlanStatus`: "pending", "approved", "rejected", "unknown"
   - `MemoryStatus`: "pending", "approved", "rejected", "archived"
   - `SkillStatus`: "draft", "active", "deprecated"

2. **Migrate Status Usage**
   - Update all services, schemas, CLI, and TUI to use status enums
   - Ensure consistent status handling across the codebase

### Phase 4.2: Schema Enum Migration (Additional) 🔄 **REQUIRED**

**New Phase Added:** Convert remaining Zod string enums to TypeScript enums.

1. **Identify Zod String Enums**
   - `src/schemas/input_validation.ts`: provider enum
   - `src/schemas/agent_executor.ts`: various enums
   - `src/services/agent_executor.ts`: provider enum
   - All schema files with hardcoded string arrays

2. **Create/Migrate to TypeScript Enums**
   - Convert to `z.nativeEnum()` usage
   - Ensure type safety and extensibility

---

## Deliverables

- All magic numbers/words/lists externalized to config or constants files.
- Updated `exo.config.sample.toml` and documentation.
- New/updated `constants.ts`, `cli.config.ts`, `tui.config.ts` as needed.
- Migration guide and validation scripts.
- PR with detailed commit messages and code review notes.

---

## Step-by-Step Implementation Plan

### Phase 1: Discovery and Analysis (Day 1)

1. **Run Magic Number Discovery**
   - Execute the grep command for magic numbers in `src/`.
   - Save output to a file (e.g., `magic_numbers.txt`).
   - Review each match: Exclude false positives (e.g., version numbers, imports), classify as user-config or internal constant.

2. **Run Magic Word Discovery**
   - Execute the grep command for magic words in `src/`.
   - Save output to a file (e.g., `magic_words.txt`).
   - Classify each match: User-facing (TOML), internal (constants), CLI/TUI (config files), or enum candidates.

3. **Create Classification Spreadsheet**
   - Create a CSV or Markdown table listing all findings with columns: File, Line, Value, Type, Classification, Action.
   - Prioritize: Start with high-impact items (e.g., model names, timeouts).

4. **Review and Prioritize**
   - Identify dependencies (e.g., enums needed before config changes).
   - Estimate effort for each item.
   - Create a prioritized backlog.

### Phase 2: Enum Creation and Constants Setup (Day 2)

1. **Create Enum Files**
   - Create `src/enums.ts` for global enums.
   - Define enums like:

    ```typescript
    export enum TaskComplexity { SIMPLE = 'simple', MEDIUM = 'medium', COMPLEX = 'complex' }
    export enum ProviderName { OLLAMA = 'ollama', ANTHROPIC = 'anthropic', OPENAI = 'openai', GOOGLE = 'google' }
    export enum RequestStatus { PENDING = 'pending', APPROVED = 'approved', REJECTED = 'rejected' }
    ```

2. **Create Constants Files**
   - Create `src/constants.ts` for internal constants.
   - Move internal magic numbers/words (e.g., `export const DEFAULT_TIMEOUT_MS = 30000;`).

3. **Create CLI/TUI Config Files**
   - Create `src/cli/cli.config.ts` with user-tunable CLI constants.
   - Create `src/tui/tui.config.ts` with user-tunable TUI constants.

4. **Update Code to Use Enums/Constants**
   - Replace string literals with enums (e.g., `'simple'` → `TaskComplexity.SIMPLE`).
   - Replace magic numbers with constants.
   - Run tests after each change to ensure no breakage.

### Phase 3: Configuration Migration (Days 3-4)

1. **Update exo.config.sample.toml**
   - Add new sections for user-facing config (e.g., `[system]`, `[provider_strategy]`, `[cli]`, `[tui]`).
   - Add comments and defaults for each option.
   - Example additions:

    ```toml
    [system]
    debounce_ms = 200
    watcher_timeout_sec = 60

    [provider_strategy]
    supported_models = ["ollama", "anthropic", "openai", "google"]
    fallback_chains = { free = ["ollama", "mock"], paid = ["anthropic", "openai"] }
    task_routing = { simple = ["ollama"], complex = ["anthropic"] }
    ```

2. **Update Config Schema**
   - Modify `src/config/schema.ts` to include new config options.
   - Add validation rules.

3. **Update Config Loading**
   - Modify `src/config/ai_config.ts` to load new options with defaults.
   - Ensure backward compatibility.

4. **Replace Code with Config Reads**
   - Update code to read from config instead of hardcoded values.
   - Example: Replace `const timeout = 30000;` with `const timeout = config.system.watcher_timeout_sec * 1000;`.

### Phase 4: Testing and Validation (Day 5)

1. **Unit Tests**
   - Add tests for enum usage and constant values.
   - Test config loading with new options.
   - Verify defaults are applied correctly.

2. **Integration Tests**
   - Test end-to-end with config changes (e.g., change timeout in TOML, verify behavior).
   - Test CLI/TUI with custom config values.

3. **Linting and Validation**
   - Run the grep commands again to ensure no new magic numbers/words.
   - Add a CI check for this.

4. **Manual Testing**
   - Test ExoFrame with only config changes (no code edits).
   - Verify all features work as expected.

### Phase 5: Documentation and Migration (Day 6)

1. **Update Documentation**
   - Update `docs/dev/ExoFrame_Technical_Spec.md` to reflect config-driven approach.
   - Update `docs/Provider_Strategy_Guide.md` with new config options.

2. **Create Migration Guide**
   - Write `docs/dev/Migration_Guide_Phase27.md` with step-by-step instructions for users.
   - Include examples of config changes.

3. **Update Agent Instructions**
   - Revise `.copilot/README.md` with new policies and checklists.

4. **Update Development Guidelines**
   - Update `CONTRIBUTING.md` with detailed instructions for adding config/options.

### Phase 6: Final Review and Deployment (Day 7)

1. **Code Review**
   - Ensure all changes are reviewed and approved.
   - Verify no magic numbers/words remain.

2. **Final Testing**
   - Run full test suite.
   - Perform manual QA.

3. **Deployment**
   - Merge PR with detailed commit messages.
   - Update release notes.

4. **Post-Deployment**
   - Monitor for issues.
   - Gather user feedback.

---

## Timeline (Updated 2026-01-14)

**Revised Timeline:** Original 7-day plan underestimated scope. 200+ magic words discovered requiring additional phases.

- **Day 1:** Magic number/word discovery ✅ **COMPLETED**
- **Day 2:** Initial enum creation and basic migration ✅ **COMPLETED**
- **Days 3-4:** Configuration migration 🔄 **PARTIALLY COMPLETED** (basic config started)
- **Days 5-6:** Status enum creation and schema migration 🔄 **REQUIRED** (new phases)
- **Days 7-8:** Provider fallback chains externalization 🔄 **REQUIRED**
- **Days 9-10:** TUI/CLI constants externalization 🔄 **REQUIRED**
- **Days 11-12:** Testing, validation, and documentation 🔄 **PENDING**
- **Day 13:** Final review and deployment 🔄 **PENDING**

**Total Estimated Effort:** 13 days (vs original 7 days)
**Additional Work Identified:** 200+ magic word instances requiring systematic externalization

## Risks & Mitigations

- **Risk:** Breaking changes for existing users.
  - **Mitigation:** Provide migration guide, maintain backward compatibility, add config validation.
- **Risk:** Over-configuration leading to complexity.
  - **Mitigation:** Sensible defaults, clear documentation, group related options.
- **Risk:** Missed magic numbers/words.
  - **Mitigation:** Comprehensive search, code review, and user feedback.

---

## Additional Tasks

### Update Agent Instructions in `.copilot/`

- Revise `.copilot/README.md` and any agent onboarding docs to instruct contributors to:
  - Never introduce new magic numbers or magic words in code.
  - Always add user-facing configuration to TOML files (`exo.config.sample.toml`).
  - Use `constants.ts`, `cli.config.ts`, or `tui.config.ts` for internal constants.
  - Reference the migration guide for updating legacy code.
  - Include a checklist in PR templates to verify no magic numbers/words were added.

### Update Development Guidelines

- Update `CONTRIBUTING.md` and/or `docs/dev/Development_Guidelines.md` to include:
  - Policy: No magic numbers/words in code; all must be externalized.
  - How to add new config options: Add to `exo.config.sample.toml` with documentation, update schema in `src/config/schema.ts`, and provide defaults in `src/config/ai_config.ts`.
  - How to update and use constants files: Create or update `constants.ts` for internal values, ensure named exports.
  - How to write tests for new configuration options: Include unit tests for config loading and integration tests for behavior changes.
  - How to validate that no new magic numbers/words are introduced: Use the provided grep commands in CI/linting, add a pre-commit hook.
  - Migration path for existing contributors: Link to the migration guide and provide examples.

---

## Success Criteria (Updated 2026-01-14)

**Phase 1 Success (Completed):**
- Magic number/word discovery completed with comprehensive findings
- Initial enum creation and basic constants setup done
- Provider implementations migrated to use constants

**Phase 2-4 Success (In Progress):**
- All user-facing configuration externalized to TOML files (provider fallback chains, default agents, timeouts)
- All internal constants moved to dedicated constants/enums files
- No hardcoded model/provider names in core provider logic
- Status enums created and consistently used across services
- Zod string enums converted to TypeScript enum usage
- TUI/CLI constants externalized to config files

**Final Success:**
- Zero magic words found by discovery grep commands
- Users can fully configure ExoFrame behavior without code changes
- All tests pass with externalized configuration
- Comprehensive documentation and migration guides provided
- CI validation prevents new magic numbers/words from being introduced

---

## Appendix: Example Config Additions

```toml
# exo.config.sample.toml

[system]
debounce_ms = 200
watcher_timeout_sec = 60

[provider_strategy]
fallback_chains = { free = ["ollama", "mock"], paid = ["anthropic", "openai"] }
task_routing = { simple = ["ollama", "google"], complex = ["anthropic", "openai"] }
supported_models = ["ollama", "anthropic", "openai", "google"]
max_daily_cost_usd = 10.00

[cli]
command_timeout_sec = 30
default_log_level = "info"

[tui]
refresh_interval_ms = 1000
theme = "dark"
```

---

## Related Documents

- [Phase 26: LLM Provider Flexibility & Multi-Model Support Strategy](./phase-26-llm-provider-flexibility.md)
- [Provider Strategy Guide](../../docs/Provider_Strategy_Guide.md)
- [ExoFrame Technical Specification](../../docs/dev/ExoFrame_Technical_Spec.md)

---

**Document Status:** Draft
**File Destination:** `.copilot/planning/phase-27-magic-number-word-externalization.md`
**Author:** GitHub Copilot
**Date:** 2026-01-14
