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

async function withTempRoot(fn: (root: string) => Promise<void>): Promise<void> {
  const root = await Deno.makeTempDir({ prefix: "mem-extractor-" });
  try {
    await fn(root);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

function makeService(root: string, overrides: {
  db?: unknown;
  memoryBank?: unknown;
} = {}): {
  config: ReturnType<typeof createMockConfig>;
  svc: MemoryExtractorService;
} {
  const config = createMockConfig(root);
  const db = overrides.db ?? { logActivity: () => {} };
  const memoryBank = overrides.memoryBank ?? {};
  const svc = new MemoryExtractorService(config, db as any, memoryBank as any);
  return { config, svc };
}

async function ensurePendingDir(config: { system: { root: string }; paths: { memory: string } }): Promise<string> {
  const pendingDir = join(config.system.root, config.paths.memory, "Pending");
  await Deno.mkdir(pendingDir, { recursive: true });
  return pendingDir;
}

function makeProposal(overrides: Partial<MemoryUpdateProposal> = {}): MemoryUpdateProposal {
  const { id, created_at, learning, ...rest } = overrides;
  return {
    id: id ?? crypto.randomUUID(),
    created_at: created_at ?? new Date().toISOString(),
    operation: MemoryOperation.ADD,
    target_scope: MemoryScope.GLOBAL,
    target_project: undefined,
    learning: learning ?? makeProposalLearning(),
    reason: "r",
    agent: "a",
    execution_id: "e",
    status: MemoryStatus.PENDING,
    ...rest,
  };
}

async function writeProposal(pendingDir: string, proposal: MemoryUpdateProposal): Promise<string> {
  const proposalPath = join(pendingDir, `${proposal.id}.json`);
  await Deno.writeTextFile(proposalPath, JSON.stringify(proposal));
  return proposalPath;
}

Deno.test("MemoryExtractorService.listPending: returns [] when pending dir missing", async () => {
  await withTempRoot(async (root) => {
    const { svc } = makeService(root);
    const pending = await svc.listPending();
    assertEquals(pending, []);
  });
});

Deno.test("MemoryExtractorService.listPending: skips invalid JSON and non-pending proposals", async () => {
  await withTempRoot(async (root) => {
    const { config, svc } = makeService(root);
    const pendingDir = await ensurePendingDir(config);

    // invalid json
    await Deno.writeTextFile(join(pendingDir, "bad.json"), "{not json");

    // valid schema, but status not pending
    const nonPending = makeProposal({ status: MemoryStatus.APPROVED });
    await Deno.writeTextFile(join(pendingDir, "nonpending.json"), JSON.stringify(nonPending));

    const list = await svc.listPending();
    assertEquals(list.length, 0);
  });
});

Deno.test("MemoryExtractorService.getPending: returns null for missing or invalid proposal file", async () => {
  await withTempRoot(async (root) => {
    const { config, svc } = makeService(root);

    const missing = await svc.getPending("does-not-exist");
    assertEquals(missing, null);

    const pendingDir = await ensurePendingDir(config);

    await Deno.writeTextFile(join(pendingDir, "bad-id.json"), "{not json");
    const invalid = await svc.getPending("bad-id");
    assertEquals(invalid, null);
  });
});

Deno.test("MemoryExtractorService.approvePending: global proposal merges learning and removes file", async () => {
  await withTempRoot(async (root) => {
    const calls: unknown[] = [];

    const { config, svc } = makeService(root, {
      db: { logActivity: (...args: unknown[]) => calls.push(args) },
      memoryBank: {
        addGlobalLearning: (learning: Learning) => {
          calls.push({ kind: "addGlobalLearning", learning });
          return Promise.resolve();
        },
      },
    });

    const pendingDir = await ensurePendingDir(config);

    const proposal = makeProposal({
      learning: makeProposalLearning({ scope: MemoryScope.GLOBAL }),
      status: MemoryStatus.PENDING,
    });

    const proposalPath = await writeProposal(pendingDir, proposal);

    await svc.approvePending(proposal.id);

    // file removed
    await assertRejects(() => Deno.stat(proposalPath));

    const globalCall = calls.find((c) => (c as any)?.kind === "addGlobalLearning") as any;
    assertExists(globalCall);
    assertEquals(globalCall.learning.status, MemoryStatus.APPROVED);
    assertExists(globalCall.learning.approved_at);
  });
});

Deno.test("MemoryExtractorService.approvePending: project proposal adds pattern (file refs only)", async () => {
  await withTempRoot(async (root) => {
    const calls: unknown[] = [];

    const { config, svc } = makeService(root, {
      db: { logActivity: (...args: unknown[]) => calls.push(args) },
      memoryBank: {
        addPattern: (project: string, pattern: unknown) => {
          calls.push({ kind: "addPattern", project, pattern });
          return Promise.resolve();
        },
      },
    });

    const pendingDir = await ensurePendingDir(config);

    const proposal = makeProposal({
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
      status: MemoryStatus.PENDING,
    });

    await writeProposal(pendingDir, proposal);

    await svc.approvePending(proposal.id);

    const addPatternCall = calls.find((c) => (c as any)?.kind === "addPattern") as any;
    assertExists(addPatternCall);
    assertEquals(addPatternCall.project, "portalA");
    assertEquals(Array.isArray(addPatternCall.pattern.examples), true);
    assertEquals(addPatternCall.pattern.examples, ["src/a.ts"]);
  });
});

Deno.test("MemoryExtractorService.rejectPending: removes proposal file", async () => {
  await withTempRoot(async (root) => {
    const { config, svc } = makeService(root);
    const pendingDir = await ensurePendingDir(config);

    const proposal = makeProposal({ status: MemoryStatus.PENDING });
    const proposalPath = await writeProposal(pendingDir, proposal);

    await svc.rejectPending(proposal.id, "no");
    await assertRejects(() => Deno.stat(proposalPath));
  });
});

Deno.test("MemoryExtractorService.approveAll: counts only successful approvals", async () => {
  await withTempRoot(async (root) => {
    const { svc } = makeService(root);

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
  });
});
