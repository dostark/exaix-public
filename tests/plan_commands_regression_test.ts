/**
 * Plan Commands Regression Tests
 *
 * Regression tests for plan list command fixes.
 *
 * Regression test for: "Approved plans not shown in plan list --status approved"
 * Root cause: plan list only scanned Workspace/Plans, but approved plans are in Workspace/Active
 * Fix: Updated list() to scan Active directory for approved, Rejected for rejected
 */

import { assertEquals } from "@std/assert";
import { ensureDir } from "@std/fs";
import { join } from "@std/path";

// Helper to create a minimal plan file
async function createPlanFile(
  dir: string,
  filename: string,
  status: string,
  traceId: string,
): Promise<string> {
  const path = join(dir, filename);
  const content = `---
trace_id: "${traceId}"
status: ${status}
agent_id: test-agent
created_at: "2026-01-17T00:00:00.000Z"
---

# Test Plan

This is a test plan for regression testing.
`;
  await Deno.writeTextFile(path, content);
  return path;
}

// Helper to create test workspace structure
async function createTestWorkspace(baseDir: string): Promise<{
  plansDir: string;
  activeDir: string;
  rejectedDir: string;
}> {
  const plansDir = join(baseDir, "Workspace", "Plans");
  const activeDir = join(baseDir, "Workspace", "Active");
  const rejectedDir = join(baseDir, "Workspace", "Rejected");

  await ensureDir(plansDir);
  await ensureDir(activeDir);
  await ensureDir(rejectedDir);

  return { plansDir, activeDir, rejectedDir };
}

// ============================================================================
// Regression Tests for Plan List Directory Scanning
// ============================================================================

Deno.test("[regression] Plan list finds approved plans in Active directory", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "exo_plan_regression_" });

  try {
    const { activeDir } = await createTestWorkspace(tempDir);

    // Create an approved plan in Active directory
    const traceId = crypto.randomUUID();
    await createPlanFile(activeDir, "test_plan.md", "approved", traceId);

    // Import PlanCommands
    const { PlanCommands } = await import("../src/cli/plan_commands.ts");

    // Create minimal config pointing to our test workspace
    const config = {
      system: { root: tempDir },
      paths: {
        workspace: "Workspace",
        plans: "Plans",
        active: "Active",
        rejected: "Rejected",
        archive: "Archive",
      },
    } as any;

    // Create stub db
    const stubDb = {
      logActivity: () => {},
      waitForFlush: async () => {},
    };

    const planCommands = new PlanCommands({ config, db: stubDb as any });

    // List with status=approved - should find the plan in Active directory
    const approvedPlans = await planCommands.list("approved");

    // Before the fix, this would return 0 plans (only scanned Plans directory)
    // After the fix, this should return 1 plan (scans Active directory for approved)
    assertEquals(approvedPlans.length, 1, "Should find 1 approved plan in Active directory");
    assertEquals(approvedPlans[0].status, "approved");
    assertEquals(approvedPlans[0].trace_id, traceId);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("[regression] Plan list finds rejected plans in Rejected directory", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "exo_plan_regression_" });

  try {
    const { rejectedDir } = await createTestWorkspace(tempDir);

    // Create a rejected plan in Rejected directory
    const traceId = crypto.randomUUID();
    await createPlanFile(rejectedDir, "test_plan_rejected.md", "rejected", traceId);

    // Import PlanCommands
    const { PlanCommands } = await import("../src/cli/plan_commands.ts");

    // Create minimal config
    const config = {
      system: { root: tempDir },
      paths: {
        workspace: "Workspace",
        plans: "Plans",
        active: "Active",
        rejected: "Rejected",
        archive: "Archive",
      },
    } as any;

    const stubDb = {
      logActivity: () => {},
      waitForFlush: async () => {},
    };

    const planCommands = new PlanCommands({ config, db: stubDb as any });

    // List with status=rejected - should find the plan in Rejected directory
    const rejectedPlans = await planCommands.list("rejected");

    assertEquals(rejectedPlans.length, 1, "Should find 1 rejected plan in Rejected directory");
    assertEquals(rejectedPlans[0].status, "rejected");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("[regression] Plan list finds review plans in Plans directory", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "exo_plan_regression_" });

  try {
    const { plansDir } = await createTestWorkspace(tempDir);

    // Create a review plan in Plans directory
    const traceId = crypto.randomUUID();
    await createPlanFile(plansDir, "test_plan.md", "review", traceId);

    // Import PlanCommands
    const { PlanCommands } = await import("../src/cli/plan_commands.ts");

    const config = {
      system: { root: tempDir },
      paths: {
        workspace: "Workspace",
        plans: "Plans",
        active: "Active",
        rejected: "Rejected",
        archive: "Archive",
      },
    } as any;

    const stubDb = {
      logActivity: () => {},
      waitForFlush: async () => {},
    };

    const planCommands = new PlanCommands({ config, db: stubDb as any });

    // List with status=review - should find the plan in Plans directory
    const reviewPlans = await planCommands.list("review");

    assertEquals(reviewPlans.length, 1, "Should find 1 review plan in Plans directory");
    assertEquals(reviewPlans[0].status, "review");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("[regression] Plan list without filter scans all directories", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "exo_plan_regression_" });

  try {
    const { plansDir, activeDir, rejectedDir } = await createTestWorkspace(tempDir);

    // Create plans in all directories
    await createPlanFile(plansDir, "review_plan.md", "review", crypto.randomUUID());
    await createPlanFile(activeDir, "approved_plan.md", "approved", crypto.randomUUID());
    await createPlanFile(rejectedDir, "rejected_plan.md", "rejected", crypto.randomUUID());

    // Import PlanCommands
    const { PlanCommands } = await import("../src/cli/plan_commands.ts");

    const config = {
      system: { root: tempDir },
      paths: {
        workspace: "Workspace",
        plans: "Plans",
        active: "Active",
        rejected: "Rejected",
        archive: "Archive",
      },
    } as any;

    const stubDb = {
      logActivity: () => {},
      waitForFlush: async () => {},
    };

    const planCommands = new PlanCommands({ config, db: stubDb as any });

    // List without filter - should find all 3 plans from all directories
    const allPlans = await planCommands.list();

    assertEquals(allPlans.length, 3, "Should find 3 plans across all directories");

    const statuses = allPlans.map((p) => p.status).sort();
    assertEquals(statuses, ["approved", "rejected", "review"]);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("[regression] Plan list handles empty directories gracefully", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "exo_plan_regression_" });

  try {
    await createTestWorkspace(tempDir);

    // Don't create any plan files - directories are empty

    // Import PlanCommands
    const { PlanCommands } = await import("../src/cli/plan_commands.ts");

    const config = {
      system: { root: tempDir },
      paths: {
        workspace: "Workspace",
        plans: "Plans",
        active: "Active",
        rejected: "Rejected",
        archive: "Archive",
      },
    } as any;

    const stubDb = {
      logActivity: () => {},
      waitForFlush: async () => {},
    };

    const planCommands = new PlanCommands({ config, db: stubDb as any });

    // Should not throw, just return empty array
    const allPlans = await planCommands.list();
    assertEquals(allPlans.length, 0);

    const approvedPlans = await planCommands.list("approved");
    assertEquals(approvedPlans.length, 0);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
