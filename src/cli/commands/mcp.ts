import { BaseCommand, type CommandContext } from "../base.ts";
import { MCPServer } from "../../mcp/server.ts";

export class McpCommands extends BaseCommand {
  constructor(context: CommandContext) {
    super(context);
  }

  async start(options: { sse?: boolean; port?: number }) {
    const { config, db } = this;
    const transport = options.sse ? "sse" : "stdio";
    const server = new MCPServer({
      config,
      db,
      transport,
    });

    if (transport === "sse") {
      await server.startHTTPServer(options.port || 3000);
    } else {
      server.start();
      // Stdio loop for JSON-RPC 2.0
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      for await (const chunk of Deno.stdin.readable) {
        const text = decoder.decode(chunk);
        const lines = text.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          try {
            const request = JSON.parse(line);
            const response = await server.handleRequest(request);
            if (response) {
              const responseStr = JSON.stringify(response) + "\n";
              await Deno.stdout.write(encoder.encode(responseStr));
            }
          } catch (error) {
            console.error("Failed to process request:", error);
          }
        }
      }
    }
  }
}
