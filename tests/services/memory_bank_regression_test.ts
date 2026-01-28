import { assert, assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { searchByKeyword, searchByTags, searchMemoryAdvanced } from "../../src/services/memory_search.ts";
import { MemoryStatus, MemoryType } from "../../src/enums.ts";

Deno.test("[regression] searchByKeyword finds patterns, decisions and overview", async () => {
  const projectsDir = await Deno.makeTempDir({ prefix: "exotest-" });
  // create two project directories
  await Deno.mkdir(`${projectsDir}/projA`);
  await Deno.mkdir(`${projectsDir}/projB`);

  const deps = {
    projectsDir,
    getProjectMemory: (portal: string) => {
      if (portal === "projA") {
        return {
          portal: "projA",
          overview: "An overview mentioning Foobar and X features.",
          patterns: [
            { name: "PatternOne", description: "Contains X keyword here", tags: ["alpha"] },
          ],
          decisions: [
            { date: "2026-01-01", decision: "Choose X", rationale: "Because X is fast", tags: ["alpha"] },
          ],
          references: [],
        } as any;
      }
      if (portal === "projB") {
        return {
          portal: "projB",
          overview: "Nothing interesting",
          patterns: [],
          decisions: [],
          references: [],
        } as any;
      }
      return null;
    },
    getExecutionHistory: (_portal?: string, _limit?: number) => {
      return [
        {
          trace_id: "abcd1234",
          portal: "projA",
          summary: "Execution mentioning X in summary",
          started_at: new Date().toISOString(),
        } as any,
      ];
    },
    loadLearningsFromFile: () => [
      { id: "L1", title: "Learning X", description: "About X", status: MemoryStatus.APPROVED, tags: ["alpha"] } as any,
    ],
    calculateFrequency: (text: string | undefined, keywordLower: string) => {
      if (!text) return 0;
      const matches = text.toLowerCase().match(new RegExp(keywordLower, "gi"));
      return matches ? matches.length : 0;
    },
    calculateRelevance: (titleFreq: number, descFreq: number) =>
      Math.min(0.99, 0.5 + (titleFreq * 0.15) + (descFreq * 0.05)),
  } as any;

  const results = await searchByKeyword("X", { portal: "projA", limit: 10 }, deps);
  // Expect at least pattern, decision, project overview, and learning entries
  const types = results.map((r) => r.type);
  assert(types.includes(MemoryType.PATTERN));
  assert(types.includes(MemoryType.DECISION));
  // `searchByKeyword` checks project overviews (PROJECT) and does not
  // currently include execution search results, so expect PROJECT here.
  assert(types.includes(MemoryType.PROJECT));
  assert(types.includes(MemoryType.LEARNING));

  // cleanup
  await Deno.remove(projectsDir, { recursive: true });
});

Deno.test("[regression] searchByTags returns matching items and learnings", async () => {
  const projectsDir = await Deno.makeTempDir({ prefix: "exotest-" });
  await Deno.mkdir(`${projectsDir}/projA`);

  const deps = {
    projectsDir,
    getProjectMemory: (portal: string) => ({
      portal,
      overview: "",
      patterns: [{ name: "P", description: "D", tags: ["t1"] }],
      decisions: [{ date: "2026-01-01", decision: "D1", rationale: "R1", tags: ["t1"] }],
      references: [],
    } as any),
    getExecutionHistory: () => [],
    loadLearningsFromFile:
      () => [{ id: "L2", title: "T", description: "D", status: MemoryStatus.APPROVED, tags: ["t1"] } as any],
    calculateFrequency: () => 0,
    calculateRelevance: () => 0.5,
  } as any;

  const results = await searchByTags(["t1"], { portal: "projA", limit: 10 }, deps);
  const types = results.map((r) => r.type);
  assert(types.includes(MemoryType.PATTERN));
  assert(types.includes(MemoryType.DECISION));
  assert(types.includes(MemoryType.LEARNING));

  await Deno.remove(projectsDir, { recursive: true });
});

Deno.test("[regression] searchMemoryAdvanced combines tag and keyword results without duplicates", async () => {
  const projectsDir = await Deno.makeTempDir({ prefix: "exotest-" });
  await Deno.mkdir(`${projectsDir}/projA`);

  const deps = {
    projectsDir,
    getProjectMemory: () => ({
      portal: "projA",
      overview: "contains zed",
      patterns: [{ name: "ZedPattern", description: "zed here", tags: ["t1"] }],
      decisions: [],
      references: [],
    } as any),
    getExecutionHistory: () => [],
    loadLearningsFromFile: () => [],
    calculateFrequency: (text: string | undefined, keywordLower: string) => {
      if (!text) return 0;
      const matches = text.toLowerCase().match(new RegExp(keywordLower, "gi"));
      return matches ? matches.length : 0;
    },
    calculateRelevance: (titleFreq: number, descFreq: number) =>
      Math.min(0.99, 0.5 + (titleFreq * 0.15) + (descFreq * 0.05)),
  } as any;

  const results = await searchMemoryAdvanced({ tags: ["t1"], keyword: "zed", portal: "projA", limit: 10 }, deps as any);
  // Should return one result for the pattern, not duplicated
  const patternResults = results.filter((r) => r.type === MemoryType.PATTERN && r.portal === "projA");
  assertEquals(patternResults.length, 1);

  await Deno.remove(projectsDir, { recursive: true });
});
