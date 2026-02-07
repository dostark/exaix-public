import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { join } from "@std/path";

import { MemoryExtractorService } from "../../src/services/memory_extractor.ts";
import {
  ConfidenceLevel,
  LearningCategory,
  MemoryOperation,
  MemoryReferenceType,
  MemoryScope,
  MemorySource,
} from "../../src/enums.ts";
import { MemoryStatus } from "../../src/memory/memory_status.ts";
import type { Learning, MemoryUpdateProposal, ProposalLearning } from "../../src/schemas/memory_bank.ts";
import { createMockConfig } from "../helpers/config.ts";

function makeProposalLearning(overrides: Partial<ProposalLearning> = {}): ProposalLearning {
  return {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    source: MemorySource.AGENT,
    source_id: undefined,

    scope: MemoryScope.GLOBAL,
    project: undefined,
    title: "t",
    description: "d",
    category: LearningCategory.INSIGHT,
    tags: ["tag"],
    confidence: ConfidenceLevel.HIGH,
    references: [],
    ...overrides,
  };
}

Deno.test("MemoryExtractorService.listPending: returns [] when pending dir missing", async () => {
  const root = await Deno.makeTempDir({ prefix: "mem-extractor-" });
  try {
    const config = createMockConfig(root);
    const db = { logActivity: () => {} };
    const memoryBank = {};

    const svc = new MemoryExtractorService(config, db as any, memoryBank as any);

    const pending = await svc.listPending();
    assertEquals(pending, []);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("MemoryExtractorService.listPending: skips invalid JSON and non-pending proposals", async () => {
  const root = await Deno.makeTempDir({ prefix: "mem-extractor-" });
  try {
    const config = createMockConfig(root);
    const db = { logActivity: () => {} };
    const memoryBank = {};

    const svc = new MemoryExtractorService(config, db as any, memoryBank as any);
    const pendingDir = join(config.system.root, config.paths.memory, "Pending");
    await Deno.mkdir(pendingDir, { recursive: true });

    // invalid json
    await Deno.writeTextFile(join(pendingDir, "bad.json"), "{not json");

    // valid schema, but status not pending
    const nonPending: MemoryUpdateProposal = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      operation: MemoryOperation.ADD,
      target_scope: MemoryScope.GLOBAL,
      target_project: undefined,
      learning: makeProposalLearning(),
      reason: "r",
      agent: "a",
      execution_id: "e",
      status: MemoryStatus.APPROVED,
    };
    await Deno.writeTextFile(join(pendingDir, "nonpending.json"), JSON.stringify(nonPending));

    const list = await svc.listPending();
    assertEquals(list.length, 0);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("MemoryExtractorService.getPending: returns null for missing or invalid proposal file", async () => {
  const root = await Deno.makeTempDir({ prefix: "mem-extractor-" });
  try {
    const config = createMockConfig(root);
    const db = { logActivity: () => {} };
    const memoryBank = {};

    const svc = new MemoryExtractorService(config, db as any, memoryBank as any);

    const missing = await svc.getPending("does-not-exist");
    assertEquals(missing, null);

    const pendingDir = join(config.system.root, config.paths.memory, "Pending");
    await Deno.mkdir(pendingDir, { recursive: true });

    await Deno.writeTextFile(join(pendingDir, "bad-id.json"), "{not json");
    const invalid = await svc.getPending("bad-id");
    assertEquals(invalid, null);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("MemoryExtractorService.approvePending: global proposal merges learning and removes file", async () => {
  const root = await Deno.makeTempDir({ prefix: "mem-extractor-" });
  try {
    const config = createMockConfig(root);
    const calls: unknown[] = [];

    const db = { logActivity: (...args: unknown[]) => calls.push(args) };
    const memoryBank = {
      addGlobalLearning: (learning: Learning) => {
        calls.push({ kind: "addGlobalLearning", learning });
        return Promise.resolve();
      },
    };

    const svc = new MemoryExtractorService(config, db as any, memoryBank as any);

    const pendingDir = join(config.system.root, config.paths.memory, "Pending");
    await Deno.mkdir(pendingDir, { recursive: true });

    const proposalId = crypto.randomUUID();
    const proposal: MemoryUpdateProposal = {
      id: proposalId,
      created_at: new Date().toISOString(),
      operation: MemoryOperation.ADD,
      target_scope: MemoryScope.GLOBAL,
      target_project: undefined,
      learning: makeProposalLearning({ scope: MemoryScope.GLOBAL }),
      reason: "r",
      agent: "a",
      execution_id: "e",
      status: MemoryStatus.PENDING,
    };

    const proposalPath = join(pendingDir, `${proposalId}.json`);
    await Deno.writeTextFile(proposalPath, JSON.stringify(proposal));

    await svc.approvePending(proposalId);

    // file removed
    await assertRejects(() => Deno.stat(proposalPath));

    const globalCall = calls.find((c) => (c as any)?.kind === "addGlobalLearning") as any;
    assertExists(globalCall);
    assertEquals(globalCall.learning.status, MemoryStatus.APPROVED);
    assertExists(globalCall.learning.approved_at);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("MemoryExtractorService.approvePending: project proposal adds pattern (file refs only)", async () => {
  const root = await Deno.makeTempDir({ prefix: "mem-extractor-" });
  try {
    const config = createMockConfig(root);
    const calls: unknown[] = [];

    const db = { logActivity: (...args: unknown[]) => calls.push(args) };
    const memoryBank = {
      addPattern: (project: string, pattern: unknown) => {
        calls.push({ kind: "addPattern", project, pattern });
        return Promise.resolve();
      },
    };

    const svc = new MemoryExtractorService(config, db as any, memoryBank as any);

    const pendingDir = join(config.system.root, config.paths.memory, "Pending");
    await Deno.mkdir(pendingDir, { recursive: true });

    const proposalId = crypto.randomUUID();
    const proposal: MemoryUpdateProposal = {
      id: proposalId,
      created_at: new Date().toISOString(),
      operation: MemoryOperation.ADD,
      target_scope: MemoryScope.PROJECT,
      target_project: "portalA",
      learning: makeProposalLearning({
        scope: MemoryScope.PROJECT,
        project: "portalA",
        references: [
          { type: MemoryReferenceType.FILE, path: "src/a.ts" },
          { type: MemoryReferenceType.URL, path: "https://example.com" },
        ],
      }),
      reason: "r",
      agent: "a",
      execution_id: "e",
      status: MemoryStatus.PENDING,
    };

    const proposalPath = join(pendingDir, `${proposalId}.json`);
    await Deno.writeTextFile(proposalPath, JSON.stringify(proposal));

    await svc.approvePending(proposalId);

    const addPatternCall = calls.find((c) => (c as any)?.kind === "addPattern") as any;
    assertExists(addPatternCall);
    assertEquals(addPatternCall.project, "portalA");
    assertEquals(Array.isArray(addPatternCall.pattern.examples), true);
    assertEquals(addPatternCall.pattern.examples, ["src/a.ts"]);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("MemoryExtractorService.rejectPending: removes proposal file", async () => {
  const root = await Deno.makeTempDir({ prefix: "mem-extractor-" });
  try {
    const config = createMockConfig(root);
    const db = { logActivity: () => {} };
    const memoryBank = {};

    const svc = new MemoryExtractorService(config, db as any, memoryBank as any);

    const pendingDir = join(config.system.root, config.paths.memory, "Pending");
    await Deno.mkdir(pendingDir, { recursive: true });

    const proposalId = crypto.randomUUID();
    const proposal: MemoryUpdateProposal = {
      id: proposalId,
      created_at: new Date().toISOString(),
      operation: MemoryOperation.ADD,
      target_scope: MemoryScope.GLOBAL,
      target_project: undefined,
      learning: makeProposalLearning(),
      reason: "r",
      agent: "a",
      execution_id: "e",
      status: MemoryStatus.PENDING,
    };

    const proposalPath = join(pendingDir, `${proposalId}.json`);
    await Deno.writeTextFile(proposalPath, JSON.stringify(proposal));

    await svc.rejectPending(proposalId, "no");
    await assertRejects(() => Deno.stat(proposalPath));
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("MemoryExtractorService.approveAll: counts only successful approvals", async () => {
  const root = await Deno.makeTempDir({ prefix: "mem-extractor-" });
  try {
    const config = createMockConfig(root);
    const db = { logActivity: () => {} };
    const memoryBank = {};

    const svc = new MemoryExtractorService(config, db as any, memoryBank as any);

    (svc as any).listPending = () =>
      Promise.resolve([
        { id: "ok" },
        { id: "bad" },
      ]);

    (svc as any).approvePending = (id: string) => {
      if (id === "bad") throw new Error("boom");
      return Promise.resolve();
    };

    const approved = await svc.approveAll();
    assertEquals(approved, 1);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
