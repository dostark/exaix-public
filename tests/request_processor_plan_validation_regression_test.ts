/**
 * Regression tests for technical writer plan validation error handling fix
 *
 * This test suite covers the comprehensive fix for the issue where:
 * 1. PlanValidationError detection was unreliable (name-based vs instanceof)
 * 2. Rejected plans weren't always saved when raw content was unavailable
 * 3. Error messages weren't stored in request metadata
 * 4. CLI didn't display error information for failed requests
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { basename, join } from "@std/path";
import { exists } from "@std/fs";

import { RequestProcessor } from "../src/services/request_processor.ts";
import { CostTracker } from "../src/services/cost_tracker.ts";
import { StatusManager } from "../src/services/request_processing/status_manager.ts";
import { PlanValidationError } from "../src/services/plan_adapter.ts";
import { RequestStatus } from "../src/requests/request_status.ts";
import { PlanStatus } from "../src/plans/plan_status.ts";
import { initTestDbService } from "./helpers/db.ts";
import { getWorkspaceRejectedDir, getWorkspaceRequestsDir } from "./helpers/paths_helper.ts";
import { RequestShowHandler } from "../src/cli/handlers/request_show_handler.ts";
import type { CommandContext } from "../src/cli/base.ts";

// ============================================================================
// Test 1: PlanValidationError instanceof detection (main fix)
// ============================================================================

Deno.test("Regression: PlanValidationError instanceof detection works reliably", async () => {
  const testDbResult = await initTestDbService();
  const { tempDir, db, config, cleanup } = testDbResult;
  const costTracker = new CostTracker(db, config);

  try {
    await Deno.mkdir(getWorkspaceRequestsDir(tempDir), { recursive: true });

    const traceId = crypto.randomUUID();
    const requestPath = join(getWorkspaceRequestsDir(tempDir), `request-${traceId.slice(0, 8)}.md`);

    const requestContent = `--- 
trace_id: "${traceId}"
created: "${new Date().toISOString()}"
status: pending
priority: normal
agent: technical-writer
source: cli
created_by: "test@example.com"
---

Create documentation for the new feature.
`;

    await Deno.writeTextFile(requestPath, requestContent);

    const processor = new RequestProcessor(
      config,
      db,
      {
        workspacePath: join(tempDir, config.paths.workspace),
        requestsDir: getWorkspaceRequestsDir(tempDir),
        blueprintsPath: join(tempDir, config.paths.blueprints, "Agents"),
        includeReasoning: false,
      },
      undefined,
      costTracker,
    );

    // Test the instanceof detection with a proper PlanValidationError instance
    const validationError = new PlanValidationError("Invalid JSON structure", {
      rawContent: "INVALID_JSON_CONTENT",
      validationErrors: ["Expected property 'steps'"],
    });

    (processor as any).planWriter = {
      writePlan: () => {
        throw validationError;
      },
    };

    const result = await processor.process(requestPath);
    assertEquals(result, null);

    // Verify the request was marked as failed
    const updatedRequest = await Deno.readTextFile(requestPath);
    assertStringIncludes(updatedRequest, `status: ${RequestStatus.FAILED}`);

    // Verify error message was stored in frontmatter
    assertStringIncludes(updatedRequest, `error: "Invalid JSON structure"`);

    // Verify rejected plan was saved
    const requestId = basename(requestPath, ".md");
    const rejectedDir = getWorkspaceRejectedDir(tempDir);
    const rejectedPath = join(rejectedDir, `${requestId}_rejected.md`);

    assertEquals(await exists(rejectedPath), true);
    const rejectedContent = await Deno.readTextFile(rejectedPath);
    assertStringIncludes(rejectedContent, `status: ${PlanStatus.REJECTED}`);
    assertStringIncludes(rejectedContent, `request_id: "${requestId}"`);
    assertStringIncludes(rejectedContent, "INVALID_JSON_CONTENT");
  } finally {
    await costTracker.flush();
    await cleanup();
  }
});

// ============================================================================
// Test 2: Fallback content saving when raw content unavailable
// ============================================================================

Deno.test("Regression: Rejected plans saved with fallback content when raw content unavailable", async () => {
  const testDbResult = await initTestDbService();
  const { tempDir, db, config, cleanup } = testDbResult;
  const costTracker = new CostTracker(db, config);

  try {
    await Deno.mkdir(getWorkspaceRequestsDir(tempDir), { recursive: true });

    const traceId = crypto.randomUUID();
    const requestPath = join(getWorkspaceRequestsDir(tempDir), `request-${traceId.slice(0, 8)}.md`);

    const requestContent = `--- 
trace_id: "${traceId}"
created: "${new Date().toISOString()}"
status: pending
priority: normal
agent: technical-writer
source: cli
created_by: "test@example.com"
---

Create documentation for the new feature.
`;

    await Deno.writeTextFile(requestPath, requestContent);

    const processor = new RequestProcessor(
      config,
      db,
      {
        workspacePath: join(tempDir, config.paths.workspace),
        requestsDir: getWorkspaceRequestsDir(tempDir),
        blueprintsPath: join(tempDir, config.paths.blueprints, "Agents"),
        includeReasoning: false,
      },
      undefined,
      costTracker,
    );

    // Test with PlanValidationError that has no rawContent in details
    const validationError = new PlanValidationError("Schema validation failed", {
      validationErrors: ["Missing required field: title"],
      // No rawContent provided,
    });

    (processor as any).planWriter = {
      writePlan: () => {
        throw validationError;
      },
    };

    const result = await processor.process(requestPath);
    assertEquals(result, null);

    // Verify rejected plan was still saved with fallback content
    const requestId = basename(requestPath, ".md");
    const rejectedDir = getWorkspaceRejectedDir(tempDir);
    const rejectedPath = join(rejectedDir, `${requestId}_rejected.md`);

    assertEquals(await exists(rejectedPath), true);
    const rejectedContent = await Deno.readTextFile(rejectedPath);
    assertStringIncludes(rejectedContent, `status: ${PlanStatus.REJECTED}`);
    assertStringIncludes(rejectedContent, `request_id: "${requestId}"`);
    // Should contain fallback content indicating no raw content was available
    assertStringIncludes(rejectedContent, "No raw content available");
  } finally {
    await cleanup();
  }
});

// ============================================================================
// Test 3: Error message storage in YAML frontmatter
// ============================================================================

Deno.test("Regression: StatusManager stores error messages in YAML frontmatter", async () => {
  const testDbResult = await initTestDbService();
  const { tempDir, cleanup } = testDbResult;

  try {
    const statusManager = new StatusManager({
      error: async () => {},
      info: async () => {},
      debug: async () => {},
    } as any);

    const requestPath = join(tempDir, "test-request.md");
    const originalContent = `--- 
trace_id: "test-trace-id"
created: "2024-01-01T00:00:00.000Z"
status: pending
priority: normal
agent: technical-writer
source: cli
created_by: "test@example.com"
---

Test request content.
`;

    await Deno.writeTextFile(requestPath, originalContent);

    // Test error message storage
    await statusManager.updateStatus(
      requestPath,
      originalContent,
      RequestStatus.FAILED,
      "Plan validation failed: Invalid JSON structure",
    );

    const updatedContent = await Deno.readTextFile(requestPath);

    // Verify status was updated
    assertStringIncludes(updatedContent, `status: ${RequestStatus.FAILED}`);

    // Verify error message was added
    assertStringIncludes(updatedContent, `error: "Plan validation failed: Invalid JSON structure"`);

    // Test error message update (when error field already exists)
    const contentWithError = updatedContent.replace(
      'error: "Plan validation failed: Invalid JSON structure"',
      'error: "Old error message"',
    );

    await statusManager.updateStatus(
      requestPath,
      contentWithError,
      RequestStatus.FAILED,
      'New error message with quotes: "test"',
    );

    const finalContent = await Deno.readTextFile(requestPath);

    // Verify error message was updated and quotes were escaped
    assertStringIncludes(finalContent, `error: "New error message with quotes: \"test\""`);
  } finally {
    await cleanup();
  }
});

// ============================================================================
// Test 4: CLI error display functionality
// ============================================================================

Deno.test("Regression: CLI displays error information for failed requests", async () => {
  const testDbResult = await initTestDbService();
  const { tempDir, db, config, cleanup } = testDbResult;

  try {
    await Deno.mkdir(getWorkspaceRequestsDir(tempDir), { recursive: true });

    const traceId = crypto.randomUUID();
    const requestPath = join(getWorkspaceRequestsDir(tempDir), `request-${traceId.slice(0, 8)}.md`);

    const requestContent = `--- 
trace_id: "${traceId}"
created: "${new Date().toISOString()}"
status: failed
priority: normal
agent: technical-writer
source: cli
created_by: "test@example.com"
error: "Plan validation failed: Invalid JSON structure in technical writer response"
---

Create documentation for the new feature.
`;

    await Deno.writeTextFile(requestPath, requestContent);

    const context: CommandContext = {
      config,
      db,
    };

    const handler = new RequestShowHandler(context);
    const result = await handler.show(basename(requestPath, ".md"));

    // Verify error information is included in metadata
    assertExists(result.metadata.error);
    assertEquals(result.metadata.error, "Plan validation failed: Invalid JSON structure in technical writer response");

    // Verify other metadata is still present
    assertEquals(result.metadata.status, "failed");
    assertEquals(result.metadata.agent, "technical-writer");
    assertEquals(result.metadata.trace_id, traceId);
  } finally {
    await cleanup();
  }
});

// ============================================================================
// ============================================================================

Deno.test("Regression: End-to-end error handling workflow from PlanValidationError to CLI display", async () => {
  const testDbResult = await initTestDbService();
  const { tempDir, db, config, cleanup } = testDbResult;
  const costTracker = new CostTracker(db, config);

  try {
    await Deno.mkdir(getWorkspaceRequestsDir(tempDir), { recursive: true });

    const traceId = crypto.randomUUID();
    const requestPath = join(getWorkspaceRequestsDir(tempDir), `request-${traceId.slice(0, 8)}.md`);

    const requestContent = `--- 
trace_id: "${traceId}"
created: "${new Date().toISOString()}"
status: pending
priority: normal
agent: technical-writer
source: cli
created_by: "test@example.com"
---

Create documentation for the new feature.
`;

    await Deno.writeTextFile(requestPath, requestContent);

    // Simulate the full error handling workflow
    const processor = new RequestProcessor(
      config,
      db,
      {
        workspacePath: join(tempDir, config.paths.workspace),
        requestsDir: getWorkspaceRequestsDir(tempDir),
        blueprintsPath: join(tempDir, config.paths.blueprints, "Agents"),
        includeReasoning: false,
      },
      undefined,
      costTracker,
    );

    // Create a PlanValidationError with detailed error information
    const detailedError = new PlanValidationError(
      "Technical writer generated invalid plan JSON",
      {
        rawContent: `{\"title\": \"Invalid Plan\", \"description\": \"Missing steps array}"`, // Corrected escaping for rawContent
        validationErrors: [
          "Missing required field: steps",
          "Unterminated string literal at position 45",
        ],
        agent: "technical-writer",
        modelResponse: "Some raw model response that caused the error",
      },
    );

    (processor as any).planWriter = {
      writePlan: () => {
        throw detailedError;
      },
    };

    // Process the request (should handle the error)
    const result = await processor.process(requestPath);
    assertEquals(result, null);

    // Verify the request was marked as failed with error message
    const updatedRequest = await Deno.readTextFile(requestPath);
    assertStringIncludes(updatedRequest, `status: ${RequestStatus.FAILED}`);
    assertStringIncludes(updatedRequest, `error: "Technical writer generated invalid plan JSON"`);

    // Verify rejected plan was saved with the raw content
    const requestId = basename(requestPath, ".md");
    const rejectedDir = getWorkspaceRejectedDir(tempDir);
    const rejectedPath = join(rejectedDir, `${requestId}_rejected.md`);

    assertEquals(await exists(rejectedPath), true);
    const rejectedContent = await Deno.readTextFile(rejectedPath);
    assertStringIncludes(rejectedContent, `status: ${PlanStatus.REJECTED}`);
    assertStringIncludes(rejectedContent, `request_id: "${requestId}"`);
    assertStringIncludes(rejectedContent, `{"title": "Invalid Plan", "description": "Missing steps array}`);

    // Verify CLI can display the error information
    const context: CommandContext = {
      config,
      db,
    };

    const handler = new RequestShowHandler(context);
    const showResult = await handler.show(requestId);

    assertEquals(showResult.metadata.error, "Technical writer generated invalid plan JSON");
    assertEquals(showResult.metadata.status, "failed");
  } finally {
    await costTracker.flush();
    await cleanup();
  }
});
