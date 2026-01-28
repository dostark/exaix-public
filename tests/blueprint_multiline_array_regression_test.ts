/**
 * Additional regression test for multi-line YAML arrays
 *
 * Regression: "blueprint.capabilities?.join is not a function"
 * Root cause: Simple YAML parser only handled inline arrays ["item1", "item2"]
 *             but not multi-line format with dash syntax
 * Fix: Enhanced parser to track state and build arrays from multi-line format
 */

import { assertEquals } from "@std/assert";
import { ensureDir } from "@std/fs";
import { join } from "@std/path";
import { createStubDb } from "./test_helpers.ts";

const AGENT_ID = "multiline-test";
const CAP_TESTING = "testing";
const CAP_VALIDATION = "validation";
const CAP_DEBUGGING = "debugging";
const SKILL_TS = "typescript";
const SKILL_DENO = "deno";

Deno.test("[regression] YAML multi-line array format parses correctly", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "exo_multiline_regression_" });

  try {
    const blueprintsDir = join(tempDir, "Blueprints", "Agents");
    await ensureDir(blueprintsDir);

    // Create blueprint with multi-line array format (like mock-agent.md)
    const multilineBlueprint = `---
agent_id: "${AGENT_ID}"
name: "Multi-line Array Test"
model: "mock:test-model"
capabilities:
  - ${CAP_TESTING}
  - ${CAP_VALIDATION}
  - ${CAP_DEBUGGING}
created: "2026-01-18T14:00:00Z"
created_by: "tester"
version: "1.0.0"
default_skills:
  - ${SKILL_TS}
  - ${SKILL_DENO}
---

# Multi-line Array Test

This blueprint uses multi-line YAML array format.
`;
    await Deno.writeTextFile(join(blueprintsDir, `${AGENT_ID}.md`), multilineBlueprint);

    // Import BlueprintCommands
    const { BlueprintCommands } = await import("../src/cli/blueprint_commands.ts");

    const config = {
      system: { root: tempDir },
      paths: {
        blueprints: "Blueprints",
        agents: "Agents",
      },
    } as any;

    const stubDb = createStubDb();

    const blueprintCommands = new BlueprintCommands({ config, db: stubDb as any });

    // List should find the blueprint and parse arrays correctly
    const blueprints = await blueprintCommands.list();

    assertEquals(blueprints.length, 1, "Should find multi-line blueprint");
    assertEquals(blueprints[0].agent_id, AGENT_ID);

    // CRITICAL: capabilities should be an array, not a string
    assertEquals(Array.isArray(blueprints[0].capabilities), true, "capabilities should be an array");
    assertEquals(blueprints[0].capabilities?.length, 3, "Should have 3 capabilities");
    assertEquals(blueprints[0].capabilities, [CAP_TESTING, CAP_VALIDATION, CAP_DEBUGGING]);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
