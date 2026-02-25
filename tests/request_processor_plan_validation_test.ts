/**
 * @module PlanValidationRequestTest
 * @path tests/request_processor_plan_validation_test.ts
 * @description Verifies the RequestProcessor's resilience when handling invalid plans,
 * ensuring rejected content is captured for debugging without breaking the execution loop.
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { basename, join } from "@std/path";
import { parse } from "@std/yaml";

import { RequestProcessor } from "../src/services/request_processor.ts";
import { CostTracker } from "../src/services/cost_tracker.ts";
import { PlanValidationError } from "../src/services/plan_adapter.ts";
import { RequestStatus } from "../src/requests/request_status.ts";
import { PlanStatus } from "../src/plans/plan_status.ts";
import { initTestDbService } from "./helpers/db.ts";
import { getWorkspaceRejectedDir, getWorkspaceRequestsDir } from "./helpers/paths_helper.ts";
import { RequestShowHandler } from "../src/cli/handlers/request_show_handler.ts";
import { StatusManager } from "../src/services/request_processing/status_manager.ts";
import type { EventLogger } from "../src/services/event_logger.ts";

import type { JSONObject } from "../src/types.ts";
function parseFrontmatter(content: string): JSONObject {
  const parts = content.split("---");
  if (parts.length < 3) {
    throw new Error("Invalid markdown content: missing YAML frontmatter delimiters.");
  }
  return parse(parts[1]) as JSONObject;
}

// ============================================================================
// Core Error Handling Tests
// ============================================================================

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

    const validationError = new PlanValidationError("Invalid plan structure", {
      rawContent: rejectedRaw,
      validationErrors: ["Missing required field: steps"],
    });

    Object.defineProperty(processor, "planWriter", {
      value: {
        writePlan: () => {
          throw validationError;
        },
      },
      writable: true,
    });

    const result = await processor.process(requestPath);
    assertEquals(result, null);

    const requestId = basename(requestPath, ".md");
    const rejectedDir = getWorkspaceRejectedDir(tempDir);
    const rejectedPath = join(rejectedDir, `${requestId}_rejected.md`);

    const rejectedContent = await Deno.readTextFile(rejectedPath);
    const rejectedFrontmatter = parseFrontmatter(rejectedContent);
    assertEquals(rejectedFrontmatter.status, PlanStatus.REJECTED);
    assertEquals(rejectedFrontmatter.request_id, requestId);
    assertStringIncludes(rejectedContent, rejectedRaw);

    const updatedRequest = await Deno.readTextFile(requestPath);
    const updatedRequestFrontmatter = parseFrontmatter(updatedRequest);
    assertEquals(updatedRequestFrontmatter.status, RequestStatus.FAILED);
    assertEquals(updatedRequestFrontmatter.error, "Invalid plan structure");
  } finally {
    await costTracker.flush();
    await cleanup();
  }
});

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

    const validationError = new PlanValidationError("Invalid JSON structure", {
      rawContent: "INVALID_JSON_CONTENT",
      validationErrors: ["Expected property 'steps'"],
    });

    Object.defineProperty(processor, "planWriter", {
      value: {
        writePlan: () => {
          throw validationError;
        },
      },
      writable: true,
    });

    const result = await processor.process(requestPath);
    assertEquals(result, null);

    const updatedRequest = await Deno.readTextFile(requestPath);
    const updatedRequestFrontmatter = parseFrontmatter(updatedRequest);
    assertEquals(updatedRequestFrontmatter.status, RequestStatus.FAILED);
    assertEquals(updatedRequestFrontmatter.error, "Invalid JSON structure");

    const requestId = basename(requestPath, ".md");
    const rejectedPath = join(getWorkspaceRejectedDir(tempDir), `${requestId}_rejected.md`);

    assertStringIncludes(await Deno.readTextFile(rejectedPath), "INVALID_JSON_CONTENT");
  } finally {
    await costTracker.flush();
    await cleanup();
  }
});

// ============================================================================
// Fallback and Raw Content Persistence Tests
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
---

Content here.
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

    const validationError = new PlanValidationError("Schema validation failed", {
      validationErrors: ["Missing required field: title"],
    });

    Object.defineProperty(processor, "planWriter", {
      value: {
        writePlan: () => {
          throw validationError;
        },
      },
      writable: true,
    });

    await processor.process(requestPath);

    const requestId = basename(requestPath, ".md");
    const rejectedPath = join(getWorkspaceRejectedDir(tempDir), `${requestId}_rejected.md`);

    const rejectedContent = await Deno.readTextFile(rejectedPath);
    assertStringIncludes(rejectedContent, "No raw content available");
  } finally {
    await costTracker.flush();
    await cleanup();
  }
});

Deno.test("Regression: End-to-end error handling workflow captures detailed raw content", async () => {
  const testDbResult = await initTestDbService();
  const { tempDir, db, config, cleanup } = testDbResult;
  const costTracker = new CostTracker(db, config);

  try {
    await Deno.mkdir(getWorkspaceRequestsDir(tempDir), { recursive: true });

    const traceId = crypto.randomUUID();
    const requestId = `request-${traceId.slice(0, 8)}`;
    const requestPath = join(getWorkspaceRequestsDir(tempDir), `${requestId}.md`);

    await Deno.writeTextFile(
      requestPath,
      `---
trace_id: "${traceId}"
status: pending
priority: normal
agent: technical-writer
---
Request info.
`,
    );

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

    const detailedError = new PlanValidationError(
      "Technical writer generated invalid plan JSON",
      {
        rawContent: `{"title": "Invalid Plan", "description": "Missing steps array"}`,
        fullRawResponse:
          `<thought>Thinking...</thought>{"title": "Invalid Plan", "description": "Missing steps array"}`,
        validationErrors: ["Missing required field: steps"],
      },
    );

    Object.defineProperty(processor, "planWriter", {
      value: {
        writePlan: () => {
          throw detailedError;
        },
      },
      writable: true,
    });

    await processor.process(requestPath);

    const rejectedPath = join(getWorkspaceRejectedDir(tempDir), `${requestId}_rejected.md`);
    const rejectedContent = await Deno.readTextFile(rejectedPath);

    assertStringIncludes(rejectedContent, `{"title": "Invalid Plan", "description": "Missing steps array"}`);

    // Verify CLI can display the error
    const handler = new RequestShowHandler({ config, db });
    const showResult = await handler.show(requestId);
    assertEquals(showResult.metadata.error, "Technical writer generated invalid plan JSON");
  } finally {
    await costTracker.flush();
    await cleanup();
  }
});

// ============================================================================
// Status Manager and CLI Tests
// ============================================================================

Deno.test("Regression: StatusManager stores error messages in YAML frontmatter", async () => {
  const testDbResult = await initTestDbService();
  const { tempDir, cleanup } = testDbResult;

  try {
    const statusManager = new StatusManager({
      error: async () => {},
      info: async () => {},
      debug: async () => {},
    } as Partial<EventLogger> as EventLogger);

    const requestPath = join(tempDir, "test-request.md");
    await Deno.writeTextFile(requestPath, "---\nstatus: pending\n---\nBody");

    await statusManager.updateStatus(requestPath, RequestStatus.FAILED, "Direct error message");

    const updatedFrontmatter = parseFrontmatter(await Deno.readTextFile(requestPath));
    assertEquals(updatedFrontmatter.status, RequestStatus.FAILED);
    assertEquals(updatedFrontmatter.error, "Direct error message");

    await statusManager.updateStatus(requestPath, RequestStatus.FAILED, 'Error with "quotes"');
    assertEquals(parseFrontmatter(await Deno.readTextFile(requestPath)).error, 'Error with "quotes"');
  } finally {
    await cleanup();
  }
});

Deno.test("Regression: CLI displays error information for failed requests", async () => {
  const testDbResult = await initTestDbService();
  const { db, config, cleanup } = testDbResult;

  try {
    const requestId = "test-req-cli";
    const requestsDir = getWorkspaceRequestsDir(config.system.root);
    await Deno.mkdir(requestsDir, { recursive: true });

    const requestPath = join(requestsDir, `${requestId}.md`);
    await Deno.writeTextFile(
      requestPath,
      `---
status: failed
error: "Validation failed"
---
`,
    );

    const handler = new RequestShowHandler({ config, db });
    const result = await handler.show(requestId);

    assertEquals(result.metadata.error, "Validation failed");
    assertEquals(result.metadata.status, "failed");
  } finally {
    await cleanup();
  }
});
