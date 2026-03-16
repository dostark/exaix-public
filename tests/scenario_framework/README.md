# Scenario Framework

Phase 50 Step 1 scaffolds the initial contract surface for deployed-workspace scenario validation.

## Current Scope

- `schema/` defines the stable scenario, step, criterion, portal, and manifest contracts.
- `runner/` defines runtime configuration, scenario selection precedence, and portal lifecycle planning helpers.
- `tests/unit/` holds RED/GREEN contract tests for the Step 1 schema and planner surface.
- `output/` is reserved for local evidence artifacts.

## Naming Conventions

- Scenario ids use kebab-case, for example `phase49-memory-aware-analysis`.
- Scenario pack names use snake_case, for example `phase45_49`.
- Request fixtures are stored under `fixtures/requests/<pack>/` and referenced by framework-relative paths.
- Output artifacts should be grouped under `output/<scenario-id>/<run-id>/` once runner execution is implemented.

## Request Fixture Format

- Request fixtures must be plain-text files ending in `.md` or `.txt`.
- Fixture paths must be framework-relative, for example `fixtures/requests/shared/request.md`.
- Scenario definitions must reference request content via `request_fixture` and must not embed prompt bodies inline.
- Shared prompt text belongs under `fixtures/requests/shared/`; pack-specific prompt text belongs under `fixtures/requests/<pack>/`.

## Path Model

- Framework home: the directory containing this subtree or its deployed copy.
- Workspace under test: the external ExoFrame workspace targeted by the runner.
- Portal roots: absolute repository or folder paths mounted into the workspace under test.
- Output directory: the external destination where evidence, manifests, and summaries are written.

The framework treats the workspace under test as an external system and does not assume repo-root execution.
