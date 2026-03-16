/**
 * @module ScenarioFrameworkPhase4549PackTest
 * @path tests/scenario_framework/tests/unit/phase45_49_pack_test.ts
 * @description RED-first tests for Phase 50 Step 7. Verifies scenario pack
 * discovery, CI-safe filtering, and schema-valid metadata for the initial
 * Phase 45-49 scenario set before the pack catalog and scenario assets exist.
 * @architectural-layer Test
 * @related-files [tests/scenario_framework/runner/scenario_catalog.ts, tests/scenario_framework/scenarios/phase45_49]
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import type { IScenario } from "../../schema/scenario_schema.ts";
import type { IScenarioStep } from "../../schema/step_schema.ts";
import {
  listCiSafeScenarios,
  loadScenarioCatalog,
  selectScenarioCatalogEntries,
} from "../../runner/scenario_catalog.ts";

const TEST_FILE_DIR = dirname(fromFileUrl(import.meta.url));
const FRAMEWORK_HOME = join(TEST_FILE_DIR, "../..");

Deno.test("[ScenarioFrameworkPhase4549Pack] scenario selection logic resolves the Phase 45-49 pack by id, path, and tag", async () => {
  const catalog = await loadScenarioCatalog({ frameworkHome: FRAMEWORK_HOME });

  const byId = selectScenarioCatalogEntries({
    catalog,
    scenarioIds: ["phase45-request-analysis-smoke"],
  });
  const byPath = selectScenarioCatalogEntries({
    catalog,
    scenarioPaths: ["scenarios/phase45_49/phase47-quality-gate-clarification.yaml"],
  });
  const byTag = selectScenarioCatalogEntries({
    catalog,
    tags: ["phase48"],
  });

  assertEquals(byId.map((scenario: IScenario) => scenario.id), ["phase45-request-analysis-smoke"]);
  assertEquals(byPath.map((scenario: IScenario) => scenario.id), ["phase47-quality-gate-clarification"]);
  assertEquals(byTag.map((scenario: IScenario) => scenario.id), ["phase48-acceptance-criteria-propagation"]);
});

Deno.test("[ScenarioFrameworkPhase4549Pack] CI-safe scenario list excludes scenarios marked manual-only or provider-live-only", async () => {
  const catalog = await loadScenarioCatalog({ frameworkHome: FRAMEWORK_HOME });
  const ciSafeScenarios = listCiSafeScenarios(catalog, {
    packs: ["phase45_49"],
  });

  assertEquals(
    ciSafeScenarios.map((scenario: IScenario) => scenario.id),
    [
      "phase45-request-analysis-smoke",
      "phase46-portal-knowledge-snapshot",
      "phase49-memory-aware-analysis",
    ],
  );
});

Deno.test("[ScenarioFrameworkPhase4549Pack] scenario metadata for the Phase 45-49 pack satisfies schema and criteria requirements", async () => {
  const catalog = await loadScenarioCatalog({ frameworkHome: FRAMEWORK_HOME });
  const phasePackScenarios = catalog.filter((scenario: IScenario) => scenario.pack === "phase45_49");

  assertEquals(
    phasePackScenarios.map((scenario: IScenario) => scenario.id),
    [
      "phase45-request-analysis-smoke",
      "phase46-portal-knowledge-snapshot",
      "phase47-quality-gate-clarification",
      "phase48-acceptance-criteria-propagation",
      "phase49-memory-aware-analysis",
    ],
  );

  for (const scenario of phasePackScenarios) {
    assertStringIncludes(scenario.request_fixture, "fixtures/requests/phase45_49/");
    assertEquals(scenario.steps.length > 0, true);
    assertEquals(
      scenario.steps.every((step: IScenarioStep) => step.input_criteria.length + step.output_criteria.length > 0),
      true,
    );
  }
});
