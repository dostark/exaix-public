import { stringify } from "jsr:@std/yaml";
import { join } from "jsr:@std/path";

const flowsDirs = [
  "Blueprints/Flows",
  "Blueprints/Flows/templates",
  "Blueprints/Flows/examples/operations",
  "Blueprints/Flows/examples/development",
  "Blueprints/Flows/examples/analysis",
  "Blueprints/Flows/examples/content"
];

for (const dir of flowsDirs) {
  for await (const entry of Deno.readDir(dir)) {
    if (entry.isFile && (entry.name.endsWith(".flow.ts") || entry.name.endsWith(".flow.template.ts"))) {
      const tsPath = join(dir, entry.name);
      const yamlPath = tsPath.replace(".ts", ".yaml");

      try {
        const fileUrl = `file://${Deno.cwd()}/${tsPath}`;
        // Import the module dynamically
        const mod = await import(fileUrl);
        const flowDef = mod.default;

        if (!flowDef) {
          console.warn(`No default export in ${tsPath}`);
          continue;
        }

        // Convert enums to string values
        // Note: Deno's JSON.stringify handles enums by putting their string/int value
        // The IFlow object evaluates enums natively.

        // Remove 'version' if it's identical to schema default, or keep it, doesn't matter

        // Strip undefined values which cause @std/yaml to throw
        const cleanedDef = JSON.parse(JSON.stringify(flowDef));

        const yamlStr = stringify(cleanedDef);

        await Deno.writeTextFile(yamlPath, yamlStr);
        await Deno.remove(tsPath);
        console.log(`Converted: ${tsPath} -> ${yamlPath}`);
      } catch (err) {
        console.error(`Error converting ${tsPath}:`, err);
      }
    }
  }
}
