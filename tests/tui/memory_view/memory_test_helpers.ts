import { MemoryServiceInterface } from "../../../src/tui/memory_view/types.ts";

export interface MockContext {
  statuses: string[];
  counters: {
    readonly treeReloads: number;
    readonly pendingReloads: number;
  };
  ctx: {
    service: MemoryServiceInterface;
    onStatusUpdate: (m: string) => void;
    onTreeReload: () => Promise<void>;
    onPendingCountReload: () => Promise<void>;
  };
}

export function createMockService(overrides: Partial<MemoryServiceInterface> = {}): MemoryServiceInterface {
  return {
    listPending: () => Promise.resolve([]),
    approvePending: () => Promise.resolve(),
    rejectPending: () => Promise.resolve(),
    ...overrides,
  } as unknown as MemoryServiceInterface;
}

export function createMockDialog(result: any, overrides: any = {}) {
  return {
    getResult: () => result,
    ...overrides,
  } as any;
}

export function createTestContext(overrides?: Partial<{ service: MemoryServiceInterface }>): MockContext {
  const statuses: string[] = [];
  let treeReloads = 0;
  let pendingReloads = 0;

  const service = overrides?.service ?? createMockService();

  return {
    statuses,
    counters: {
      get treeReloads() {
        return treeReloads;
      },
      get pendingReloads() {
        return pendingReloads;
      },
    },
    ctx: {
      service,
      onStatusUpdate: (m: string) => {
        statuses.push(m);
      },
      onTreeReload: () => {
        treeReloads++;
        return Promise.resolve();
      },
      onPendingCountReload: () => {
        pendingReloads++;
        return Promise.resolve();
      },
    },
  };
}
