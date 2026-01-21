import { assertEquals } from "@std/assert";
import { PlanAdapter } from "../src/services/plan_adapter.ts";

Deno.test("repro: Plan validation fails for unsupported tool names", () => {
  const adapter = new PlanAdapter();
  const invalidPlanJson = `
  {
    "title": "Invalid Plan",
    "description": "A plan with an invalid tool",
    "steps": [
      {
        "step": 1,
        "title": "Create directory",
        "description": "Creating a directory",
        "actions": [
          {
            "tool": "create_directory",
            "params": { "path": "src" }
          }
        ]
      }
    ]
  }
  `;

  const plan = adapter.parse(invalidPlanJson);
  // Should verify the plan has the correct action
  if (!plan.steps[0].actions?.[0]) throw new Error("Missing action");
  if (plan.steps[0].actions[0].tool !== "create_directory") throw new Error("Wrong tool");
});

Deno.test("repro: Plan validation handles markdown code blocks", () => {
  const validPlanJson = JSON.stringify({
    title: "Create src/utils.ts with hello world function",
    description: "Creates a src directory and a utils.ts file containing a hello world function.",
    steps: [
      {
        step: 1,
        title: "Create directory and file",
        description: "Create src directory and utils.ts",
        actions: [
          {
            tool: "create_directory",
            params: { path: "src" },
          },
        ],
      },
    ],
  });

  const markdownJson = `\`\`\`json
${validPlanJson}
\`\`\``;
  const adapter = new PlanAdapter();
  const plan = adapter.parse(markdownJson);
  assertEquals(plan.title, "Create src/utils.ts with hello world function");
});
