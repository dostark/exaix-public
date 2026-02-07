import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { buildParsedRequest, loadBlueprint } from "../../src/services/request_common.ts";

Deno.test("loadBlueprint: returns null when blueprint does not exist", async () => {
  const dir = await Deno.makeTempDir();
  const out = await loadBlueprint(dir, "missing");
  assertEquals(out, null);
});

Deno.test("loadBlueprint: reads blueprint when present", async () => {
  const dir = await Deno.makeTempDir();
  const agentId = "agent";
  const path = join(dir, `${agentId}.md`);
  await Deno.writeTextFile(path, "prompt");

  const out = await loadBlueprint(dir, agentId);
  assertEquals(out?.agentId, agentId);
  assertEquals(out?.systemPrompt, "prompt");
});

Deno.test("loadBlueprint: returns null on read error", async () => {
  const dir = await Deno.makeTempDir();
  const agentId = "agent";
  const path = join(dir, `${agentId}.md`);
  await Deno.writeTextFile(path, "prompt");

  const original = Deno.readTextFile;
  try {
    (Deno as any).readTextFile = (p: string) => {
      if (p === path) throw new Error("read failed");
      return original(p);
    };

    const out = await loadBlueprint(dir, agentId);
    assertEquals(out, null);
  } finally {
    (Deno as any).readTextFile = original;
  }
});

Deno.test("buildParsedRequest: trims body and parses skills", () => {
  const req = buildParsedRequest(
    "  hello \n",
    { priority: "p1", source: "src", skills: '["a","b"]' } as any,
    "req",
    "trace",
  ) as any;

  assertEquals(req.userPrompt, "hello");
  assertEquals(req.context.priority, "p1");
  assertEquals(req.context.source, "src");
  assertEquals(req.requestId, "req");
  assertEquals(req.traceId, "trace");
  assertEquals(req.skills, ["a", "b"]);
});
