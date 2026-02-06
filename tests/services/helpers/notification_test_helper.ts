import { initTestDbService } from "../../helpers/db.ts";
import { NotificationService } from "../../../src/services/notification.ts";
import type { MemoryUpdateProposal } from "../../../src/schemas/memory_bank.ts";
import { ConfidenceLevel, LearningCategory, MemoryOperation, MemoryScope, MemorySource } from "../../../src/enums.ts";
import { MemoryStatus } from "../../../src/memory/memory_status.ts";

/**
 * Creates test environment for notification tests
 */
export async function initNotificationTest() {
  const { db, config, cleanup: dbCleanup } = await initTestDbService();
  const notification = new NotificationService(config, db);

  const cleanup = async () => {
    await dbCleanup();
  };

  return {
    config,
    db,
    notification,
    cleanup,
  };
}

/**
 * Creates a test proposal
 */
// ...
export function createTestProposal(idOrOverrides?: string | Partial<MemoryUpdateProposal>): MemoryUpdateProposal {
  const overrides = typeof idOrOverrides === "string" ? { id: idOrOverrides } : idOrOverrides || {};

  return {
    id: overrides.id || crypto.randomUUID(),
    // ...
    created_at: "2026-01-04T12:00:00Z",
    operation: MemoryOperation.ADD,
    target_scope: MemoryScope.PROJECT,
    target_project: "my-app",
    learning: {
      id: crypto.randomUUID(),
      created_at: "2026-01-04T12:00:00Z",
      source: MemorySource.EXECUTION,
      scope: MemoryScope.PROJECT,
      project: "my-app",
      title: "Test Pattern",
      description: "A test pattern for notifications",
      category: LearningCategory.PATTERN,
      tags: ["test"],
      confidence: ConfidenceLevel.MEDIUM,
      ...overrides.learning,
    },
    reason: "Extracted from execution",
    agent: "senior-coder",
    execution_id: "trace-123",
    status: MemoryStatus.PENDING,
    ...overrides,
  };
}

/**
 * Helper wrapper for notification tests
 */
export async function runNotificationTest(
  fn: (ctx: { notification: NotificationService; db: any; config: any }) => Promise<void>,
) {
  const { db, config, notification, cleanup } = await initNotificationTest();
  try {
    await fn({ notification, db, config });
  } finally {
    await cleanup();
  }
}
