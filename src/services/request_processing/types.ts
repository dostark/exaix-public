/**
 * @module RequestProcessingTypes
 * @path src/services/request_processing/types.ts
 * @description Type definitions for request processing, including frontmatter and parsed file structures.
 * @architectural-layer Services
 * @dependencies [RequestStatus]
 * @related-files [src/services/request_processor.ts, src/requests/request_status.ts]
 */
import type { RequestStatusType } from "../../requests/request_status.ts";

export interface IRequestFrontmatter {
  trace_id: string;
  created: string;
  status: RequestStatusType;
  priority: string;
  agent?: string;
  flow?: string;
  source: string;
  created_by: string;
  portal?: string;
  target_branch?: string;
  model?: string;
  skills?: string;
  subject?: string;
  subject_is_fallback?: boolean;
}

export interface ParsedRequestFile {
  frontmatter: IRequestFrontmatter;
  body: string;
  rawContent: string;
}
