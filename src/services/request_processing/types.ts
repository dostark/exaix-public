import type { RequestStatusType } from "../../requests/request_status.ts";

export interface RequestFrontmatter {
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
}

export interface ParsedRequestFile {
  frontmatter: RequestFrontmatter;
  body: string;
  rawContent: string;
}
