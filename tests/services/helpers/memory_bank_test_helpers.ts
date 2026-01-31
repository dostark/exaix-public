import type { Learning, Pattern } from "../../../src/schemas/memory_bank.ts";
import { ExecutionMemory, ProjectMemory } from "../../../src/schemas/memory_bank.ts";
import type { Decision } from "../../../src/schemas/memory_bank.ts";
import { MemoryBankService } from "../../../src/services/memory_bank.ts";
import { initTestDbService } from "../../helpers/db.ts";
import type { Config } from "../../../src/config/schema.ts";
import {
  ConfidenceLevel,
  ExecutionStatus,
  LearningCategory,
  MemoryReferenceType,
  MemoryScope,
  MemorySource,
  MemoryStatus,
} from "../../../src/enums.ts";

/**
 * Creates a test setup with MemoryBankService and a pre-created project memory
 */
export function createTestMemoryBankWithProject(
  projectOverrides: Partial<ProjectMemory> = {},
): Promise<{
  service: MemoryBankService;
  config: Config;
  cleanup: () => Promise<void>;
}> {
  return createTestMemoryBankBase(async (service) => {
    // Create project memory
    const projectMemory = createMinimalProjectMemory({
      portal: "my-app",
      overview: "Test project",
      ...projectOverrides,
    });
    await service.createProjectMemory(projectMemory);
  });
}

/**
 * Creates a test setup with MemoryBankService and initialized global memory
 */
export async function createTestMemoryBankWithGlobal(
  globalOverrides: Partial<Learning> = {},
): Promise<{
  service: MemoryBankService;
  config: Config;
  db: any;
  cleanup: () => Promise<void>;
}> {
  const result = await createTestMemoryBankBase(async (service) => {
    await service.initGlobalMemory();

    // Create a default global learning if overrides provided
    if (Object.keys(globalOverrides).length > 0) {
      const defaultLearning = createSampleLearning({
        id: "550e8400-e29b-41d4-a716-446655440000",
        created_at: "2026-01-04T12:00:00Z",
        source: MemorySource.USER,
        scope: MemoryScope.GLOBAL,
        title: "Test Pattern",
        description: "A test pattern for global memory",
        category: LearningCategory.PATTERN,
        tags: ["test"],
        confidence: ConfidenceLevel.HIGH,
        status: MemoryStatus.APPROVED,
        ...globalOverrides,
      });
      await service.addGlobalLearning(defaultLearning);
    }
  }, true);

  return result as {
    service: MemoryBankService;
    config: Config;
    db: any;
    cleanup: () => Promise<void>;
  };
}

/**
 * Base function for creating test MemoryBankService instances
 */
async function createTestMemoryBankBase(
  setupFn: (service: MemoryBankService) => Promise<void>,
  includeDb: boolean = false,
): Promise<{
  service: MemoryBankService;
  config: Config;
  db?: any;
  cleanup: () => Promise<void>;
}> {
  const { db, config, cleanup: dbCleanup } = await initTestDbService();

  const service = new MemoryBankService(config, db);
  await setupFn(service);

  const cleanup = async () => {
    await dbCleanup();
  };

  const result: any = { service, config, cleanup };
  if (includeDb) {
    result.db = db;
  }
  return result;
}

/**
 * Creates a minimal valid ProjectMemory for testing
 */
export function createMinimalProjectMemory(overrides: Partial<ProjectMemory> = {}): ProjectMemory {
  return {
    portal: overrides.portal ?? "test-portal",
    overview: overrides.overview ?? "Test project overview",
    patterns: overrides.patterns ?? [],
    decisions: overrides.decisions ?? [],
    references: overrides.references ?? [],
    ...overrides,
  };
}

/**
 * Creates a ProjectMemory with sample data for testing
 */
export function createSampleProjectMemory(overrides: Partial<ProjectMemory> = {}): ProjectMemory {
  return {
    portal: overrides.portal ?? "test-portal",
    overview: overrides.overview ?? "A comprehensive test project with various memory components",
    patterns: overrides.patterns ?? [
      createSamplePattern(),
    ],
    decisions: overrides.decisions ?? [
      createSampleDecision(),
    ],
    references: overrides.references ?? [
      {
        type: MemoryReferenceType.FILE,
        path: "src/main.ts",
        description: "Main application entry point",
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a minimal valid ExecutionMemory for testing
 */
export function createMinimalExecutionMemory(overrides: Partial<ExecutionMemory> = {}): ExecutionMemory {
  return {
    trace_id: overrides.trace_id ?? "test-trace-123",
    request_id: overrides.request_id ?? "req-123",
    started_at: overrides.started_at ?? "2026-01-04T10:00:00Z",
    completed_at: overrides.completed_at ?? "2026-01-04T10:30:00Z",
    status: overrides.status ?? ExecutionStatus.COMPLETED,
    portal: overrides.portal ?? "test-portal",
    agent: overrides.agent ?? "test-agent",
    summary: overrides.summary ?? "Test execution summary",
    context_files: overrides.context_files ?? [],
    context_portals: overrides.context_portals ?? [],
    changes: overrides.changes ?? {
      files_created: [],
      files_modified: [],
      files_deleted: [],
    },
    ...overrides,
  };
}

/**
 * Creates a sample Learning for testing
 */
export function createSampleLearning(overrides: Partial<Learning> = {}): Learning {
  return {
    id: overrides.id ?? "learning-123",
    created_at: overrides.created_at ?? "2026-01-04T12:00:00Z",
    source: overrides.source ?? MemorySource.EXECUTION,
    source_id: overrides.source_id ?? "trace-123",
    scope: overrides.scope ?? MemoryScope.PROJECT,
    project: overrides.project ?? "test-portal",
    title: overrides.title ?? "Sample Learning",
    description: overrides.description ?? "A sample learning entry",

    category: overrides.category ?? LearningCategory.PATTERN,
    tags: overrides.tags ?? ["sample"],
    confidence: overrides.confidence ?? ConfidenceLevel.MEDIUM,
    references: overrides.references ?? [],
    status: overrides.status ?? MemoryStatus.APPROVED,
    ...overrides,
  };
}

/**
 * Creates a sample Pattern for testing
 */
export function createSamplePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    name: overrides.name ?? "Sample Pattern",
    description: overrides.description ?? "A sample pattern",
    examples: overrides.examples ?? [],
    tags: overrides.tags ?? ["sample"],
    ...overrides,
  };
}

/**
 * Creates a sample Decision for testing
 */
export function createSampleDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    date: overrides.date ?? "2026-01-04",
    decision: overrides.decision ?? "Sample Decision",
    rationale: overrides.rationale ?? "Sample rationale",
    alternatives: overrides.alternatives ?? ["Option A", "Option B"],
    tags: overrides.tags ?? ["sample"],
    ...overrides,
  };
}
