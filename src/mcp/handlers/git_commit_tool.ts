import { ToolHandler } from "../tool_handler.ts";
import { type MCPToolResponse } from "../../schemas/mcp.ts";
import { PortalOperation } from "../../enums.ts";

/**
 * GitCommitTool - Commits changes in portal git repositories
 *
 * Security:
 * - Validates portal exists
 * - Validates commit message not empty
 * - Optionally commits specific files
 * - Checks if git repository exists
 * - Logs all operations to Activity Journal
 */
export class GitCommitTool extends ToolHandler {
  async execute(args: unknown): Promise<MCPToolResponse> {
    const { GitCommitToolArgsSchema } = await import("../../schemas/mcp.ts");
    const validatedArgs = GitCommitToolArgsSchema.parse(args) as {
      portal: string;
      message: string;
      files?: string[];
      agent_id: string;
    };
    const { portal, message, files, agent_id } = validatedArgs;

    try {
      // All tools make permission checking for portal operations
      this.validatePermission(portal, agent_id, PortalOperation.GIT);

      // Validate portal exists
      const portalPath = this.validatePortalExists(portal);

      // Check if git repository exists
      await this.validateGitRepository(portalPath, portal);

      // Stage files
      let stageArgs: string[];
      if (files && files.length > 0) {
        stageArgs = ["add", ...files];
      } else {
        stageArgs = ["add", "."];
      }

      const stageCmd = new Deno.Command("git", {
        args: stageArgs,
        cwd: portalPath,
        stdout: "piped",
        stderr: "piped",
      });

      await stageCmd.output();

      // Commit changes
      const commitCmd = new Deno.Command("git", {
        args: ["commit", "-m", message],
        cwd: portalPath,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stderr } = await commitCmd.output();

      if (code !== 0) {
        const error = new TextDecoder().decode(stderr);
        throw new Error(`Failed to commit: ${error}`);
      }

      return this.formatSuccess(
        "git_commit",
        portal,
        `Changes committed successfully in portal '${portal}': ${message}`,
        { message, files: files?.length || "all", agent_id },
      );
    } catch (error) {
      this.formatError("git_commit", portal, error, {
        message,
        files: files?.length || "all",
        agent_id,
      });
    }
  }

  getToolDefinition() {
    return {
      name: "git_commit",
      description: "Commit changes in a portal git repository",
      inputSchema: {
        type: "object",
        properties: {
          portal: {
            type: "string",
            description: "Portal name",
          },
          message: {
            type: "string",
            description: "Commit message",
          },
          files: {
            type: "array",
            items: { type: "string" },
            description: "Optional: specific files to commit (defaults to all changes)",
          },
          agent_id: {
            type: "string",
            description: "Agent identifier for permission checks",
          },
        },
        required: ["portal", "message", "agent_id"],
      },
    };
  }
}
