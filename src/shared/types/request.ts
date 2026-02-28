/**
 * @module Request
 * @path src/shared/types/request.ts
 * @description Module for Request.
 * @architectural-layer Shared
 * @dependencies [Enums, Status]
 * @related-files [src/shared/interfaces/i_request_service.ts]
 */

import type { RequestPriority } from "../enums.ts";
import type { RequestStatusType } from "../status/request_status.ts";

/**
 * Detailed skills information for a request.
 */
export interface IRequestSkills {
  explicit?: string[]; // User-specified skills
  autoMatched?: string[]; // Skills matched by triggers
  fromDefaults?: string[]; // Skills from agent defaults
  skipped?: string[]; // Skills excluded by user
}

/**
 * Options for creating a request
 */
export interface IRequestOptions {
  agent?: string;
  priority?: RequestPriority;
  portal?: string;
  target_branch?: string;
  model?: string;
  flow?: string;
  skills?: string[];
  skipSkills?: string[];
  subject?: string;
}

/**
 * Source of request creation
 */
export type RequestSource = "cli" | "file" | "interactive" | "tui";

/**
 * Metadata returned when a request is created or listed
 */
export interface IRequestMetadata {
  trace_id: string;
  filename: string;
  path?: string;
  status: RequestStatusType;
  priority: RequestPriority;
  agent: string;
  portal?: string;
  target_branch?: string;
  model?: string;
  flow?: string;
  skills?: string[] | IRequestSkills;
  input_tokens?: string;
  output_tokens?: string;
  total_tokens?: string;
  token_provider?: string;
  token_model?: string;
  token_cost_usd?: string;
  created: string;
  created_by: string;
  source: RequestSource;
  rejected_path?: string;
  subject?: string;
}

/**
 * Request entry when listing (includes potential error)
 */
export interface IRequestEntry extends IRequestMetadata {
  error?: string;
}

/**
 * Standard alias for compatibility.
 */
export type IRequest = IRequestEntry;

/**
 * Result of showing a request's full details
 */
export interface IRequestShowResult {
  metadata: IRequestEntry;
  content: string;
}
