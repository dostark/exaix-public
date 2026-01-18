/**
 * Blueprint Commands Regression Tests
 *
 * Regression tests for blueprint frontmatter parsing fixes.
 *
 * Regression test for: "Blueprint 'senior-coder' not shown in list; 'Invalid blueprint format'"
 * Root cause: extractTomlFrontmatter only accepted TOML format with +++ delimiters,
 *             but existing blueprints use YAML format with --- delimiters
 * Fix: Updated extractTomlFrontmatter to support both TOML (+++) and YAML (---) formats
 */

import { assertEquals, assertExists } from "@std/assert";
import { ensureDir } from "@std/fs";
import { join } from "@std/path";

// Helper to create test workspace structure
async function createTestBlueprintsDir(baseDir: string): Promise<string> {
  const blueprintsDir = join(baseDir, "Blueprints", "Agents");
  await ensureDir(blueprintsDir);
  return blueprintsDir;
}

// Create minimal config for testing
function createTestConfig(root: string) {
  return {
    system: { root },
    paths: {
      blueprints: "Blueprints",
      agents: "Agents",
    },
  } as any;
}

// Create stub db for testing
const stubDb = {
  logActivity: () => {},
  waitForFlush: async () => {},
};

// ============================================================================
// Regression Tests for Blueprint Frontmatter Parsing
// ============================================================================

Deno.test("[regression] Blueprint list works with YAML frontmatter (---)", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "exo_blueprint_regression_" });

  try {
    const blueprintsDir = await createTestBlueprintsDir(tempDir);

    // Create blueprint with YAML frontmatter (--- delimiters)
    const yamlBlueprint = `---
agent_id: "yaml-agent"
name: "YAML Format Agent"
model: "mock:test-model"
capabilities: ["testing"]
created: "2026-01-18T12:00:00Z"
created_by: "test"
version: "1.0.0"
description: "Agent with YAML frontmatter"
---

# YAML Agent

This agent uses YAML frontmatter format.
`;
    await Deno.writeTextFile(join(blueprintsDir, "yaml-agent.md"), yamlBlueprint);

    // Import BlueprintCommands
    const { BlueprintCommands } = await import("../src/cli/blueprint_commands.ts");

    const config = createTestConfig(tempDir);
    const blueprintCommands = new BlueprintCommands({ config, db: stubDb as any });

    // List should find the YAML-format blueprint
    const blueprints = await blueprintCommands.list();

    // Before the fix, this would return 0 (only looked for +++ delimiters)
    // After the fix, this should return 1 (supports both +++ and --- delimiters)
    assertEquals(blueprints.length, 1, "Should find blueprint with YAML frontmatter");
    assertEquals(blueprints[0].agent_id, "yaml-agent");
    assertEquals(blueprints[0].name, "YAML Format Agent");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("[regression] Blueprint list works with TOML frontmatter (+++)", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "exo_blueprint_regression_" });

  try {
    const blueprintsDir = await createTestBlueprintsDir(tempDir);

    // Create blueprint with TOML frontmatter (+++ delimiters)
    const tomlBlueprint = `+++
agent_id = "toml-agent"
name = "TOML Format Agent"
model = "mock:test-model"
capabilities = ["testing"]
created = "2026-01-18T12:00:00Z"
created_by = "test"
version = "1.0.0"
description = "Agent with TOML frontmatter"
+++

# TOML Agent

This agent uses TOML frontmatter format.
`;
    await Deno.writeTextFile(join(blueprintsDir, "toml-agent.md"), tomlBlueprint);

    // Import BlueprintCommands
    const { BlueprintCommands } = await import("../src/cli/blueprint_commands.ts");

    const config = createTestConfig(tempDir);
    const blueprintCommands = new BlueprintCommands({ config, db: stubDb as any });

    // List should find the TOML-format blueprint
    const blueprints = await blueprintCommands.list();

    assertEquals(blueprints.length, 1, "Should find blueprint with TOML frontmatter");
    assertEquals(blueprints[0].agent_id, "toml-agent");
    assertEquals(blueprints[0].name, "TOML Format Agent");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("[regression] Blueprint show works with YAML frontmatter", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "exo_blueprint_regression_" });

  try {
    const blueprintsDir = await createTestBlueprintsDir(tempDir);

    // Create blueprint with YAML frontmatter
    const yamlBlueprint = `---
agent_id: "show-yaml-test"
name: "Show YAML Test"
model: "ollama:llama3.2"
capabilities: ["code_generation"]
created: "2026-01-18T12:00:00Z"
created_by: "tester"
version: "1.0.0"
description: "Testing show with YAML"
---

# Show YAML Test Agent

System prompt content here.
`;
    await Deno.writeTextFile(join(blueprintsDir, "show-yaml-test.md"), yamlBlueprint);

    // Import BlueprintCommands
    const { BlueprintCommands } = await import("../src/cli/blueprint_commands.ts");

    const config = createTestConfig(tempDir);
    const blueprintCommands = new BlueprintCommands({ config, db: stubDb as any });

    // Show should work with YAML format
    // Before the fix, this would throw "Invalid blueprint format"
    const details = await blueprintCommands.show("show-yaml-test");

    assertExists(details, "Should return blueprint details");
    assertEquals(details.agent_id, "show-yaml-test");
    assertEquals(details.model, "ollama:llama3.2");
    assertEquals(details.name, "Show YAML Test");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("[regression] Blueprint validate works with YAML frontmatter", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "exo_blueprint_regression_" });

  try {
    const blueprintsDir = await createTestBlueprintsDir(tempDir);

    // Create valid blueprint with YAML frontmatter
    // Includes required <thought> and <content> tags for validation
    const yamlBlueprint = `---
agent_id: "validate-yaml-test"
name: "Validate YAML Test"
model: "mock:test-model"
capabilities: ["testing"]
created: "2026-01-18T12:00:00Z"
created_by: "tester"
version: "1.0.0"
---

# Validate YAML Test Agent

You are a test agent. Use <thought> tags for reasoning and <content> tags for responses.

{{RESPONSE_FORMAT}}
`;
    await Deno.writeTextFile(join(blueprintsDir, "validate-yaml-test.md"), yamlBlueprint);

    // Import BlueprintCommands
    const { BlueprintCommands } = await import("../src/cli/blueprint_commands.ts");

    const config = createTestConfig(tempDir);
    const blueprintCommands = new BlueprintCommands({ config, db: stubDb as any });

    // Validate should work with YAML format
    // Before the fix, this would show "Missing or invalid TOML frontmatter"
    const result = await blueprintCommands.validate("validate-yaml-test");

    assertEquals(result.valid, true, "Blueprint with YAML frontmatter should be valid");
    assertEquals(result.errors.length, 0, "Should have no errors");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("[regression] Blueprint list finds both YAML and TOML formats in same directory", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "exo_blueprint_regression_" });

  try {
    const blueprintsDir = await createTestBlueprintsDir(tempDir);

    // Create YAML blueprint
    const yamlBlueprint = `---
agent_id: "mixed-yaml"
name: "Mixed YAML Agent"
model: "mock:yaml"
version: "1.0.0"
---

YAML content.
`;
    await Deno.writeTextFile(join(blueprintsDir, "mixed-yaml.md"), yamlBlueprint);

    // Create TOML blueprint
    const tomlBlueprint = `+++
agent_id = "mixed-toml"
name = "Mixed TOML Agent"
model = "mock:toml"
version = "1.0.0"
+++

TOML content.
`;
    await Deno.writeTextFile(join(blueprintsDir, "mixed-toml.md"), tomlBlueprint);

    // Import BlueprintCommands
    const { BlueprintCommands } = await import("../src/cli/blueprint_commands.ts");

    const config = createTestConfig(tempDir);
    const blueprintCommands = new BlueprintCommands({ config, db: stubDb as any });

    // Should find both blueprints
    const blueprints = await blueprintCommands.list();

    assertEquals(blueprints.length, 2, "Should find both YAML and TOML blueprints");

    const ids = blueprints.map((b) => b.agent_id).sort();
    assertEquals(ids, ["mixed-toml", "mixed-yaml"]);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("[regression] YAML frontmatter parses arrays correctly", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "exo_blueprint_regression_" });

  try {
    const blueprintsDir = await createTestBlueprintsDir(tempDir);

    // Create blueprint with array in YAML frontmatter
    const yamlBlueprint = `---
agent_id: "array-test"
name: "Array Test Agent"
model: "mock:test"
capabilities: ["code_generation", "testing", "debugging"]
default_skills: ["typescript", "deno"]
version: "1.0.0"
---

Array test.
`;
    await Deno.writeTextFile(join(blueprintsDir, "array-test.md"), yamlBlueprint);

    // Import BlueprintCommands
    const { BlueprintCommands } = await import("../src/cli/blueprint_commands.ts");

    const config = createTestConfig(tempDir);
    const blueprintCommands = new BlueprintCommands({ config, db: stubDb as any });

    const details = await blueprintCommands.show("array-test");

    assertExists(details.capabilities, "Should parse capabilities array");
    assertEquals(
      (details.capabilities as string[]).length,
      3,
      "Should have 3 capabilities",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
