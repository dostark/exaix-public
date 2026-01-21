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
