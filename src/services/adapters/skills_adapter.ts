/**
 * @module SkillsAdapter
 * @path src/services/adapters/skills_adapter.ts
 * @description Adapter for SkillsService that satisfies the ISkillsService interface.
 * @architectural-layer Services/Adapters
 * @dependencies [shared_interfaces, skills_service]
 * @related-files [src/shared/interfaces/i_skills_service.ts, src/services/skills.ts] */

import type { ISkillsService } from "../../shared/interfaces/i_skills_service.ts";
import type { SkillsService } from "../skills.ts";
import type { ISkill, ISkillMatch } from "../../shared/schemas/memory_bank.ts";
import type { ISkillMatchRequest } from "../../shared/types/skill.ts";

export class SkillsAdapter implements ISkillsService {
  constructor(private inner: SkillsService) {}

  async initialize(): Promise<void> {
    return await this.inner.initialize();
  }

  async matchSkills(request: ISkillMatchRequest): Promise<ISkillMatch[]> {
    return await this.inner.matchSkills(request);
  }

  async buildSkillContext(skillIds: string[]): Promise<string> {
    return await this.inner.buildSkillContext(skillIds);
  }

  async recordSkillUsage(skillId: string): Promise<void> {
    return await this.inner.recordSkillUsage(skillId);
  }

  async deriveSkillFromLearnings(
    learningIds: string[],
    skillDef: Omit<ISkill, "id" | "created_at" | "usage_count">,
  ): Promise<ISkill> {
    return await this.inner.deriveSkillFromLearnings(learningIds, skillDef);
  }

  async createSkill(skillDef: Omit<ISkill, "id" | "created_at" | "usage_count">): Promise<ISkill> {
    return await this.inner.createSkill(skillDef);
  }

  async rebuildIndex(): Promise<void> {
    return await this.inner.rebuildIndex();
  }

  async listSkills(filter?: { source?: string; status?: string }): Promise<ISkill[]> {
    return await this.inner.listSkills(filter as any);
  }

  async getSkill(skillId: string): Promise<ISkill | null> {
    return await this.inner.getSkill(skillId);
  }

  async deleteSkill(skillId: string): Promise<boolean> {
    return await this.inner.deleteSkill(skillId);
  }
}
