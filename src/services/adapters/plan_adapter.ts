/**
 * @module PlanAdapter
 * @path src/services/adapters/plan_adapter.ts
 * @description Module for PlanAdapter.
 * @architectural-layer Services
 * @dependencies [IPlanService, PlanCommands]
 * @related-files [src/cli/commands/plan_commands.ts, src/shared/interfaces/i_plan_service.ts]
 */

import { PlanCommands } from "../../cli/commands/plan_commands.ts";
import { IPlanService } from "../../shared/interfaces/i_plan_service.ts";
import { IPlanDetails, IPlanMetadata } from "../../shared/types/plan.ts";
import { PlanStatus, type PlanStatusType } from "../../shared/status/plan_status.ts";

export class PlanServiceAdapter implements IPlanService {
  constructor(private commands: PlanCommands) {}

  async approve(planId: string, _reviewer?: string, skills?: string[]): Promise<boolean> {
    try {
      await this.commands.approve(planId, skills);
      return true;
    } catch {
      return false;
    }
  }

  async reject(planId: string, _reviewer?: string, reason?: string): Promise<boolean> {
    try {
      await this.commands.reject(planId, reason || "Rejected via TUI");
      return true;
    } catch {
      return false;
    }
  }

  async revise(planId: string, comments: string[]): Promise<void> {
    await this.commands.revise(planId, comments);
  }

  async list(statusFilter?: PlanStatusType): Promise<IPlanMetadata[]> {
    return await this.commands.list(statusFilter);
  }

  async listPending(): Promise<IPlanMetadata[]> {
    return await this.list(PlanStatus.REVIEW);
  }

  async show(planId: string): Promise<IPlanDetails> {
    return await this.commands.show(planId);
  }

  async getDiff(planId: string): Promise<string> {
    // In a real implementation, this would generate a diff from the plan's proposed changes
    const details = await this.show(planId);
    return `Diff for plan ${planId}:\n\n${details.content}`;
  }
}
