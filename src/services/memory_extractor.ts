/**
 * Memory Extractor Service
 *
 * Extracts learnings from agent executions and creates memory update proposals.
 * Part of Phase 12.9: Agent Memory Updates
 *
 * Key responsibilities:
 * - Analyze execution results for learnable patterns
 * - Create proposals in Memory/Pending/
 * - Manage pending proposal lifecycle (approve/reject)
 * - Activity Journal integration
 */

import { join } from "@std/path";
import { ensureDir, exists } from "@std/fs";
import type { Config } from "../config/schema.ts";
import type { DatabaseService } from "./db.ts";
import type { MemoryBankService } from "./memory_bank.ts";
import type {
  ExecutionMemory,
  Learning,
  MemoryUpdateProposal,
  Pattern,
  ProposalLearning,
} from "../schemas/memory_bank.ts";
import { MemoryUpdateProposalSchema } from "../schemas/memory_bank.ts";
import { MemoryOperation, MemoryReferenceType, MemoryScope, MemoryStatus } from "../enums.ts";
import { LearningExtractor } from "./memory/learning_extractor.ts";

/**
 * Memory Extractor Service
 *
 * Analyzes executions and manages memory update proposals.
 */
export class MemoryExtractorService {
  private pendingDir: string;

  constructor(
    private config: Config,
    private db: DatabaseService,
    private memoryBank: MemoryBankService,
  ) {
    this.pendingDir = join(config.system.root, config.paths.memory, "Pending");
  }

  // ===== Extraction Operations =====

  // ===== Extraction Operations =====

  /**
   * Analyze an execution and extract potential learnings
   *
   * @param execution - Completed execution memory
   * @returns Array of extracted learnings (without status, ready for proposal)
   */
  analyzeExecution(execution: ExecutionMemory): ProposalLearning[] {
    return LearningExtractor.extract(execution);
  }
  // ===== Proposal Operations =====

  /**
   * Create a proposal from a learning and write to Pending directory
   *
   * @param learning - The learning to propose
   * @param execution - Source execution
   * @param agent - Agent that created the learning
   * @returns Proposal ID
   */
  async createProposal(
    learning: ProposalLearning,
    execution: ExecutionMemory,
    agent: string,
  ): Promise<string> {
    await ensureDir(this.pendingDir);

    const proposal: MemoryUpdateProposal = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      operation: MemoryOperation.ADD,
      target_scope: learning.scope,
      target_project: learning.project,
      learning,
      reason: `Extracted from execution ${execution.trace_id}`,
      agent,
      execution_id: execution.trace_id,
      status: MemoryStatus.PENDING,
    };

    // Validate proposal
    MemoryUpdateProposalSchema.parse(proposal);

    // Write to Pending directory
    const proposalPath = join(this.pendingDir, `${proposal.id}.json`);
    await Deno.writeTextFile(proposalPath, JSON.stringify(proposal, null, 2));

    // Log to Activity Journal
    this.logActivity({
      event_type: "memory.proposal.created",
      target: learning.project || MemoryScope.GLOBAL,
      metadata: {
        proposal_id: proposal.id,
        learning_title: learning.title,
        category: learning.category,
        agent,
      },
    });

    return proposal.id;
  }

  /**
   * List all pending proposals
   *
   * @returns Array of pending proposals
   */
  async listPending(): Promise<MemoryUpdateProposal[]> {
    const proposals: MemoryUpdateProposal[] = [];

    if (!await exists(this.pendingDir)) {
      return proposals;
    }

    for await (const entry of Deno.readDir(this.pendingDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        try {
          const content = await Deno.readTextFile(join(this.pendingDir, entry.name));
          const proposal = MemoryUpdateProposalSchema.parse(JSON.parse(content));
          if (proposal.status === MemoryStatus.PENDING) {
            proposals.push(proposal);
          }
        } catch {
          // Skip invalid files
        }
      }
    }

    // Sort by created_at descending
    proposals.sort((a, b) => b.created_at.localeCompare(a.created_at));

    return proposals;
  }

  /**
   * Get a specific pending proposal
   *
   * @param proposalId - Proposal ID
   * @returns Proposal or null if not found
   */
  async getPending(proposalId: string): Promise<MemoryUpdateProposal | null> {
    const proposalPath = join(this.pendingDir, `${proposalId}.json`);

    if (!await exists(proposalPath)) {
      return null;
    }

    try {
      const content = await Deno.readTextFile(proposalPath);
      return MemoryUpdateProposalSchema.parse(JSON.parse(content));
    } catch {
      return null;
    }
  }

  /**
   * Approve a pending proposal and merge the learning
   *
   * @param proposalId - Proposal ID to approve
   */
  async approvePending(proposalId: string): Promise<void> {
    const proposal = await this.getPending(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    // Convert proposal learning to full Learning
    const learning: Learning = {
      ...proposal.learning,
      status: MemoryStatus.APPROVED,
      approved_at: new Date().toISOString(),
    };

    // Add to appropriate scope
    if (proposal.target_scope === MemoryScope.GLOBAL) {
      await this.memoryBank.addGlobalLearning(learning);
    } else if (proposal.target_project) {
      // Add as pattern to project
      const pattern: Pattern = {
        name: learning.title,
        description: learning.description,
        examples: learning.references?.filter((r) => r.type === MemoryReferenceType.FILE).map((r) => r.path) || [],
        tags: learning.tags,
      };
      await this.memoryBank.addPattern(proposal.target_project, pattern);
    }

    // Remove proposal file
    const proposalPath = join(this.pendingDir, `${proposalId}.json`);
    await Deno.remove(proposalPath);

    // Log approval
    this.logActivity({
      event_type: "memory.proposal.approved",
      target: proposal.target_project || MemoryScope.GLOBAL,
      metadata: {
        proposal_id: proposalId,
        learning_title: proposal.learning.title,
      },
    });
  }

  /**
   * Reject a pending proposal
   *
   * @param proposalId - Proposal ID to reject
   * @param reason - Rejection reason
   */
  async rejectPending(proposalId: string, reason: string): Promise<void> {
    const proposal = await this.getPending(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    // Remove proposal file
    const proposalPath = join(this.pendingDir, `${proposalId}.json`);
    await Deno.remove(proposalPath);

    // Log rejection
    this.logActivity({
      event_type: "memory.proposal.rejected",
      target: proposal.target_project || MemoryScope.GLOBAL,
      metadata: {
        proposal_id: proposalId,
        learning_title: proposal.learning.title,
        reason,
      },
    });
  }

  /**
   * Approve all pending proposals
   *
   * @returns Number of proposals approved
   */
  async approveAll(): Promise<number> {
    const pending = await this.listPending();
    let approved = 0;

    for (const proposal of pending) {
      try {
        await this.approvePending(proposal.id);
        approved++;
      } catch {
        // Skip failed approvals, continue with others
      }
    }

    return approved;
  }

  // ===== Private Helpers =====

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
        "memory-extractor",
        event.event_type,
        event.target,
        event.metadata || {},
        event.trace_id,
      );
    } catch {
      // Don't fail on logging errors
    }
  }
}
