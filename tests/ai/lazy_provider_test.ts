import { assertEquals } from "@std/assert";
import type { IProviderFactory } from "../../src/ai/factories/abstract_provider_factory.ts";
import { LazyProvider } from "../../src/ai/providers/lazy_provider.ts";
import type { IModelProvider } from "../../src/ai/types.ts";

Deno.test("LazyProvider: derives id from constructor arg > options.id > provider-model", () => {
  const factory: IProviderFactory = {
    create: () => Promise.reject(new Error("not used")),
  } as unknown as IProviderFactory;

  const optsWithId = { provider: "p", model: "m", id: "opt-id" } as any;
  const optsNoId = { provider: "p", model: "m" } as any;

  const a = new LazyProvider(factory, optsWithId, "ctor-id");
  const b = new LazyProvider(factory, optsWithId);
  const c = new LazyProvider(factory, optsNoId);

  assertEquals(a.id, "ctor-id");
  assertEquals(b.id, "opt-id");
  assertEquals(c.id, "p-m");
});

Deno.test("LazyProvider: initializes underlying provider only once", async () => {
  const createdWith: unknown[] = [];
  let createCalls = 0;
  const generateCalls: Array<{ prompt: string; options: unknown }> = [];

  const underlying: IModelProvider = {
    id: "underlying",
    generate: (prompt: string, options?: unknown) => {
      generateCalls.push({ prompt, options });
      return Promise.resolve(`out:${prompt}`);
    },
  } as unknown as IModelProvider;

  const factory: IProviderFactory = {
    create: (options: unknown) => {
      createCalls++;
      createdWith.push(options);
      return Promise.resolve(underlying);
    },
  } as unknown as IProviderFactory;

  const opts = { provider: "p", model: "m" } as any;
  const lazy = new LazyProvider(factory, opts);

  const out1 = await lazy.generate("a", { temperature: 0 } as any);
  const out2 = await lazy.generate("b");

  assertEquals(out1, "out:a");
  assertEquals(out2, "out:b");
  assertEquals(createCalls, 1);
  assertEquals(createdWith[0], opts);
  assertEquals(generateCalls.length, 2);
  assertEquals(generateCalls[0].prompt, "a");
  assertEquals(generateCalls[1].prompt, "b");
});
