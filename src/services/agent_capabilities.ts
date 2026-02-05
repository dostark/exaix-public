/**
 * Agent capability helpers
 *
 * Centralizes capability-based decisions so execution paths remain consistent.
 */

export const WRITE_CAPABILITIES_REQUIRING_GIT_TRACKING = [
  "write_file",
  "git_commit",
  "git_create_branch",
] as const;

export type WriteCapabilityRequiringGitTracking = typeof WRITE_CAPABILITIES_REQUIRING_GIT_TRACKING[number];

export function requiresGitTracking(capabilities: readonly string[]): boolean {
  return capabilities.some((cap) => (WRITE_CAPABILITIES_REQUIRING_GIT_TRACKING as readonly string[]).includes(cap));
}

export function isReadOnlyAgentCapabilities(capabilities: readonly string[]): boolean {
  return !requiresGitTracking(capabilities);
}
