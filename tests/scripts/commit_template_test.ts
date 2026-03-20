/**
 * @module CommitTemplateTest
 * @path tests/scripts/commit_template_test.ts
 * @description Verifies the existence and basic structure of the commit message template.
 */

import { assert } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

describe("templates/commit_msg.template", () => {
  it("exists and contains all mandatory headers", async () => {
    const content = await Deno.readTextFile("templates/commit_msg.template");
    assert(content.includes("what:"), "Template should have 'what:' header");
    assert(content.includes("rationale:"), "Template should have 'rationale:' header");
    assert(content.includes("tests:"), "Template should have 'tests:' header");
    assert(content.includes("who:"), "Template should have 'who:' header");
    assert(content.includes("impact:"), "Template should have 'impact:' header");
  });
});
