/**
 * @module BlueprintLoader
 * @path src/services/blueprint_loader.ts
 * @description Unified service for loading and validating agent blueprints.
 * Handles YAML frontmatter parsing, schema validation, and blueprint resolution.
 * @architectural-layer Services
 * @dependencies [Zod, YAML, Config]
 * @related-files [src/services/agent_runner.ts, src/services/request_processor.ts]
 */

import { join } from "@std/path";
import { exists } from "@std/fs";
import { parse as parseYaml } from "@std/yaml";
import { z } from "zod";
import { DataFormat } from "../shared/enums.ts";
import { JSONValue } from "../shared/types/json.ts";
import { DEFAULT_BLUEPRINT_VERSION } from "../shared/constants.ts";

/**
 * Fully loaded and validated blueprint
 */
export interface ILoadedBlueprint {
  /** Agent identifier (from frontmatter or filename) */
  agentId: string;

  /** Human-readable name (from frontmatter or derived from agentId) */
  name: string;

  /** Model specification (provider:model format) */
  model: string;

  /** Legacy provider field (for backward compatibility) */
  provider?: string;

  /** Agent capabilities */
  capabilities: string[];

  /** System prompt (markdown body after frontmatter) */
  systemPrompt: string;

  /** Version */
  version: string;

  /** Full raw frontmatter for extensions */
  frontmatter: RuntimeBlueprintFrontmatter;

  /** Path to blueprint file */
  path: string;
}

/**
 * Legacy Blueprint interface for backward compatibility
 * Used by agent_runner.ts
 */
export interface IBlueprint {
  systemPrompt: string;
  agentId?: string;
}

export interface IBlueprintLoaderOptions {
  /** Path to blueprints directory */
  blueprintsPath: string;

  /** Default model if not specified in blueprint */
  defaultModel?: string;
}

// ============================================================================
// Blueprint Schema (Extended for Runtime)
// ============================================================================

/**
 * Extended schema for runtime blueprint usage
 * More permissive than creation schema - allows older blueprints
 */
export const RuntimeBlueprintFrontmatterSchema = z.object({
  /** Agent identifier - required */
  agent_id: z.string().min(1).optional(),

  /** Human-readable name */
  name: z.string().min(1).optional(),

  /** Model in provider:model format */
  model: z.string().min(1).optional(),

  /** Provider name (legacy field, prefer model with provider prefix) */
  provider: z.string().optional(),

  /** Agent capabilities */
  capabilities: z.array(z.string()).default([]),

  /** Semantic version */
  version: z.string().default(DEFAULT_BLUEPRINT_VERSION),

  /** Description */
  description: z.string().optional(),

  /** Created timestamp (ISO 8601) */
  created: z.string().optional(),

  /** Creator */
  created_by: z.string().optional(),

  // === Phase 16.4+ Extensions ===

  /** Enable reflexive self-critique */
  reflexive: z.boolean().default(false),

  /** Max iterations for reflexive critique */
  max_reflexion_iterations: z.number().min(1).max(10).default(3),

  /** Minimum confidence required (0-100) */
  confidence_required: z.number().min(0).max(100).optional(),

  /** Enable session memory */
  memory_enabled: z.boolean().default(false),

  // === Phase 17 Skills Extension ===

  /** Default skills to apply */
  default_skills: z.array(z.string()).optional(),
});

export type RuntimeBlueprintFrontmatter = z.infer<typeof RuntimeBlueprintFrontmatterSchema>;

// ============================================================================
// Loaded Blueprint Type
// ============================================================================

// ============================================================================
// BlueprintLoader Service
// ============================================================================

/**
 * Unified blueprint loader service
 *
 * Provides consistent blueprint loading with:
 * - YAML frontmatter parsing
 * - Schema validation with Zod
 * - Backward compatibility with simple blueprints
 * - Extension fields for Phase 16.4+ features
 */
export class BlueprintLoader {
  private cache = new Map<string, ILoadedBlueprint>();

  constructor(private options: IBlueprintLoaderOptions) {}

  /**
   * Load a blueprint by agent ID
   *
   * @param agentId - The agent identifier (filename without .md)
   * @returns ILoadedBlueprint or null if not found
   */
  async load(agentId: string): Promise<ILoadedBlueprint | null> {
    // Check cache first
    if (this.cache.has(agentId)) {
      return this.cache.get(agentId)!;
    }

    const blueprintPath = this.resolvePath(agentId);

    if (!await exists(blueprintPath)) {
      return null;
    }

    try {
      const content = await Deno.readTextFile(blueprintPath);
      const blueprint = this.parse(content, agentId, blueprintPath);

      // Cache for subsequent lookups
      this.cache.set(agentId, blueprint);

      return blueprint;
    } catch (error) {
      if (error instanceof BlueprintLoadError) {
        throw error;
      }
      throw new BlueprintLoadError(
        `Failed to load blueprint '${agentId}': ${error instanceof Error ? error.message : String(error)}`,
        agentId,
        blueprintPath,
      );
    }
  }

  /**
   * Load blueprint or throw if not found
   */
  async loadOrThrow(agentId: string): Promise<ILoadedBlueprint> {
    const blueprint = await this.load(agentId);
    if (!blueprint) {
      throw new BlueprintLoadError(
        `Blueprint not found: ${agentId}`,
        agentId,
        this.resolvePath(agentId),
      );
    }
    return blueprint;
  }

  /**
   * Parse blueprint content
   *
   * Handles three formats:
   * 1. YAML frontmatter (--- delimited)
   * 2. TOML frontmatter (+++ delimited)
   * 3. Plain markdown (no frontmatter, entire content is system prompt)
   */
  parse(content: string, agentId: string, path: string): ILoadedBlueprint {
    // Try YAML frontmatter first (most common)
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
    if (yamlMatch) {
      return this.parseWithFrontmatter(
        yamlMatch[1],
        content.slice(yamlMatch[0].length),
        agentId,
        path,
        DataFormat.YAML,
      );
    }

    // Try TOML frontmatter
    const tomlMatch = content.match(/^\+\+\+\n([\s\S]*?)\n\+\+\+\n?/);
    if (tomlMatch) {
      return this.parseWithFrontmatter(
        tomlMatch[1],
        content.slice(tomlMatch[0].length),
        agentId,
        path,
        DataFormat.TOML,
      );
    }

    // No frontmatter - treat entire content as system prompt (backward compatible)
    return this.createMinimalBlueprint(content, agentId, path);
  }

  /**
   * Parse blueprint with frontmatter
   */
  private parseWithFrontmatter(
    frontmatterRaw: string,
    body: string,
    agentId: string,
    path: string,
    format: DataFormat.YAML | DataFormat.TOML,
  ): ILoadedBlueprint {
    let parsed: Record<string, JSONValue>;

    try {
      if (format === DataFormat.YAML) {
        parsed = parseYaml(frontmatterRaw) as Record<string, JSONValue>;
      } else {
        // TOML parsing - use dynamic import to avoid bundling if not needed
        throw new Error("TOML frontmatter not yet implemented");
      }
    } catch (error) {
      throw new BlueprintLoadError(
        `Invalid ${String(format).toUpperCase()} frontmatter in blueprint '${agentId}': ${
          error instanceof Error ? error.message : String(error)
        }`,
        agentId,
        path,
      );
    }

    // Validate frontmatter with Zod
    const validation = RuntimeBlueprintFrontmatterSchema.safeParse(parsed);
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      throw new BlueprintLoadError(
        `Invalid frontmatter in blueprint '${agentId}': ${errors}`,
        agentId,
        path,
      );
    }

    const frontmatter = validation.data;
    const rawSystemPrompt = body.trim();

    // Resolve inclusions recursively
    const systemPrompt = this.resolveFragments(rawSystemPrompt, new Set());

    return {
      agentId: frontmatter.agent_id || agentId,
      name: frontmatter.name || this.deriveNameFromId(agentId),
      model: frontmatter.model || this.options.defaultModel || "anthropic:claude-sonnet-4-20250514",
      provider: frontmatter.provider,
      capabilities: frontmatter.capabilities,
      systemPrompt,
      version: frontmatter.version,
      frontmatter,
      path,
    };
  }

  /**
   * Resolve {{include:fragments}} recursively
   */
  private resolveFragments(content: string, seen: Set<string>): string {
    const includeRegex = /{{include:([^}]+)}}/g;

    return content.replace(includeRegex, (match, fragmentName) => {
      fragmentName = fragmentName.trim();

      if (seen.has(fragmentName)) {
        console.warn(`Circular inclusion detected for fragment: ${fragmentName}`);
        return match;
      }

      // Fragments are stored in Blueprints/Fragments/ relative to blueprintsPath
      const fragmentsDir = this.options.blueprintsPath.endsWith("Agents")
        ? join(this.options.blueprintsPath, "..", "Fragments")
        : join(this.options.blueprintsPath, "Fragments");

      const fragmentPath = join(fragmentsDir, `${fragmentName}.md`);

      try {
        // We use a sync read here for simplicity within replace,
        // but since loader is async, we could optimize this later if needed.
        // For now, these are small files read during startup.
        const fragmentContent = Deno.readTextFileSync(fragmentPath);

        const nextSeen = new Set(seen);
        nextSeen.add(fragmentName);

        return this.resolveFragments(fragmentContent, nextSeen);
      } catch (error) {
        console.warn(
          `Failed to include fragment '${fragmentName}': ${error instanceof Error ? error.message : String(error)}`,
        );
        return match;
      }
    });
  }

  /**
   * Create minimal blueprint from content without frontmatter
   * Backward compatible with simple blueprint files
   */
  private createMinimalBlueprint(
    content: string,
    agentId: string,
    path: string,
  ): ILoadedBlueprint {
    const frontmatter = RuntimeBlueprintFrontmatterSchema.parse({});

    return {
      agentId,
      name: this.deriveNameFromId(agentId),
      model: this.options.defaultModel || "anthropic:claude-sonnet-4-20250514",
      capabilities: [],
      systemPrompt: content.trim(),
      version: "1.0.0",
      frontmatter,
      path,
    };
  }

  /**
   * Derive human-readable name from agent ID
   * "code-reviewer" → "Code Reviewer"
   */
  private deriveNameFromId(agentId: string): string {
    return agentId
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Resolve agent ID to file path
   *
   * Supports two modes:
   * 1. blueprintsPath points to Blueprints/ → looks in Blueprints/Agents/{agentId}.md
   * 2. blueprintsPath points to Blueprints/Agents/ → looks in {agentId}.md directly
   *
   * This maintains backward compatibility with existing code.
   */
  private resolvePath(agentId: string): string {
    // If blueprintsPath already ends with 'Agents', don't add it again
    if (this.options.blueprintsPath.endsWith("Agents")) {
      return join(this.options.blueprintsPath, `${agentId}.md`);
    }
    // Otherwise, assume it's the Blueprints root
    return join(this.options.blueprintsPath, "Agents", `${agentId}.md`);
  }

  /**
   * Check if a blueprint exists
   */
  async exists(agentId: string): Promise<boolean> {
    return await exists(this.resolvePath(agentId));
  }

  /**
   * Clear the blueprint cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Remove a specific blueprint from cache
   */
  invalidate(agentId: string): void {
    this.cache.delete(agentId);
  }

  /**
   * Convert to legacy Blueprint interface for backward compatibility
   */
  toLegacyBlueprint(loaded: ILoadedBlueprint): IBlueprint {
    return {
      systemPrompt: loaded.systemPrompt,
      agentId: loaded.agentId,
    };
  }
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Error thrown when blueprint loading fails
 */
export class BlueprintLoadError extends Error {
  constructor(
    message: string,
    public readonly agentId: string,
    public readonly path: string,
  ) {
    super(message);
    this.name = "BlueprintLoadError";
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a BlueprintLoader with default configuration
 */
export function createBlueprintLoader(blueprintsPath: string): BlueprintLoader {
  return new BlueprintLoader({ blueprintsPath });
}

/**
 * Standalone function for simple usage (backward compatible)
 * Drop-in replacement for request_common.loadBlueprint
 */
export async function loadBlueprint(
  blueprintsPath: string,
  agentId: string,
): Promise<IBlueprint | null> {
  const loader = new BlueprintLoader({ blueprintsPath });
  const loaded = await loader.load(agentId);

  if (!loaded) {
    return null;
  }

  return loader.toLegacyBlueprint(loaded);
}
