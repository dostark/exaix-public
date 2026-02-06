/**
 * Artifact Schema
 *
 * Defines schema for analysis artifacts produced by read-only agents.
 * Artifacts are stored as markdown files with YAML frontmatter in Memory/Execution/.
 */

import { z } from "zod";
import { REVIEW_STATUS_VALUES, ReviewStatus as ReviewStatusValue } from "../reviews/review_status.ts";
import type { ReviewStatus } from "../reviews/review_status.ts";

/**
 * Artifact status values
 */
export const ArtifactStatus = ReviewStatusValue;

export type ArtifactStatusType = ReviewStatus;

/**
 * Artifact type values
 */
export const ArtifactType = {
  ANALYSIS: "analysis",
  REPORT: "report",
  DIAGRAM: "diagram",
} as const;

export type ArtifactTypeValue = typeof ArtifactType[keyof typeof ArtifactType];

/**
 * Artifact frontmatter schema (YAML)
 */
export const ArtifactFrontmatterSchema = z.object({
  status: z.enum(REVIEW_STATUS_VALUES),
  type: z.enum(["analysis", "report", "diagram"]),
  agent: z.string(),
  portal: z.string().nullable().optional(),
  target_branch: z.string().nullable().optional(),
  created: z.string(), // ISO 8601 timestamp
  request_id: z.string(),
});

export type ArtifactFrontmatter = z.infer<typeof ArtifactFrontmatterSchema>;

/**
 * Artifact database record schema
 */
export const ArtifactSchema = z.object({
  id: z.string(),
  status: z.enum(REVIEW_STATUS_VALUES),
  type: z.enum(["analysis", "report", "diagram"]),
  agent: z.string(),
  portal: z.string().nullable().optional(),
  target_branch: z.string().nullable().optional(),
  created: z.string(), // ISO 8601 timestamp
  updated: z.string().nullable().optional(), // ISO 8601 timestamp
  request_id: z.string(),
  file_path: z.string(), // Path to markdown file in Memory/Execution/
  rejection_reason: z.string().nullable().optional(),
});

export type Artifact = z.infer<typeof ArtifactSchema>;

/**
 * Artifact with content (file content loaded)
 */
export interface ArtifactWithContent extends Artifact {
  content: string; // Full markdown content with frontmatter
  body: string; // Markdown content without frontmatter
}

/**
 * Artifact creation input
 */
export const CreateArtifactInputSchema = z.object({
  request_id: z.string(),
  agent: z.string(),
  content: z.string(), // Markdown content (frontmatter will be added)
  portal: z.string().nullable().optional(),
  target_branch: z.string().nullable().optional(),
  type: z.enum(["analysis", "report", "diagram"]).default("analysis"),
});

export type CreateArtifactInput = z.infer<typeof CreateArtifactInputSchema>;

/**
 * Artifact list filters
 */
export const ArtifactFiltersSchema = z.object({
  status: z.enum(REVIEW_STATUS_VALUES).optional(),
  agent: z.string().optional(),
  portal: z.string().nullable().optional(),
  type: z.enum(["analysis", "report", "diagram"]).optional(),
}).partial();

export type ArtifactFilters = z.infer<typeof ArtifactFiltersSchema>;
