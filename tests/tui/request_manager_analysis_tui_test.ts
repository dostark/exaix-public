/**
 * @module RequestManagerAnalysisTuiTest
 * @path tests/tui/request_manager_analysis_tui_test.ts
 * @description TDD test for Phase 45 Step 13: TUI Analysis Display.
 */

import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.220.0/assert/mod.ts";
import { MinimalRequestServiceMock, RequestManagerTuiSession } from "../../src/tui/request_manager_view.ts";
import { RequestFormatter } from "../../src/tui/request_manager/formatters.ts";
import {
  AmbiguityImpact,
  AnalyzerMode,
  IRequestAnalysis,
  RequestAnalysisComplexity,
  RequestTaskType,
} from "../../src/shared/schemas/request_analysis.ts";
import { RequestPriority } from "../../src/shared/enums.ts";
import { RequestStatus } from "../../src/shared/status/request_status.ts";

Deno.test("RequestManagerTuiSession - Detail View includes Analysis section", async () => {
  const analysis: IRequestAnalysis = {
    complexity: RequestAnalysisComplexity.MEDIUM,
    actionabilityScore: 85,
    taskType: RequestTaskType.FEATURE,
    goals: [
      { description: "Implement TUI check", explicit: true, priority: 1 },
    ],
    requirements: [{ description: "Req 1", confidence: 0.9 }],
    ambiguities: [{ description: "Ambiguity 1", impact: AmbiguityImpact.LOW }],
    referencedFiles: ["src/main.ts"],
    tags: ["tui"],
    constraints: [],
    acceptanceCriteria: [],
    metadata: {
      analyzedAt: new Date().toISOString(),
      durationMs: 100,
      mode: AnalyzerMode.HEURISTIC,
    },
  };

  const mockRequest = {
    trace_id: "test-req-1",
    filename: "test-req-1.md",
    subject: "Test Request",
    status: RequestStatus.PENDING,
    priority: RequestPriority.NORMAL,
    agent: "default",
    created: new Date().toISOString(),
    source: "tui" as const,
    created_by: "test-user",
  };

  const mockService = new MinimalRequestServiceMock([mockRequest]);
  // Mock getAnalysis to return our data
  mockService.getAnalysis = (id: string): Promise<IRequestAnalysis | null> => {
    if (id === "test-req-1") return Promise.resolve(analysis);
    return Promise.resolve(null);
  };
  mockService.getRequestContent = () => Promise.resolve("Request Body Content");

  const session = new RequestManagerTuiSession([mockRequest], mockService, false);

  // Trigger detail view
  await session.showRequestDetail("test-req-1");

  const detail = session.renderDetail();

  // Verify analysis section presence
  assertStringIncludes(detail, "REQUEST ANALYSIS");
  assertStringIncludes(detail, "Complexity:   medium");
  assertStringIncludes(detail, "Actionability: █████████░ 85/100");
  assertStringIncludes(detail, "Goals:        1 total");
  assertStringIncludes(detail, "Implement TUI check");
  assertStringIncludes(detail, "Top Ambiguity: Ambiguity 1");
  assertStringIncludes(detail, "Files:        src/main.ts");
});

Deno.test("RequestFormatter.formatAnalysisSection - formats analysis correctly", () => {
  const analysis: IRequestAnalysis = {
    complexity: RequestAnalysisComplexity.COMPLEX,
    actionabilityScore: 40,
    taskType: RequestTaskType.REFACTOR,
    goals: [
      { description: "Goal 1", explicit: true, priority: 1 },
      { description: "Goal 2", explicit: false, priority: 2 },
    ],
    requirements: [],
    ambiguities: [],
    referencedFiles: [],
    tags: [],
    constraints: [],
    acceptanceCriteria: [],
    metadata: {
      analyzedAt: new Date().toISOString(),
      durationMs: 50,
      mode: AnalyzerMode.HEURISTIC,
    },
  };

  const lines = RequestFormatter.formatAnalysisSection(analysis);
  const output = lines.join("\n");

  assertStringIncludes(output, "REQUEST ANALYSIS");
  assertStringIncludes(output, "Complexity:   complex");
  assertStringIncludes(output, "Actionability: ████░░░░░░ 40/100");
  assertStringIncludes(output, "Goals:        2 total");
  assertStringIncludes(output, "[E] Goal 1");
  assertStringIncludes(output, "[I] Goal 2");
});

Deno.test("RequestFormatter.formatAnalysisSection - handles empty analysis", () => {
  const lines = RequestFormatter.formatAnalysisSection(null);
  assertEquals(lines.length, 0);
});
