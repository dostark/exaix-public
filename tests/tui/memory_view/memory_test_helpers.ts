import { MemoryServiceInterface } from "../../../src/tui/memory_view/types.ts";
import { DialogStatus } from "../../../src/enums.ts";

export interface IMemoryViewTestContext {
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
  const svc: MemoryServiceInterface = {
    getProjects: () => Promise.resolve([]),
    getProjectMemory: () => Promise.resolve(null),
    getGlobalMemory: () => Promise.resolve(null),
    getExecutionByTraceId: () => Promise.resolve(null),
    getExecutionHistory: () => Promise.resolve([]),
    search: () => Promise.resolve([]),
    listPending: () => Promise.resolve([]),
    getPending: () => Promise.resolve(null),
    approvePending: () => Promise.resolve(),
    rejectPending: () => Promise.resolve(),
  };
  return Object.assign(svc, overrides);
}

export function createMockDialog<T>(
  result: { type: DialogStatus; value?: T },
  overrides: Partial<{ [K in keyof T]?: T[K] }> = {},
) {
  const dialog = { getResult: () => result };
  Object.assign(dialog, overrides);
  return dialog as { getResult: () => { type: DialogStatus; value?: T } };
}

export function createTestContext(overrides?: Partial<{ service: MemoryServiceInterface }>): IMemoryViewTestContext {
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

export function testDialogProcess<T>(
  name: string,
  setup: () => {
    dialog: { getResult: () => { type: DialogStatus; value?: T } };
    ctx: IMemoryViewTestContext;
    process: (
      dialog: { getResult: () => { type: DialogStatus; value?: T } },
      ctx: IMemoryViewTestContext["ctx"],
    ) => Promise<void>;
  },
  verify: (ctx: IMemoryViewTestContext) => void | Promise<void>,
) {
  Deno.test(name, async () => {
    const { dialog, ctx, process } = setup();
    await process(dialog, ctx.ctx);
    await verify(ctx);
  });
}
