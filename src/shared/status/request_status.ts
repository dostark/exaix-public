/**
 * @module SharedRequestStatus
 * @path src/shared/status/request_status.ts
 * @description Shared type definitions and utility functions for Request lifecycle states.
 * @architectural-layer Shared
 * @dependencies []
 * @related-files [src/shared/status/plan_status.ts]
 */
export const RequestStatus = {
  PENDING: "pending",
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type RequestStatus = typeof RequestStatus[keyof typeof RequestStatus];
export type RequestStatusType = RequestStatus;

export const REQUEST_STATUS_VALUES = [
  RequestStatus.PENDING,
  RequestStatus.PLANNED,
  RequestStatus.IN_PROGRESS,
  RequestStatus.COMPLETED,
  RequestStatus.FAILED,
  RequestStatus.CANCELLED,
] as const;

export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === "string" && (REQUEST_STATUS_VALUES as readonly string[]).includes(value);
}

export function coerceRequestStatus(
  value: unknown,
  fallback: RequestStatus = RequestStatus.PENDING,
): RequestStatus {
  return isRequestStatus(value) ? value : fallback;
}
