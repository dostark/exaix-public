/**
 * Memory Bank Service
 *
 * Core service for managing ExoFrame's Memory Banks:
 * - Project memory (overview, patterns, decisions, references)
 * - Execution memory (trace records, lessons learned)
 * - Search and indexing operations
 * - Activity Journal integration
 *
 * Memory Banks provide structured, programmatically accessible storage
 * for project memory and execution history, replacing the Obsidian-specific
 * storage layout.
 */

import { join } from "@std/path";
import { ensureDir, ensureDirSync, ensureFile, exists } from "@std/fs";
import type { Config } from "../config/schema.ts";
import type { DatabaseService } from "./db.ts";
import { ActivityType, MemoryReferenceType, MemoryScope, MemorySource, MemoryStatus, MemoryType } from "../enums.ts";
import {
  ExecutionMemorySchema,
  GlobalMemorySchema,
  LearningSchema,
  ProjectMemorySchema,
} from "../schemas/memory_bank.ts";
import {
  searchByKeyword as searchByKeywordHelper,
  searchByTags as searchByTagsHelper,
  searchMemory as searchMemoryHelper,
  searchMemoryAdvanced as searchMemoryAdvancedHelper,
} from "./memory_search.ts";
import type {
  ActivitySummary,
  Decision,
  ExecutionMemory,
  GlobalMemory,
  Learning,
  MemorySearchResult,
  Pattern,
  ProjectMemory,
  Reference,
} from "../schemas/memory_bank.ts";

/**
 * Memory Bank Service
 *
 * Manages all memory bank operations with Activity Journal integration.
                const titleFreq = this.calculateFrequency(pattern.name, keywordLower);
                const descFreq = this.calculateFrequency(pattern.description, keywordLower);
 */
export class MemoryBankService {
  private memoryRoot!: string;
  private projectsDir!: string;
  private executionDir!: string;
  private tasksDir!: string;
  private indexDir!: string;
  private globalDir!: string;

  /**
   * Create a new Memory Bank Service instance
   *
   * @param config - ExoFrame configuration
   * @param db - Database service for Activity Journal integration
                const titleFreq = this.calculateFrequency(decision.decision, keywordLower);
                const descFreq = this.calculateFrequency(decision.rationale, keywordLower);
  */
  constructor(private config: Config, private db: DatabaseService) {
    this.memoryRoot = join(config.system.root, config.paths.memory);
    this.projectsDir = join(this.memoryRoot, config.paths.memoryProjects);
    this.executionDir = join(this.memoryRoot, config.paths.memoryExecution);
    this.tasksDir = join(this.memoryRoot, config.paths.memoryTasks);
    this.indexDir = join(this.memoryRoot, config.paths.memoryIndex);
    this.globalDir = join(this.memoryRoot, config.paths.memoryGlobal);

    // Ensure directory structure exists
    this.initializeDirectories();
  }

  /**
   * Initialize Memory Banks directory structure
   */
  private initializeDirectories(): void {
    ensureDirSync(this.projectsDir);
    ensureDirSync(this.executionDir);
    ensureDirSync(this.tasksDir);
    ensureDirSync(this.indexDir);
    ensureDirSync(this.globalDir);
  }

  /**
   * Execute an operation with file-based locking to prevent concurrent access
   *
   * @param lockPath - Path to the lock file
   * @param operation - Async operation to execute while holding the lock
   * @param timeoutMs - Maximum time to wait for lock acquisition (default: 5000ms)
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   */
  private async withFileLock<T>(
    lockPath: string,
    operation: () => Promise<T>,
    timeoutMs: number = 5000,
    maxRetries: number = 3,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Try to acquire lock with exclusive access
        const lockFile = await Deno.open(lockPath, {
          createNew: true,
          write: true,
        });

        try {
          // Execute the operation while holding the lock
          const result = await operation();
          return result;
        } finally {
          // Always close and remove the lock file
          try {
            lockFile.close();
            await Deno.remove(lockPath);
          } catch {
            // Ignore cleanup errors
          }
        }
      } catch (error) {
        lastError = error as Error;

        // If it's not a "file exists" error, rethrow immediately
        if (!(error instanceof Deno.errors.AlreadyExists)) {
          throw error;
        }

        // If this was the last attempt, throw the timeout error
        if (attempt === maxRetries) {
          throw new Error(
            `Failed to acquire file lock after ${maxRetries + 1} attempts: ${lastError.message}`,
          );
        }

        // Wait with exponential backoff before retrying
        const delay = Math.min(timeoutMs * Math.pow(2, attempt), 30000); // Cap at 30 seconds
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError || new Error("Unexpected error in file locking");
  }

  // ===== Project Memory Operations =====

  /**
   * Get project memory for a specific portal
   *
   * @param portal - Portal name
   * @returns Project memory or null if not found
   */
  async getProjectMemory(portal: string): Promise<ProjectMemory | null> {
    const projectDir = join(this.projectsDir, portal);

    if (!await exists(projectDir)) {
      return null;
    }

    try {
      const overview = await this.readMarkdownFile(join(projectDir, "overview.md"));
      const patternsContent = await this.readMarkdownFile(join(projectDir, "patterns.md"));
      const decisionsContent = await this.readMarkdownFile(join(projectDir, "decisions.md"));
      const referencesContent = await this.readMarkdownFile(join(projectDir, "references.md"));

      const patterns = this.parsePatterns(patternsContent);
      const decisions = this.parseDecisions(decisionsContent);
      const references = this.parseReferences(referencesContent);

      return {
        portal,
        overview,
        patterns,
        decisions,
        references,
      };
    } catch (error) {
      console.error(`Error reading project memory for ${portal}:`, error);
      return null;
    }
  }

  /**
   * Create new project memory
   *
   * @param projectMem - Project memory data
   */
  async createProjectMemory(projectMem: ProjectMemory): Promise<void> {
    // Validate schema
    ProjectMemorySchema.parse(projectMem);

    const projectDir = join(this.projectsDir, projectMem.portal);
    await ensureDir(projectDir);

    // Write overview
    await this.writeMarkdownFile(
      join(projectDir, "overview.md"),
      projectMem.overview,
    );

    // Write patterns
    await this.writeMarkdownFile(
      join(projectDir, "patterns.md"),
      this.formatPatterns(projectMem.patterns),
    );

    // Write decisions
    await this.writeMarkdownFile(
      join(projectDir, "decisions.md"),
      this.formatDecisions(projectMem.decisions),
    );

    // Write references
    await this.writeMarkdownFile(
      join(projectDir, "references.md"),
      this.formatReferences(projectMem.references),
    );

    // Log to Activity Journal
    this.logActivity({
      event_type: "memory.project.created",
      target: projectMem.portal,
      metadata: {
        patterns_count: projectMem.patterns.length,
        decisions_count: projectMem.decisions.length,
        references_count: projectMem.references.length,
      },
    });
  }

  /**
   * Update project memory (merge update)
   *
   * @param portal - Portal name
   * @param updates - Partial project memory updates
   */
  async updateProjectMemory(
    portal: string,
    updates: Partial<Omit<ProjectMemory, "portal">>,
  ): Promise<void> {
    const projectDir = join(this.projectsDir, portal);
    const lockPath = join(projectDir, "update.lock");

    await this.withFileLock(lockPath, async () => {
      const existing = await this.getProjectMemory(portal);
      if (!existing) {
        throw new Error(`Project memory not found for portal: ${portal}`);
      }

      const updated: ProjectMemory = {
        portal,
        overview: updates.overview ?? existing.overview,
        patterns: updates.patterns ?? existing.patterns,
        decisions: updates.decisions ?? existing.decisions,
        references: updates.references ?? existing.references,
      };

      // Rewrite all files
      await this.createProjectMemory(updated);
    });

    // Log update
    this.logActivity({
      event_type: "memory.project.updated",
      target: portal,
      metadata: { updated_fields: Object.keys(updates) },
    });
  }

  /**
   * Add a pattern to project memory
   *
   * @param portal - Portal name
   * @param pattern - Pattern to add
   */
  async addPattern(portal: string, pattern: Pattern): Promise<void> {
    const projectDir = join(this.projectsDir, portal);
    const lockPath = join(projectDir, "patterns.lock");

    await this.withFileLock(lockPath, async () => {
      const existing = await this.getProjectMemory(portal);
      if (!existing) {
        throw new Error(`Project memory not found for portal: ${portal}`);
      }

      existing.patterns.push(pattern);
      await this.updateProjectMemory(portal, { patterns: existing.patterns });
    });

    // Log pattern addition
    this.logActivity({
      event_type: "memory.pattern.added",
      target: portal,
      metadata: {
        pattern_name: pattern.name,
        tags: pattern.tags || [],
      },
    });
  }

  /**
   * Add a decision to project memory
   *
   * @param portal - Portal name
   * @param decision - Decision to add
   */
  async addDecision(portal: string, decision: Decision): Promise<void> {
    const projectDir = join(this.projectsDir, portal);
    const lockPath = join(projectDir, "decisions.lock");

    await this.withFileLock(lockPath, async () => {
      const existing = await this.getProjectMemory(portal);
      if (!existing) {
        throw new Error(`Project memory not found for portal: ${portal}`);
      }

      existing.decisions.push(decision);
      await this.updateProjectMemory(portal, { decisions: existing.decisions });
    });

    // Log decision addition
    this.logActivity({
      event_type: "memory.decision.added",
      target: portal,
      metadata: {
        decision_summary: decision.decision.substring(0, 100),
        date: decision.date,
        tags: decision.tags || [],
      },
    });
  }

  // ===== Execution Memory Operations =====

  /**
   * Create execution memory record
   *
   * @param execution - Execution memory data
   */
  async createExecutionRecord(execution: ExecutionMemory): Promise<void> {
    // Validate schema - fail fast on invalid data
    ExecutionMemorySchema.parse(execution);

    const execDir = join(this.executionDir, execution.trace_id);
    await ensureDir(execDir);

    // Write summary.md
    const summary = this.formatExecutionSummary(execution);
    await this.writeMarkdownFile(join(execDir, "summary.md"), summary);

    // Write context.json
    await Deno.writeTextFile(
      join(execDir, "context.json"),
      JSON.stringify(execution, null, 2),
    );

    // Log to Activity Journal
    this.logActivity({
      event_type: "memory.execution.recorded",
      target: execution.portal,
      trace_id: execution.trace_id,
      metadata: {
        status: execution.status,
        agent: execution.agent,
        files_changed: (execution.changes?.files_created?.length || 0) +
          (execution.changes?.files_modified?.length || 0),
      },
    });
  }

  /**
   * Get execution memory by trace ID
   *
   * @param traceId - Execution trace ID (UUID)
   * @returns Execution memory or null if not found
   */
  async getExecutionByTraceId(traceId: string): Promise<ExecutionMemory | null> {
    const execDir = join(this.executionDir, traceId);
    const contextFile = join(execDir, "context.json");

    if (!await exists(contextFile)) {
      return null;
    }

    try {
      const content = await Deno.readTextFile(contextFile);
      const data = JSON.parse(content);
      return ExecutionMemorySchema.parse(data);
    } catch (error) {
      console.error(`Error reading execution memory for ${traceId}:`, error);
      return null;
    }
  }

  /**
   * Get execution history with optional filtering
   *
   * @param portal - Optional portal filter
   * @param limit - Maximum number of results (default: 100)
   * @returns Array of execution memories, sorted by started_at descending
   */
  async getExecutionHistory(
    portal?: string,
    limit: number = 100,
  ): Promise<ExecutionMemory[]> {
    const executions: ExecutionMemory[] = [];

    try {
      // Read all execution directories
      for await (const entry of Deno.readDir(this.executionDir)) {
        if (entry.isDirectory) {
          const execution = await this.getExecutionByTraceId(entry.name);
          if (execution) {
            // Apply portal filter if specified
            if (!portal || execution.portal === portal) {
              executions.push(execution);
            }
          }
        }
      }

      // Sort by started_at descending (most recent first)
      executions.sort((a, b) => {
        return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
      });

      // Apply limit
      return executions.slice(0, limit);
    } catch (error) {
      console.error("Error reading execution history:", error);
      return [];
    }
  }

  // ===== Global Memory Operations (Phase 12.8) =====

  /**
   * Get global memory
   *
   * @returns Global memory or null if not initialized
   */
  async getGlobalMemory(): Promise<GlobalMemory | null> {
    const jsonPath = join(this.globalDir, "learnings.json");

    if (!await exists(jsonPath)) {
      return null;
    }

    try {
      const content = await Deno.readTextFile(jsonPath);
      const data = JSON.parse(content);
      return GlobalMemorySchema.parse(data);
    } catch (error) {
      console.error("Error reading global memory:", error);
      return null;
    }
  }

  /**
   * Initialize global memory directory structure
   *
   * Creates Memory/Global/ with empty learnings, patterns, and anti-patterns files.
   */
  async initGlobalMemory(): Promise<void> {
    await ensureDir(this.globalDir);

    const now = new Date().toISOString();
    const emptyGlobal: GlobalMemory = {
      version: "1.0.0",
      updated_at: now,
      learnings: [],
      patterns: [],
      anti_patterns: [],
      statistics: {
        total_learnings: 0,
        by_category: {},
        by_project: {},
        last_activity: now,
      },
    };

    // Write JSON index
    await Deno.writeTextFile(
      join(this.globalDir, "learnings.json"),
      JSON.stringify(emptyGlobal, null, 2),
    );

    // Write empty markdown files
    await this.writeMarkdownFile(
      join(this.globalDir, "learnings.md"),
      "# Global Learnings\n\nCross-project learnings and insights.\n",
    );

    await this.writeMarkdownFile(
      join(this.globalDir, "patterns.md"),
      "# Global Patterns\n\nCode patterns that apply across all projects.\n",
    );

    await this.writeMarkdownFile(
      join(this.globalDir, "anti-patterns.md"),
      "# Anti-Patterns\n\nThings to avoid across all projects.\n",
    );

    this.logActivity({
      event_type: "memory.global.initialized",
      target: "global",
      metadata: { version: "1.0.0" },
    });
  }

  /**
   * Add a learning to global memory
   *
   * @param learning - Learning to add
   */
  async addGlobalLearning(learning: Learning): Promise<void> {
    // Validate learning schema
    LearningSchema.parse(learning);

    // Ensure global directory exists before locking
    await ensureDir(this.globalDir);

    const lockPath = join(this.globalDir, "learnings.lock");

    await this.withFileLock(lockPath, async () => {
      let globalMem = await this.getGlobalMemory();
      if (!globalMem) {
        await this.initGlobalMemory();
        globalMem = await this.getGlobalMemory();
      }

      if (!globalMem) {
        throw new Error("Failed to initialize global memory");
      }

      // Check for duplicate ID
      if (globalMem.learnings.some((l: Learning) => l.id === learning.id)) {
        throw new Error(`Learning with ID '${learning.id}' already exists`);
      }

      // Add learning
      globalMem.learnings.push(learning);

      // Update statistics
      globalMem.statistics.total_learnings = globalMem.learnings.length;
      globalMem.statistics.by_category[learning.category] = (globalMem.statistics.by_category[learning.category] || 0) +
        1;

      if (learning.project) {
        globalMem.statistics.by_project[learning.project] = (globalMem.statistics.by_project[learning.project] || 0) +
          1;
      }

      globalMem.statistics.last_activity = new Date().toISOString();
      globalMem.updated_at = new Date().toISOString();

      // Write updated JSON
      await Deno.writeTextFile(
        join(this.globalDir, "learnings.json"),
        JSON.stringify(globalMem, null, 2),
      );

      // Append to markdown file
      const mdContent = this.formatLearningMarkdown(learning);
      const mdPath = join(this.globalDir, "learnings.md");
      const existingContent = await this.readMarkdownFile(mdPath);
      await this.writeMarkdownFile(mdPath, existingContent + "\n" + mdContent);
    });

    this.logActivity({
      event_type: "memory.global.learning.added",
      target: "global",
      metadata: {
        learning_id: learning.id,
        title: learning.title,
        category: learning.category,
        confidence: learning.confidence,
      },
    });
  }

  /**
   * Promote a learning from project to global scope
   *
   * @param portal - Source portal name
   * @param promotion - Promotion details
   * @returns ID of the created global learning
   */
  async promoteLearning(
    portal: string,
    promotion: {
      type: MemoryType.PATTERN | MemoryType.DECISION;
      name: string;
      title: string;
      description: string;
      category: Learning["category"];
      tags: string[];
      confidence: Learning["confidence"];
    },
  ): Promise<string> {
    // Verify source project exists
    const projectMem = await this.getProjectMemory(portal);
    if (!projectMem) {
      throw new Error(`Project memory not found for portal: ${portal}`);
    }

    // Ensure global memory exists
    const globalMem = await this.getGlobalMemory();
    if (!globalMem) {
      await this.initGlobalMemory();
    }

    // Create learning from promotion
    const learningId = crypto.randomUUID();
    const now = new Date().toISOString();

    const learning: Learning = {
      id: learningId,
      created_at: now,
      source: MemorySource.USER,
      scope: MemoryScope.GLOBAL,
      project: portal,
      title: promotion.title,
      description: promotion.description,
      category: promotion.category,
      tags: promotion.tags,
      confidence: promotion.confidence,
      status: MemoryStatus.APPROVED,
      approved_at: now,
    };

    await this.addGlobalLearning(learning);

    this.logActivity({
      event_type: "memory.learning.promoted",
      target: portal,
      metadata: {
        learning_id: learningId,
        from_type: promotion.type,
        from_name: promotion.name,
        to_scope: "global",
      },
    });

    return learningId;
  }

  /**
   * Demote a learning from global to project scope
   *
   * @param learningId - ID of the learning to demote
   * @param targetPortal - Target portal name
   */
  async demoteLearning(learningId: string, targetPortal: string): Promise<void> {
    // Get global memory
    const globalMem = await this.getGlobalMemory();
    if (!globalMem) {
      throw new Error("Global memory not initialized");
    }

    // Find the learning
    const learningIndex = globalMem.learnings.findIndex((l: Learning) => l.id === learningId);
    if (learningIndex === -1) {
      throw new Error(`Learning not found: ${learningId}`);
    }

    // Verify target project exists
    const projectMem = await this.getProjectMemory(targetPortal);
    if (!projectMem) {
      throw new Error(`Project memory not found for portal: ${targetPortal}`);
    }

    const learning = globalMem.learnings[learningIndex];

    // Add to project as a pattern (most common case)
    const pattern: Pattern = {
      name: learning.title,
      description: learning.description,
      examples: [],
      tags: learning.tags,
    };

    await this.addPattern(targetPortal, pattern);

    // Remove from global memory
    globalMem.learnings.splice(learningIndex, 1);

    // Update statistics
    globalMem.statistics.total_learnings = globalMem.learnings.length;
    globalMem.statistics.by_category[learning.category] = Math.max(
      0,
      (globalMem.statistics.by_category[learning.category] || 1) - 1,
    );

    if (learning.project) {
      globalMem.statistics.by_project[learning.project] = Math.max(
        0,
        (globalMem.statistics.by_project[learning.project] || 1) - 1,
      );
    }

    globalMem.updated_at = new Date().toISOString();

    // Write updated global memory
    await Deno.writeTextFile(
      join(this.globalDir, "learnings.json"),
      JSON.stringify(globalMem, null, 2),
    );

    // Rewrite learnings.md without the demoted learning
    await this.rewriteLearningsMarkdown(globalMem);

    this.logActivity({
      event_type: "memory.learning.demoted",
      target: targetPortal,
      metadata: {
        learning_id: learningId,
        from_scope: "global",
        to_project: targetPortal,
      },
    });
  }

  /**
   * Format a learning as markdown
   */
  private formatLearningMarkdown(learning: Learning): string {
    let md = `## ${learning.title}\n\n`;
    md += `**ID:** ${learning.id}\n`;
    md += `**Created:** ${learning.created_at}\n`;
    md += `**Source:** ${learning.source}`;
    if (learning.project) {
      md += ` (from ${learning.project})`;
    }
    md += `\n`;
    md += `**Category:** ${learning.category}\n`;
    md += `**Confidence:** ${learning.confidence}\n`;

    if (learning.tags.length > 0) {
      md += `**Tags:** ${learning.tags.join(", ")}\n`;
    }

    md += `\n${learning.description}\n`;

    if (learning.references && learning.references.length > 0) {
      md += `\n**References:**\n`;
      for (const ref of learning.references) {
        md += `- [${ref.type}] ${ref.path}\n`;
      }
    }

    return md;
  }

  /**
   * Rewrite the learnings.md file from global memory state
   */
  private async rewriteLearningsMarkdown(globalMem: GlobalMemory): Promise<void> {
    let md = "# Global Learnings\n\nCross-project learnings and insights.\n\n";

    for (const learning of globalMem.learnings) {
      md += this.formatLearningMarkdown(learning) + "\n";
    }

    await this.writeMarkdownFile(join(this.globalDir, "learnings.md"), md);
  }

  // ===== Search Operations =====

  /**
   * Search memory banks for matching content
   *
   * @param query - Search query string
   * @param options - Search options (portal filter, limit)
   * @returns Array of search results
   */
  async searchMemory(
    query: string,
    options?: { portal?: string; limit?: number },
  ): Promise<MemorySearchResult[]> {
    return await searchMemoryHelper(query, options, {
      projectsDir: this.projectsDir,
      getProjectMemory: this.getProjectMemory.bind(this),
      getExecutionHistory: this.getExecutionHistory.bind(this),
      loadLearningsFromFile: this.loadLearningsFromFile.bind(this),
      calculateFrequency: this.calculateFrequency.bind(this),
      calculateRelevance: this.calculateRelevance.bind(this),
    });
  }

  // Helper: calculate frequency of a keyword in text
  private calculateFrequency(text: string | undefined, keywordLower: string): number {
    if (!text) return 0;
    const matches = text.toLowerCase().match(new RegExp(keywordLower, "gi"));
    return matches ? matches.length : 0;
  }

  // Helper: calculate a relevance score based on title/description frequency
  private calculateRelevance(titleFreq: number, descFreq: number): number {
    return Math.min(0.99, 0.5 + (titleFreq * 0.15) + (descFreq * 0.05));
  }

  /**
   * Search memory by tags (AND logic for multiple tags)
   *
   * @param tags - Array of tags to search for
   * @param options - Optional search options (portal filter, limit)
   * @returns Array of search results with matching tags
   */
  async searchByTags(
    tags: string[],
    options?: { portal?: string; limit?: number },
  ): Promise<MemorySearchResult[]> {
    return await searchByTagsHelper(tags, options, {
      projectsDir: this.projectsDir,
      getProjectMemory: this.getProjectMemory.bind(this),
      getExecutionHistory: this.getExecutionHistory.bind(this),
      loadLearningsFromFile: this.loadLearningsFromFile.bind(this),
      calculateFrequency: this.calculateFrequency.bind(this),
      calculateRelevance: this.calculateRelevance.bind(this),
    });
  }

  /**
   * Search memory by keyword with frequency-based ranking
   *
   * @param keyword - Keyword to search for
   * @param options - Optional search options (portal filter, limit)
   * @returns Array of search results ranked by keyword frequency
   */
  async searchByKeyword(
    keyword: string,
    options?: { portal?: string; limit?: number },
  ): Promise<MemorySearchResult[]> {
    return await searchByKeywordHelper(keyword, options, {
      projectsDir: this.projectsDir,
      getProjectMemory: this.getProjectMemory.bind(this),
      getExecutionHistory: this.getExecutionHistory.bind(this),
      loadLearningsFromFile: this.loadLearningsFromFile.bind(this),
      calculateFrequency: this.calculateFrequency.bind(this),
      calculateRelevance: this.calculateRelevance.bind(this),
    });
  }

  async searchMemoryAdvanced(
    options: {
      tags?: string[];
      keyword?: string;
      portal?: string;
      limit?: number;
    },
  ): Promise<MemorySearchResult[]> {
    return await searchMemoryAdvancedHelper(options, {
      projectsDir: this.projectsDir,
      getProjectMemory: this.getProjectMemory.bind(this),
      getExecutionHistory: this.getExecutionHistory.bind(this),
      loadLearningsFromFile: this.loadLearningsFromFile.bind(this),
      calculateFrequency: this.calculateFrequency.bind(this),
      calculateRelevance: this.calculateRelevance.bind(this),
    });
  }

  /**
   * Load learnings from JSON file (helper for search operations)
   */
  private async loadLearningsFromFile(): Promise<Learning[]> {
    const learningsPath = join(this.globalDir, "learnings.json");
    if (!await exists(learningsPath)) {
      return [];
    }
    try {
      const content = await Deno.readTextFile(learningsPath);
      const parsed = JSON.parse(content);
      // Handle both flat array and GlobalMemory structure
      if (Array.isArray(parsed)) {
        return parsed;
      }
      // GlobalMemory structure with learnings property
      if (parsed.learnings && Array.isArray(parsed.learnings)) {
        return parsed.learnings;
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Get recent activity summary
   *
   * @param limit - Maximum number of activities to return
   * @returns Array of activity summaries
   */
  async getRecentActivity(limit: number = 20): Promise<ActivitySummary[]> {
    const executions = await this.getExecutionHistory(undefined, limit);

    return executions.map((exec) => ({
      type: ActivityType.EXECUTION,
      timestamp: exec.started_at,
      portal: exec.portal,
      summary: exec.summary,
      trace_id: exec.trace_id,
      status: exec.status,
    }));
  }

  // ===== Index Management =====

  /**
   * Rebuild all indices for fast lookups
   *
   * Creates:
   * - files.json: File path → executions mapping
   * - patterns.json: Pattern → projects mapping
   * - tags.json: Tag → projects/patterns mapping
   */
  async rebuildIndices(): Promise<void> {
    const filesIndex: Record<string, string[]> = {};
    const patternsIndex: Record<string, string[]> = {};
    const tagsIndex: Record<string, string[]> = {};

    // Index execution memory (files)
    const executions = await this.getExecutionHistory(undefined, 1000);
    for (const exec of executions) {
      const allFiles = [
        ...(exec.changes?.files_created || []),
        ...(exec.changes?.files_modified || []),
        ...(exec.context_files || []),
      ];

      for (const file of allFiles) {
        if (!filesIndex[file]) {
          filesIndex[file] = [];
        }
        filesIndex[file].push(exec.trace_id);
      }
    }

    // Index project memory (patterns, tags)
    for await (const entry of Deno.readDir(this.projectsDir)) {
      if (entry.isDirectory) {
        const projectMem = await this.getProjectMemory(entry.name);
        if (projectMem) {
          for (const pattern of projectMem.patterns) {
            if (!patternsIndex[pattern.name]) {
              patternsIndex[pattern.name] = [];
            }
            patternsIndex[pattern.name].push(entry.name);

            // Index tags
            for (const tag of pattern.tags || []) {
              if (!tagsIndex[tag]) {
                tagsIndex[tag] = [];
              }
              tagsIndex[tag].push(`pattern:${entry.name}:${pattern.name}`);
            }
          }

          // Index decision tags
          for (const decision of projectMem.decisions) {
            for (const tag of decision.tags || []) {
              if (!tagsIndex[tag]) {
                tagsIndex[tag] = [];
              }
              tagsIndex[tag].push(`decision:${entry.name}:${decision.date}`);
            }
          }
        }
      }
    }

    // Index global learnings tags
    const learnings = await this.loadLearningsFromFile();
    for (const learning of learnings) {
      if (learning.status !== MemoryStatus.APPROVED) continue;
      for (const tag of learning.tags || []) {
        if (!tagsIndex[tag]) {
          tagsIndex[tag] = [];
        }
        tagsIndex[tag].push(`learning:global:${learning.id}`);
      }
    }

    // Write indices
    await Deno.writeTextFile(
      join(this.indexDir, "files.json"),
      JSON.stringify(filesIndex, null, 2),
    );

    await Deno.writeTextFile(
      join(this.indexDir, "patterns.json"),
      JSON.stringify(patternsIndex, null, 2),
    );

    await Deno.writeTextFile(
      join(this.indexDir, "tags.json"),
      JSON.stringify(tagsIndex, null, 2),
    );

    // Log index rebuild
    this.logActivity({
      event_type: "memory.indices.rebuilt",
      target: "system",
      metadata: {
        files_indexed: Object.keys(filesIndex).length,
        patterns_indexed: Object.keys(patternsIndex).length,
        tags_indexed: Object.keys(tagsIndex).length,
      },
    });
  }

  /**
   * Rebuild all indices including embeddings
   *
   * This method rebuilds standard indices and also regenerates
   * embedding vectors for all learnings using the provided embedding service.
   *
   * @param embeddingService - The embedding service to use for generating vectors
   */
  async rebuildIndicesWithEmbeddings(
    embeddingService: {
      embedLearning(learning: Learning): Promise<void>;
      initializeManifest(): Promise<void>;
    },
  ): Promise<void> {
    // First, rebuild standard indices
    await this.rebuildIndices();

    // Initialize embedding manifest
    await embeddingService.initializeManifest();

    // Embed all approved learnings
    const learnings = await this.loadLearningsFromFile();
    for (const learning of learnings) {
      if (learning.status === MemoryStatus.APPROVED) {
        await embeddingService.embedLearning(learning);
      }
    }

    // Log embedding rebuild
    const approvedCount = learnings.filter((l) => l.status === MemoryStatus.APPROVED).length;
    this.logActivity({
      event_type: "memory.embeddings.rebuilt",
      target: "system",
      metadata: {
        learnings_embedded: approvedCount,
      },
    });
  }

  // ===== Helper Methods =====

  /**
   * Read markdown file content
   */
  private async readMarkdownFile(path: string): Promise<string> {
    if (!await exists(path)) {
      return "";
    }
    return await Deno.readTextFile(path);
  }

  /**
   * Write markdown file content
   */
  private async writeMarkdownFile(path: string, content: string): Promise<void> {
    await ensureFile(path);
    await Deno.writeTextFile(path, content);
  }

  /**
   * Parse patterns from markdown content
   */
  private parsePatterns(content: string): Pattern[] {
    // Simple parsing - assumes patterns are separated by "## " headers
    const patterns: Pattern[] = [];
    const sections = content.split(/^## /m).filter((s) => s.trim());

    for (const section of sections) {
      const lines = section.split("\n");
      const name = lines[0].trim();

      // Find the description (everything until **Examples** or **Tags**)
      let descriptionEnd = lines.length;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].startsWith("**Examples:**") || lines[i].startsWith("**Tags:")) {
          descriptionEnd = i;
          break;
        }
      }

      const description = lines.slice(1, descriptionEnd).join("\n").trim();

      // Parse examples
      const examples: string[] = [];
      const examplesStart = lines.findIndex((line) => line.startsWith("**Examples:**"));
      if (examplesStart !== -1) {
        for (let i = examplesStart + 1; i < lines.length; i++) {
          if (lines[i].startsWith("**") || lines[i].trim() === "") break;
          const match = lines[i].match(/^- (.+)$/);
          if (match) {
            examples.push(match[1]);
          }
        }
      }

      // Parse tags
      let tags: string[] | undefined;
      const tagsLine = lines.find((line) => line.startsWith("**Tags:"));
      if (tagsLine) {
        const tagsMatch = tagsLine.match(/\*\*Tags:\*\* (.+)/);
        if (tagsMatch) {
          tags = tagsMatch[1].split(", ").map((t) => t.trim());
        }
      }

      if (name && description) {
        patterns.push({
          name,
          description,
          examples,
          tags,
        });
      }
    }

    return patterns;
  }

  /**
   * Parse decisions from markdown content
   */
  private parseDecisions(content: string): Decision[] {
    const decisions: Decision[] = [];
    const sections = content.split(/^## /m).filter((s) => s.trim());

    for (const section of sections) {
      const lines = section.split("\n");
      const match = lines[0].match(/^(\d{4}-\d{2}-\d{2}): (.+)$/);

      if (match) {
        const date = match[1];
        const decision = match[2];

        // Find the rationale (everything until **Alternatives** or **Tags**)
        let rationaleEnd = lines.length;
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].startsWith("**Alternatives considered:**") || lines[i].startsWith("**Tags:")) {
            rationaleEnd = i;
            break;
          }
        }

        const rationale = lines.slice(1, rationaleEnd).join("\n").trim();

        // Parse alternatives
        let alternatives: string[] | undefined;
        const alternativesLine = lines.find((line) => line.startsWith("**Alternatives considered:"));
        if (alternativesLine) {
          const alternativesMatch = alternativesLine.match(/\*\*Alternatives considered:\*\* (.+)/);
          if (alternativesMatch) {
            alternatives = alternativesMatch[1].split(", ").map((a) => a.trim());
          }
        }

        // Parse tags
        let tags: string[] | undefined;
        const tagsLine = lines.find((line) => line.startsWith("**Tags:"));
        if (tagsLine) {
          const tagsMatch = tagsLine.match(/\*\*Tags:\*\* (.+)/);
          if (tagsMatch) {
            tags = tagsMatch[1].split(", ").map((t) => t.trim());
          }
        }

        decisions.push({
          date,
          decision,
          rationale,
          alternatives,
          tags,
        });
      }
    }

    return decisions;
  }

  /**
   * Parse references from markdown content
   */
  private parseReferences(content: string): Reference[] {
    const references: Reference[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const match = line.match(/^\- \[(.+)\]\((.+)\)(?: - (.+))?$/);
      if (match) {
        references.push({
          path: match[2],
          type: MemoryReferenceType.URL,
          description: match[3] || match[1],
        });
      }
    }

    return references;
  }

  /**
   * Format patterns to markdown
   */
  private formatPatterns(patterns: Pattern[]): string {
    return patterns.map((p) => {
      let md = `## ${p.name}\n\n${p.description}\n`;
      if (p.examples && p.examples.length > 0) {
        md += `\n**Examples:**\n${p.examples.map((e) => `- ${e}`).join("\n")}\n`;
      }
      if (p.tags && p.tags.length > 0) {
        md += `\n**Tags:** ${p.tags.join(", ")}\n`;
      }
      return md;
    }).join("\n\n");
  }

  /**
   * Format decisions to markdown
   */
  private formatDecisions(decisions: Decision[]): string {
    return decisions.map((d) => {
      let md = `## ${d.date}: ${d.decision}\n\n${d.rationale}\n`;
      if (d.alternatives && d.alternatives.length > 0) {
        md += `\n**Alternatives considered:** ${d.alternatives.join(", ")}\n`;
      }
      if (d.tags && d.tags.length > 0) {
        md += `\n**Tags:** ${d.tags.join(", ")}\n`;
      }
      return md;
    }).join("\n\n");
  }

  /**
   * Format references to markdown
   */
  private formatReferences(references: Reference[]): string {
    return references.map((r) => {
      const desc = r.description ? ` - ${r.description}` : "";
      const title = r.description || r.path;
      return `- [${title}](${r.path})${desc}`;
    }).join("\n");
  }

  /** (r)(r)(r)
   * Format execution summary to markdown
   */
  private formatExecutionSummary(exec: ExecutionMemory): string {
    let md = `# Execution Summary\n\n`;
    md += `**Trace ID:** ${exec.trace_id}\n`;
    md += `**Request ID:** ${exec.request_id}\n`;
    md += `**Portal:** ${exec.portal}\n`;
    md += `**Agent:** ${exec.agent}\n`;
    md += `**Status:** ${exec.status}\n`;
    md += `**Started:** ${exec.started_at}\n`;
    if (exec.completed_at) {
      md += `**Completed:** ${exec.completed_at}\n`;
    }
    md += `\n## Summary\n\n${exec.summary}\n`;

    if (exec.changes) {
      md += `\n## Changes\n\n`;
      if (exec.changes.files_created.length > 0) {
        md += `**Created:**\n${exec.changes.files_created.map((f) => `- ${f}`).join("\n")}\n\n`;
      }
      if (exec.changes.files_modified.length > 0) {
        md += `**Modified:**\n${exec.changes.files_modified.map((f) => `- ${f}`).join("\n")}\n\n`;
      }
      if (exec.changes.files_deleted.length > 0) {
        md += `**Deleted:**\n${exec.changes.files_deleted.map((f) => `- ${f}`).join("\n")}\n\n`;
      }
    }

    if (exec.lessons_learned && exec.lessons_learned.length > 0) {
      md += `\n## Lessons Learned\n\n`;
      md += exec.lessons_learned.map((l) => `- ${l}`).join("\n");
    }

    if (exec.error_message) {
      md += `\n## Error\n\n${exec.error_message}\n`;
    }

    return md;
  }

  /**
   * Log activity to Activity Journal
   */
  private logActivity(event: {
    event_type: string;
    target: string;
    trace_id?: string;
    metadata?: Record<string, unknown>;
  }): void {
    try {
      this.db.logActivity(
        "system",
        event.event_type,
        event.target,
        event.metadata || {},
        event.trace_id,
        null, // No agent_id for memory bank operations
      );
    } catch (error) {
      console.error("Failed to log activity:", error);
      // Don't throw - logging failure shouldn't break memory operations
    }
  }
}
