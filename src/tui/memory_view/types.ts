/**
 * @module MemoryTuiTypes
 * @path src/tui/memory_view/types.ts
 * @description Core types and interfaces for the Memory View TUI components, including TreeNode and MemoryServiceInterface.
 * @architectural-layer TUI
 * @dependencies [MemoryBankService, Enums]
 * @related-files [src/services/memory_bank.ts, src/enums.ts]
 */

import type {
  ExecutionMemory,
  GlobalMemory,
  MemorySearchResult,
  MemoryUpdateProposal,
  ProjectMemory,
} from "../../services/memory_bank.ts";
import { TuiNodeType } from "../../enums.ts";

export type TreeNodeType = TuiNodeType;

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
