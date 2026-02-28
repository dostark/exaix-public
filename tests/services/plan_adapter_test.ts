/**
 * @module PlanAdapterTest
 * @path tests/services/plan_adapter_test.ts
 * @description Verifies the PlanAdapter's ability to serialize and deserialize execution plans
 * across frontmatter, internal objects, and human-readable Markdown representations.
 */

import { describe, it } from "@std/testing/bdd";
import { McpToolName } from "../../src/shared/enums.ts";

import { assertEquals, assertExists, assertStringIncludes, assertThrows } from "@std/assert";

// Import adapter (will create this)
import { PlanAdapter, PlanValidationError } from "../../src/services/plan_adapter.ts";
import type { Plan } from "../../src/shared/schemas/plan_schema.ts";

describe("PlanAdapter", () => {
  const adapter = new PlanAdapter();

  describe("parse() - Valid JSON", () => {
    it("should parse valid JSON plan with all fields", () => {
      const jsonContent = JSON.stringify({
        subject: "Implement Authentication System",
        description: "Add user authentication with JWT tokens",
        steps: [
          {
            step: 1,
            title: "Create User Schema",
            description: "Create database schema for users",
            tools: [McpToolName.WRITE_FILE, McpToolName.RUN_COMMAND],
            successCriteria: ["Migration file created", "Schema valid"],
            dependencies: [],
            rollback: "Drop users table",
          },
          {
            step: 2,
            title: "Password Hashing",
            description: "Implement password hashing utilities",
            tools: [McpToolName.WRITE_FILE],
            dependencies: [1],
          },
        ],
        estimatedDuration: "2-3 hours",
        risks: ["JWT secret security", "Migration conflicts"],
      });

      const plan: Plan = adapter.parse(jsonContent);

      assertEquals(plan.subject, "Implement Authentication System");
      assertEquals(plan.description, "Add user authentication with JWT tokens");
      assertEquals(plan.steps?.length, 2);
      assertEquals(plan.steps?.[0].step, 1);
      assertEquals(plan.steps?.[0].tools?.length, 2);
      assertEquals(plan.steps?.[0].successCriteria?.length, 2);
      assertEquals(plan.steps?.[0].rollback, "Drop users table");
      assertEquals(plan.steps?.[1].dependencies?.length, 1);
      assertEquals(plan.estimatedDuration, "2-3 hours");
      assertEquals(plan.risks?.length, 2);
    });

    it("should parse minimal JSON plan (required fields only)", () => {
      const jsonContent = JSON.stringify({
        subject: "Simple Plan",
        description: "A simple plan",
        steps: [
          {
            step: 1,
            title: "Do something",
            description: "Perform the task",
          },
        ],
      });

      const plan: Plan = adapter.parse(jsonContent);

      assertEquals(plan.subject, "Simple Plan");
      assertEquals(plan.steps?.length, 1);
      assertEquals(plan.steps?.[0].tools, undefined);
      assertEquals(plan.estimatedDuration, undefined);
    });
  });

  describe("parse() - Invalid JSON Syntax", () => {
    it("should throw PlanValidationError for malformed JSON", () => {
      const invalidJson = '{ "subject": "Broken JSON" invalid }';

      assertThrows(
        () => adapter.parse(invalidJson),
        PlanValidationError,
        "Invalid JSON",
      );
    });

    it("should include raw content in error details", () => {
      const invalidJson = "not json at all";

      try {
        adapter.parse(invalidJson);
        throw new Error("Should have thrown PlanValidationError");
      } catch (err) {
        const error = err as Error;
        assertEquals(error instanceof PlanValidationError, true);
        if (error instanceof PlanValidationError) {
          assertExists(error.details);
          assertEquals(error.details.rawContent, invalidJson);
        }
      }
    });
  });

  describe("parse() - Schema Validation Errors", () => {
    it("should throw PlanValidationError when subject is missing", () => {
      const jsonContent = JSON.stringify({
        description: "Missing subject",
        steps: [
          {
            step: 1,
            title: "Step 1",
            description: "Description",
          },
        ],
      });

      assertThrows(
        () => adapter.parse(jsonContent),
        PlanValidationError,
        "Required",
      );
    });

    it("should throw PlanValidationError when steps are missing", () => {
      const jsonContent = JSON.stringify({
        subject: "Has Subject",
        description: "Missing steps",
      });

      assertThrows(
        () => adapter.parse(jsonContent),
        PlanValidationError,
        "Plan must contain",
      );
    });

    it("should include Zod errors in error details", () => {
      const jsonContent = JSON.stringify({
        subject: "Plan",
        description: "Description",
        steps: [], // Empty array, should fail min(1) validation
      });

      try {
        adapter.parse(jsonContent);
        throw new Error("Should have thrown PlanValidationError");
      } catch (err) {
        const error = err as Error;
        assertEquals(error instanceof PlanValidationError, true);
        if (error instanceof PlanValidationError) {
          assertExists(error.details.zodErrors);
          assertEquals(Array.isArray(error.details.zodErrors), true);
        }
      }
    });

    it("should reject invalid tool enum values", () => {
      const jsonContent = JSON.stringify({
        subject: "Subject",
        description: "Description",
        steps: [
          {
            step: 1,
            title: "Step",
            description: "Desc",
            tools: ["invalid_tool"],
          },
        ],
      });

      assertThrows(
        () => adapter.parse(jsonContent),
        PlanValidationError,
        "Invalid enum value",
      );
    });

    it("should reject invalid field types", () => {
      const jsonContent = JSON.stringify({
        subject: "Subject",
        description: "Description",
        steps: [
          {
            step: "one", // Should be number
            title: "Step",
            description: "Desc",
          },
        ],
      });

      assertThrows(
        () => adapter.parse(jsonContent),
        PlanValidationError,
      );
    });
  });

  describe("toMarkdown() - Conversion", () => {
    it("should convert plan with all fields to markdown", () => {
      const plan: Plan = {
        subject: "Implement Authentication",
        description: "Add authentication to the application",
        steps: [
          {
            step: 1,
            title: "Create Schema",
            description: "Create user database schema",
            tools: [McpToolName.WRITE_FILE, McpToolName.RUN_COMMAND],
            successCriteria: ["Schema created", "Migration runs"],
            dependencies: [],
            rollback: "Drop table",
          },
          {
            step: 2,
            title: "Add Middleware",
            description: "Create auth middleware",
            tools: [McpToolName.WRITE_FILE],
            dependencies: [1],
            successCriteria: ["Middleware works"],
          },
        ],
        estimatedDuration: "3 hours",
        risks: ["Security concerns", "Breaking changes"],
      };

      const markdown = adapter.toMarkdown(plan);

      // Check subject (header)
      assertStringIncludes(markdown, "# Implement Authentication");

      // Check description
      assertStringIncludes(markdown, "Add authentication to the application");

      // Check estimated duration
      assertStringIncludes(markdown, "**Estimated Duration:** 3 hours");

      // Check risks section
      assertStringIncludes(markdown, "## Risks");
      assertStringIncludes(markdown, "- Security concerns");
      assertStringIncludes(markdown, "- Breaking changes");

      // Check steps
      assertStringIncludes(markdown, "## Step 1: Create Schema");
      assertStringIncludes(markdown, "Create user database schema");

      // Check tools
      assertStringIncludes(markdown, "**Tools:** write_file, run_command");

      // Check success criteria
      assertStringIncludes(markdown, "**Success Criteria:**");
      assertStringIncludes(markdown, "- Schema created");
      assertStringIncludes(markdown, "- Migration runs");

      // Check rollback
      assertStringIncludes(markdown, "**Rollback:** Drop table");

      // Check dependencies
      assertStringIncludes(markdown, "**Dependencies:** Steps 1");
    });

    it("should convert minimal plan to markdown", () => {
      const plan: Plan = {
        subject: "Simple Plan",
        description: "A simple plan",
        steps: [
          {
            step: 1,
            title: "Do Task",
            description: "Complete the task",
          },
        ],
      };

      const markdown = adapter.toMarkdown(plan);

      assertStringIncludes(markdown, "# Simple Plan");
      assertStringIncludes(markdown, "A simple plan");
      assertStringIncludes(markdown, "## Step 1: Do Task");
      assertStringIncludes(markdown, "Complete the task");

      // Should not include optional sections
      assertEquals(markdown.includes("**Estimated Duration:**"), false);
      assertEquals(markdown.includes("## Risks"), false);
      assertEquals(markdown.includes("**Tools:**"), false);
      assertEquals(markdown.includes("**Dependencies:**"), false);
    });

    it("should format steps with dependencies correctly", () => {
      const plan: Plan = {
        subject: "Plan",
        description: "Description",
        steps: [
          {
            step: 1,
            title: "Step 1",
            description: "First step",
          },
          {
            step: 2,
            title: "Step 2",
            description: "Second step",
            dependencies: [1],
          },
          {
            step: 3,
            title: "Step 3",
            description: "Third step",
            dependencies: [1, 2],
          },
        ],
      };

      const markdown = adapter.toMarkdown(plan);

      // Step 2 depends on step 1
      assertStringIncludes(markdown, "**Dependencies:** Steps 1");

      // Step 3 depends on steps 1 and 2
      assertStringIncludes(markdown, "**Dependencies:** Steps 1, 2");
    });

    it("should include all valid tools in markdown", () => {
      const plan: Plan = {
        subject: "Plan",
        description: "Description",
        steps: [
          {
            step: 1,
            title: "Step",
            description: "Desc",
            tools: [
              McpToolName.READ_FILE,
              McpToolName.WRITE_FILE,
              McpToolName.RUN_COMMAND,
              McpToolName.LIST_DIRECTORY,
              McpToolName.SEARCH_FILES,
            ],
          },
        ],
      };

      const markdown = adapter.toMarkdown(plan);

      assertStringIncludes(markdown, "**Tools:** read_file, write_file, run_command, list_directory, search_files");
    });

    it("should format success criteria as bullet list", () => {
      const plan: Plan = {
        subject: "Plan",
        description: "Description",
        steps: [
          {
            step: 1,
            title: "Step",
            description: "Desc",
            successCriteria: ["First criterion", "Second criterion", "Third criterion"],
          },
        ],
      };

      const markdown = adapter.toMarkdown(plan);

      assertStringIncludes(markdown, "**Success Criteria:**");
      assertStringIncludes(markdown, "- First criterion");
      assertStringIncludes(markdown, "- Second criterion");
      assertStringIncludes(markdown, "- Third criterion");
    });
  });

  describe("PlanValidationError", () => {
    it("should be throwable error with details", () => {
      const error = new PlanValidationError("Test error", {
        testDetail: "test value",
        rawContent: "some content",
      });

      assertEquals(error instanceof Error, true);
      assertEquals(error.name, "PlanValidationError");
      assertEquals(error.message, "Test error");
      assertExists(error.details);
      assertEquals(error.details.testDetail, "test value");
      assertEquals(error.details.rawContent, "some content");
    });
  });
});
