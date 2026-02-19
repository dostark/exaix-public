/**
 * @module FlowCommands
 * @path src/cli/commands/flow_commands.ts
 * @description Provides CLI commands for flow management and execution, including list, show, run, plan, history, and validation.
 * @architectural-layer CLI
 * @dependencies [table, path, flow_loader, flow_validator, event_logger, config, db, providers]
 * @related-files [src/flows/flow_loader.ts, src/cli/main.ts]
 */

import { Table } from "@cliffy/table";
import { join } from "@std/path";
import { FlowLoader } from "../../flows/flow_loader.ts";
import { FlowValidatorImpl } from "../../services/flow_validator.ts";
import { EventLogger } from "../../services/event_logger.ts";
import type { Config } from "../../config/schema.ts";
import type { IDatabaseService } from "../../services/db.ts";
import type { IModelProvider } from "../../ai/providers.ts";
import type { Flow } from "../../schemas/flow.ts";

interface FlowListOptions {
  json?: boolean;
}

interface FlowShowOptions {
  json?: boolean;
}

interface FlowValidateOptions {
  json?: boolean;
}

interface CLIContext {
  config: Config;
  db: IDatabaseService;
  provider: IModelProvider;
}

export class FlowCommands {
  private flowLoader: FlowLoader;
  private flowValidator: FlowValidatorImpl;
  private eventLogger: EventLogger;

  constructor(private context: CLIContext) {
    const flowsDir = join(context.config.system.root, context.config.paths.blueprints, context.config.paths.flows);
    this.flowLoader = new FlowLoader(flowsDir);
    this.flowValidator = new FlowValidatorImpl(
      this.flowLoader,
      flowsDir,
    );
    this.eventLogger = new EventLogger({
      db: context.db,
      defaultActor: "cli",
    });
  }

  async listFlows(options: FlowListOptions = {}) {
    try {
      const flows = await this.flowLoader.loadAllFlows();

      if (options.json) {
        console.log(JSON.stringify(
          flows.map((flow) => ({
            id: flow.id,
            name: flow.name,
            description: flow.description,
            version: flow.version,
            steps: flow.steps.length,
          })),
          null,
          2,
        ));
        return;
      }

      if (flows.length === 0) {
        console.log("No flows found");
        return;
      }

      const table = new Table()
        .header(["ID", "Name", "Version", "Steps", "Description"])
        .border(true);

      for (const flow of flows) {
        table.push([
          flow.id,
          flow.name,
          flow.version,
          flow.steps.length.toString(),
          flow.description,
        ]);
      }

      table.render();
    } catch (error) {
      console.error("Error listing flows:", error instanceof Error ? error.message : String(error));
      Deno.exit(1);
    }
  }

  async showFlow(flowId: string, options: FlowShowOptions = {}) {
    try {
      const flow = await this.flowLoader.loadFlow(flowId);

      if (options.json) {
        console.log(JSON.stringify(flow, null, 2));
        return;
      }

      console.log(`Flow: ${flow.name} (${flow.id})`);
      console.log(`Version: ${flow.version}`);
      console.log(`Description: ${flow.description}`);
      console.log();

      // Display dependency graph
      console.log("Dependency Graph:");
      const graph = this.renderDependencyGraph(flow);
      console.log(graph);
      console.log();

      // Display steps table
      const stepsTable = new Table()
        .header(["ID", "Agent", "Dependencies", "Description"])
        .border(true);

      for (const step of flow.steps) {
        stepsTable.push([
          step.id,
          step.agent,
          step.dependsOn.length > 0 ? step.dependsOn.join(", ") : "None",
          step.name,
        ]);
      }

      stepsTable.render();

      // Display flow settings
      console.log();
      console.log("Settings:");
      console.log(`  Max Parallelism: ${flow.settings?.maxParallelism || "unlimited"}`);
      console.log(`  Fail Fast: ${flow.settings?.failFast !== false}`);
      console.log(`  Output Format: ${flow.output?.format || "markdown"}`);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.error(`Flow '${flowId}' not found`);
      } else {
        console.error("Error showing flow:", error instanceof Error ? error.message : String(error));
      }
      Deno.exit(1);
    }
  }

  async validateFlow(flowId: string, options: FlowValidateOptions = {}) {
    try {
      const validation = await this.flowValidator.validateFlow(flowId);

      if (options.json) {
        console.log(JSON.stringify(validation, null, 2));
        return;
      }

      if (validation.valid) {
        console.log(`✅ Flow '${flowId}' is valid`);
      } else {
        console.log(`❌ Flow '${flowId}' validation failed:`);
        console.log(validation.error);
        Deno.exit(1);
      }
    } catch (error) {
      console.error("Error validating flow:", error instanceof Error ? error.message : String(error));
      Deno.exit(1);
    }
  }

  private renderDependencyGraph(flow: Flow): string {
    // Simple text-based dependency graph
    const lines: string[] = [];
    for (const step of flow.steps) {
      lines.push(`${step.id} (${step.agent})`);
      if (step.dependsOn.length > 0) {
        lines.push(`  ← ${step.dependsOn.join(", ")}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }
}
