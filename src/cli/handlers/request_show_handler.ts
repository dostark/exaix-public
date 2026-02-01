import { join } from "@std/path";
import { exists } from "@std/fs";
import { BaseCommand, type CommandContext } from "../base.ts";
import { type RequestShowResult } from "../request_commands.ts";

export class RequestShowHandler extends BaseCommand {
  private workspaceRequestsDir: string;

  constructor(context: CommandContext) {
    super(context);
    this.workspaceRequestsDir = join(
      context.config.system.root,
      context.config.paths.workspace,
      context.config.paths.requests,
    );
  }

  async show(idOrFilename: string): Promise<RequestShowResult> {
    // Check if directory exists
    if (!await exists(this.workspaceRequestsDir)) {
      throw new Error(`Request not found: ${idOrFilename}`);
    }

    const { matchingFile, matchingFrontmatter } = await this.findMatchingRequestFile(idOrFilename);

    // Read full content
    const fullContent = await Deno.readTextFile(matchingFile);

    // Extract body (content after YAML frontmatter)
    const body = fullContent.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();

    return {
      metadata: {
        trace_id: matchingFrontmatter.trace_id || "",
        filename: matchingFile.split("/").pop() || "",
        path: matchingFile,
        status: matchingFrontmatter.status || "unknown",
        priority: matchingFrontmatter.priority || "normal",
        agent: matchingFrontmatter.agent || "default",
        portal: matchingFrontmatter.portal,
        model: matchingFrontmatter.model,
        flow: matchingFrontmatter.flow,
        skills: matchingFrontmatter.skills ? JSON.parse(matchingFrontmatter.skills) : undefined,
        created: matchingFrontmatter.created || "",
        created_by: matchingFrontmatter.created_by || "unknown",
        source: matchingFrontmatter.source || "unknown",
      },
      content: body,
    };
  }

  private async findMatchingRequestFile(
    idOrFilename: string,
  ): Promise<{ matchingFile: string; matchingFrontmatter: Record<string, string> }> {
    let matchingFile: string | null = null;
    let matchingFrontmatter: Record<string, string> | null = null;

    for await (const entry of Deno.readDir(this.workspaceRequestsDir)) {
      if (!entry.isFile || !entry.name.endsWith(".md")) continue;

      const filePath = join(this.workspaceRequestsDir, entry.name);
      const content = await Deno.readTextFile(filePath);
      const frontmatter = this.extractFrontmatter(content);

      if (entry.name === idOrFilename || frontmatter.trace_id === idOrFilename) {
        return { matchingFile: filePath, matchingFrontmatter: frontmatter };
      }

      if (frontmatter.trace_id && frontmatter.trace_id.startsWith(idOrFilename)) {
        if (matchingFile) {
          throw new Error(`Ambiguous request ID: ${idOrFilename}. Please use a longer ID.`);
        }
        matchingFile = filePath;
        matchingFrontmatter = frontmatter;
      }
    }

    if (!matchingFile || !matchingFrontmatter) {
      throw new Error(`Request not found: ${idOrFilename}`);
    }

    return { matchingFile, matchingFrontmatter };
  }
}
