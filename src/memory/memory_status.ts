/**
 * @module MemoryStatus
 * @path src/memory/memory_status.ts
 * @description Type definitions and coercion utilities for memory record statuses (pending, approved, etc.).
 * @architectural-layer Schemas
 * @dependencies []
 * @related-files [src/services/memory_bank.ts]
 */
export const MemoryStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  ARCHIVED: "archived",
} as const;

export type MemoryStatus = typeof MemoryStatus[keyof typeof MemoryStatus];
export type MemoryStatusType = MemoryStatus;

export const MEMORY_STATUS_VALUES = [
  MemoryStatus.PENDING,
  MemoryStatus.APPROVED,
  MemoryStatus.REJECTED,
  MemoryStatus.ARCHIVED,
] as const;

export function isMemoryStatus(value: unknown): value is MemoryStatus {
  return typeof value === "string" && (MEMORY_STATUS_VALUES as readonly string[]).includes(value);
}

export function coerceMemoryStatus(
  value: unknown,
  fallback: MemoryStatus = MemoryStatus.PENDING,
): MemoryStatus {
  return isMemoryStatus(value) ? value : fallback;
}
