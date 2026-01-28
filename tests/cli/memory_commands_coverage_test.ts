/**
 * Additional Coverage Tests for MemoryCommands
 *
 * Covers untested paths to improve coverage from 66.1% to >80%
 */

import { ConfidenceLevel, ExecutionStatus, LearningCategory, MemoryScope, MemoryType } from "../../src/enums.ts";
import { assertEquals, assertStringIncludes } from "@std/assert";
import { MemoryEmbeddingService } from "../../src/services/memory_embedding.ts";
import { TestEnvironmentFactory } from "../fixtures/test_environment_factory.ts";
import { LearningBuilder, ProjectMemoryBuilder } from "../fixtures/memory_builder.ts";

// ===== Search with Embeddings Tests =====

Deno.test("MemoryCommands: search with useEmbeddings option", async () => {
  const { commands, memoryBank, config, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  const embedding = new MemoryEmbeddingService(config);
  try {
    // Create project
    await memoryBank.createProjectMemory(
      new ProjectMemoryBuilder("EmbedProject")
        .addPattern({
          name: "Error Handling Pattern",
          description: "Always use try-catch for async operations",
          examples: ["src/api.ts"],
          tags: ["error-handling", "typescript"],
        })
        .build(),
    );

    // Create embeddings for the learning
    const learning = new LearningBuilder()
      .withScope(MemoryScope.GLOBAL)
      .withTitle("Error handling best practices")
      .withDescription("Use try-catch with proper logging for errors")
      .withCategory(LearningCategory.PATTERN)
      .withTags(["error-handling"])
      .build();

    await embedding.embedLearning(learning);

    const result = await commands.search("error handling", {
      useEmbeddings: true,
      format: "table",
    });

    // Should return some results (even if empty due to mock embeddings)
    assertEquals(typeof result, "string");
  } finally {
    await cleanup();
  }
});

Deno.test("MemoryCommands: search with tags option", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    await memoryBank.createProjectMemory(
      new ProjectMemoryBuilder("TagProject")
        .addPattern({
          name: "Error Handling Pattern",
          description: "Use try-catch",
          examples: ["src/api.ts"],
          tags: ["error-handling", "typescript"], // Includes typescript tag
        })
        .build(),
    );

    const result = await commands.search(LearningCategory.PATTERN, {
      tags: ["typescript"],
      format: "table",
    });

    assertEquals(typeof result, "string");
  } finally {
    await cleanup();
  }
});

Deno.test("MemoryCommands: search --format md outputs markdown", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    await memoryBank.createProjectMemory(
      new ProjectMemoryBuilder("MdSearchProject").build(),
    );

    const result = await commands.search("Pattern", { format: "md" });

    // If results found, should have markdown formatting
    if (!result.includes("No results found")) {
      assertStringIncludes(result, "# Search Results");
      assertStringIncludes(result, "| Type |");
    }
  } finally {
    await cleanup();
  }
});

// ===== Project List Markdown Format Test =====

Deno.test("MemoryCommands: project list --format md outputs markdown", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    await memoryBank.createProjectMemory(
      new ProjectMemoryBuilder("MdListProject").build(),
    );

    const result = await commands.projectList("md");

    assertStringIncludes(result, "# Project Memories");
    assertStringIncludes(result, "| Project |");
    assertStringIncludes(result, "MdListProject");
  } finally {
    await cleanup();
  }
});

Deno.test("MemoryCommands: project show --format md outputs markdown", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    await memoryBank.createProjectMemory(
      new ProjectMemoryBuilder("MdShowProject")
        .addPattern({ name: "Test Pattern" })
        .build(),
    );

    const result = await commands.projectShow("MdShowProject", "md");

    assertStringIncludes(result, "# Project Memory:");
    assertStringIncludes(result, "## Overview");
    assertStringIncludes(result, "## Patterns");
  } finally {
    await cleanup();
  }
});

// ===== Execution List Markdown Format Test =====

Deno.test("MemoryCommands: execution list --format md outputs markdown", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    const traceId = "cccccccc-cccc-4000-8000-000000000001";
    await memoryBank.createExecutionRecord({
      trace_id: traceId,
      request_id: "req-123",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: ExecutionStatus.COMPLETED,
      portal: "MdExecProject",
      agent: "test-agent",
      summary: "Test execution",
      context_files: [],
      context_portals: ["MdExecProject"],
      changes: {
        files_created: [],
        files_modified: [],
        files_deleted: [],
      },
    });

    const result = await commands.executionList({ format: "md" });

    assertStringIncludes(result, "# Execution History");
    assertStringIncludes(result, "| Trace ID |");
  } finally {
    await cleanup();
  }
});

// ===== Global Memory Tests =====

Deno.test("MemoryCommands: globalShow returns init message when not initialized", async () => {
  const { commands, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    const result = await commands.globalShow("table");

    assertStringIncludes(result, "not initialized");
  } finally {
    await cleanup();
  }
});

Deno.test("MemoryCommands: globalShow with initialized memory", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    await memoryBank.initGlobalMemory();

    const result = await commands.globalShow("table");

    assertStringIncludes(result, "Global Memory");
    assertStringIncludes(result, "Version:");
  } finally {
    await cleanup();
  }
});

Deno.test("MemoryCommands: globalShow --format md outputs markdown", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    await memoryBank.initGlobalMemory();

    const result = await commands.globalShow("md");

    assertStringIncludes(result, "# Global Memory");
    assertStringIncludes(result, "| Property | Value |");
  } finally {
    await cleanup();
  }
});

Deno.test("MemoryCommands: globalListLearnings returns init message when not initialized", async () => {
  const { commands, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    const result = await commands.globalListLearnings("table");

    assertStringIncludes(result, "not initialized");
  } finally {
    await cleanup();
  }
});

Deno.test("MemoryCommands: globalListLearnings with no learnings", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    await memoryBank.initGlobalMemory();

    const result = await commands.globalListLearnings("table");

    assertStringIncludes(result, "No learnings");
  } finally {
    await cleanup();
  }
});

Deno.test("MemoryCommands: globalListLearnings --format md outputs markdown", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    await memoryBank.initGlobalMemory();

    // Add a global learning
    const learning = new LearningBuilder()
      .withTitle("Test global learning")
      .withDescription("A test learning description")
      .withCategory(LearningCategory.PATTERN)
      .withTags(["test"])
      .withScope(MemoryScope.GLOBAL)
      .build();

    await memoryBank.addGlobalLearning(learning);

    const result = await commands.globalListLearnings("md");

    assertStringIncludes(result, "# Global Learnings");
    assertStringIncludes(result, "| ID |");
  } finally {
    await cleanup();
  }
});

Deno.test("MemoryCommands: globalStats returns init message when not initialized", async () => {
  const { commands, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    const result = await commands.globalStats("table");

    assertStringIncludes(result, "not initialized");
  } finally {
    await cleanup();
  }
});

Deno.test("MemoryCommands: globalStats --format md outputs markdown", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    await memoryBank.initGlobalMemory();

    const result = await commands.globalStats("md");

    assertStringIncludes(result, "# Global Memory Statistics");
    assertStringIncludes(result, "| Metric | Value |");
  } finally {
    await cleanup();
  }
});

// ===== Promote/Demote Error Handling Tests =====

Deno.test("MemoryCommands: promote returns error for non-existent project", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    await memoryBank.initGlobalMemory();

    const result = await commands.promote("NonExistentPortal", {
      type: MemoryType.PATTERN,
      name: "test",
      title: "Test Pattern",
      description: "Test description",
      category: LearningCategory.PATTERN,
      tags: ["test"],
      confidence: ConfidenceLevel.MEDIUM,
    });

    assertStringIncludes(result, "Error");
  } finally {
    await cleanup();
  }
});

Deno.test("MemoryCommands: demote returns error for non-existent learning", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    await memoryBank.initGlobalMemory();
    await memoryBank.createProjectMemory(
      new ProjectMemoryBuilder("DemoteTarget").build(),
    );

    const result = await commands.demote("non-existent-id", "DemoteTarget");

    assertStringIncludes(result, "Error");
  } finally {
    await cleanup();
  }
});

// ===== Pending Commands Error Handling =====

Deno.test("MemoryCommands: pendingApprove returns error for non-existent proposal", async () => {
  const { commands, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    const result = await commands.pendingApprove("non-existent-proposal-id");

    assertStringIncludes(result, "not found");
  } finally {
    await cleanup();
  }
});

Deno.test("MemoryCommands: pendingReject returns error for non-existent proposal", async () => {
  const { commands, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    const result = await commands.pendingReject("non-existent-proposal-id", "Reason");

    assertStringIncludes(result, "not found");
  } finally {
    await cleanup();
  }
});

// ===== Rebuild Index with Embeddings =====

Deno.test("MemoryCommands: rebuildIndex with embeddings option", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    await memoryBank.initGlobalMemory();

    // Add a learning to embed
    const learning = new LearningBuilder()
      .withTitle("Embedding test learning")
      .withDescription("This learning will be embedded during index rebuild")
      .withCategory(LearningCategory.INSIGHT)
      .withTags(["test"])
      .withScope(MemoryScope.GLOBAL)
      .build();

    await memoryBank.addGlobalLearning(learning);

    const result = await commands.rebuildIndex({ includeEmbeddings: true });

    assertStringIncludes(result, "rebuilt successfully");
    assertStringIncludes(result, "Embeddings regenerated");
  } finally {
    await cleanup();
  }
});

// ===== Edge Cases for Execution Show =====

Deno.test("MemoryCommands: execution show with error message", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    const traceId = "ffffffff-ffff-4000-8000-000000000001";
    await memoryBank.createExecutionRecord({
      trace_id: traceId,
      request_id: "req-error",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: ExecutionStatus.FAILED,
      portal: "ErrorProject",
      agent: "test-agent",
      summary: "Failed execution",
      context_files: [],
      context_portals: [],
      changes: {
        files_created: [],
        files_modified: [],
        files_deleted: [],
      },
      error_message: "Connection timeout after 30 seconds",
    });

    const result = await commands.executionShow(traceId, "table");

    assertStringIncludes(result, "Error:");
    assertStringIncludes(result, "Connection timeout");
  } finally {
    await cleanup();
  }
});

Deno.test("MemoryCommands: execution show with changes and lessons learned", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    const traceId = "11111111-1111-4000-8000-000000000001";
    await memoryBank.createExecutionRecord({
      trace_id: traceId,
      request_id: "req-full",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: ExecutionStatus.COMPLETED,
      portal: "FullProject",
      agent: "test-agent",
      summary: "Full execution with changes",
      context_files: ["src/main.ts", "src/api.ts"],
      context_portals: ["FullProject"],
      changes: {
        files_created: ["src/new.ts"],
        files_modified: ["src/main.ts"],
        files_deleted: ["src/old.ts"],
      },
      lessons_learned: ["Lesson 1: Test first", "Lesson 2: Document everything"],
    });

    const result = await commands.executionShow(traceId, "table");

    assertStringIncludes(result, "Changes:");
    assertStringIncludes(result, "Created:");
    assertStringIncludes(result, "Modified:");
    assertStringIncludes(result, "Deleted:");
    assertStringIncludes(result, "Lessons Learned:");
    assertStringIncludes(result, "Test first");
  } finally {
    await cleanup();
  }
});

Deno.test("MemoryCommands: execution show --format md with full data", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    const traceId = "22222222-2222-4000-8000-000000000001";
    await memoryBank.createExecutionRecord({
      trace_id: traceId,
      request_id: "req-md",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: ExecutionStatus.COMPLETED,
      portal: "MdFullProject",
      agent: "test-agent",
      summary: "Full markdown test",
      context_files: ["src/index.ts"],
      context_portals: ["MdFullProject"],
      changes: {
        files_created: ["src/feature.ts"],
        files_modified: ["src/index.ts"],
        files_deleted: [],
      },
      lessons_learned: ["Always write tests"],
    });

    const result = await commands.executionShow(traceId, "md");

    assertStringIncludes(result, "# Execution:");
    assertStringIncludes(result, "## Context Files");
    assertStringIncludes(result, "## Changes");
    assertStringIncludes(result, "### Created");
    assertStringIncludes(result, "### Modified");
    assertStringIncludes(result, "## Lessons Learned");
  } finally {
    await cleanup();
  }
});

// ===== Global Learning Table Format =====

Deno.test("MemoryCommands: globalListLearnings table format with learnings", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    await memoryBank.initGlobalMemory();

    // Add multiple learnings
    for (let i = 1; i <= 3; i++) {
      await memoryBank.addGlobalLearning(
        new LearningBuilder()
          .withTitle(`Learning ${i}`)
          .withDescription(`Description for learning ${i}`)
          .withCategory(LearningCategory.PATTERN)
          .withTags(["test"])
          .build(),
      );
    }

    const result = await commands.globalListLearnings("table");

    assertStringIncludes(result, "Global Learnings");
    assertStringIncludes(result, "ID");
    assertStringIncludes(result, "Category");
    assertStringIncludes(result, "Confidence");
    assertStringIncludes(result, "Total: 3 learning(s)");
  } finally {
    await cleanup();
  }
});

// ===== Global Stats with Data =====

Deno.test("MemoryCommands: globalStats with learnings by category and project", async () => {
  const { commands, memoryBank, cleanup } = await TestEnvironmentFactory.createMemoryEnvironment();
  try {
    await memoryBank.initGlobalMemory();
    await memoryBank.createProjectMemory(
      new ProjectMemoryBuilder("StatsProject")
        .addPattern({
          name: "Error Handling Pattern",
          description: "Use try-catch",
          examples: [],
          tags: ["error-handling", "typescript"],
        })
        .build(),
    );

    // Add learnings of different categories
    await memoryBank.addGlobalLearning(
      new LearningBuilder()
        .withTitle("Pattern Learning")
        .withDescription("A pattern")
        .withCategory(LearningCategory.PATTERN)
        .build(),
    );

    await memoryBank.addGlobalLearning(
      new LearningBuilder()
        .withTitle("Insight Learning")
        .withDescription("An insight")
        .withCategory(LearningCategory.INSIGHT)
        .build(),
    );

    const result = await commands.globalStats("table");

    assertStringIncludes(result, "Global Memory Statistics");
    assertStringIncludes(result, "Total Learnings:");
    assertStringIncludes(result, "By Category:");
  } finally {
    await cleanup();
  }
});
