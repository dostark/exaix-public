# Scenario Framework

Phase 50 Step 1 scaffolds the initial contract surface for deployed-workspace scenario validation.

## Current Scope

- `schema/` defines the stable scenario, step, criterion, portal, and manifest contracts.
- `runner/` defines runtime configuration, scenario selection precedence, pack filtering, template rendering, and portal lifecycle planning helpers.
- `scripts/` defines deployment helpers for copying the framework into an external execution home.
- `scenarios/phase45_49/` contains the first reusable pack for validating Phases 45 through 49.
- `scenarios/smoke/` contains a placeholder pack that proves unrelated scenarios can coexist without runner changes.
- `tests/unit/` holds focused contract tests for schema, fixture loading, execution, assertions, deployment, and catalog behavior.
- `tests/integration/` holds synthetic end-to-end framework tests that run without a deployed ExoFrame workspace or live provider.
- `output/` is reserved for local evidence artifacts.

## Deployment

- Use `scripts/deploy_framework.ts` to plan and copy the framework into an external destination.
- The deployed framework writes `runtime_config.json` with the resolved external `framework_home`, `workspace_path`, `output_dir`, and portal overrides.
- The deployed framework writes `deployment-manifest.json` so copied assets remain deterministic and reviewable.
- Deployment is designed for running outside both the repository checkout and the deployed ExoFrame workspace under test.

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

## Initial Pack

- `scenarios/phase45_49/` currently includes one scenario per phase for Phases 45, 46, 47, 48, and 49.
- `scenarios/smoke/` provides a minimal cross-pack placeholder scenario using a shared request fixture.
- The current CI-safe subset excludes entries tagged `manual-only`, `provider-live`, or `live`, and requires `auto` mode support.
- Pack selection can now resolve scenarios by id, scenario path, pack, or tag through the scenario catalog layer.

## Adding Packs

- Add scenario YAML files under `scenarios/<pack>/` and keep the `pack` field aligned with the directory name.
- Store shared prompts under `fixtures/requests/shared/` and pack-specific prompts under `fixtures/requests/<pack>/`.
- Use `templates/scenario_template.yaml` with `runner/scenario_templates.ts` to generate a schema-valid starter document for new packs.
- New packs should rely on existing catalog and selection behavior rather than introducing pack-specific runner branches.

## Internal Test Harness

- Use `runner/synthetic_runner.ts` when adding framework integration tests that should exercise loader, execution, criteria, modes, and manifest writing together.
- Synthetic integration tests should create temporary framework and workspace directories, then execute shell-based scenarios without depending on a deployed ExoFrame instance.
- Keep these tests deterministic and local so framework regressions remain distinguishable from deployed-workspace failures.

## Path Model

- Framework home: the directory containing this subtree or its deployed copy.
- Workspace under test: the external ExoFrame workspace targeted by the runner.
- Portal roots: absolute repository or folder paths mounted into the workspace under test.
- Output directory: the external destination where evidence, manifests, and summaries are written.

The framework treats the workspace under test as an external system and does not assume repo-root execution.
