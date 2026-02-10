import { assertEquals, assertStringIncludes } from "@std/assert";
import { basename, join } from "@std/path";

import { RequestProcessor } from "../src/services/request_processor.ts";
import { CostTracker } from "../src/services/cost_tracker.ts";
import { initTestDbService } from "./helpers/db.ts";
import { getWorkspaceRequestsDir } from "./helpers/paths_helper.ts";
import { PlanStatus } from "../src/plans/plan_status.ts";
import { RequestStatus } from "../src/requests/request_status.ts";

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

    (processor as any).planWriter = {
      writePlan: () => {
        throw { name: "PlanValidationError", details: { rawContent: rejectedRaw } };
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
  } finally {
    await costTracker.flush();
    await cleanup();
  }
});
