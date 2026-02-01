import {
  calculateComplexityFromText,
  complexityForNode,
  computeFileComplexityMetrics,
  traverse,
} from "../../scripts/measure_complexity.ts";
import { traverseWithAncestors } from "../../scripts/measure_complexity.ts";

Deno.test("calculateComplexityFromText counts tokens correctly", () => {
  const code = `if (x) { } else { } for(;;) {} x && y || z ? a : b`;
  const c = calculateComplexityFromText(code);
  // Tokens: if, else, for, &&, ||, ? => 6 matches + base 1 = 7
  if (c !== 7) throw new Error(`expected 7, got ${c}`);
});

Deno.test("complexityForNode counts AST nodes correctly", () => {
  const fnNode = {
    type: "FunctionDeclaration",
    id: { name: "test" },
    loc: { start: { line: 1 } },
    body: {
      type: "BlockStatement",
      body: [
        { type: "IfStatement", test: {}, consequent: { type: "BlockStatement", body: [] }, alternate: null },
        { type: "ForStatement", init: null, test: null, update: null, body: { type: "BlockStatement", body: [] } },
        { type: "LogicalExpression", operator: "||", left: {}, right: {} },
        { type: "ConditionalExpression", test: {}, consequent: {}, alternate: {} },
        { type: "CatchClause" },
        { type: "SwitchCase", test: {} },
      ],
    },
  } as any;

  const c = complexityForNode(fnNode as any);
  // base 1 + If + For + LogicalExpression + Conditional + Catch + SwitchCase = 7
  if (c !== 7) throw new Error(`expected 7, got ${c}`);
});

Deno.test("traverse visits nodes and parent is passed", () => {
  const root = { type: "Root", child: { type: "Child", sub: { type: "Leaf" } } } as any;
  const types: string[] = [];
  traverse(root, (n, parent) => {
    if (n && n.type) types.push(n.type);
    // parent should be undefined for root
    if (n.type === "Root" && parent) throw new Error("root should have no parent");
  });
  if (types.join(",") !== "Root,Child,Leaf") throw new Error(`unexpected traversal order: ${types.join(",")}`);
  // verify traverseWithAncestors provides chain
  const ancList: string[] = [];
  traverseWithAncestors(root, (n, ancestors) => {
    ancList.push(`${n.type}:${ancestors.map((a) => a.type).join("/")}`);
  });
  const expected = ["Root:", "Child:Root", "Leaf:Root/Child"];
  if (ancList.join(",") !== expected.join(",")) throw new Error(`ancestors mismatch: ${ancList.join(",")}`);
});

Deno.test("[regression] computeFileComplexityMetrics uses max for file threshold", () => {
  // Root cause: summing per-function complexity made nearly every file exceed a low threshold.
  // Fix: represent file-level complexity as the max of (max function, top-level), while still exposing a sum.
  const metrics = computeFileComplexityMetrics([2, 5, 3], 4);
  if (metrics.maxFnComplexity !== 5) throw new Error(`expected maxFnComplexity=5, got ${metrics.maxFnComplexity}`);
  if (metrics.fileComplexity !== 5) throw new Error(`expected fileComplexity=5, got ${metrics.fileComplexity}`);
  if (metrics.fileComplexitySum !== 14) {
    throw new Error(`expected fileComplexitySum=14, got ${metrics.fileComplexitySum}`);
  }
});
