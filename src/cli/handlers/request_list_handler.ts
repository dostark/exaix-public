import { join } from "@std/path";
import { exists } from "@std/fs";
import { BaseCommand, type CommandContext } from "../base.ts";
import { type RequestEntry } from "../request_commands.ts";

export class RequestListHandler extends BaseCommand {
  private workspaceRequestsDir: string;

  constructor(context: CommandContext) {
    super(context);
    this.workspaceRequestsDir = join(
      context.config.system.root,
      context.config.paths.workspace,
      context.config.paths.requests,
    );
  }

  async list(status?: string): Promise<RequestEntry[]> {
    const requests: RequestEntry[] = [];

    // Check if directory exists
    if (!await exists(this.workspaceRequestsDir)) {
      return [];
    }

    // Scan directory
    for await (const entry of Deno.readDir(this.workspaceRequestsDir)) {
      if (!entry.isFile || !entry.name.endsWith(".md")) {
        continue;
      }

      const filePath = join(this.workspaceRequestsDir, entry.name);
      const content = await Deno.readTextFile(filePath);
      const frontmatter = this.extractFrontmatter(content);

      // Skip if status filter doesn't match
      if (status && frontmatter.status !== status) {
        continue;
      }

      requests.push({
        trace_id: frontmatter.trace_id || "",
        filename: entry.name,
        path: filePath,
        status: frontmatter.status || "unknown",
        priority: frontmatter.priority || "normal",
        agent: frontmatter.agent || "default",
        portal: frontmatter.portal,
        target_branch: frontmatter.target_branch,
        model: frontmatter.model,
        flow: frontmatter.flow,
        skills: frontmatter.skills ? JSON.parse(frontmatter.skills) : undefined,
        created: frontmatter.created || "",
        created_by: frontmatter.created_by || "unknown",
        source: frontmatter.source || "unknown",
      });
    }

    // Sort by created date descending (newest first)
    requests.sort((a, b) => {
      const dateA = new Date(a.created).getTime();
      const dateB = new Date(b.created).getTime();
      return dateB - dateA;
    });

    return requests;
  }
}
