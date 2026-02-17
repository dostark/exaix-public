/**
 * @module ReviewStatus
 * @path src/reviews/review_status.ts
 * @description Type definitions and utility functions for Review outcome states.
 * @architectural-layer Reviews
 * @dependencies []
 * @related-files [src/services/review_registry.ts, src/schemas/review.ts]
 */
export const ReviewStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const REVIEW_STATUS_VALUES = [
  ReviewStatus.PENDING,
  ReviewStatus.APPROVED,
  ReviewStatus.REJECTED,
] as const;

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return value === ReviewStatus.PENDING || value === ReviewStatus.APPROVED || value === ReviewStatus.REJECTED;
}

export function coerceReviewStatus(value: unknown, fallback: ReviewStatus = ReviewStatus.PENDING): ReviewStatus {
  return isReviewStatus(value) ? value : fallback;
}
