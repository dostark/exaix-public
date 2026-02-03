/**
 * Review Schema
 *
 * Defines the structure for reviews created by agents during plan execution.
 * Reviews represent code changes that are pending review and approval.
 */

import { z } from "zod";
import { ReviewStatus } from "../enums.ts";

/**
 * Review status values
 */
export const ReviewStatusSchema = z.nativeEnum(ReviewStatus);

/**
 * Review schema with all fields
 */
export const ReviewSchema = z.object({
  id: z.string().uuid(), // Review UUID
  trace_id: z.string().uuid(), // Link to request/plan trace
  portal: z.string().nullish(), // Portal name (null for workspace)
  branch: z.string().min(1), // Git branch name (feat/<desc>-<trace>)
  repository: z.string().min(1), // Absolute path to git repository
  status: ReviewStatusSchema, // Current status
  description: z.string(), // Description of changes
  commit_sha: z.string().nullish(), // Latest commit SHA from agent
  files_changed: z.number().int().nonnegative().default(0), // Number of files in commit
  created: z.string().datetime(), // ISO 8601 timestamp
  created_by: z.string().min(1), // Agent blueprint name
  approved_at: z.string().datetime().nullish(), // Approval timestamp
  approved_by: z.string().nullish(), // User who approved
  rejected_at: z.string().datetime().nullish(), // Rejection timestamp
  rejected_by: z.string().nullish(), // User who rejected
  rejection_reason: z.string().nullish(), // Reason for rejection
});

export type Review = z.infer<typeof ReviewSchema>;

/**
 * Input for registering a new review
 */
export const RegisterReviewSchema = z.object({
  trace_id: z.string().uuid(),
  portal: z.string().nullish(), // Can be null for workspace reviews
  branch: z.string().min(1),
  repository: z.string().min(1), // Absolute path to git repository
  commit_sha: z.string().optional(),
  files_changed: z.number().int().nonnegative().default(0),
  description: z.string(),
  created_by: z.string().min(1), // Agent name
});

export type RegisterReviewInput = z.infer<typeof RegisterReviewSchema>;

/**
 * Filters for listing reviews
 */
export const ReviewFiltersSchema = z.object({
  trace_id: z.string().uuid().optional(),
  portal: z.string().optional(),
  status: ReviewStatusSchema.optional(),
  created_by: z.string().optional(),
});

export type ReviewFilters = z.infer<typeof ReviewFiltersSchema>;
