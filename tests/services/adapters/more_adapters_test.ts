/**
 * @module MoreAdaptersTest
 * @path tests/services/adapters/more_adapters_test.ts
 * @description Unit tests for ConfigAdapter, MemoryBankAdapter, and MemoryExtractorAdapter.
 */

import { assertEquals } from "@std/assert";
import { ConfigAdapter } from "../../../src/services/adapters/config_adapter.ts";
import { MemoryBankAdapter } from "../../../src/services/adapters/memory_bank_adapter.ts";
import { MemoryExtractorAdapter } from "../../../src/services/adapters/memory_extractor_adapter.ts";
import { ConfigService } from "../../../src/config/service.ts";
import { MemoryBankService } from "../../../src/services/memory_bank.ts";
import { MemoryExtractorService } from "../../../src/services/memory_extractor.ts";
import { MemoryType, PortalExecutionStrategy } from "../../../src/shared/enums.ts";

// ──────────────────────────────────────────────────────────────────────
// ConfigAdapter
// ──────────────────────────────────────────────────────────────────────

function createMockConfigService(overrides: Partial<ConfigService> = {}): ConfigService {
  return ({
    get: () => ({ system: { root: "/root" }, paths: { workspace: "W", requests: "R" } }),
    getConfigPath: () => "/path/to/config.json",
    reload: () => ({}),
    addPortal: () => Promise.resolve(),
    removePortal: () => Promise.resolve(),
    getPortals: () => [],
    getPortal: () => undefined,
    ...overrides,
  } as unknown) as ConfigService;
}

Deno.test("ConfigAdapter: delegates all methods", async () => {
  let addCalled = false;
  let removeCalled = false;
  let reloadCalled = false;

  const service = createMockConfigService({
    addPortal: (alias, path, options) => {
      assertEquals(alias, "p");
      assertEquals(path, "/t");
      assertEquals(options?.executionStrategy, PortalExecutionStrategy.WORKTREE);
      addCalled = true;
      return Promise.resolve();
    },
    removePortal: (alias) => {
      assertEquals(alias, "p");
      removeCalled = true;
      return Promise.resolve();
    },
    reload: () => {
      reloadCalled = true;
      return {} as any;
    },
  });

  const adapter = new ConfigAdapter(service);

  adapter.get();
  adapter.getAll();
  assertEquals(adapter.getConfigPath(), "/path/to/config.json");
  await adapter.addPortal("p", "/t", { executionStrategy: PortalExecutionStrategy.WORKTREE });
  await adapter.removePortal("p");
  adapter.reload();
  adapter.getPortals();
  adapter.getPortal("p");

  assertEquals(addCalled, true);
  assertEquals(removeCalled, true);
  assertEquals(reloadCalled, true);
});

// ──────────────────────────────────────────────────────────────────────
// MemoryBankAdapter
// ──────────────────────────────────────────────────────────────────────

function createMockMemoryBankService(overrides: Partial<MemoryBankService> = {}): MemoryBankService {
  return ({
    getProjectMemory: () => Promise.resolve(null),
    createProjectMemory: () => Promise.resolve(),
    updateProjectMemory: () => Promise.resolve(),
    addPattern: () => Promise.resolve(),
    addDecision: () => Promise.resolve(),
    createExecutionRecord: () => Promise.resolve(),
    getExecutionByTraceId: () => Promise.resolve(null),
    getExecutionHistory: () => Promise.resolve([]),
    getGlobalMemory: () => Promise.resolve(null),
    initGlobalMemory: () => Promise.resolve(),
    addGlobalLearning: () => Promise.resolve(),
    promoteLearning: () => Promise.resolve("new-id"),
    demoteLearning: () => Promise.resolve(),
    searchMemory: () => Promise.resolve([]),
    searchByTags: () => Promise.resolve([]),
    searchByKeyword: () => Promise.resolve([]),
    searchMemoryAdvanced: () => Promise.resolve([]),
    getRecentActivity: () => Promise.resolve([]),
    rebuildIndices: () => Promise.resolve(),
    rebuildIndicesWithEmbeddings: () => Promise.resolve(),
    getProjects: () => Promise.resolve(["alpha"]),
    ...overrides,
  } as unknown) as MemoryBankService;
}

Deno.test("MemoryBankAdapter: delegates project and execution methods", async () => {
  let addPatternCalled = false;
  let addDecisionCalled = false;
  let promoteCalled = false;

  const service = createMockMemoryBankService({
    addPattern: () => {
      addPatternCalled = true;
      return Promise.resolve();
    },
    addDecision: () => {
      addDecisionCalled = true;
      return Promise.resolve();
    },
    promoteLearning: () => {
      promoteCalled = true;
      return Promise.resolve("id");
    },
  });

  const adapter = new MemoryBankAdapter(service);

  await adapter.getProjectMemory("p");
  await adapter.createProjectMemory({} as any);
  await adapter.updateProjectMemory("p", {});
  await adapter.addPattern("p", {} as any);
  await adapter.addDecision("p", {} as any);
  await adapter.createExecutionRecord({} as any);
  await adapter.getExecutionByTraceId("t");
  await adapter.getExecutionHistory("p", 5);
  await adapter.promoteLearning("p", { type: MemoryType.PATTERN } as any);
  await adapter.demoteLearning("id", "p");

  assertEquals(addPatternCalled, true);
  assertEquals(addDecisionCalled, true);
  assertEquals(promoteCalled, true);
});

Deno.test("MemoryBankAdapter: delegates global and search methods", async () => {
  let initGlobalCalled = false;
  let rebuildCalled = false;

  const service = createMockMemoryBankService({
    initGlobalMemory: () => {
      initGlobalCalled = true;
      return Promise.resolve();
    },
    rebuildIndices: () => {
      rebuildCalled = true;
      return Promise.resolve();
    },
  });

  const adapter = new MemoryBankAdapter(service);

  await adapter.getGlobalMemory();
  await adapter.initGlobalMemory();
  await adapter.addGlobalLearning({} as any);
  await adapter.searchMemory("q");
  await adapter.searchByTags(["t"]);
  await adapter.searchByKeyword("k");
  await adapter.searchMemoryAdvanced({ tags: ["t"], keyword: "k", portal: "p", limit: 10 });
  await adapter.getRecentActivity(10);
  await adapter.rebuildIndices();
  await adapter.rebuildIndicesWithEmbeddings({} as any);
  assertEquals(await adapter.getProjects(), ["alpha"]);

  assertEquals(initGlobalCalled, true);
  assertEquals(rebuildCalled, true);
});

// ──────────────────────────────────────────────────────────────────────
// MemoryExtractorAdapter
// ──────────────────────────────────────────────────────────────────────

function createMockMemoryExtractorService(overrides: Partial<MemoryExtractorService> = {}): MemoryExtractorService {
  return ({
    analyzeExecution: () => [],
    createProposal: () => Promise.resolve("prop-1"),
    listPending: () => Promise.resolve([]),
    getPending: () => Promise.resolve(null),
    approvePending: () => Promise.resolve(),
    rejectPending: () => Promise.resolve(),
    approveAll: () => Promise.resolve(5),
    ...overrides,
  } as unknown) as MemoryExtractorService;
}

Deno.test("MemoryExtractorAdapter: delegates all methods", async () => {
  let approveCalled = false;
  let rejectCalled = false;

  const service = createMockMemoryExtractorService({
    approvePending: (id) => {
      assertEquals(id, "1");
      approveCalled = true;
      return Promise.resolve();
    },
    rejectPending: (id) => {
      assertEquals(id, "2");
      rejectCalled = true;
      return Promise.resolve();
    },
  });

  const adapter = new MemoryExtractorAdapter(service);

  assertEquals(await adapter.listPending(), []);
  assertEquals(await adapter.getPending("1"), null);

  const learning = {
    type: "pattern",
    name: "p",
    title: "t",
    description: "d",
    category: "insight",
    confidence: 0.9,
    tags: [],
  } as any;
  const execution = { trace_id: "t" } as any;
  await adapter.analyzeExecution(execution);
  await adapter.createProposal(learning, execution, "agent");
  await adapter.approvePending("1");
  await adapter.rejectPending("2", "Reason");
  assertEquals(await adapter.approveAll(), 5);

  assertEquals(approveCalled, true);
  assertEquals(rejectCalled, true);
});
