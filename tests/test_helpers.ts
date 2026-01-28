export function createStubDb(overrides: Record<string, unknown> = {}): any {
  const base: Record<string, unknown> = {
    logActivity: () => {},
    waitForFlush: async () => {},
    preparedGet: function (_query: string, _params: unknown[] = []) {
      return Promise.resolve(null);
    },
    preparedAll: function (_query: string, _params: unknown[] = []) {
      return Promise.resolve([]);
    },
    preparedRun: function (_query: string, _params: unknown[] = []) {
      return Promise.resolve({});
    },
    async getActivitiesByTraceSafe(traceId: string) {
      if (typeof (this as any).getActivitiesByTrace === "function") {
        const r = (this as any).getActivitiesByTrace(traceId);
        return r instanceof Promise ? await r : r;
      }
      return [];
    },
    async getActivitiesByActionTypeSafe(actionType: string) {
      if (typeof (this as any).getActivitiesByActionType === "function") {
        const r = (this as any).getActivitiesByActionType(actionType);
        return r instanceof Promise ? await r : r;
      }
      return [];
    },
  };

  return Object.assign(base, overrides) as any;
}

export function createMockRepo(overrides: Record<string, unknown> = {}): any {
  return Object.assign({
    logActivity: () => Promise.resolve(),
    getActivitiesByTraceId: () => Promise.resolve([]),
    getActivitiesByActionType: () => Promise.resolve([]),
    getRecentActivities: () => Promise.resolve([]),
  }, overrides) as any;
}
