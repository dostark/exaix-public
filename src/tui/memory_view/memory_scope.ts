/**
 * Canonical, type-safe Memory View scope identifiers.
 *
 * This follows the same "const-object + union type" pattern as other status modules.
 */

export const MemoryTuiScope = {
  GLOBAL: "global",
  PROJECTS: "projects",
  EXECUTIONS: "executions",
  PENDING: "pending",
  SEARCH: "search",
} as const;

export type MemoryTuiScopeType = typeof MemoryTuiScope[keyof typeof MemoryTuiScope];

export const MEMORY_TUI_SCOPE_VALUES: readonly MemoryTuiScopeType[] = [
  MemoryTuiScope.GLOBAL,
  MemoryTuiScope.PROJECTS,
  MemoryTuiScope.EXECUTIONS,
  MemoryTuiScope.PENDING,
  MemoryTuiScope.SEARCH,
];

export function isMemoryTuiScope(value: unknown): value is MemoryTuiScopeType {
  return typeof value === "string" && (MEMORY_TUI_SCOPE_VALUES as readonly string[]).includes(value);
}

export function coerceMemoryTuiScope(
  value: unknown,
  fallback: MemoryTuiScopeType = MemoryTuiScope.PROJECTS,
): MemoryTuiScopeType {
  return isMemoryTuiScope(value) ? value : fallback;
}
