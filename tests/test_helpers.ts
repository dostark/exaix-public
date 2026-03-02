/**
 * @module TestHelpersSelfTest
 * @path tests/test_helpers.ts
 * @description Self-tests for the primary test helper repository, ensuring stable delivery
 * of mock files, request factories, and common visual primitives.
 */

import type { IDatabaseService } from "../src/services/db.ts";
import type { ActivityRepository } from "../src/repositories/activity_repository.ts";
import { type Config, ConfigSchema } from "../src/shared/schemas/config.ts";
import type { ICliApplicationContext } from "../src/cli/cli_context.ts";
import type { IModelProvider } from "../src/ai/types.ts";
import type { IGitService } from "../src/shared/interfaces/i_git_service.ts";
import type { IDisplayService } from "../src/shared/interfaces/i_display_service.ts";
import type { IConfigService } from "../src/shared/interfaces/i_config_service.ts";
import { JSONObject } from "../src/shared/types/json.ts";
import { ExoPathDefaults } from "../src/shared/constants.ts";
import { LogLevel } from "../src/shared/enums.ts";

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
      _payload: JSONObject,
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
    close: () => Promise.resolve(),
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

/**
 * Create a stub IConfigService for tests.
 */
export function createStubConfig(config: Config): IConfigService {
  return {
    get: () => config,
    getAll: () => config,
    getConfigPath: () => "/mock/exo.config.toml",
    reload: () => config,
    addPortal: () => Promise.resolve(),
    removePortal: () => Promise.resolve(),
    getPortals: () => [],
    getPortal: () => undefined,
  };
}

/**
 * Create a stub IModelProvider for tests.
 */
export function createStubProvider(): IModelProvider {
  return {
    id: "mock-provider",
    generate: () => Promise.resolve("Mock response"),
  };
}

/**
 * Create a stub IGitService for tests.
 */
export function createStubGit(): IGitService {
  return {
    setRepository: () => {},
    getRepository: () => "/mock/repo",
    ensureRepository: () => Promise.resolve(),
    ensureIdentity: () => Promise.resolve(),
    createBranch: () => Promise.resolve("feature/test"),
    commit: () => Promise.resolve("abcdef"),
    checkoutBranch: () => Promise.resolve(),
    getCurrentBranch: () => Promise.resolve("main"),
    getDefaultBranch: () => Promise.resolve("main"),
    addWorktree: () => Promise.resolve(),
    removeWorktree: () => Promise.resolve(),
    pruneWorktrees: () => Promise.resolve(""),
    listWorktrees: () => Promise.resolve([]),
    runGitCommand: () => Promise.resolve({ output: "", exitCode: 0 }),
  };
}

/**
 * Create a stub IDisplayService for tests.
 */
export function createStubDisplay(): IDisplayService {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    log: () => {},
    success: () => {},
  } as unknown as IDisplayService;
}

/**
 * Create a stub ICliApplicationContext for tests.
 */
export function createStubContext(overrides: Partial<ICliApplicationContext> = {}): ICliApplicationContext {
  const root = "/tmp/exo-test";
  const config: Config = ConfigSchema.parse({
    system: { root, log_level: LogLevel.INFO },
    paths: { ...ExoPathDefaults },
  });

  const base: ICliApplicationContext = {
    db: createStubDb(),
    config: createStubConfig(config),
    provider: createStubProvider(),
    git: createStubGit(),
    display: createStubDisplay(),
  };

  return Object.assign(base, overrides);
}
