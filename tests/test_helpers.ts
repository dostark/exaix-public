import type { IDatabaseService } from "../src/services/db.ts";
import type { ActivityRepository } from "../src/repositories/activity_repository.ts";

/**
 * Create a fully-typed stub implementation of the DatabaseService used in tests.
 * Returns an object matching `IDatabaseService` with no-op implementations so
 * tests can pass it without casting to `any`.
 */
export function createStubDb(overrides: Partial<IDatabaseService> = {}): IDatabaseService {
  const base: IDatabaseService = {
    logActivity: (
      _actor: string,
      _actionType: string,
      _target: string | null,
      _payload: Record<string, unknown>,
      _traceId?: string,
      _agentId?: string | null,
    ) => {
      /* noop */
    },
    waitForFlush: () => Promise.resolve(),
    queryActivity: () => Promise.resolve([]),
    preparedGet: <T>(_query: string, _params: (string | number | boolean | null)[] = []) =>
      Promise.resolve(null as T | null),
    preparedAll: <T>(_query: string, _params: (string | number | boolean | null)[] = []) => Promise.resolve([] as T[]),
    preparedRun: (_query: string, _params: (string | number | boolean | null)[] = []) => Promise.resolve({}),
    getActivitiesByTrace: (_traceId: string) => [],
    // The "Safe" variants delegate to the possibly-overridden sync method so tests
    // that provide a spy for `getActivitiesByTrace` or `getActivitiesByActionType`
    // still get invoked. This keeps backwards compatibility.
    getActivitiesByTraceSafe: async function (this: IDatabaseService, _traceId: string) {
      if (typeof this.getActivitiesByTrace === "function") {
        const r = this.getActivitiesByTrace(_traceId);
        return r instanceof Promise ? await r : (r as unknown[]);
      }
      return [];
    },
    getActivitiesByActionType: (_actionType: string) => [],
    getActivitiesByActionTypeSafe: async function (this: IDatabaseService, _actionType: string) {
      if (typeof this.getActivitiesByActionType === "function") {
        const r = this.getActivitiesByActionType(_actionType);
        return r instanceof Promise ? await r : (r as unknown[]);
      }
      return [];
    },
    getRecentActivity: (_limit?: number) => Promise.resolve([]),
  };

  return Object.assign(base, overrides);
}

/**
 * Create a typed ActivityRepository mock for tests.
 */
export function createMockRepo(overrides: Partial<ActivityRepository> = {}): ActivityRepository {
  const base: ActivityRepository = {
    logActivity: () => Promise.resolve(),
    getActivitiesByTraceId: () => Promise.resolve([]),
    getActivitiesByActionType: () => Promise.resolve([]),
    getRecentActivities: () => Promise.resolve([]),
  };
  return Object.assign(base, overrides);
}
