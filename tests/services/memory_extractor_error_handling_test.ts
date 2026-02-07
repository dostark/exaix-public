import { assertEquals } from "@std/assert";

import { MemoryExtractorService } from "../../src/services/memory_extractor.ts";
import { createMockConfig } from "../helpers/config.ts";
import { ConfidenceLevel, LearningCategory, MemoryScope, MemorySource } from "../../src/enums.ts";

Deno.test("MemoryExtractorService: logActivity errors do not break createProposal", async () => {
  const root = await Deno.makeTempDir({ prefix: "memory-extractor-" });
  try {
    const config = createMockConfig(root);

    const db = {
      logActivity: () => {
        throw new Error("db down");
      },
    };

    const extractor = new MemoryExtractorService(config, db as any, {} as any);

    const proposalId = await extractor.createProposal(
      {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        source: MemorySource.EXECUTION,
        title: "t",
        description: "d",
        scope: MemoryScope.GLOBAL,
        category: LearningCategory.INSIGHT,
        tags: ["tag"],
        confidence: ConfidenceLevel.HIGH,
        references: [],
      } as any,
      { trace_id: "trace" } as any,
      "agent",
    );

    assertEquals(typeof proposalId, "string");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
