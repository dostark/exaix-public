/**
 * @module SkillsService
 * @path src/services/skills.ts
 * @description Manages procedural memory (skills).
 *
 * Skills encode domain expertise, procedures, and best practices as reusable
 * instruction modules, providing storage, retrieval, and trigger-based matching.
 *
 * @architectural-layer Services
 * @dependencies [Config, DatabaseService, Zod]
 * @related-files [src/services/context_loader.ts, src/schemas/memory_bank.ts]
 */

import { join } from "@std/path";
import { ensureDir, exists } from "@std/fs";
import { parse as parseYaml, stringify as stringifyYaml } from "@std/yaml";
import type { Config } from "../config/schema.ts";
import type { IDatabaseService } from "./db.ts";
import { MemoryScope, MemorySource, SkillStatus } from "../enums.ts";
import { extractKeywords } from "../helpers/text.ts";
import {
  type Skill,
  type SkillIndex,
  type SkillIndexEntry,
  SkillIndexSchema,
  type SkillMatch,
  SkillSchema,
  type SkillTriggers,
} from "../schemas/memory_bank.ts";
import { type JsonValue, toSafeJson } from "../flows/transforms.ts";

/**
 * Skills Service Configuration
 */
export interface SkillsConfig {
  /** Enable automatic skill matching */
  autoMatch: boolean;
  /** Maximum skills to inject per request */
  maxSkillsPerRequest: number;
  /** Token budget for skill context */
  skillContextBudget: number;
  /** Confidence threshold for trigger matching */
  matchThreshold: number;
}

const DEFAULT_CONFIG: SkillsConfig = {
  autoMatch: true,
  maxSkillsPerRequest: 5,
  skillContextBudget: 2000,
  matchThreshold: 0.3,
};

/**
 * Request context for skill matching
 */
export interface SkillMatchRequest {
  /** Keywords from the request */
  keywords?: string[];
  /** Detected task type */
  taskType?: string;
  /** File paths involved */
  filePaths?: string[];
  /** Request tags */
  tags?: string[];
  /** Raw request text for keyword extraction */
  requestText?: string;
  /** Agent ID for compatibility filtering */
  agentId?: string;
}

/**
 * Skills Service
 *
 * Provides skill management and matching capabilities:
 * - CRUD operations for skills
 * - Trigger-based skill matching
 * - Skill context building for prompt injection
 * - Learning-to-skill derivation
 */
export class SkillsService {
  private blueprintsSkillsDir: string;
  private indexPath: string;
  private skillsConfig: SkillsConfig;
  private indexCache: SkillIndex | null = null;

  constructor(
    private config: Config,
    private db: IDatabaseService,
    skillsConfig?: Partial<SkillsConfig>,
  ) {
    this.blueprintsSkillsDir = join(config.system.root, config.paths.memory, "Skills");
    this.indexPath = join(this.blueprintsSkillsDir, "index.json");
    this.skillsConfig = { ...DEFAULT_CONFIG, ...skillsConfig };
  }

  /**
   * Initialize skills directory structure
   */
  async initialize(): Promise<void> {
    await ensureDir(this.blueprintsSkillsDir);
    await ensureDir(join(this.blueprintsSkillsDir, "core"));
    await ensureDir(join(this.blueprintsSkillsDir, "learned"));
    await ensureDir(join(this.blueprintsSkillsDir, "project"));

    // Initialize index if missing
    if (!(await exists(this.indexPath))) {
      const emptyIndex: SkillIndex = {
        version: "1.0.0",
        skills: [],
        updated_at: new Date().toISOString(),
      };
      await Deno.writeTextFile(this.indexPath, JSON.stringify(emptyIndex, null, 2));
    }
  }

  // ===== Skill CRUD Operations =====

  /**
   * Get a skill by ID
   */
  async getSkill(skillId: string): Promise<Skill | null> {
    const index = await this.loadIndex();
    const entry = index.skills.find((s) => s.skill_id === skillId);

    if (entry) {
      return this.loadSkillFromFile(entry.path);
    }

    // Fallback: scan filesystem directly for backward compatibility
    const skill = await this.findSkillOnFilesystem(skillId);
    return skill;
  }

  /**
   * List all skills with optional filtering
   */
  async listSkills(filter?: {
    status?: SkillStatus;
    scope?: "global" | "project";
    source?: "core" | "project" | "user" | "learned";
  }): Promise<Skill[]> {
    const index = await this.loadIndex();
    const skills: Skill[] = [];

    for (const entry of index.skills) {
      const skill = await this.loadSkillFromFile(entry.path);
      if (!skill) continue;

      // Apply filters
      if (filter?.status && skill.status !== filter.status) continue;
      if (filter?.scope && skill.scope !== filter.scope) continue;
      if (filter?.source && skill.source !== filter.source) continue;

      skills.push(skill);
    }

    return skills;
  }

  /**
   * Create a new skill
   */
  async createSkill(
    skill: Omit<Skill, "id" | "created_at" | "usage_count">,
  ): Promise<Skill> {
    const fullSkill: Skill = {
      ...skill,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      usage_count: 0,
    };

    // Validate skill
    const result = SkillSchema.safeParse(fullSkill);
    if (!result.success) {
      throw new Error(`Invalid skill: ${result.error.message}`);
    }

    // Write skill file
    const skillPath = join(this.blueprintsSkillsDir, `${fullSkill.skill_id}.skill.md`);
    await this.writeSkillToFile(fullSkill, skillPath);

    // Update index
    await this.addToIndex(fullSkill, skillPath);

    this.logActivity({
      event_type: "skill.created",
      target: fullSkill.skill_id,
      metadata: {
        location: "blueprints",
        scope: fullSkill.scope,
        source: fullSkill.source,
      },
    });

    return fullSkill;
  }

  /**
   * Update an existing skill
   */
  async updateSkill(
    skillId: string,
    updates: Partial<Omit<Skill, "id" | "skill_id" | "created_at">>,
  ): Promise<Skill | null> {
    const index = await this.loadIndex();
    const entry = index.skills.find((s) => s.skill_id === skillId);

    if (!entry) {
      return null;
    }

    const skill = await this.loadSkillFromFile(entry.path);
    if (!skill) {
      return null;
    }

    const updatedSkill: Skill = {
      ...skill,
      ...updates,
    };

    // Validate
    const result = SkillSchema.safeParse(updatedSkill);
    if (!result.success) {
      throw new Error(`Invalid skill update: ${result.error.message}`);
    }

    // Write updated skill
    await this.writeSkillToFile(updatedSkill, entry.path);

    // Update index
    await this.updateIndexEntry(updatedSkill, entry.path);

    this.logActivity({
      event_type: "skill.updated",
      target: skillId,
      metadata: {
        updated_fields: Object.keys(updates),
      },
    });

    return updatedSkill;
  }

  /**
   * Activate a draft skill
   */
  async activateSkill(skillId: string): Promise<boolean> {
    const result = await this.updateSkill(skillId, { status: SkillStatus.ACTIVE });
    return result !== null;
  }

  /**
   * Deprecate an active skill
   */
  async deprecateSkill(skillId: string): Promise<boolean> {
    const result = await this.updateSkill(skillId, { status: SkillStatus.DEPRECATED });
    return result !== null;
  }

  // ===== Skill Matching =====

  /**
   * Match skills based on request context
   */
  async matchSkills(request: SkillMatchRequest): Promise<SkillMatch[]> {
    const skills = await this.listSkills({ status: SkillStatus.ACTIVE });
    const matches: SkillMatch[] = [];

    // Extract keywords from request text if provided
    let keywords = request.keywords || [];
    if (request.requestText) {
      keywords = [...keywords, ...this.extractKeywords(request.requestText)];
    }

    for (const skill of skills) {
      // Check agent compatibility
      if (request.agentId && skill.compatible_with?.agents) {
        if (!skill.compatible_with.agents.includes(request.agentId)) {
          continue;
        }
      }

      const { confidence, matchedTriggers } = this.calculateTriggerMatch(
        skill.triggers,
        { ...request, keywords },
      );

      if (confidence >= this.skillsConfig.matchThreshold) {
        matches.push({
          skillId: skill.skill_id,
          confidence,
          matchedTriggers,
        });
      }
    }

    // Sort by confidence and limit
    matches.sort((a, b) => b.confidence - a.confidence);
    return matches.slice(0, this.skillsConfig.maxSkillsPerRequest);
  }

  /**
   * Calculate trigger match score
   */
  private calculateTriggerMatch(
    triggers: SkillTriggers,
    request: SkillMatchRequest,
  ): { confidence: number; matchedTriggers: Partial<SkillTriggers> } {
    const matchedTriggers: Partial<SkillTriggers> = {};
    let totalScore = 0;
    let maxScore = 0;

    const keywordMatch = this.scoreKeywordTriggers(triggers.keywords, request.keywords);
    maxScore += keywordMatch.max;
    totalScore += keywordMatch.score;
    if (keywordMatch.matched && keywordMatch.matched.length > 0) {
      matchedTriggers.keywords = keywordMatch.matched;
    }

    const taskTypeMatch = this.scoreTaskTypeTriggers(triggers.task_types, request.taskType);
    maxScore += taskTypeMatch.max;
    totalScore += taskTypeMatch.score;
    if (taskTypeMatch.matched && taskTypeMatch.matched.length > 0) {
      matchedTriggers.task_types = taskTypeMatch.matched;
    }

    const filePatternMatch = this.scoreFilePatternTriggers(triggers.file_patterns, request.filePaths);
    maxScore += filePatternMatch.max;
    totalScore += filePatternMatch.score;
    if (filePatternMatch.matched && filePatternMatch.matched.length > 0) {
      matchedTriggers.file_patterns = filePatternMatch.matched;
    }

    const tagMatch = this.scoreTagTriggers(triggers.tags, request.tags);
    maxScore += tagMatch.max;
    totalScore += tagMatch.score;
    if (tagMatch.matched && tagMatch.matched.length > 0) {
      matchedTriggers.tags = tagMatch.matched;
    }

    // Normalize score to 0-1
    const confidence = maxScore > 0 ? totalScore / maxScore : 0;

    return { confidence, matchedTriggers };
  }

  private scoreKeywordTriggers(
    triggerKeywords: string[] | undefined,
    requestKeywords: string[] | undefined,
  ): { max: number; score: number; matched?: string[] } {
    if (!triggerKeywords || triggerKeywords.length === 0) return { max: 0, score: 0 };
    const candidates = requestKeywords ?? [];
    if (candidates.length === 0) return { max: 40, score: 0 };

    const triggerLower = triggerKeywords.map((k) => k.toLowerCase());
    const requestLower = candidates.map((k) => k.toLowerCase());

    const matched: string[] = [];
    for (let i = 0; i < triggerKeywords.length; i++) {
      const t = triggerKeywords[i];
      const tl = triggerLower[i];
      let found = false;
      for (const rk of requestLower) {
        if (rk.includes(tl)) {
          found = true;
          break;
        }
        if (tl.includes(rk)) {
          found = true;
          break;
        }
      }
      if (found) matched.push(t);
    }

    if (matched.length === 0) return { max: 40, score: 0 };
    return { max: 40, score: (matched.length / triggerKeywords.length) * 40, matched };
  }

  private scoreTaskTypeTriggers(
    triggerTaskTypes: string[] | undefined,
    requestTaskType: string | undefined,
  ): { max: number; score: number; matched?: string[] } {
    if (!triggerTaskTypes || triggerTaskTypes.length === 0) return { max: 0, score: 0 };
    if (!requestTaskType) return { max: 30, score: 0 };
    if (!triggerTaskTypes.includes(requestTaskType)) return { max: 30, score: 0 };
    return { max: 30, score: 30, matched: [requestTaskType] };
  }

  private scoreFilePatternTriggers(
    triggerPatterns: string[] | undefined,
    requestFilePaths: string[] | undefined,
  ): { max: number; score: number; matched?: string[] } {
    if (!triggerPatterns || triggerPatterns.length === 0) return { max: 0, score: 0 };
    const paths = requestFilePaths ?? [];
    if (paths.length === 0) return { max: 20, score: 0 };

    const matched: string[] = [];
    for (const pattern of triggerPatterns) {
      let found = false;
      for (const fp of paths) {
        if (this.matchGlob(fp, pattern)) {
          found = true;
          break;
        }
      }
      if (found) matched.push(pattern);
    }

    if (matched.length === 0) return { max: 20, score: 0 };
    return { max: 20, score: (matched.length / triggerPatterns.length) * 20, matched };
  }

  private scoreTagTriggers(
    triggerTags: string[] | undefined,
    requestTags: string[] | undefined,
  ): { max: number; score: number; matched?: string[] } {
    if (!triggerTags || triggerTags.length === 0) return { max: 0, score: 0 };
    const tags = requestTags ?? [];
    if (tags.length === 0) return { max: 10, score: 0 };

    const matched = triggerTags.filter((tag) => tags.includes(tag));
    if (matched.length === 0) return { max: 10, score: 0 };
    return { max: 10, score: (matched.length / triggerTags.length) * 10, matched };
  }

  /**
   * Simple glob pattern matching
   */
  private matchGlob(path: string, pattern: string): boolean {
    // Convert glob to regex
    const regex = pattern
      .replace(/\*\*/g, "GLOBSTAR")
      .replace(/\*/g, "[^/]*")
      .replace(/GLOBSTAR/g, ".*")
      .replace(/\?/g, ".");

    try {
      return new RegExp(`^${regex}$`).test(path);
    } catch {
      return false;
    }
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    return extractKeywords(text);
  }

  // ===== Skill Context Building =====

  /**
   * Build skill context for prompt injection
   */
  async buildSkillContext(skillIds: string[]): Promise<string> {
    const skills: Skill[] = [];

    for (const skillId of skillIds) {
      const skill = await this.getSkill(skillId);
      if (skill) {
        skills.push(skill);
      }
    }

    if (skills.length === 0) {
      return "";
    }

    return this.formatSkillsForPrompt(skills);
  }

  /**
   * Format skills as markdown for prompt injection
   */
  private formatSkillsForPrompt(skills: Skill[]): string {
    const parts: string[] = [];

    parts.push("## Applied Skills");
    parts.push("");
    parts.push("The following skills have been automatically matched for this task:");
    parts.push("");

    for (const skill of skills) {
      parts.push(`### ${skill.name} (v${skill.version})`);
      parts.push("");
      parts.push(`> ${skill.description}`);
      parts.push("");
      parts.push("**Instructions:**");
      parts.push("");
      parts.push(skill.instructions);
      parts.push("");

      if (skill.constraints && skill.constraints.length > 0) {
        parts.push("**Constraints:**");
        for (const constraint of skill.constraints) {
          parts.push(`- ${constraint}`);
        }
        parts.push("");
      }

      if (skill.quality_criteria && skill.quality_criteria.length > 0) {
        parts.push("**Quality Criteria:**");
        for (const criterion of skill.quality_criteria) {
          parts.push(`- ${criterion.name}: ${criterion.description || ""}`);
        }
        parts.push("");
      }

      parts.push("---");
      parts.push("");
    }

    return parts.join("\n");
  }

  /**
   * Track skill usage
   */
  async recordSkillUsage(skillId: string): Promise<void> {
    const skill = await this.getSkill(skillId);
    if (skill) {
      await this.updateSkill(skillId, {
        usage_count: skill.usage_count + 1,
      });
    }
  }

  // ===== Learning-to-Skill Pipeline =====

  /**
   * Derive a skill from learnings
   */
  async deriveSkillFromLearnings(
    learningIds: string[],
    skillDraft: Omit<Skill, "id" | "created_at" | "usage_count" | "source" | "derived_from">,
  ): Promise<Skill> {
    const skill = await this.createSkill(
      {
        ...skillDraft,
        source: MemorySource.LEARNED,
        derived_from: learningIds,
        status: SkillStatus.DRAFT, // Always starts as draft
      },
    );

    this.logActivity({
      event_type: "skill.derived",
      target: skill.skill_id,
      metadata: {
        learning_ids: learningIds,
      },
    });

    return skill;
  }

  // ===== Index Management =====

  /**
   * Load the skill index
   */
  private async loadIndex(): Promise<SkillIndex> {
    if (this.indexCache) {
      return this.indexCache;
    }

    try {
      const content = await Deno.readTextFile(this.indexPath);
      const parsed = JSON.parse(content);
      const result = SkillIndexSchema.safeParse(parsed);

      if (!result.success) {
        console.warn("[SkillsService] Invalid index, creating new one");
        return this.createEmptyIndex();
      }

      this.indexCache = result.data;
      return result.data;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return this.createEmptyIndex();
      }
      throw error;
    }
  }

  /**
   * Create empty index
   */
  private createEmptyIndex(): SkillIndex {
    return {
      version: "1.0.0",
      skills: [],
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Save the skill index
   */
  private async saveIndex(index: SkillIndex): Promise<void> {
    index.updated_at = new Date().toISOString();
    await Deno.writeTextFile(this.indexPath, JSON.stringify(index, null, 2));
    this.indexCache = index;
  }

  /**
   * Add skill to index
   */
  private async addToIndex(skill: Skill, path: string): Promise<void> {
    const index = await this.loadIndex();

    const entry: SkillIndexEntry = {
      skill_id: skill.skill_id,
      name: skill.name,
      version: skill.version,
      status: skill.status,
      scope: skill.scope,
      project: skill.project,
      path: path,
      triggers: skill.triggers,
    };

    // Remove existing entry if present
    index.skills = index.skills.filter((s) => s.skill_id !== skill.skill_id);
    index.skills.push(entry);

    await this.saveIndex(index);
  }

  /**
   * Update index entry
   */
  private async updateIndexEntry(skill: Skill, path: string): Promise<void> {
    await this.addToIndex(skill, path);
  }

  /**
   * Rebuild the entire index by scanning directories
   */
  async rebuildIndex(): Promise<void> {
    const index: SkillIndex = this.createEmptyIndex();

    // Scan blueprints skills directory
    if (await exists(this.blueprintsSkillsDir)) {
      for await (const entry of Deno.readDir(this.blueprintsSkillsDir)) {
        if (entry.isFile && entry.name.endsWith(".skill.md")) {
          const skillPath = join(this.blueprintsSkillsDir, entry.name);
          const skill = await this.loadSkillFromFile(skillPath);

          if (skill) {
            const indexEntry: SkillIndexEntry = {
              skill_id: skill.skill_id,
              name: skill.name,
              version: skill.version,
              status: skill.status,
              scope: skill.scope,
              project: skill.project,
              path: skillPath,
              triggers: skill.triggers,
            };
            index.skills.push(indexEntry);
          }
        }
      }
    }

    await this.saveIndex(index);

    this.logActivity({
      event_type: "skill.index_rebuilt",
      target: "index.json",
      metadata: {
        skill_count: index.skills.length,
      },
    });
  }

  /**
   * Find skill on filesystem (fallback for backward compatibility)
   * Scans lower priority locations first, then higher priority (blueprints last)
   */
  private async findSkillOnFilesystem(skillId: string): Promise<Skill | null> {
    if (!(await exists(this.blueprintsSkillsDir))) return null;

    for await (const entry of Deno.readDir(this.blueprintsSkillsDir)) {
      if (entry.isFile && entry.name.endsWith(".skill.md")) {
        const skillPath = join(this.blueprintsSkillsDir, entry.name);
        const skill = await this.loadSkillFromFile(skillPath);

        if (skill && skill.skill_id === skillId) {
          return skill;
        }
      }
    }

    return null;
  }

  // ===== File Operations =====

  /**
   * Load skill from markdown file with YAML frontmatter
   */
  private async loadSkillFromFile(path: string): Promise<Skill | null> {
    try {
      const content = await Deno.readTextFile(path);
      return this.parseSkillFile(content);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return null;
      }
      console.error(`[SkillsService] Error loading skill from ${path}:`, error);
      return null;
    }
  }

  /**
   * Parse skill file content (YAML frontmatter + markdown body)
   */
  private parseSkillFile(content: string): Skill | null {
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      return null;
    }

    try {
      const frontmatter = parseYaml(frontmatterMatch[1]) as Record<string, unknown>;
      const body = frontmatterMatch[2].trim();

      // Map source values (core/project maps to user for schema compatibility)
      let source = frontmatter.source as string;
      if (source === "core" || source === "project") {
        source = MemorySource.USER;
      }

      // Build skill object
      const skill: Skill = {
        id: frontmatter.id as string,
        skill_id: frontmatter.skill_id as string,
        name: frontmatter.name as string,
        version: frontmatter.version as string,
        description: frontmatter.description as string,
        scope: frontmatter.scope as MemoryScope,
        project: frontmatter.project as string | undefined,
        status: frontmatter.status as SkillStatus,
        source: source as MemorySource,
        source_id: frontmatter.source_id as string | undefined,
        triggers: frontmatter.triggers as SkillTriggers,
        instructions: body,
        constraints: frontmatter.constraints as string[] | undefined,
        output_requirements: frontmatter.output_requirements as string[] | undefined,
        quality_criteria: frontmatter.quality_criteria as Skill["quality_criteria"],
        compatible_with: frontmatter.compatible_with as Skill["compatible_with"],
        created_at: frontmatter.created_at as string,
        derived_from: frontmatter.derived_from as string[] | undefined,
        effectiveness_score: frontmatter.effectiveness_score as number | undefined,
        usage_count: (frontmatter.usage_count as number) ?? 0,
      };

      // Validate
      const result = SkillSchema.safeParse(skill);
      if (!result.success) {
        console.warn(`[SkillsService] Invalid skill in file: ${result.error.message}`);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error("[SkillsService] Error parsing skill file:", error);
      return null;
    }
  }

  /**
   * Write skill to markdown file with YAML frontmatter
   */
  private async writeSkillToFile(skill: Skill, path: string): Promise<void> {
    const { instructions, ...frontmatterData } = skill;

    // Filter out undefined values to avoid YAML stringify errors
    const cleanedFrontmatter = Object.fromEntries(
      Object.entries(frontmatterData).filter(([_, v]) => v !== undefined),
    );

    const frontmatter = stringifyYaml(cleanedFrontmatter);
    const content = `---\n${frontmatter}---\n\n${instructions}`;

    await Deno.writeTextFile(path, content);
  }

  // ===== Activity Logging =====

  /**
   * Log activity to database
   */
  private logActivity(event: {
    event_type: string;
    target: string;
    metadata?: Record<string, JsonValue>;
  }): void {
    try {
      this.db.logActivity(
        "skills_service",
        event.event_type,
        event.target,
        toSafeJson(event.metadata) as Record<string, JsonValue>,
      );
    } catch {
      // Silently ignore logging errors - non-critical
    }
  }
}

// Re-export types for consumers
export type { SkillMatch };
