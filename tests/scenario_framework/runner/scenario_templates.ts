/**
 * @module ScenarioFrameworkScenarioTemplates
 * @path tests/scenario_framework/runner/scenario_templates.ts
 * @description Implements Phase 50 Step 8 starter-template rendering so new
 * scenario packs can be authored without changing core framework code.
 * @architectural-layer Test
 * @dependencies [@std/path]
 * @related-files [tests/scenario_framework/templates/scenario_template.yaml, tests/scenario_framework/tests/unit/pack_generalization_test.ts]
 */

import { resolve } from "@std/path";

export interface IScenarioTemplateOptions {
  id: string;
  title: string;
  pack: string;
  tags: string[];
  requestFixture: string;
}

const SCENARIO_TEMPLATE_PATH = resolve(
  import.meta.dirname ?? ".",
  "../templates/scenario_template.yaml",
);

export function renderScenarioTemplate(
  options: IScenarioTemplateOptions,
): string {
  const template = Deno.readTextFileSync(SCENARIO_TEMPLATE_PATH);

  return template
    .replaceAll("__SCENARIO_ID__", options.id)
    .replaceAll("__SCENARIO_TITLE__", options.title)
    .replaceAll("__SCENARIO_PACK__", options.pack)
    .replaceAll("__SCENARIO_TAGS__", options.tags.map((tag) => `"${tag}"`).join(", "))
    .replaceAll("__REQUEST_FIXTURE__", options.requestFixture);
}
