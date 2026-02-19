/**
 * @module WriteFileTool
 * @path src/mcp/handlers/write_file_tool.ts
 * @description MCP tool handler for writing files to a portal with security validation and path safety.
 * @architectural-layer MCP
 * @dependencies [ToolHandler, Path, FS]
 * @related-files [src/mcp/tool_handler.ts]
 */
import { ToolHandler } from "../tool_handler.ts";
import { type MCPToolResponse, WriteFileToolArgsSchema } from "../../schemas/mcp.ts";
import { PortalOperation } from "../../enums.ts";
import { dirname } from "@std/path";
import type { JSONValue } from "../../types.ts";

/**
 * WriteFileTool - Writes file content to a portal
 *
 * Security:
 * - Validates portal exists
 * - Prevents path traversal
 * - Creates parent directories if needed
 * - Logs all writes to Activity Journal
 */
export class WriteFileTool extends ToolHandler {
  async execute(args: Record<string, JSONValue>): Promise<MCPToolResponse> {
    const validatedArgs = WriteFileToolArgsSchema.parse(args) as {
      portal: string;
      path: string;
      content: string;
      agent_id: string;
    };
    const { portal, path, content, agent_id } = validatedArgs;

    try {
      // All tools make permission checking for portal operations
      this.validatePermission(portal, agent_id, PortalOperation.WRITE);

      // Validate portal exists
      const portalPath = this.validatePortalExists(portal);

      // Resolve and validate path
      const absolutePath = this.resolvePortalPath(portalPath, path);

      // Create parent directories if needed
      const parentDir = dirname(absolutePath);
      await Deno.mkdir(parentDir, { recursive: true });

      // Write file
      await Deno.writeTextFile(absolutePath, content);

      // Log successful execution
      this.logToolExecution("write_file", portal, {
        path,
        agent_id: agent_id ?? null,
        success: true,
        bytes: content.length,
      });

      return {
        content: [
          {
            type: "text",
            text: `File written successfully: ${path} (${content.length} bytes)`,
          },
        ],
      };
    } catch (error) {
      // Log failed execution
      this.logToolExecution("write_file", portal, {
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
      name: "write_file",
      description: "Write a file to a portal (validated and logged)",
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
          content: {
            type: "string",
            description: "File content to write",
          },
          agent_id: {
            type: "string",
            description: "Agent identifier for permission checks",
          },
        },
        required: ["portal", "path", "content", "agent_id"],
      },
    };
  }
}
