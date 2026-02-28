/**
 * @module MemoryTuiTypes
 * @path src/tui/memory_view/types.ts
 * @description Core types and interfaces for the Memory View TUI components, including ITreeNode and MemoryServiceInterface.
 * @architectural-layer TUI
 * @dependencies [MemoryBankService, Enums]
 * @related-files [src/services/memory_bank.ts, src/enums.ts]
 */

import type {
  IExecutionMemory,
  IGlobalMemory,
  IMemorySearchResult,
  IMemoryUpdateProposal,
  IProjectMemory,
} from "../../shared/schemas/memory_bank.ts";
import { TuiNodeType } from "../../shared/enums.ts";

export type ITreeNodeType = TuiNodeType;

export interface ITreeNode {
  id: string;
  type: ITreeNodeType;
  label: string;
  expanded: boolean;
  children: ITreeNode[];
  badge?: number;
  data?: unknown;
}

export interface IMemoryServiceInterface {
  getProjects(): Promise<string[]>;
  getProjectMemory(portal: string): Promise<IProjectMemory | null>;
  getGlobalMemory(): Promise<IGlobalMemory | null>;
  getExecutionByTraceId(traceId: string): Promise<IExecutionMemory | null>;
  getExecutionHistory(options?: {
    portal?: string;
    limit?: number;
  }): Promise<IExecutionMemory[]>;
  search(
    query: string,
    options?: { portal?: string; limit?: number },
  ): Promise<IMemorySearchResult[]>;
  listPending(): Promise<IMemoryUpdateProposal[]>;
  getPending(proposalId: string): Promise<IMemoryUpdateProposal | null>;
  approvePending(proposalId: string): Promise<void>;
  rejectPending(proposalId: string, reason: string): Promise<void>;
}
