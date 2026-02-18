/**
 * @module RequestCommon
 * @path src/services/request_common.ts
 * @description Provides common utility functions for loading agent blueprints
 * and building parsed request objects.
 * @architectural-layer Services
 * @dependencies [Blueprint, Path]
 * @related-files [src/services/request_processor.ts, src/services/agent_runner.ts]
 */
import { join } from "@std/path";
import { exists } from "@std/fs";
import type { Blueprint, ParsedRequest } from "./agent_runner.ts";
import type { RequestFrontmatter } from "./request_processing/types.ts";

/** Load an agent blueprint file from a blueprints directory. */
export async function loadBlueprint(blueprintsPath: string, agentId: string): Promise<Blueprint | null> {
  const blueprintPath = join(blueprintsPath, `${agentId}.md`);
  if (!await exists(blueprintPath)) return null;
  try {
    const content = await Deno.readTextFile(blueprintPath);
    return { systemPrompt: content, agentId };
  } catch (err) {
    console.error(`Failed to load blueprint ${agentId}:`, err);
    return null;
  }
}

/** Build a ParsedRequest used by AgentRunner. */
export function buildParsedRequest(
  body: string,
  frontmatter: RequestFrontmatter,
  requestId: string,
  traceId: string,
): ParsedRequest {
  return {
    userPrompt: body.trim(),
    context: {
      priority: frontmatter.priority,
      source: frontmatter.source,
      traceId,
      requestId,
    },
    requestId,
    traceId,
  };
}
