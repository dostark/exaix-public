/**
 * Canonical, type-safe agent status values.
 *
 * This replaces the old `AgentStatus` enum and any `AGENT_STATUS_*` constants.
 */

export const AgentStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  ERROR: "error",
} as const;

export type AgentStatusType = typeof AgentStatus[keyof typeof AgentStatus];

export const AGENT_STATUS_VALUES: readonly AgentStatusType[] = [
  AgentStatus.ACTIVE,
  AgentStatus.INACTIVE,
  AgentStatus.ERROR,
];

export const AGENT_STATUS_ORDER: readonly AgentStatusType[] = [
  AgentStatus.ACTIVE,
  AgentStatus.INACTIVE,
  AgentStatus.ERROR,
];

export function isAgentStatus(value: unknown): value is AgentStatusType {
  return typeof value === "string" && (AGENT_STATUS_VALUES as readonly string[]).includes(value);
}

export function coerceAgentStatus(
  value: unknown,
  fallback: AgentStatusType = AgentStatus.INACTIVE,
): AgentStatusType {
  return isAgentStatus(value) ? value : fallback;
}
