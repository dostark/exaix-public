/**
 * Skills Blueprint Migration Tests
 *
 * Phase 23: Skills Blueprint Migration
 * Tests for moving core skills from Memory/Skills/core/ to Blueprints/Skills/
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { join } from "@std/path";
import { exists } from "@std/fs";
import { SkillsService } from "../../src/services/skills.ts";
import { initTestDbService } from "../helpers/db.ts";

// ===== Migration Tests =====

Deno.test("SkillsService: loads skills from Blueprints/Skills/ after migration", async () => {
  const { db, config, cleanup } = await initTestDbService();

  try {
    const service = new SkillsService(config, db);
    await service.initialize();

    // Create Blueprints/Skills/ directory structure
    const blueprintsSkillsDir = join(config.system.root, "Blueprints", "Skills");
    await Deno.mkdir(blueprintsSkillsDir, { recursive: true });

    // Create a test skill in Blueprints/Skills/
    const testSkillContent = `---
id: "550e8400-e29b-41d4-a716-446655440001"
created_at: "2026-01-10T00:00:00.000Z"
skill_id: "blueprint-test-skill"
name: "Blueprint Test Skill"
version: "1.0.0"
description: "A test skill for blueprint migration"
scope: "global"
status: "active"
source: "user"
usage_count: 0

triggers:
  keywords: ["test"]
  task_types: ["test"]
  file_patterns: ["*.ts"]
  tags: ["test"]

constraints:
  - "Test constraint"
---

Test instructions for blueprint skill.
`;

    const skillPath = join(blueprintsSkillsDir, "blueprint-test-skill.skill.md");
    await Deno.writeTextFile(skillPath, testSkillContent);

    // Rebuild index to include the new skill
    await service.rebuildIndex();

    // Test that skill can be loaded from Blueprints/Skills/
    const skill = await service.getSkill("blueprint-test-skill");
    assertExists(skill);
    assertEquals(skill.skill_id, "blueprint-test-skill");
    assertEquals(skill.name, "Blueprint Test Skill");
  } finally {
    await cleanup();
  }
});

Deno.test("SkillsService: maintains backward compatibility with Memory/Skills/core/", async () => {
  const { db, config, cleanup } = await initTestDbService();

  try {
    const service = new SkillsService(config, db);
    await service.initialize();

    // Create old location skill
    const memorySkillsDir = join(config.system.root, "Memory", "Skills", "core");
    await Deno.mkdir(memorySkillsDir, { recursive: true });

    const testSkillContent = `---
id: "550e8400-e29b-41d4-a716-446655440002"
created_at: "2026-01-10T00:00:00.000Z"
skill_id: "legacy-test-skill"
name: "Legacy Test Skill"
version: "1.0.0"
description: "A test skill for legacy compatibility"
scope: "global"
status: "active"
source: "user"
usage_count: 0

triggers:
  keywords: ["legacy"]
  task_types: ["legacy"]
  file_patterns: ["*.js"]
  tags: ["legacy"]

constraints:
  - "Legacy constraint"
---

Legacy instructions for memory skill.
`;

    const skillPath = join(memorySkillsDir, "legacy-test-skill.skill.md");
    await Deno.writeTextFile(skillPath, testSkillContent);

    // Rebuild index to include the new skill
    await service.rebuildIndex();

    // Test that skill can still be loaded from old location
    const skill = await service.getSkill("legacy-test-skill");
    assertExists(skill);
    assertEquals(skill.skill_id, "legacy-test-skill");
    assertEquals(skill.name, "Legacy Test Skill");
  } finally {
    await cleanup();
  }
});

Deno.test("SkillsService: prioritizes Blueprints/Skills/ over Memory/Skills/core/", async () => {
  const { db, config, cleanup } = await initTestDbService();

  try {
    const service = new SkillsService(config, db);
    await service.initialize();

    // Create skill in both locations with different content
    const blueprintsSkillsDir = join(config.system.root, "Blueprints", "Skills");
    const memorySkillsDir = join(config.system.root, "Memory", "Skills", "core");
    await Deno.mkdir(blueprintsSkillsDir, { recursive: true });
    await Deno.mkdir(memorySkillsDir, { recursive: true });

    // Blueprint version (should be prioritized)
    const blueprintSkillContent = `---
id: "550e8400-e29b-41d4-a716-446655440003"
created_at: "2026-01-10T00:00:00.000Z"
skill_id: "priority-test-skill"
name: "Blueprint Priority Skill"
version: "2.0.0"
description: "Blueprint version for priority testing"
scope: "global"
status: "active"
source: "user"
usage_count: 0

triggers:
  keywords: ["priority"]
  task_types: ["priority"]
  file_patterns: ["*.ts"]
  tags: ["blueprint"]

constraints:
  - "Blueprint constraint"
---

Blueprint version should be loaded.
`;

    // Memory version (should be ignored)
    const memorySkillContent = `---
id: "550e8400-e29b-41d4-a716-446655440004"
created_at: "2026-01-10T00:00:00.000Z"
skill_id: "priority-test-skill"
name: "Memory Priority Skill"
version: "1.0.0"
description: "Memory version for priority testing"
scope: "global"
status: "active"
source: "user"
usage_count: 0

triggers:
  keywords: ["priority"]
  task_types: ["priority"]
  file_patterns: ["*.js"]
  tags: ["memory"]

constraints:
  - "Memory constraint"
---

Memory version should NOT be loaded.
`;

    await Deno.writeTextFile(join(blueprintsSkillsDir, "priority-test-skill.skill.md"), blueprintSkillContent);
    await Deno.writeTextFile(join(memorySkillsDir, "priority-test-skill.skill.md"), memorySkillContent);

    // Rebuild index to include both skills (blueprints should take priority)
    await service.rebuildIndex();

    // Test that blueprint version is loaded
    const skill = await service.getSkill("priority-test-skill");
    assertExists(skill);
    assertEquals(skill.name, "Blueprint Priority Skill");
    assertEquals(skill.version, "2.0.0");
  } finally {
    await cleanup();
  }
});
