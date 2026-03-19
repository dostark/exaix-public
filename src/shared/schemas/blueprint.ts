/**
 * @module BlueprintSchema
 * @path src/schemas/blueprint.ts
 * @description Defines Zod validation schemas for agent blueprint files, including frontmatter and creation results.
 * @architectural-layer Schemas
 * @dependencies [zod]
 * @related-files [src/cli/blueprint_commands.ts]
 */

import { z } from "zod";
import { DEFAULT_BLUEPRINT_VERSION } from "../constants.ts";

// ============================================================================
// Blueprint Interfaces
// ============================================================================

/**
 * Result from blueprint creation
 */
export interface IBlueprintCreateResult {
  agent_id: string;
  name: string;
  model: string;
  capabilities?: string[];
  created: string;
  created_by: string;
  version: string;
  path: string;
}

/**
 * Metadata for blueprint listing
 */
export interface IBlueprintMetadata {
  agent_id: string;
  name: string;
  model: string;
  capabilities?: string[];
  created: string;
  created_by: string;
  version: string;
}

/**
 * Full blueprint details for show command
 */
export interface IBlueprintDetails extends IBlueprintMetadata {
  content: string; // Full markdown content including frontmatter
}

/**
 * Validation result
 */
export interface IBlueprintValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// ============================================================================
// Blueprint Frontmatter Schema
// ============================================================================

/**
 * Zod schema for blueprint frontmatter validation
 */
export const BlueprintFrontmatterSchema = z.object({
  /** Unique agent identifier (lowercase alphanumeric + hyphens) */
  agent_id: z.string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "agent_id must be lowercase alphanumeric with hyphens only"),

  /** Human-readable agent name */
  name: z.string().min(1).max(100),

  /** Model in provider:model format */
  model: z.string()
    .min(1)
    .regex(/^[a-z]+:[a-z0-9-.:]+$/, "model must be in provider:model format"),

  /** Agent capabilities */
  capabilities: z.array(z.string()).optional().default([]),

  /** ISO 8601 timestamp */
  created: z.string().datetime(),

  /** User who created the blueprint */
  created_by: z.string(),

  /** Semantic version */
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default(DEFAULT_BLUEPRINT_VERSION),

  /** Optional description */
  description: z.string().optional(),

  /** Default skills to apply to all requests for this agent (Phase 17) */
  default_skills: z.array(z.string()).optional(),
});

export type IBlueprintFrontmatter = z.infer<typeof BlueprintFrontmatterSchema>;

// ============================================================================
// Reserved Agent IDs
// ============================================================================

/**
 * Agent IDs that cannot be used for custom blueprints
 */
export const RESERVED_AGENT_IDS = new Set([
  "system",
  "test",
]);

/**
 * Check if agent_id is reserved
 */
export function isReservedAgentId(agentId: string): boolean {
  return RESERVED_AGENT_IDS.has(agentId);
}
