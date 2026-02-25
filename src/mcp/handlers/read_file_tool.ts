import { type MCPToolResponse, ReadFileToolArgsSchema } from "../../schemas/mcp.ts";
import { PortalOperation } from "../../enums.ts";
import type { JSONValue } from "../../types.ts";
/**
 * @module ReadFileTool
 * @path src/mcp/handlers/read_file_tool.ts
 * @description MCP tool handler for reading files from a portal with security validation.
 * @architectural-layer MCP
 * @dependencies [ToolHandler, Path]
 * @related-files [src/mcp/tool_handler.ts]
 */
import { ToolHandler } from "../tool_handler.ts";

/**
 * ReadFileTool - Reads file content from a portal
 *
 * Security:
 * - Validates portal exists
 * - Prevents path traversal
 * - Validates file exists
 * - Logs all reads to IActivity Journal
 */
export class ReadFileTool extends ToolHandler {
  async execute(args: Record<string, JSONValue>): Promise<MCPToolResponse> {
    // Validate arguments with Zod schema
    const validatedArgs = ReadFileToolArgsSchema.parse(args);
    const { portal, path, agent_id } = validatedArgs;

    try {
      // All tools make permission checking for portal operations
      this.validatePermission(portal, agent_id, PortalOperation.READ);

      // Validate portal exists
      const portalPath = this.validatePortalExists(portal);

      // Resolve and validate path
      const absolutePath = this.resolvePortalPath(portalPath, path);

      // Read file
      let content: string;
      try {
        content = await Deno.readTextFile(absolutePath);
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          throw new Error(`File not found: ${path}`);
        }
        throw error;
      }

      // Log successful execution
      this.logToolExecution("read_file", portal, {
        path,
        agent_id: agent_id ?? null,
        success: true,
        bytes: content.length,
      });

      return {
        content: [
          {
            type: "text",
            text: content,
          },
        ],
      };
    } catch (error) {
      // Log failed execution
      this.logToolExecution("read_file", portal, {
        path,
        agent_id: agent_id ?? null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  getToolDefinition() {
    return {
      name: "read_file",
      description: "Read a file from a portal (scoped to allowed portals)",
      inputSchema: {
        type: "object",
        properties: {
          portal: {
            type: "string",
            description: "Portal name",
          },
          path: {
            type: "string",
            description: "Relative path within portal",
          },
          agent_id: {
            type: "string",
            description: "Agent identifier for permission checks",
          },
        },
        required: ["portal", "path", "agent_id"],
      },
    };
  }
}
