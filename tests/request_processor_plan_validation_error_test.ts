import { assertEquals, assertStringIncludes } from "@std/assert";
import { basename, join } from "@std/path";

import { RequestProcessor } from "../src/services/request_processor.ts";
import { CostTracker } from "../src/services/cost_tracker.ts";
import { StatusManager } from "../src/services/request_processing/status_manager.ts";
import { initTestDbService } from "./helpers/db.ts";
import { getWorkspaceRequestsDir } from "./helpers/paths_helper.ts";
import { PlanStatus } from "../src/plans/plan_status.ts";
import { RequestStatus } from "../src/requests/request_status.ts";
import { PlanValidationError } from "../src/services/plan_adapter.ts";

Deno.test("RequestProcessor: PlanValidationError saves rejected raw content and marks request failed", async () => {
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
flow: code-review
source: cli
created_by: "test@example.com"
---

Do flow work.
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

    const rejectedRaw = "RAW_PLAN_CONTENT";

    // Use proper PlanValidationError instance (regression test for instanceof detection)
    const validationError = new PlanValidationError("Invalid plan structure", {
      rawContent: rejectedRaw,
      validationErrors: ["Missing required field: steps"],
    });

    (processor as any).planWriter = {
      writePlan: () => {
        throw validationError;
      },
    };

    const result = await processor.process(requestPath);
    assertEquals(result, null);

    const requestId = basename(requestPath, ".md");
    const rejectedDir = join(config.system.root, config.paths.workspace, config.paths.rejected);
    const rejectedPath = join(rejectedDir, `${requestId}_rejected.md`);

    const rejectedContent = await Deno.readTextFile(rejectedPath);
    assertStringIncludes(rejectedContent, `status: ${PlanStatus.REJECTED}`);
    assertStringIncludes(rejectedContent, `request_id: "${requestId}"`);
    assertStringIncludes(rejectedContent, rejectedRaw);

    const updatedRequest = await Deno.readTextFile(requestPath);
    assertStringIncludes(updatedRequest, `status: ${RequestStatus.FAILED}`);

    // Regression test: verify error message is stored in frontmatter
    assertStringIncludes(updatedRequest, `error: "Invalid plan structure"`);
  } finally {
    await costTracker.flush();
    await cleanup();
  }
});

// ============================================================================
// Additional Regression Tests for the Plan Validation Fix
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
    const rejectedDir = join(config.system.root, config.paths.workspace, config.paths.rejected);
    const rejectedPath = join(rejectedDir, `${requestId}_rejected.md`);

    const rejectedContent = await Deno.readTextFile(rejectedPath);
    assertStringIncludes(rejectedContent, `status: ${PlanStatus.REJECTED}`);
    assertStringIncludes(rejectedContent, `request_id: "${requestId}"`);
    assertStringIncludes(rejectedContent, "INVALID_JSON_CONTENT");
  } finally {
    await costTracker.flush();
    await cleanup();
  }
});

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
      // No rawContent provided
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
    const rejectedDir = join(config.system.root, config.paths.workspace, config.paths.rejected);
    const rejectedPath = join(rejectedDir, `${requestId}_rejected.md`);

    const rejectedContent = await Deno.readTextFile(rejectedPath);
    assertStringIncludes(rejectedContent, `status: ${PlanStatus.REJECTED}`);
    assertStringIncludes(rejectedContent, `request_id: "${requestId}"`);
    // Should contain fallback content indicating no raw content was available
    assertStringIncludes(rejectedContent, "No raw content available");
  } finally {
    await costTracker.flush();
    await cleanup();
  }
});

// ============================================================================
// StatusManager Error Storage Test
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
  } finally {
    await cleanup();
  }
});
