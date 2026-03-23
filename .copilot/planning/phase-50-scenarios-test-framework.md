# Phase 50: Scenario Test Framework for Deployed Workspaces

## Status: PLANNING

## Executive Summary

I consulted `.copilot/docs/documentation.md` for plan structure, `.copilot/cross-reference.md` for task-to-doc routing, `.copilot/source/exaix.md` for the runtime and request pipeline, and the existing manual validation sources in `docs/dev/Agent_Validation_Requests.md` and `docs/dev/Exaix_Manual_Test_Scenarios.md` as the migration baseline.

This phase defines a reusable scenario test framework that validates Exaix behavior through deployed workspaces rather than through internal service calls. The first target is Phases 45–49, but the framework must be generic enough to support future request lifecycle, portal, TUI, provider, and operational scenarios.

The framework should live entirely under `tests/`, carry its own fixtures and support files, and be deployable into an arbitrary destination outside both `~/git/Exaix` and `~/Exaix`. Scenario requests must be stored as editable text files rather than embedded inline in TypeScript or YAML. The runner should execute in `auto`, `step`, and `manual-checkpoint` modes so the same framework supports both fast regression runs and human-in-the-loop validation.

---

## Problem Statement

Current validation for real deployed workspaces is split across long manual guides and ad hoc CLI usage:

1. `docs/dev/Exaix_Manual_Test_Scenarios.md` provides broad manual release coverage, but it is slow and expensive to run.
1. `docs/dev/Agent_Validation_Requests.md` contains realistic request prompts, but they are documented as prose instead of executable assets.
1. Recent phases 45–49 introduced request-analysis, portal-knowledge, clarification, acceptance-criteria, and quality-hardening behavior that is best validated at the deployed-workspace boundary.
1. There is no isolated, deployable framework that can be copied elsewhere and run without relying on the repository checkout as its execution home.

The result is a gap between unit or integration coverage inside the repo and realistic validation of the deployed system as users actually operate it.

---

## Phase Goals

### Primary Goals

- [ ] Create a reusable deployed-workspace scenario framework under `tests/`.
- [ ] Keep all framework code, fixtures, scenario definitions, and support assets inside one dedicated subtree.
- [ ] Ensure request inputs are stored as plain editable text files and referenced by path, not embedded inline in code or scenario metadata.
- [ ] Support deployment of the framework into an arbitrary external destination for execution outside `~/git/Exaix` and `~/Exaix`.
- [ ] Validate Phases 45–49 as the initial scenario pack.
- [ ] Design the framework so additional scenario packs can be added for unrelated features later.

### Secondary Goals

- [ ] Preserve pause-and-inspect workflows with `step` and `manual-checkpoint` execution modes.
- [ ] Standardize evidence capture so every run produces comparable artifacts.
- [ ] Provide a migration path from manual scenario documents into executable scenarios.
- [ ] Support deterministic CI execution using a predefined list of scenarios or scenario tags.
- [ ] Support validation runs that mount portals pointing to repositories other than Exaix.
- [ ] Maintain an internal unit test suite for the framework itself so core runner logic is validated independently from deployed-workspace scenarios.

### Non-Goals

- [ ] Replace all existing unit and integration tests.
- [ ] Automate the entire TUI surface in Phase 50.
- [ ] Hard-code the framework around only Phases 45–49.
- [ ] Depend on internal service APIs as the primary validation boundary.

---

## Key Decisions

### 1. Validation Boundary

The framework will validate behavior through deployed-workspace interfaces:

- `exactl` commands
- workspace files and folders
- request, plan, review, and journal artifacts
- portal state and derived knowledge artifacts

It should not use internal service APIs as the main assertion boundary unless a helper is purely infrastructural.

### 2. Request Assets Must Be File-Based

Scenario request content must be stored as standalone text fixtures, for example `.md` or `.txt` files, under the framework tree.

Reasons:

- requests remain easy to edit without touching TypeScript
- long prompts stay readable and reviewable
- the same request text can be reused across modes and environments
- scenarios reference request files by path instead of embedding multi-line prompt bodies

This is a hard design constraint for the framework, not just a style preference.

### 3. Framework Must Be Self-Contained Under `tests/`

The framework must be implemented under a dedicated subtree inside `tests/`, with all dependent artifacts kept within that subtree. That includes:

- runner code
- schema or DSL definitions
- fixture requests
- expected output samples where needed
- support scripts
- deployment helpers
- documentation specific to the framework

This makes the framework portable, reviewable, and easier to evolve independently from unrelated tests.

### 4. Framework Must Be Deployable Elsewhere

The framework should be copyable or deployable into another destination folder outside both the repository checkout and the main deployed workspace. That external destination becomes the framework's execution home while it targets a chosen Exaix workspace under test.

This avoids accidental coupling to repo-relative paths and forces the framework to treat the deployed workspace as an external system.

### 5. Phases 45–49 Are the Initial Pack, Not the Whole Product

Phase 50 should produce a generic scenario framework plus an initial `phase45_49` scenario pack. Future packs should be addable without redesigning the runner.

### 6. Each Step Must Declare Measurable Criteria

Every scenario step should declare explicit measurable criteria for both its expected inputs and its expected outputs.

Examples:

- expected input files exist before execution
- expected request fixture is resolvable and non-empty
- expected command arguments or environment keys are present
- expected artifact path is created after execution
- expected JSON field, frontmatter field, or journal event is observable

These criteria should be used for two purposes:

- precondition and postcondition validation at runtime
- structured failure manifests that explain exactly which step contract failed

### 7. CI Execution Is a First-Class Requirement

The framework must support non-interactive CI execution using a predefined scenario selection, such as a scenario id list, pack list, or tag filter.

CI mode should favor deterministic, bounded runs and produce machine-readable summaries suitable for build logs and artifact upload.

### 8. Portal Mounting Must Not Be Exaix-Specific

The framework must be able to mount and validate portals that target other repositories, not just the Exaix codebase.

This affects:

- scenario schema
- deployment configuration
- fixture organization
- preflight validation
- scenario pack design

---

## Proposed Repository Layout

```text
tests/
└── scenario_framework/
      ├── README.md
      ├── runner/
      │   ├── main.ts
      │   ├── config.ts
      │   ├── scenario_loader.ts
      │   ├── step_executor.ts
      │   ├── evidence_collector.ts
      │   ├── assertions/
      │   └── modes/
      ├── tests/
      │   ├── unit/
      │   ├── fixtures/
      │   └── integration/
      ├── schema/
      │   ├── scenario_schema.ts
      │   └── step_schema.ts
      ├── fixtures/
      │   ├── requests/
      │   │   ├── phase45_49/
      │   │   └── shared/
      │   ├── expected/
      │   └── portals/
      ├── scenarios/
      │   ├── phase45_49/
      │   ├── smoke/
      │   └── provider_live/
      ├── scripts/
      │   ├── deploy_framework.ts
      │   └── run_scenarios.ts
      ├── templates/
      │   └── scenario_template.yaml
      └── output/
            └── .gitkeep
```

Notes:

- `fixtures/requests/` stores editable prompt text files.
- `scenarios/` stores declarative scenario definitions that reference fixture files.
- `tests/unit/` stores internal framework unit tests for schema validation, step execution, criteria evaluation, mode control, and manifest generation.
- `scripts/deploy_framework.ts` packages or copies the framework into an external destination.
- `output/` is for local development only; deployed runs should write to the chosen external destination.

---

## Framework Architecture

### Scenario Model

Each scenario should be declarative and composed of ordered steps. The schema should support at least:

- metadata: id, title, tags, scenario pack, risk, mode compatibility
- environment preconditions
- request fixture references
- portal mount declarations
- step list
- evidence expectations
- cleanup rules

Each step should also carry a measurable contract:

- declared input criteria that must hold before the step runs
- declared output criteria that must hold after the step completes
- failure messages or manifest-friendly labels for each criterion

This lets the runner distinguish setup failures, execution failures, and validation failures at step granularity.

Representative step types:

- `shell`
- `exactl`
- `wait-for-file`
- `wait-for-status`
- `wait-for-json-field`
- `journal-assert`
- `frontmatter-assert`
- `file-contains`
- `manual-review`
- `cleanup`

### Execution Modes

- `auto`: run all steps without interaction and fail fast on assertion errors.
- `step`: run exactly one step at a time and wait for explicit continuation.
- `manual-checkpoint`: run until designated checkpoints, then pause and present evidence.

### Evidence Model

Every scenario run should capture:

- stdout and stderr for each step
- executed commands
- trace ids, request ids, plan ids, review ids when created
- copied request artifacts
- `_analysis.json` and `_clarification.json` snapshots where applicable
- journal excerpts used by assertions
- a final machine-readable run summary

The run summary should include criterion-level failures so a failed run can report:

- which step failed
- whether the failure was input validation, execution, or output validation
- which measurable criterion was unmet
- which evidence artifacts support the failure

### Portability Model

The framework must operate with explicit paths rather than assuming repo-relative execution:

- framework home: where the framework was deployed
- workspace under test: the deployed Exaix instance
- optional portal roots: repositories or folders mounted into that workspace
- output directory: where evidence and reports are written

The portal model must support multiple mounted portals, including repositories unrelated to Exaix.

### CI Model

The framework should support a CI-friendly entry point with:

- predefined scenario selection by ids, packs, or tags
- non-interactive execution
- stable exit codes
- machine-readable result manifests
- explicit skipping rules for provider-live or manual-checkpoint scenarios when not allowed in CI

### Runner Entry-Point CLI Interface

The `run_scenarios.ts` entry point should accept the following flags:

- `--config <path>`: path to the runtime configuration YAML or JSON file
- `--workspace <path>`: workspace under test (overrides config file value)
- `--output <path>`: output directory for evidence and manifests (overrides config)
- `--mode <auto|step|manual-checkpoint>`: execution mode (overrides config)
- `--profile <ci-smoke|ci-core|ci-extended>`: CI profile filter
- `--scenario <id>`: run a single named scenario (repeatable for multiple ids)
- `--pack <name>`: run all scenarios in a named pack (repeatable)
- `--tag <tag>`: filter by tag (repeatable; union of all tags provided)
- `--dry-run`: validate configuration and scenario definitions without executing any steps

Flag precedence: explicit CLI flags override file-provided config values for the same setting. `--scenario`, `--pack`, and `--tag` are additive selection sources that follow the precedence order in Contract 4.

---

## Formalized Design Contracts

This section closes the previously identified design gaps by defining the contracts that implementation must follow.

### 1. Scenario Schema Contract

Each scenario document should use a stable top-level contract with these required fields:

- `id`: unique scenario identifier
- `title`: human-readable title
- `pack`: owning scenario pack
- `tags`: selection and profile tags
- `request_fixture`: relative path to the request text file
- `mode_support`: allowed execution modes
- `portals`: declared portal mounts
- `steps`: ordered executable steps

Optional top-level fields:

- `description`
- `risk`
- `ci_profile`
- `timeouts`
- `cleanup`
- `expected_artifacts`
- `metadata`

Each step should use a stable contract with these required fields:

- `id`: unique within the scenario
- `type`: step kind
- `input_criteria`
- `output_criteria`

Optional step fields:

- `name`
- `command`
- `args`
- `env`
- `timeout_sec`
- `checkpoint`
- `instructions`
- `continue_on_failure`
- `artifact_refs`

Defaulting rules:

- `continue_on_failure` defaults to `false`
- omitted `env` means no step-specific environment overrides
- omitted `timeout_sec` inherits the scenario or runner default

Versioning rule:

- scenario schema must expose an explicit version field once the first implementation lands so future changes can remain backward-compatible

### 2. Criterion Taxonomy and Result Contract

Allowed criterion kinds in the first implementation should be explicitly bounded to a known set:

- `file-exists`
- `file-found`
- `file-not-exists`
- `text-contains`
- `json-path-exists`
- `json-path-equals`
- `json-path-equals-any`
- `frontmatter-field-exists`
- `frontmatter-field-equals`
- `journal-event-exists`
- `command-exit-code`
- `status-equals`
- `portal-mounted`
- `env-var-present`

Criterion kind disambiguation:

- `file-exists` requires an exact file path and passes when that precise path exists on the filesystem.
- `file-found` accepts a glob pattern and passes when at least one path matching the pattern exists.
- `file-not-exists` requires an exact path and passes when no file exists at that path.
- `text-contains` applies to an exact file path and passes when the file content includes the specified string or regex pattern.

Each criterion result in the manifest should include:

- `criterion_id`
- `kind`
- `phase`: `input` or `output`
- `status`: `passed`, `failed`, `skipped`, `error`, `timeout`, or `blocked`
- `message`
- `evidence_refs`
- `observed_value`
- `expected_value`

Rules:

- input criteria must be evaluated before step execution
- output criteria must be evaluated only after a step reaches an execution result
- `blocked` is used when a downstream criterion cannot run because an upstream prerequisite already failed
- `timeout` is reserved for bounded waits and command execution timeouts

### 3. Failure Manifest Contract

Every scenario run should emit a machine-readable manifest with at least:

- run metadata: scenario id, pack, mode, timestamps, selected profile
- execution summary: total steps, passed, failed, skipped, blocked
- per-step records: step id, step type, command summary, execution status
- per-criterion records using the criterion result contract
- evidence references to raw outputs and copied artifacts
- final outcome classification

Final outcome classes:

- `success`
- `scenario-failure`
- `configuration-failure`
- `environment-failure`
- `framework-failure`

### 4. CI Profile and Skip Policy Contract

The framework should support fixed CI profiles from the start:

- `ci-smoke`: shortest deterministic subset, no provider-live, no manual checkpoints
- `ci-core`: broader non-interactive coverage, still no manual checkpoints
- `ci-extended`: allowed to include slower scenarios when environment prerequisites are satisfied

Scenario selection precedence:

1. explicit scenario ids
1. explicit pack selection
1. tag filters
1. profile defaults

Allowed skip reasons:

- `interactive-not-allowed`
- `provider-disabled`
- `missing-env`
- `missing-portal`
- `unsupported-platform`
- `profile-excluded`
- `prerequisite-failed`

Exit code contract:

- `0`: all selected scenarios passed, or were skipped for allowed reasons under the chosen policy
- `1`: one or more scenarios failed validation
- `2`: invalid framework configuration, schema violation, or malformed scenario definition
- `3`: environment or infrastructure setup failure prevented execution

### 5. Portal Provisioning Lifecycle Contract

Portal handling should follow a fixed lifecycle:

1. declare portal aliases and source paths in scenario or runtime config
1. preflight-validate source paths and alias uniqueness
1. mount missing portals
1. verify mounted portal resolves to the expected source path
1. reuse existing compatible mounts when allowed
1. clean up framework-owned temporary mounts after execution

Alias collision policy:

- fail by default if an alias already exists with a different source path
- allow reuse only when alias and source path both match exactly
- require explicit override flags for destructive remount behavior

Cleanup policy:

- never remove user-owned mounts implicitly
- remove only mounts created by the framework in the current run
- record portal lifecycle actions in the run manifest

### 6. Framework Test Layer Matrix Contract

The framework should enforce four test layers:

- `unit`: pure logic tests for schema, criteria, manifest writing, selection, and config resolution
- `synthetic-integration`: runner tests using fake steps and synthetic artifacts only
- `deployed-workspace-scenario`: real workspace validation against `exactl`, files, and journals
- `provider-live`: optional paid or external-provider scenarios

Layer rules:

- unit and synthetic-integration tests must run in standard CI
- deployed-workspace scenarios must be selectively runnable and profile-gated
- provider-live scenarios must be opt-in and excluded from default CI
- failures should be reported with the layer they came from to avoid conflating framework bugs with product behavior

### 7. Runtime Configuration Contract

The runner must accept a runtime configuration document with these defined fields.

Required fields:

- `workspace_path`: absolute path to the deployed Exaix instance under test
- `output_dir`: absolute path where evidence, manifests, and run artifacts are written

Optional fields with defaults:

- `framework_home`: absolute path to the deployed framework; defaults to the directory containing the runner entry point
- `portals`: map of portal alias to absolute source path; overrides scenario-declared paths when present
- `profile`: CI profile name (`ci-smoke`, `ci-core`, `ci-extended`) or empty string for default; defaults to `ci-smoke` in non-interactive mode and `auto` in interactive mode
- `mode`: execution mode (`auto`, `step`, `manual-checkpoint`); defaults to `auto`
- `timeout_sec`: default step and criterion wait timeout in seconds; defaults to `120`
- `allow_dirty_workspace`: permit running against a workspace with in-progress requests; defaults to `false`

Configuration delivery rules:

- Config may be provided as a YAML or JSON file via a `--config` flag, or as individual CLI flags
- CLI flags override file-provided values for any field
- Unknown top-level fields are rejected with a `configuration-failure` outcome before any scenario executes
- Missing required fields (`workspace_path`, `output_dir`) emit a `configuration-failure` before any scenario executes

Manifest integration:

- Resolved runtime config (after CLI flag merging) must be recorded in the run manifest header
- API keys, tokens, and secrets must not appear in the recorded config; use opaque placeholder references instead

---

## Initial Scenario Packs

### Pack A: `phase45_49`

This is the initial consumer of the framework.

Coverage targets:

1. Phase 45 request intent analysis
1. Phase 46 portal knowledge and codebase awareness
1. Phase 47 quality gate, enrichment, and clarification
1. Phase 48 acceptance criteria propagation and goal-aware evaluation
1. Phase 49 hardening: memory-aware analysis, structured frontmatter, and content-based complexity

### Pack B: `smoke`

A small cross-cutting pack intended for quick confidence checks after deployment or before demos.

### Pack C: `provider_live`

Longer-running scenarios that validate real-provider behavior using curated request fixtures migrated from `docs/dev/Agent_Validation_Requests.md`.

These should remain optional and tagged clearly because they are slower and may incur cost.

---

## Draft Implementation Steps

> **Sequencing Note:** All implementation steps follow TDD-first order per project mandatory standards. Within each step, the "Planned Unit Tests" are written before the corresponding implementation code. Steps are sequenced so earlier steps produce stable interfaces that later steps build against. No step is considered complete until its listed unit tests pass.

## Step 1: Define the Framework Contract

### Actions

- [x] Freeze the scenario schema contract, criterion taxonomy, manifest contract, CI profile contract, portal lifecycle contract, runtime configuration contract, and framework test-layer matrix in code-facing types and docs.
- [x] Create the `tests/scenario_framework/` subtree.
- [x] Define naming conventions for scenarios, fixtures, outputs, and scenario packs.
- [x] Write the initial scenario schema and step schema.
- [x] Document the path model: framework home, workspace under test, portal roots, output directory.
- [x] Include criterion schemas for per-step input and output validation.
- [x] Include schema support for multiple named portal mounts targeting arbitrary repositories.
- [x] Register `scenario:test` and `scenario:test:unit` tasks in `deno.json` so framework internal tests run via standard commands without requiring a deployed workspace.

### Justification

The framework needs stable contracts before implementation begins, otherwise scenario content will get coupled to ad hoc runner behavior.

### Success Criteria

- [x] The formalized design contracts are documented and stable enough to code against.
- [x] A schema exists for scenarios and step definitions.
- [x] The schema can express external request fixture paths.
- [x] The schema can express measurable input and output criteria for each step.
- [x] The schema can express multiple non-Exaix portal mounts.
- [x] The directory structure is defined and consistent with deployment needs.

### Planned Unit Tests

- [x] Schema accepts valid scenario documents with request fixtures, portal mounts, and step criteria.
- [x] Schema rejects scenarios missing required metadata.
- [x] Schema rejects steps that omit criterion ids or kinds where required.
- [x] Schema rejects invalid portal declarations and duplicate aliases.
- [x] Schema rejects unsupported criterion kinds and invalid criterion status payloads.
- [x] CI profile selection obeys explicit precedence rules.
- [x] Portal lifecycle planner rejects destructive remount attempts without explicit override.

**✅ IMPLEMENTED** — `tests/scenario_framework/schema/scenario_schema.ts`, `tests/scenario_framework/schema/step_schema.ts`, `tests/scenario_framework/runner/config.ts`, 10/10 Step 1 tests passing

## Step 2: Enforce File-Based Request Fixtures

### Actions

- [x] Define a request fixture format using plain text files.
- [x] Add fixture-loading support to the runner.
- [x] Ensure scenarios reference request content by file path only.
- [x] Add validation that rejects embedded long-form request text in scenario definitions.

### Justification

This addresses the requirement that request text be editable, reviewable, and independent from runner code.

### Success Criteria

- [x] Request prompts are stored only in fixture files.
- [x] Scenario definitions reference fixture paths rather than inlined prompt bodies.
- [x] Invalid embedded-request scenarios fail schema or runner validation.

### Planned Unit Tests

- [x] Fixture loader resolves valid text fixtures from framework-relative paths.
- [x] Fixture loader rejects missing, empty, or non-text request files.
- [x] Scenario validation rejects embedded prompt bodies when fixture-only mode is enabled.
- [x] Shared request fixtures can be referenced by multiple scenarios without mutation.

**✅ IMPLEMENTED** — `tests/scenario_framework/runner/request_fixtures.ts`, 4/4 Step 2 tests passing

## Step 3: Implement Scenario Loader and Execution Core

### Actions

- [x] Implement scenario loading from YAML and schema validation against the Contract 1 types.
- [x] Implement request fixture path resolution and content loading.
- [x] Implement step execution for `shell` and `exactl` step kinds.
- [x] Capture stdout, stderr, and exit codes per step.
- [x] Record basic step results including start time, end time, exit code, and raw output.
- [x] Integrate runtime configuration loading and validation per Contract 7.

### Justification

A clean loader and execution core is the minimum viable runner. Keeping it separate from mode logic prevents the state machine from coupling to the file I/O and schema validation layer, which makes both independently testable.

### Success Criteria

- [x] A scenario YAML file is loaded, validated, and its steps are returned in order.
- [x] `shell` and `exactl` steps execute and produce captured output.
- [x] Invalid scenario definitions fail at load time with a structured error.
- [x] Request fixture paths are resolved correctly relative to framework home.
- [x] Runtime config schema violations emit a `configuration-failure` before any step executes.

### Planned Unit Tests

- [x] Scenario loader returns ordered validated steps for a valid scenario document.
- [x] Scenario loader rejects documents that violate schema contracts with a descriptive error.
- [x] Fixture path resolver finds valid files and rejects missing or empty files.
- [x] Shell step executor captures stdout and stderr independently.
- [x] Execution core records step start time, end time, exit code, and raw output.
- [x] Runtime config loader rejects unknown fields and missing required fields.

**✅ IMPLEMENTED** — `tests/scenario_framework/runner/scenario_loader.ts`, `tests/scenario_framework/runner/step_executor.ts`, 6/6 Step 3 tests passing

## Step 4: Implement Execution Modes and CI Entry

### Actions

- [x] Implement execution-state persistence for pause and resume.
- [x] Implement `auto` mode with fail-fast behavior on the first failed criterion.
- [x] Implement `step` mode that pauses after each step and awaits explicit continuation.
- [x] Implement `manual-checkpoint` mode that pauses only at declared checkpoint steps.
- [x] Implement a non-interactive CI entry path that accepts predefined scenario ids, packs, or tags.
- [x] Implement mode-level skip enforcement for interactive scenarios when running in CI mode.

### Justification

The mode system is the primary interface between automated regression and human-in-the-loop review. Implementing it on top of the stable execution core prevents the modes from becoming entangled with loading or assertion logic.

### Success Criteria

- [x] A scenario can be started, paused, resumed, and completed in `step` and `manual-checkpoint` modes.
- [x] `step` mode persists enough state to resume from the correct next step after a restart.
- [x] `manual-checkpoint` mode emits a useful review bundle at declared checkpoints.
- [x] CI mode runs a predefined scenario selection without prompting for user input.
- [x] CI mode records the skip reason for interactive-only scenarios.

### Planned Unit Tests

- [x] Runner state persists and resumes correctly from the expected next step after interruption.
- [x] `step` mode executes exactly one step and then halts pending explicit continuation.
- [x] `manual-checkpoint` mode pauses only at declared checkpoint steps and not at others.
- [x] `auto` mode halts the scenario on the first failed criterion and records the manifest outcome.
- [x] CI mode rejects interactive-only scenarios with skip reason `interactive-not-allowed`.
- [x] Scenario selection by pack, tag, and explicit id list each resolve the correct subset.

**✅ IMPLEMENTED** — `tests/scenario_framework/runner/modes.ts`, 6/6 Step 4 tests passing

## Step 5: Implement Assertions and Evidence Capture

### Actions

- [x] Implement file, frontmatter, JSON, status, and journal assertion primitives.
- [x] Implement per-step precondition and postcondition evaluation based on declared criteria.
- [x] Capture per-step evidence to a stable output structure.
- [x] Generate a run manifest summarizing step outcomes and collected ids.
- [x] Add helper utilities for copying relevant workspace artifacts into evidence bundles.

### Justification

Without strong evidence capture, the framework becomes another opaque script instead of a validation tool.

### Success Criteria

- [x] Each run produces a deterministic evidence tree.
- [x] Failed assertions point to concrete artifacts or command output.
- [x] Failed steps identify the exact unmet input or output criterion.
- [x] Evidence bundles are readable without inspecting runner internals.

### Planned Unit Tests

- [x] Criterion evaluator distinguishes input validation, execution failure, and output validation failure.
- [x] JSON, file, frontmatter, and journal assertions report stable failure payloads.
- [x] Evidence collector writes the expected manifest shape for success and failure cases.
- [x] Failure manifests include step id, criterion id, status, and evidence references.

**✅ IMPLEMENTED** — `tests/scenario_framework/runner/assertions.ts`, `tests/scenario_framework/runner/evidence_collector.ts`, 4/4 Step 5 tests passing

## Step 6: Make the Framework Deployable Outside the Repo

### Actions

- [x] Add a deployment script under `tests/scenario_framework/scripts/`.
- [x] Support copying the framework into an arbitrary target directory.
- [x] Rewrite runtime config to use external absolute paths provided at execution time.
- [x] Verify the deployed framework can target a separate Exaix workspace under test.
- [x] Verify the deployed framework can mount one or more non-Exaix portals as part of scenario setup.

### Justification

This forces the framework to behave like an external validation tool and prevents hidden dependence on the repository checkout.

### Success Criteria

- [x] The framework can run from a destination outside `~/git/Exaix` and `~/Exaix`.
- [x] No runner path assumptions require execution from the repo root.
- [x] External portal mounts can target arbitrary repositories provided by scenario config.
- [x] Deployed runs can still locate fixtures, scenarios, and outputs correctly.

### Planned Unit Tests

- [x] Deployment planner rewrites framework paths relative to the external destination correctly.
- [x] Runtime config resolves explicit workspace, portal, and output paths without repo-root assumptions.
- [x] Portal mount preparation accepts non-Exaix repository paths.
- [x] Deployment manifest records copied framework assets deterministically.

**✅ IMPLEMENTED** — `tests/scenario_framework/scripts/deploy_framework.ts`, `tests/scenario_framework/runner/config.ts`, 4/4 Step 6 tests passing

## Step 7: Implement the Initial Phase 45–49 Scenario Pack

### Actions

- [x] Create one or more scenarios per phase covering the primary new behavior.
- [x] Store each request in a dedicated fixture file.
- [x] Add assertions that map to actual observable artifacts, not assumptions.
- [x] Add smoke tags for a reduced fast path.
- [x] Define a CI-safe subset list for the initial Phase 45-49 pack.

### Justification

Phases 45–49 are the immediate business need and provide a realistic proving ground for the framework design.

### Success Criteria

- [x] The initial pack validates the key behaviors of Phases 45–49.
- [x] At least one scenario runs in `auto` mode and `step` mode successfully.
- [x] At least one curated subset runs successfully in CI mode.
- [x] Scenarios rely on file-based request fixtures and deployed-workspace observables only.

### Planned Unit Tests

- [x] Scenario selection logic resolves the Phase 45–49 pack by id, path, and tag.
- [x] CI-safe scenario list excludes scenarios marked manual-only or provider-live-only.
- [x] Scenario metadata for the Phase 45–49 pack satisfies schema and criteria requirements.

**✅ IMPLEMENTED** — `tests/scenario_framework/runner/scenario_catalog.ts`, `tests/scenario_framework/scenarios/phase45_49/`, 3/3 Step 7 tests passing

## Step 8: Generalize for Future Packs

### Actions

- [x] Separate framework internals from pack-specific scenario data.
- [x] Add tags, pack selection, and filtering capabilities.
- [x] Create a template and authoring guide for new scenario packs.
- [x] Prove the design can host at least one non-45-49 placeholder pack.

### Justification

The framework should become a general validation asset rather than a one-off harness tied to a single phase cluster.

### Success Criteria

- [x] A new pack can be added without modifying core runner architecture.
- [x] Pack selection works by path, id, or tag.
- [x] The framework documentation explains how to add unrelated scenarios later.

### Planned Unit Tests

- [x] Runner can load two unrelated packs without pack-specific code branches.
- [x] Tag filtering returns the expected scenario subset across packs.
- [x] Scenario template generation produces a valid starter document for a new pack.

**✅ IMPLEMENTED** — `tests/scenario_framework/runner/scenario_catalog.ts`, `tests/scenario_framework/runner/scenario_templates.ts`, `tests/scenario_framework/scenarios/smoke/`, `tests/scenario_framework/templates/scenario_template.yaml`, 3/3 Step 8 tests passing

## Step 9: Add Internal Unit and Integration Tests for the Framework Itself

### Actions

- [x] Create a dedicated internal test suite under `tests/scenario_framework/tests/`.
- [x] Add unit tests for schema validation, fixture loading, criteria evaluation, mode control, deployment config, and manifest generation.
- [x] Add lightweight framework integration tests using local fake steps and fake evidence outputs.
- [x] Ensure the framework test suite can run quickly without requiring a deployed workspace or live LLM provider.

### Justification

The framework itself is infrastructure. If its contracts are not tested independently, scenario failures will be harder to localize and the framework will be difficult to evolve safely.

### Success Criteria

- [x] Internal framework unit tests cover the critical runner, schema, and manifest logic.
- [x] Lightweight integration tests verify end-to-end runner behavior against synthetic scenarios.
- [x] The internal framework test suite runs deterministically in local development and CI.
- [x] Failures in framework logic are distinguishable from failures in deployed-workspace scenarios.

### Planned Unit Tests

- [x] Synthetic scenario completes successfully through the runner without touching a real workspace.
- [x] Synthetic failing scenario emits the expected criterion-level manifest.
- [x] Synthetic checkpoint scenario pauses and resumes correctly.
- [x] Synthetic CI scenario selection honors tags and explicit scenario ids.

**✅ IMPLEMENTED** — `tests/scenario_framework/runner/synthetic_runner.ts`, `tests/scenario_framework/tests/integration/synthetic_runner_test.ts`, full internal framework suite 44/44 passing

---

## Example Scenario Shape

```yaml
id: phase49-memory-aware-analysis
title: Phase 49 memory-aware analysis enriches request understanding
pack: phase45_49
tags: [phase49, analysis, smoke]
request_fixture: fixtures/requests/phase45_49/memory_aware_analysis.md
portals:
   - alias: portal-exaix
      source_path: /path/to/exaix-repo
   - alias: portal-sample-app
      source_path: /path/to/other-repo
mode_support: [auto, step, manual-checkpoint]
steps:
   - id: create-request
      type: exactl
      input_criteria:
         - id: request-fixture-exists
            kind: file-exists
            path: fixtures/requests/phase45_49/memory_aware_analysis.md
         - id: portal-available
            kind: portal-mounted
            alias: portal-exaix
      command: request create
      args:
         - --portal
         - portal-exaix
         - --from-file
         - fixtures/requests/phase45_49/memory_aware_analysis.md
      output_criteria:
         - id: request-created
            kind: command-exit-code
            equals: 0
   - id: wait-analysis-file
      type: wait-for-file
      path_pattern: Workspace/Requests/*/_analysis.json
      output_criteria:
         - id: analysis-artifact-created
            kind: file-found
            path_pattern: Workspace/Requests/*/_analysis.json
   - id: assert-analysis-fields
      type: json-assert
      file_pattern: Workspace/Requests/*/_analysis.json
      input_criteria:
         - id: analysis-file-available
            kind: file-found
            path_pattern: Workspace/Requests/*/_analysis.json
      assertions:
         - path: $.goals[0]
            exists: true
         - path: $.complexity
            equals_any: [simple, medium, complex]
      output_criteria:
         - id: goals-extracted
            kind: json-path-exists
            path: $.goals[0]
         - id: complexity-extracted
            kind: json-path-equals-any
            path: $.complexity
            values: [simple, medium, complex]
   - id: review-analysis
      type: manual-review
      checkpoint: analysis-complete
      instructions: Review the extracted goals and context before continuing.
```

Important constraint: the scenario definition references the request fixture path, but does not embed the request body.

---

## Verification Strategy

### Planning Verification

- [ ] Confirm every planned assertion maps to a real artifact or CLI-observable behavior.
- [ ] Confirm the framework tree under `tests/` is self-contained.
- [ ] Confirm deployment requirements do not rely on the repository being the execution root.

### Implementation Verification

- [ ] Run one minimal scenario locally from the repo tree.
- [ ] Deploy the framework to an external folder and rerun the same scenario there.
- [ ] Validate the same scenario in `auto` and `step` modes.
- [ ] Validate one `manual-checkpoint` scenario produces usable evidence for review.
- [ ] Validate a predefined CI scenario list runs non-interactively and produces a machine-readable manifest.
- [ ] Validate at least one scenario with an additional portal mounted to a non-Exaix repository.
- [ ] Validate the internal framework unit suite passes without requiring a real deployed workspace.

### Coverage Verification

- [ ] Confirm the initial pack covers each of Phases 45, 46, 47, 48, and 49.
- [ ] Confirm at least one future-pack placeholder can be authored without changing the runner.

---

## Gap Analysis and Readiness Assessment

### What Is Already Strong in the Design

- [x] Clear system boundary: the framework is defined around CLI commands, workspace artifacts, and journals rather than internal service APIs.
- [x] Clear portability goal: the framework is intended to run outside the repo checkout and outside the primary deployed workspace.
- [x] Strong scenario model direction: file-based requests, measurable per-step criteria, and explicit portal declarations are now part of the design.
- [x] Clear extensibility direction: Phases 45–49 are positioned as the first scenario pack rather than a special-case implementation.
- [x] CI intent is explicit: non-interactive execution and curated scenario selection are included as first-class requirements.

### Gap Closure Status

#### Gap 1: Scenario Schema Was Conceptual, Now Addressed by the Scenario Schema Contract

Current state:

- The design now defines required top-level fields, required step fields, optional fields, defaulting rules, and schema versioning expectations.

Impact:

- Schema ambiguity is reduced and implementation can proceed against a stable contract.

Remaining implementation work:

- Encode the documented contract in TypeScript and validate example scenarios against it.

#### Gap 2: Criterion Taxonomy Was Not Finalized, Now Addressed by the Criterion and Manifest Contracts

Current state:

- The design now bounds criterion kinds, result statuses, and manifest fields for criterion results.

Impact:

- Failure reporting can now be implemented consistently across step types.

Remaining implementation work:

- Implement the evaluator and manifest writer against the documented taxonomy.

#### Gap 3: CI Profiles and Skip Semantics Needed Hard Rules, Now Addressed by the CI Contract

Current state:

- The design now defines CI profiles, selection precedence, allowed skip reasons, and exit code semantics.

Impact:

- CI behavior is now constrained to a predictable contract.

Remaining implementation work:

- Implement profile resolution and skip reporting exactly as specified.

#### Gap 4: Portal Provisioning Lifecycle Was Partially Specified, Now Addressed by the Portal Lifecycle Contract

Current state:

- The design now defines mount, verify, reuse, collision, and cleanup behavior including ownership rules.

Impact:

- Portal provisioning can now be implemented with deterministic behavior and safer cleanup.

Remaining implementation work:

- Implement portal preparation and teardown logic against the documented lifecycle.

#### Gap 5: Internal Framework Test Boundaries Needed a Concrete Plan, Now Addressed by the Test Layer Matrix

Current state:

- The design now defines four distinct test layers and where each must run.

Impact:

- Test placement and CI expectations are now clearer.

Remaining implementation work:

- Implement directory structure, tasks, and CI wiring that enforce the layer boundaries.

### Readiness Evaluation

Readiness for implementation planning: high.

- The design is sufficiently mature to begin Step 1 implementation work on scaffolding, schemas, and the internal framework test harness.

Readiness for full implementation without further clarification: high.

- The architecture is coherent and the previously open design gaps now have explicit contracts. Remaining work is primarily implementation and validation, not unresolved design ambiguity.

Recommended go/no-go assessment:

- Go for contract-definition work, scaffolding, internal test harness setup, and phased runner implementation.
- Treat the design as stable enough for implementation, while allowing backward-compatible refinement if real execution exposes missing criterion kinds or profile needs.

Exit criteria for “design ready for execution”:

- [x] Finalize the scenario schema.
- [x] Finalize criterion kinds and manifest payload format.
- [x] Finalize CI profile and skip semantics.
- [x] Finalize portal provisioning lifecycle rules.
- [x] Finalize the framework test-layer matrix.

---

## Risks and Mitigations

### Risk: Hidden coupling to repo-relative paths

Controls:

- Prevention: require explicit workspace, output, and portal path inputs in runtime config.
- Detection: fail preflight when resolved paths still depend on repo-root assumptions.
- Containment: write configuration failures as `configuration-failure` outcomes before any scenario execution begins.

### Risk: Scenarios become unreadable if prompts are embedded inline

Controls:

- Prevention: scenario schema must not allow inline request bodies for standard scenarios.
- Detection: schema validation and fixture loader reject embedded or empty request bodies.
- Containment: emit a schema-level failure before runner execution starts.

### Risk: The runner becomes Phase 45–49 specific

Controls:

- Prevention: keep pack metadata and scenario loading generic, with no phase-specific branches in core runner code.
- Detection: internal tests load unrelated packs through the same code paths.
- Containment: new feature-specific needs should be introduced as new step kinds or criteria only when they generalize.

### Risk: Step failures are too opaque to debug quickly

Controls:

- Prevention: require criterion ids, kinds, and manifest-friendly messages for each declared step contract.
- Detection: unit tests verify stable failure payloads for every supported criterion kind.
- Containment: manifests distinguish input failure, execution failure, output failure, timeout, and blocked states.

### Risk: CI runs become flaky or too broad

Controls:

- Prevention: enforce curated CI profiles and explicit exclusions for interactive or provider-live scenarios.
- Detection: CI mode reports profile, selection source, and skip reasons in the final manifest.
- Containment: flaky or slow scenarios move to `ci-extended` or opt-in profiles rather than remaining in the default path.

### Risk: Portal support assumes every scenario targets Exaix only

Controls:

- Prevention: model portals as generic alias-to-source declarations with no Exaix-specific assumptions in schema or runner.
- Detection: unit tests exercise non-Exaix repository mounts and alias collision rules.
- Containment: framework-owned mounts are tracked and cleaned up separately from user-owned mounts.

### Risk: Manual-checkpoint mode becomes too vague to be actionable

Controls:

- Prevention: checkpoints must declare instructions and evidence references before scenarios validate.
- Detection: scenario validation rejects manual checkpoints missing actionable instructions.
- Containment: paused runs persist resumable state and expose explicit continue or abort commands.

### Risk: Evidence output becomes noisy and unhelpful

Controls:

- Prevention: separate raw outputs, copied artifacts, and summarized manifests into predictable directories.
- Detection: internal tests verify manifest shape and evidence references for both pass and fail cases.
- Containment: failure manifests should reference only the minimal relevant artifacts while preserving raw logs for deeper inspection.

### Risk: Schema and implementation drift over time

Controls:

- Prevention: use a single source of truth for schema types and validate bundled example scenarios in CI.
- Detection: internal schema tests should load example scenarios and template outputs on every change.
- Containment: introduce explicit schema versioning and compatibility checks before accepting new scenario documents.

---

## Relevant Files and Inputs

- `docs/dev/Agent_Validation_Requests.md`
- `docs/dev/Exaix_Manual_Test_Scenarios.md`
- `src/cli/exactl.ts`
- `src/cli/commands/request_commands.ts`
- `src/cli/commands/plan_commands.ts`
- `src/cli/commands/journal_commands.ts`
- `src/services/request_analysis/`
- `src/services/portal_knowledge/`
- `src/services/quality_gate/`
- `.copilot/planning/phase-45-request-intent-analysis.md`
- `.copilot/planning/phase-46-portal-knowledge-gathering.md`
- `.copilot/planning/phase-47-request-quality-gate.md`
- `.copilot/planning/phase-48-acceptance-criteria-propagation.md`
- `.copilot/planning/phase-49-quality-pipeline-hardening.md`

---

## Completion Definition

Phase 50 is complete when:

- [ ] a self-contained scenario framework exists under `tests/`
- [ ] request prompts are stored as standalone text fixtures
- [ ] the framework can be deployed to and run from an external destination
- [ ] the framework supports `auto`, `step`, and `manual-checkpoint`
- [ ] the framework supports predefined non-interactive CI scenario execution
- [ ] each step exposes measurable input and output criteria with criterion-level failure reporting
- [ ] the framework can mount portals that target repositories other than Exaix
- [ ] an initial Phase 45–49 scenario pack runs successfully
- [ ] the framework is documented so future scenario packs can be added without redesign
- [ ] the runtime configuration is schema-validated and the resolved config is recorded in every run manifest
