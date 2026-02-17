/**
 * @module RequestStatus
 * @path src/requests/request_status.ts
 * @description Type definitions and utility functions for Request lifecycle states.
 * @architectural-layer Requests
 * @dependencies []
 * @related-files [src/services/request_processor.ts, src/schemas/request.ts]
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
