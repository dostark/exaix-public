import {
  ConfidenceLevel,
  ExecutionStatus,
  LearningCategory,
  MemoryOperation,
  MemoryScope,
  MemorySource,
  ReviewSource,
} from "../../../src/enums.ts";
import { MemoryStatus } from "../../../src/memory/memory_status.ts";
import type { MemoryUpdateProposal } from "../../../src/schemas/memory_bank.ts";
import type { MemoryExtractorService } from "../../../src/services/memory_extractor.ts";
import type { ExecutionMemory } from "../../../src/schemas/memory_bank.ts";

export function createSuccessfulExecutionMemory(portal: string, traceId: string): ExecutionMemory {
  return {
    trace_id: traceId,
    request_id: `req-${traceId.substring(0, 8)}`,
    started_at: "2026-01-04T10:00:00Z",
    completed_at: "2026-01-04T10:30:00Z",
    status: ExecutionStatus.COMPLETED,
    portal,
    agent: "senior-coder",
    summary:
      "Implemented repository pattern for database access. Created UserRepository with CRUD operations. Added proper error handling with typed exceptions.",
    context_files: ["src/services/user.ts", "src/types/errors.ts"],
    context_portals: [portal],
    changes: {
      files_created: ["src/repos/user_repo.ts", "src/types/repo_errors.ts"],
      files_modified: ["src/services/user.ts"],
      files_deleted: [],
    },
    lessons_learned: [
      "Repository pattern improves testability",
      "Typed errors make debugging easier",
    ],
  };
}

export function createFailedExecutionMemory(portal: string, traceId: string): ExecutionMemory {
  return {
    trace_id: traceId,
    request_id: `req-${traceId.substring(0, 8)}`,
    started_at: "2026-01-04T11:00:00Z",
    completed_at: "2026-01-04T11:15:00Z",
    status: ExecutionStatus.FAILED,
    portal,
    agent: "senior-coder",
    summary: "Failed to implement feature due to missing dependency configuration.",
    context_files: ["src/config.ts"],
    context_portals: [portal],
    changes: {
      files_created: [],
      files_modified: [],
      files_deleted: [],
    },
    error_message: "Module not found: @db/sqlite. Ensure dependencies are installed.",
    lessons_learned: ["Always verify dependencies before implementation"],
  };
}

/**
 * Creates a test execution with learnable content and returns a proposal ID
 * This helper encapsulates the common pattern of creating an execution, analyzing it,
 * and creating a proposal for testing memory extractor operations.
 */
export async function createTestProposal(
  extractor: MemoryExtractorService,
  portal: string = "my-app",
  traceId?: string,
): Promise<string | null> {
  // Use a unique trace ID if not provided
  const executionTraceId = traceId ??
    `550e8400-e29b-41d4-a716-44665544${Math.random().toString().slice(2, 4).padStart(3, "0")}`;

  const execution = createSuccessfulExecutionMemory(portal, executionTraceId);

  const learnings = await extractor.analyzeExecution(execution);

  if (learnings.length === 0) {
    return null;
  }

  return await extractor.createProposal(learnings[0], execution, "senior-coder");
}

/**
 * Base learning object for testing
 */
function createBaseLearning(
  overrides: Partial<MemoryUpdateProposal["learning"]> = {},
): MemoryUpdateProposal["learning"] {
  return {
    id: overrides.id ?? "550e8400-e29b-41d4-a716-446655440001",
    created_at: overrides.created_at ?? "2026-01-04T12:00:00Z",
    source: overrides.source ?? MemorySource.EXECUTION,
    source_id: overrides.source_id ?? "trace-123",
    scope: overrides.scope ?? MemoryScope.PROJECT,
    project: overrides.project ?? "my-app",
    title: overrides.title ?? "Use repository pattern",
    description: overrides.description ?? "Database access should go through repositories",
    category: overrides.category ?? LearningCategory.PATTERN,
    tags: overrides.tags ?? ["architecture"],
    confidence: overrides.confidence ?? ConfidenceLevel.MEDIUM,
    references: overrides.references ?? [],
  };
}

/**
 * Creates a minimal valid MemoryUpdateProposal for testing
 */
export function createMinimalProposal(overrides: Partial<MemoryUpdateProposal> = {}): MemoryUpdateProposal {
  return createBaseProposal({
    learning: createBaseLearning(overrides.learning),
    reason: overrides.reason ?? "Extracted from successful execution",
    agent: overrides.agent ?? "senior-coder",
    ...overrides,
  });
}

/**
 * Creates a global scope proposal for testing
 */
export function createGlobalProposal(overrides: Partial<MemoryUpdateProposal> = {}): MemoryUpdateProposal {
  return {
    id: overrides.id ?? "550e8400-e29b-41d4-a716-446655440002",
    created_at: overrides.created_at ?? "2026-01-04T12:00:00Z",
    operation: overrides.operation ?? MemoryOperation.PROMOTE,
    target_scope: overrides.target_scope ?? MemoryScope.GLOBAL,
    learning: createBaseLearning({
      id: "550e8400-e29b-41d4-a716-446655440003",
      source: MemorySource.AGENT,
      scope: MemoryScope.GLOBAL,
      title: "Always validate input",
      description: "Input validation prevents security issues",
      category: LearningCategory.INSIGHT,
      tags: ["security"],
      confidence: ConfidenceLevel.HIGH,

      ...overrides.learning,
    }),
    reason: overrides.reason ?? "Pattern observed across multiple projects",

    agent: overrides.agent ?? "architect",

    status: overrides.status ?? MemoryStatus.PENDING,
    ...overrides,
  };
}

/**
 * Creates an approved proposal for testing
 */
export function createApprovedProposal(overrides: Partial<MemoryUpdateProposal> = {}): MemoryUpdateProposal {
  return {
    id: overrides.id ?? "550e8400-e29b-41d4-a716-446655440004",
    created_at: overrides.created_at ?? "2026-01-04T12:00:00Z",
    operation: overrides.operation ?? MemoryOperation.ADD,
    target_scope: overrides.target_scope ?? MemoryScope.PROJECT,
    target_project: overrides.target_project ?? "my-app",
    learning: createBaseLearning({
      id: "550e8400-e29b-41d4-a716-446655440005",
      source: MemorySource.USER,
      title: "Test Learning",
      description: "Test description",
      category: LearningCategory.PATTERN,
      tags: [],
      confidence: ConfidenceLevel.LOW,
      ...overrides.learning,
    }),
    reason: overrides.reason ?? "User requested",
    agent: overrides.agent ?? "user-cli",
    status: overrides.status ?? MemoryStatus.APPROVED,
    reviewed_at: overrides.reviewed_at ?? "2026-01-04T13:00:00Z",
    reviewed_by: overrides.reviewed_by ?? ReviewSource.USER,
    ...overrides,
  };
}

/**
 * Creates an invalid proposal for testing schema validation failures
 */
export function createInvalidProposal(overrides: Partial<MemoryUpdateProposal> = {}): Record<string, unknown> {
  return createBaseProposal({
    id: "550e8400-e29b-41d4-a716-446655440006",
    operation: "invalid-op" as Partial<MemoryOperation> as MemoryOperation,
    learning: createInvalidLearning(overrides.learning),
    reason: "Test",
    agent: "test",
    status: MemoryStatus.PENDING,
    ...overrides,
  });
}

/**
 * Creates an invalid proposal with invalid status for testing
 */
export function createInvalidStatusProposal(overrides: Partial<MemoryUpdateProposal> = {}): Record<string, unknown> {
  return createBaseProposal({
    id: "550e8400-e29b-41d4-a716-446655440008",
    operation: MemoryOperation.ADD,
    learning: createInvalidLearning(overrides.learning),
    reason: "Test",
    agent: "test",
    status: "invalid-status" as Partial<MemoryStatus> as MemoryStatus, // Invalid status
    ...overrides,
  });
}

/**
 * Creates a test learning object for invalid proposals
 */
function createInvalidLearning(
  overrides: Partial<MemoryUpdateProposal["learning"]> = {},
): MemoryUpdateProposal["learning"] {
  return {
    id: overrides.id ?? "550e8400-e29b-41d4-a716-446655440007",
    created_at: overrides.created_at ?? "2026-01-04T12:00:00Z",
    source: overrides.source ?? MemorySource.USER,
    scope: overrides.scope ?? MemoryScope.PROJECT,
    title: overrides.title ?? "Test",
    description: overrides.description ?? "Test",
    category: overrides.category ?? LearningCategory.PATTERN,
    tags: overrides.tags ?? [],
    confidence: overrides.confidence ?? ConfidenceLevel.LOW,
    ...overrides,
  };
}

/**
 * Base proposal creation function to reduce duplication
 */
function createBaseProposal(overrides: Partial<MemoryUpdateProposal> = {}): MemoryUpdateProposal {
  return {
    id: overrides.id ?? "550e8400-e29b-41d4-a716-446655440000",
    created_at: overrides.created_at ?? "2026-01-04T12:00:00Z",
    operation: overrides.operation ?? MemoryOperation.ADD,
    target_scope: overrides.target_scope ?? MemoryScope.PROJECT,
    target_project: overrides.target_project ?? "my-app",
    learning: overrides.learning ?? createBaseLearning(),
    reason: overrides.reason ?? "Test proposal",
    agent: overrides.agent ?? "test-agent",
    execution_id: overrides.execution_id ?? "trace-123",
    status: overrides.status ?? MemoryStatus.PENDING,
    ...overrides,
  };
}
