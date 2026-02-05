import { assertEquals, assertStringIncludes } from "@std/assert";

import { FlowCommands } from "../../src/cli/flow_commands.ts";
import { FlowLoader } from "../../src/flows/flow_loader.ts";
import { FlowValidatorImpl } from "../../src/services/flow_validator.ts";
import { join } from "@std/path";
import { copySync } from "@std/fs";

const defaultContextPaths = {
  memory: "Memory",
  system: "System",
  blueprints: "Blueprints",
  flows: "Flows",
};

async function createMockContext() {
  const root = await Deno.makeTempDir({ prefix: "test-flow-commands-" });
  return {
    config: {
      system: { root },
      paths: defaultContextPaths,
    },
    db: undefined,
    provider: undefined,
  };
}

function getFlowDir(ctx: { config: { system: { root: string }; paths: { blueprints: string } } }) {
  return join(ctx.config.system.root, ctx.config.paths.blueprints, "Flows");
}

function seedFlowModuleSupportFiles(
  ctx: { config: { system: { root: string }; paths: { blueprints: string } } },
  flowDir: string,
) {
  copySync("src/flows/define_flow.ts", `${flowDir}/define_flow.ts`);
  copySync("src/enums.ts", join(ctx.config.system.root, ctx.config.paths.blueprints, "enums.ts"));
  copySync("src/schemas", join(ctx.config.system.root, ctx.config.paths.blueprints, "schemas"));
}

async function withFlowsDir(
  ctx: { config: { system: { root: string } } },
  fn: (flowDir: string) => Promise<void>,
) {
  const flowDir = getFlowDir(ctx as any);
  await Deno.mkdir(flowDir, { recursive: true });
  try {
    await fn(flowDir);
  } finally {
    await Deno.remove(ctx.config.system.root, { recursive: true });
  }
}

async function captureConsole(kind: "log" | "error", fn: () => Promise<void>) {
  let output = "";
  const original = console[kind];
  (console as any)[kind] = (...args: unknown[]) => {
    output += args.map((a) => String(a)).join(" ") + "\n";
  };
  try {
    await fn();
  } finally {
    console[kind] = original;
  }
  return output;
}

Deno.test("FlowCommands: listFlows returns empty when no flows", async () => {
  const ctx = await createMockContext();
  await withFlowsDir(ctx, async (_flowDir) => {
    const commands = new FlowCommands(ctx as any);
    const output = await captureConsole("log", async () => {
      await commands.listFlows();
    });
    assertStringIncludes(output, "No flows found");
  });
});

Deno.test("FlowCommands: listFlows outputs table for valid flows", async () => {
  const ctx = await createMockContext();
  await withFlowsDir(ctx, async (flowDir) => {
    seedFlowModuleSupportFiles(ctx as any, flowDir);
    const validFlow = `
import { defineFlow } from "./define_flow.ts";
export default defineFlow({
  id: "cli-flow",
  name: "CLI Flow",
  description: "Flow for CLI test",
  steps: [{ id: "s1", name: "Step 1", agent: "agent1", dependsOn: [], input: { source: "request", transform: "passthrough" }, retry: { maxAttempts: 1, backoffMs: 1000 } }],
  output: { from: "s1", format: "markdown" },
});
`;
    await Deno.writeTextFile(`${flowDir}/cli-flow.flow.ts`, validFlow);
    const commands = new FlowCommands(ctx as any);
    const output = await captureConsole("log", async () => {
      await commands.listFlows();
    });
    assertStringIncludes(output, "CLI Flow");
    assertStringIncludes(output, "Flow for CLI test");
  });
});

Deno.test("FlowCommands: listFlows outputs JSON when requested", async () => {
  const ctx = await createMockContext();
  await withFlowsDir(ctx, async (flowDir) => {
    seedFlowModuleSupportFiles(ctx as any, flowDir);
    const flowModule = `
import { defineFlow } from "./define_flow.ts";
export default defineFlow({
  id: "json-flow",
  name: "JSON Flow",
  description: "Flow for JSON test",
  steps: [{ id: "s1", name: "Step 1", agent: "agent1", dependsOn: [], input: { source: "request", transform: "passthrough" }, retry: { maxAttempts: 1, backoffMs: 1000 } }],
  output: { from: "s1", format: "markdown" },
});
`;
    await Deno.writeTextFile(`${flowDir}/json-flow.flow.ts`, flowModule);

    const commands = new FlowCommands(ctx as any);
    const output = await captureConsole("log", async () => {
      await commands.listFlows({ json: true });
    });

    // should be valid JSON and include our flow id
    assertStringIncludes(output, '"id": "json-flow"');
  });
});

Deno.test("FlowCommands: validateFlow returns valid for correct flow", async () => {
  const ctx = await createMockContext();
  await withFlowsDir(ctx, async (flowDir) => {
    seedFlowModuleSupportFiles(ctx as any, flowDir);
    const validFlow = `
import { defineFlow } from "./define_flow.ts";
export default defineFlow({
  id: "valid-cli-flow",
  name: "Valid CLI Flow",
  description: "Valid flow for CLI test",
  steps: [{ id: "s1", name: "Step 1", agent: "agent1", dependsOn: [], input: { source: "request", transform: "passthrough" }, retry: { maxAttempts: 1, backoffMs: 1000 } }],
  output: { from: "s1", format: "markdown" },
});
`;
    await Deno.writeTextFile(`${flowDir}/valid-cli-flow.flow.ts`, validFlow);
    const loader = new FlowLoader(flowDir);
    const validator = new FlowValidatorImpl(loader, "unused-blueprints-path");
    const result = await validator.validateFlow("valid-cli-flow");
    assertEquals(result.valid, true);
  });
});

Deno.test("FlowCommands: showFlow outputs JSON when requested (id check)", async () => {
  const ctx = await createMockContext();
  await withFlowsDir(ctx, async (flowDir) => {
    seedFlowModuleSupportFiles(ctx as any, flowDir);
    const flowDef = `
import { defineFlow } from "./define_flow.ts";
export default defineFlow({
  id: "show-flow",
  name: "Show Flow",
  description: "Flow to test show",
  steps: [{ id: "s1", name: "Step 1", agent: "agent1", dependsOn: [], input: { source: "request", transform: "passthrough" }, retry: { maxAttempts: 1, backoffMs: 1000 } }],
  output: { from: "s1", format: "markdown" },
});
`;
    await Deno.writeTextFile(`${flowDir}/show-flow.flow.ts`, flowDef);
    const commands = new FlowCommands(ctx as any);
    const output = await captureConsole("log", async () => {
      await commands.showFlow("show-flow", { json: true });
    });
    const parsed = JSON.parse(output.trim());
    assertEquals(parsed.id, "show-flow");
  });
});

Deno.test("FlowCommands: showFlow prints JSON when requested (id & name)", async () => {
  const ctx = await createMockContext();
  await withFlowsDir(ctx, async (flowDir) => {
    seedFlowModuleSupportFiles(ctx as any, flowDir);
    const flowModule = `
import { defineFlow } from "./define_flow.ts";
export default defineFlow({
  id: "show-flow-2",
  name: "Show Flow 2",
  description: "Flow for show test",
  steps: [{ id: "s1", name: "Step 1", agent: "agentA", dependsOn: [], input: { source: "request", transform: "passthrough" }, retry: { maxAttempts: 1, backoffMs: 1000 } }],
  output: { from: "s1", format: "markdown" },
});
`;
    await Deno.writeTextFile(`${flowDir}/show-flow-2.flow.ts`, flowModule);

    const commands = new FlowCommands(ctx as any);
    const output = await captureConsole("log", async () => {
      await commands.showFlow("show-flow-2", { json: true });
    });

    assertStringIncludes(output, '"id": "show-flow-2"');
    assertStringIncludes(output, '"name": "Show Flow 2"');
  });
});

Deno.test("FlowCommands: showFlow renders full view (non-JSON)", async () => {
  const ctx = await createMockContext();
  await withFlowsDir(ctx, async (flowDir) => {
    seedFlowModuleSupportFiles(ctx as any, flowDir);
    const flowModule = `
import { defineFlow } from "./define_flow.ts";
export default defineFlow({
  id: "full-flow",
  name: "Full Flow",
  description: "Flow for full render test",
  steps: [
    { id: "a", name: "Step A", agent: "agentA", dependsOn: [] , input: { source: "request", transform: "passthrough" }, retry: { maxAttempts: 1, backoffMs: 1000 }},
    { id: "b", name: "Step B", agent: "agentB", dependsOn: ["a"] , input: { source: "request", transform: "passthrough" }, retry: { maxAttempts: 1, backoffMs: 1000 }}
  ],
  settings: { maxParallelism: 2, failFast: true },
  output: { from: "b", format: "markdown" },
});
`;
    await Deno.writeTextFile(`${flowDir}/full-flow.flow.ts`, flowModule);

    const commands = new FlowCommands(ctx as any);
    const output = await captureConsole("log", async () => {
      await commands.showFlow("full-flow");
    });

    assertStringIncludes(output, "Dependency Graph:");
    assertStringIncludes(output, "Settings:");
    assertStringIncludes(output, "agentA");
    assertStringIncludes(output, "agentB");
  });
});

Deno.test("FlowCommands: listFlows handles loader errors and exits", async () => {
  const ctx = await createMockContext();
  const commands = new FlowCommands(ctx as any);
  (commands as any).flowLoader.loadAllFlows = () => {
    throw new Error("boom");
  };

  // Capture console.error
  let errOut = "";
  const origErr = console.error;
  console.error = (...args: any[]) => {
    errOut += args.join(" ") + "\n";
  };

  const origExit = (Deno as any).exit;
  (Deno as any).exit = (_c?: number) => {
    throw new Error("DENO_EXIT");
  };

  try {
    let threw = false;
    try {
      await commands.listFlows();
    } catch (_e) {
      threw = true;
      // ensure console.error logged the message
      if (!errOut.includes("Error listing flows: boom")) {
        throw new Error(`Expected error log not found. got: ${errOut}`);
      }
    }
    if (!threw) throw new Error("Expected Deno.exit to be called");
  } finally {
    console.error = origErr;
    (Deno as any).exit = origExit;
  }
});

Deno.test("FlowCommands: validateFlow outputs JSON when requested and handles validator errors", async () => {
  const ctx = await createMockContext();
  const commands = new FlowCommands(ctx as any);
  (commands as any).flowValidator.validateFlow = () => ({ valid: true, warnings: [] });

  let out = "";
  const origLog = console.log;
  console.log = (msg: string) => {
    out += msg + "\n";
  };
  try {
    await commands.validateFlow("whatever", { json: true });
  } finally {
    console.log = origLog;
  }
  if (!out.includes('"valid": true')) throw new Error("Expected JSON output with valid:true");

  // Now test validator throws and we exit
  (commands as any).flowValidator.validateFlow = () => {
    throw new Error("uh-oh");
  };
  let errOut = "";
  const origErr2 = console.error;
  console.error = (...args: any[]) => {
    errOut += args.join(" ") + "\n";
  };
  const origExit = (Deno as any).exit;
  (Deno as any).exit = (_c?: number) => {
    throw new Error("DENO_EXIT");
  };

  try {
    let threw = false;
    try {
      await commands.validateFlow("bad");
    } catch (_e) {
      threw = true;
      if (!errOut.includes("Error validating flow: uh-oh")) throw new Error(`Unexpected err log: ${errOut}`);
    }
    if (!threw) throw new Error("Expected Deno.exit to be called");
  } finally {
    console.error = origErr2;
    (Deno as any).exit = origExit;
  }
});

Deno.test("FlowCommands: validateFlow prints invalid and exits", async () => {
  const ctx = await createMockContext();
  const commands = new FlowCommands(ctx as any);
  (commands as any).flowValidator.validateFlow = () => ({ valid: false, error: "problem" });
  const originalExit = (Deno as any).exit;
  (Deno as any).exit = (_c?: number) => {
    throw new Error("EXIT");
  };
  try {
    let caught = false;
    try {
      await commands.validateFlow("bad");
    } catch (e) {
      caught = true;
      assertStringIncludes((e as Error).message, "EXIT");
    }
    assertEquals(caught, true);
  } finally {
    (Deno as any).exit = originalExit;
  }
});

Deno.test("FlowCommands: renderDependencyGraph shows arrows for dependencies", () => {
  const commands = new FlowCommands({ config: { system: { root: "" }, paths: defaultContextPaths } } as any);
  const flow = { steps: [{ id: "a", agent: "A", dependsOn: [] }, { id: "b", agent: "B", dependsOn: ["a"] }] } as any;
  const graph = (commands as any).renderDependencyGraph(flow);
  assertStringIncludes(graph, "a (A)");
  assertStringIncludes(graph, "b (B)");
  assertStringIncludes(graph, "← a");
});
