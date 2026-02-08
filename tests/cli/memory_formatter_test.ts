import { assertStringIncludes } from "@std/assert";
import { MemoryFormatter } from "../../src/cli/formatters/memory_formatter.ts";
import { ExecutionStatus, MemoryReferenceType, MemorySource } from "../../src/enums.ts";
import type {
  ExecutionMemory,
  GlobalMemory,
  GlobalMemoryStats,
  Learning,
  ProjectMemory,
} from "../../src/schemas/memory_bank.ts";
import {
  TEST_AGENT_NAME,
  TEST_COMPLETED_AT,
  TEST_CONTEXT_FILE,
  TEST_DECISION_DATE,
  TEST_DECISION_RATIONALE,
  TEST_DECISION_TEXT,
  TEST_ERROR_TEXT,
  TEST_GLOBAL_CATEGORY,
  TEST_GLOBAL_PROJECT,
  TEST_GLOBAL_UPDATED_AT,
  TEST_GLOBAL_VERSION,
  TEST_LESSON_TEXT,
  TEST_PATTERN_DESCRIPTION,
  TEST_PATTERN_EXAMPLE,
  TEST_PATTERN_NAME,
  TEST_PATTERN_TAG,
  TEST_PORTAL_NAME,
  TEST_PROJECT_OVERVIEW,
  TEST_REFERENCE_DESCRIPTION,
  TEST_REFERENCE_PATH,
  TEST_REQUEST_ID,
  TEST_STARTED_AT,
  TEST_SUMMARY_TEXT,
  TEST_TRACE_ID,
} from "../config/constants.ts";

const MSG_NO_EXECUTIONS = "No execution history";

function createProjectMemory(): ProjectMemory {
  return {
    portal: TEST_PORTAL_NAME,
    overview: TEST_PROJECT_OVERVIEW,
    patterns: [
      {
        name: TEST_PATTERN_NAME,
        description: TEST_PATTERN_DESCRIPTION,
        examples: [TEST_PATTERN_EXAMPLE],
        tags: [TEST_PATTERN_TAG],
      },
    ],
    decisions: [
      {
        date: TEST_DECISION_DATE,
        decision: TEST_DECISION_TEXT,
        rationale: TEST_DECISION_RATIONALE,
        alternatives: [],
      },
    ],
    references: [
      {
        type: MemoryReferenceType.FILE,
        path: TEST_REFERENCE_PATH,
        description: TEST_REFERENCE_DESCRIPTION,
      },
    ],
  };
}

function createExecutionMemory(): ExecutionMemory {
  return {
    trace_id: TEST_TRACE_ID,
    request_id: TEST_REQUEST_ID,
    started_at: TEST_STARTED_AT,
    completed_at: TEST_COMPLETED_AT,
    status: ExecutionStatus.COMPLETED,
    portal: TEST_PORTAL_NAME,
    agent: TEST_AGENT_NAME,
    summary: TEST_SUMMARY_TEXT,
    context_files: [TEST_CONTEXT_FILE],
    context_portals: [TEST_PORTAL_NAME],
    changes: {
      files_created: [TEST_CONTEXT_FILE],
      files_modified: [],
      files_deleted: [],
    },
    lessons_learned: [TEST_LESSON_TEXT],
    error_message: TEST_ERROR_TEXT,
  };
}

function createGlobalStats(): GlobalMemoryStats {
  return {
    total_learnings: 1,
    by_category: { [TEST_GLOBAL_CATEGORY]: 1 },
    by_project: { [TEST_GLOBAL_PROJECT]: 1 },
    last_activity: TEST_GLOBAL_UPDATED_AT,
  };
}

function createLearning(): Learning {
  return {
    id: TEST_TRACE_ID,
    created_at: TEST_GLOBAL_UPDATED_AT,
    source: MemorySource.USER,
    scope: "global" as any,
    project: undefined,
    title: TEST_PATTERN_NAME,
    description: TEST_PATTERN_DESCRIPTION,
    category: "pattern" as any,
    tags: [TEST_PATTERN_TAG],
    confidence: "high" as any,
    references: [],
    status: "approved" as any,
    approved_at: TEST_GLOBAL_UPDATED_AT,
    archived_at: undefined,
  };
}

function createGlobalMemory(): GlobalMemory {
  return {
    version: TEST_GLOBAL_VERSION,
    updated_at: TEST_GLOBAL_UPDATED_AT,
    learnings: [createLearning()],
    patterns: [],
    anti_patterns: [],
    statistics: createGlobalStats(),
  };
}

Deno.test("MemoryFormatter: formatProjectShowTable includes patterns, decisions, references", () => {
  const formatter = new MemoryFormatter();
  const result = formatter.formatProjectShowTable(createProjectMemory());

  assertStringIncludes(result, TEST_PATTERN_NAME);
  assertStringIncludes(result, TEST_DECISION_DATE);
  assertStringIncludes(result, TEST_REFERENCE_PATH);
});

Deno.test("MemoryFormatter: formatExecutionShowTable includes context, lessons, error", () => {
  const formatter = new MemoryFormatter();
  const result = formatter.formatExecutionShowTable(createExecutionMemory());

  assertStringIncludes(result, TEST_CONTEXT_FILE);
  assertStringIncludes(result, TEST_LESSON_TEXT);
  assertStringIncludes(result, TEST_ERROR_TEXT);
});

Deno.test("MemoryFormatter: formatExecutionListTable handles empty list", () => {
  const formatter = new MemoryFormatter();
  const result = formatter.formatExecutionListTable([]);

  assertStringIncludes(result, MSG_NO_EXECUTIONS);
});

Deno.test("MemoryFormatter: formatGlobalShowTable includes learning summary", () => {
  const formatter = new MemoryFormatter();
  const result = formatter.formatGlobalShowTable(createGlobalMemory());

  assertStringIncludes(result, TEST_GLOBAL_VERSION);
  assertStringIncludes(result, TEST_PATTERN_NAME);
});

Deno.test("MemoryFormatter: formatGlobalStatsTable includes category and project", () => {
  const formatter = new MemoryFormatter();
  const result = formatter.formatGlobalStatsTable(createGlobalStats());

  assertStringIncludes(result, TEST_GLOBAL_CATEGORY);
  assertStringIncludes(result, TEST_GLOBAL_PROJECT);
});
