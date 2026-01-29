/**
 * Types for Memory View
 */

import type {
  ExecutionMemory,
  GlobalMemory,
  MemorySearchResult,
  MemoryUpdateProposal,
  ProjectMemory,
} from "../../services/memory_bank.ts";

export type TreeNodeType = "root" | "scope" | "project" | "execution" | "learning" | "pattern" | "decision";

export interface TreeNode {
  id: string;
  type: TreeNodeType;
  label: string;
  expanded: boolean;
  children: TreeNode[];
  badge?: number;
  data?: unknown;
}

export interface MemoryServiceInterface {
  getProjects(): Promise<string[]>;
  getProjectMemory(portal: string): Promise<ProjectMemory | null>;
  getGlobalMemory(): Promise<GlobalMemory | null>;
  getExecutionByTraceId(traceId: string): Promise<ExecutionMemory | null>;
  getExecutionHistory(options?: {
    portal?: string;
    limit?: number;
  }): Promise<ExecutionMemory[]>;
  search(
    query: string,
    options?: { portal?: string; limit?: number },
  ): Promise<MemorySearchResult[]>;
  listPending(): Promise<MemoryUpdateProposal[]>;
  getPending(proposalId: string): Promise<MemoryUpdateProposal | null>;
  approvePending(proposalId: string): Promise<void>;
  rejectPending(proposalId: string, reason: string): Promise<void>;
}
