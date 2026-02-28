/**
 * @module IskillsService
 * @path src/shared/interfaces/i_skills_service.ts
 * @description Module for IskillsService.
 * @architectural-layer Shared
 * @dependencies [Enums, SkillTypes]
 * @related-files [src/shared/types/skill.ts]
 */

import type { ISkill, ISkillMatch } from "../schemas/memory_bank.ts";
import type { ISkillMatchRequest } from "../types/skill.ts";

export interface ISkillsService {
  /**
   * Match skills based on request context.
   */
  matchSkills(request: ISkillMatchRequest): Promise<ISkillMatch[]>;

  /**
   * Build combined skill context for prompt injection.
   */
  buildSkillContext(skillIds: string[]): Promise<string>;

  /**
   * Record that a skill was successfully used.
   */
  recordSkillUsage(skillId: string): Promise<void>;

  /**
   * Derive a new skill from one or more learning entries.
   */
  deriveSkillFromLearnings(
    learningIds: string[],
    skillDef: Omit<ISkill, "id" | "created_at" | "usage_count">,
  ): Promise<ISkill>;

  /**
   * Rebuild the skill index by scanning the filesystem.
   */
  rebuildIndex(): Promise<void>;

  /**
   * List all skills, optionally filtered by source or status.
   */
  listSkills(filter?: { source?: string; status?: string }): Promise<ISkill[]>;

  /**
   * Get a specific skill by ID.
   */
  getSkill(skillId: string): Promise<ISkill | null>;

  /**
   * Delete a skill.
   */
  deleteSkill(skillId: string): Promise<boolean>;
}
