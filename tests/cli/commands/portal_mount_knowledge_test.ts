/**
 * @module PortalMountKnowledgeTest
 * @path tests/cli/commands/portal_mount_knowledge_test.ts
 * @description Integration tests for the post-mount knowledge analysis trigger
 * in PortalCommands.add(). Verifies that IPortalKnowledgeService.analyze() is
 * called when autoAnalyzeOnMount is enabled, skipped when disabled, and that
 * mount succeeds even when analysis fails.
 */

import { assertEquals, assertExists } from "@std/assert";
import { join } from "@std/path";
import { PortalCommands } from "../../../src/cli/commands/portal_commands.ts";
import type { IPortalKnowledgeConfig } from "../../../src/shared/interfaces/i_portal_knowledge_service.ts";
import type { IPortalKnowledgeService } from "../../../src/shared/interfaces/i_portal_knowledge_service.ts";
import type { IPortalKnowledge } from "../../../src/shared/schemas/portal_knowledge.ts";
import type { ICliApplicationContext } from "../../../src/cli/cli_context.ts";
import { PortalAnalysisMode } from "../../../src/shared/enums.ts";
import { initPortalTest } from "../helpers/test_setup.ts";
import { ExoPathDefaults } from "../../../src/shared/constants.ts";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeKnowledgeResult(alias: string): IPortalKnowledge {
  return {
    portal: alias,
    gatheredAt: new Date().toISOString(),
    version: 1,
    architectureOverview: "",
    layers: [],
    keyFiles: [],
    conventions: [],
    dependencies: [],
    packages: undefined,
    techStack: { primaryLanguage: "unknown" },
    symbolMap: [],
    stats: { totalFiles: 1, totalDirectories: 1, extensionDistribution: {} },
    metadata: {
      durationMs: 10,
      mode: PortalAnalysisMode.QUICK,
      filesScanned: 1,
      filesRead: 0,
    },
  };
}

function makeMockKnowledgeService(
  opts: { fail?: boolean } = {},
): IPortalKnowledgeService & { analyzeCallCount: number; lastAlias: string | null } {
  let analyzeCallCount = 0;
  let lastAlias: string | null = null;
  return {
    get analyzeCallCount() {
      return analyzeCallCount;
    },
    get lastAlias() {
      return lastAlias;
    },
    analyze: (portalAlias: string, _portalPath: string, _mode?: PortalAnalysisMode) => {
      analyzeCallCount++;
      lastAlias = portalAlias;
      if (opts.fail) return Promise.reject(new Error("Analysis failed"));
      return Promise.resolve(makeKnowledgeResult(portalAlias));
    },
    getOrAnalyze: (_portalAlias: string, _portalPath: string) => Promise.resolve(makeKnowledgeResult("mock")),
    isStale: (_portalAlias: string) => Promise.resolve(false),
    updateKnowledge: (_portalAlias: string, _portalPath: string) => Promise.resolve(makeKnowledgeResult("mock")),
  };
}

function makeKnowledgeConfig(
  overrides: Partial<IPortalKnowledgeConfig> = {},
): IPortalKnowledgeConfig {
  return {
    autoAnalyzeOnMount: true,
    defaultMode: PortalAnalysisMode.QUICK,
    quickScanLimit: 50,
    maxFilesToRead: 10,
    ignorePatterns: [],
    staleness: 168,
    useLlmInference: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test(
  "[portal add] triggers quick analysis on mount when enabled",
  async () => {
    const { targetDir, context, cleanup } = await initPortalTest({
      targetFiles: { "README.md": "# Test" },
    });
    try {
      const knowledgeService = makeMockKnowledgeService();
      const ctxWithKnowledge: ICliApplicationContext = {
        ...context,
        portalKnowledge: knowledgeService,
        portalKnowledgeConfig: makeKnowledgeConfig({ autoAnalyzeOnMount: true }),
      };
      const commands = new PortalCommands(ctxWithKnowledge);

      await commands.add(targetDir, "KnowledgePortal");

      assertEquals(knowledgeService.analyzeCallCount, 1, "Should call analyze once");
      assertEquals(knowledgeService.lastAlias, "KnowledgePortal");
    } finally {
      await cleanup();
    }
  },
);

Deno.test(
  "[portal add] skips analysis when autoAnalyzeOnMount is false",
  async () => {
    const { targetDir, context, cleanup } = await initPortalTest({
      targetFiles: { "README.md": "# Test" },
    });
    try {
      const knowledgeService = makeMockKnowledgeService();
      const ctxWithKnowledge: ICliApplicationContext = {
        ...context,
        portalKnowledge: knowledgeService,
        portalKnowledgeConfig: makeKnowledgeConfig({ autoAnalyzeOnMount: false }),
      };
      const commands = new PortalCommands(ctxWithKnowledge);

      await commands.add(targetDir, "NoAnalysisPortal");

      assertEquals(knowledgeService.analyzeCallCount, 0, "Should NOT call analyze");
    } finally {
      await cleanup();
    }
  },
);

Deno.test(
  "[portal add] mount succeeds even if analysis fails",
  async () => {
    const { tempRoot, targetDir, context, cleanup } = await initPortalTest({
      targetFiles: { "README.md": "# Test" },
    });
    try {
      const failingService = makeMockKnowledgeService({ fail: true });
      const ctxWithKnowledge: ICliApplicationContext = {
        ...context,
        portalKnowledge: failingService,
        portalKnowledgeConfig: makeKnowledgeConfig({ autoAnalyzeOnMount: true }),
      };
      const commands = new PortalCommands(ctxWithKnowledge);

      // Should not throw — analysis failure must not block mount
      await commands.add(targetDir, "SafePortal");

      // Symlink must exist despite analysis failure
      const symlinkPath = join(tempRoot, "Portals", "SafePortal");
      const stat = await Deno.lstat(symlinkPath);
      assertExists(stat, "Symlink should exist after mount");
    } finally {
      await cleanup();
    }
  },
);

Deno.test(
  "[portal add] persists knowledge.json after analysis",
  async () => {
    const { tempRoot, targetDir, context, cleanup } = await initPortalTest({
      targetFiles: { "README.md": "# Test" },
    });
    try {
      const knowledgeService = makeMockKnowledgeService();
      const ctxWithKnowledge: ICliApplicationContext = {
        ...context,
        portalKnowledge: knowledgeService,
        portalKnowledgeConfig: makeKnowledgeConfig({ autoAnalyzeOnMount: true }),
      };
      const commands = new PortalCommands(ctxWithKnowledge);

      await commands.add(targetDir, "PersistPortal");

      const knowledgePath = join(
        tempRoot,
        ExoPathDefaults.memoryProjects,
        "PersistPortal",
        "knowledge.json",
      );
      const raw = await Deno.readTextFile(knowledgePath);
      const parsed = JSON.parse(raw);
      assertEquals(parsed.portal, "PersistPortal");
    } finally {
      await cleanup();
    }
  },
);
