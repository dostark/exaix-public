import type { RequestStatus } from "../../enums.ts";

export interface RequestFrontmatter {
  trace_id: string;
  created: string;
  status: RequestStatus;
  priority: string;
  agent?: string;
  flow?: string;
  source: string;
  created_by: string;
  portal?: string;
  model?: string;
  skills?: string;
}

export interface ParsedRequestFile {
  frontmatter: RequestFrontmatter;
  body: string;
  rawContent: string;
}
