import { join } from "@std/path";
import { exists } from "@std/fs";
import { BaseCommand, type CommandContext } from "../base.ts";
import { type RequestShowResult } from "../request_commands.ts";
import { coerceRequestStatus } from "../../requests/request_status.ts";
import { getWorkspaceRequestsDir } from "./request_paths.ts";

export class RequestShowHandler extends BaseCommand {
  private workspaceRequestsDir: string;

  constructor(context: CommandContext) {
    super(context);
    this.workspaceRequestsDir = getWorkspaceRequestsDir(context);
  }

  async show(idOrFilename: string): Promise<RequestShowResult> {
    // Check if directory exists
    if (!await exists(this.workspaceRequestsDir)) {
      throw new Error(`Request not found: ${idOrFilename}`);
    }

    const { matchingFile, matchingFrontmatter } = await this.findMatchingRequestFile(idOrFilename);
    const requestId = matchingFile.split("/").pop()?.replace(/\.md$/, "") ?? "";
    const planTokens = await this.findPlanTokenStats(requestId);

    // Read full content
    const fullContent = await Deno.readTextFile(matchingFile);

    // Extract body (content after YAML frontmatter)
    const body = fullContent.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();

    return {
      metadata: {
        trace_id: matchingFrontmatter.trace_id || "",
        filename: matchingFile.split("/").pop() || "",
        path: matchingFile,
        status: coerceRequestStatus(matchingFrontmatter.status),
        priority: matchingFrontmatter.priority || "normal",
        agent: matchingFrontmatter.agent || "default",
        portal: matchingFrontmatter.portal,
        target_branch: matchingFrontmatter.target_branch,
        model: matchingFrontmatter.model,
        flow: matchingFrontmatter.flow,
        skills: matchingFrontmatter.skills ? JSON.parse(matchingFrontmatter.skills) : undefined,
        ...(planTokens ?? {}),
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

  private async findPlanTokenStats(requestId: string): Promise<Record<string, string> | null> {
    if (!requestId) {
      return null;
    }

    const workspaceRoot = join(this.config.system.root, this.config.paths.workspace);
    const plansDir = join(workspaceRoot, this.config.paths.plans);
    const rejectedDir = join(workspaceRoot, this.config.paths.rejected);
    const activeDir = join(workspaceRoot, this.config.paths.active);
    const archiveDir = join(workspaceRoot, this.config.paths.archive);

    const planId = `${requestId}_plan`;
    const candidatePaths = [
      join(plansDir, `${planId}.md`),
      join(rejectedDir, `${planId}_rejected.md`),
      join(activeDir, `${planId}.md`),
      join(archiveDir, `${planId}.md`),
    ];

    for (const planPath of candidatePaths) {
      if (await exists(planPath)) {
        const content = await Deno.readTextFile(planPath);
        const frontmatter = this.extractFrontmatter(content);
        const tokenFields: Record<string, string> = {};
        if (frontmatter.input_tokens) tokenFields.input_tokens = frontmatter.input_tokens;
        if (frontmatter.output_tokens) tokenFields.output_tokens = frontmatter.output_tokens;
        if (frontmatter.total_tokens) tokenFields.total_tokens = frontmatter.total_tokens;
        if (frontmatter.token_provider) tokenFields.token_provider = frontmatter.token_provider;
        if (frontmatter.token_model) tokenFields.token_model = frontmatter.token_model;
        if (frontmatter.token_cost_usd) tokenFields.token_cost_usd = frontmatter.token_cost_usd;
        return Object.keys(tokenFields).length > 0 ? tokenFields : null;
      }
    }

    return null;
  }
}
