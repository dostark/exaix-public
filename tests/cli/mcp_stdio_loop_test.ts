import { assertEquals } from "@std/assert";
import { runMcpStdioLoop } from "../../src/cli/commands/mcp.ts";

function streamFromText(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

Deno.test("runMcpStdioLoop: writes JSON responses and ignores blank lines", async () => {
  const outputs: string[] = [];
  const decoder = new TextDecoder();

  const server = {
    start: () => {},
    handleRequest: (req: any) => Promise.resolve({ ok: true, echo: req.id }),
  };

  await runMcpStdioLoop(server, {
    stdin: streamFromText('{"id":1}\n\n{"id":2}\n'),
    writeStdout: (data) => {
      outputs.push(decoder.decode(data));
      return Promise.resolve(data.length);
    },
  });

  assertEquals(outputs.length, 2);
  assertEquals(outputs[0].trim(), JSON.stringify({ ok: true, echo: 1 }));
  assertEquals(outputs[1].trim(), JSON.stringify({ ok: true, echo: 2 }));
});

Deno.test("runMcpStdioLoop: reports parse errors via onError", async () => {
  const errors: string[] = [];

  const server = {
    start: () => {},
    handleRequest: (_req: any) => Promise.resolve(null),
  };

  await runMcpStdioLoop(server, {
    stdin: streamFromText("not-json\n"),
    writeStdout: () => Promise.resolve(0),
    onError: (m, e) => errors.push(`${m} ${String(e)}`),
  });

  assertEquals(errors.length, 1);
  assertEquals(errors[0].includes("Failed to process request:"), true);
});
