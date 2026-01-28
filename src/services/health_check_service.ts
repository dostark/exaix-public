import type { DatabaseService } from "./db.ts";
import type { IModelProvider } from "../ai/providers.ts";
import type { Config } from "../config/schema.ts";
import {
  DEFAULT_HEALTH_CACHE_TTL_MS,
  DEFAULT_HEALTH_CHECK_TIMEOUT_MS,
  DEFAULT_MEMORY_CRITICAL_PERCENT,
  DEFAULT_MEMORY_WARN_PERCENT,
} from "../config/constants.ts";
import { HealthCheckVerdict, HealthStatus } from "../enums.ts";
import { EventLogger } from "./event_logger.ts";
import { LogMethod } from "./decorators/logging.ts";
import { CircuitBreaker } from "../ai/circuit_breaker.ts";
import { DEFAULT_MCP_VERSION } from "../config/constants.ts";

// Local defaults to avoid magic numbers in this module
const DEFAULT_CHECK_BREAKER_FAILURE_THRESHOLD = 3;
const DEFAULT_CHECK_BREAKER_RESET_TIMEOUT_MS = 60_000; // 1 minute
const DEFAULT_CHECK_BREAKER_HALF_OPEN_SUCCESS_THRESHOLD = 2;
const MS_PER_SECOND = 1000;

/**
 * Interface for individual health check implementations
 */
export interface HealthCheck {
  /** Unique name for this health check */
  name: string;
  /** Whether failure of this check should mark the overall service as unhealthy */
  critical: boolean;
  /** Perform the health check */
  check(): Promise<HealthCheckResult>;
}

/**
 * Result of a health check operation
 */
export interface HealthCheckResult {
  /** Status of the check: pass, warn, or fail */
  status: HealthCheckVerdict;
  /** Optional human-readable message */
  message?: string;
  /** Optional metadata about the check (response times, metrics, etc.) */
  metadata?: Record<string, unknown>;
  /** Duration of the check in milliseconds */
  duration_ms?: number;
}

/**
 * Overall health report of the service
 */
export interface HealthReport {
  /** Overall status: healthy, degraded, or unhealthy */
  status: HealthStatus;
  /** ISO timestamp when the check was performed */
  timestamp: string;
  /** Service version */
  version: string;
  /** Uptime in seconds since service start */
  uptime_seconds: number;
  /** Results of individual health checks */
  checks: Record<string, HealthCheckResult>;
}

/**
 * Cached health check result with expiration
 */
interface CachedHealthResult {
  result: HealthCheckResult;
  expiresAt: number; // Timestamp when cache expires
}

/**
 * Main health check service that orchestrates all health checks
 */
export class HealthCheckService {
  private checks = new Map<string, HealthCheck>();
  private checkBreakers = new Map<string, CircuitBreaker>();
  private startTime = Date.now();
  private healthCache = new Map<string, CachedHealthResult>();

  constructor(
    private version: string,
    private config?: Config,
    private logger?: EventLogger,
  ) {
    // Determine logger instance
    this.logger = logger ?? new EventLogger({ prefix: "[HealthCheck]" });
  }

  public get checkTimeoutMs(): number {
    return this.config?.health?.check_timeout_ms ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS;
  }

  public get cacheTtlMs(): number {
    return this.config?.health?.cache_ttl_ms ?? DEFAULT_HEALTH_CACHE_TTL_MS;
  }

  public get memoryWarnPercent(): number {
    return this.config?.health?.memory_warn_percent ?? DEFAULT_MEMORY_WARN_PERCENT;
  }

  public get memoryCriticalPercent(): number {
    return this.config?.health?.memory_critical_percent ?? DEFAULT_MEMORY_CRITICAL_PERCENT;
  }

  /**
   * Register a health check
   */
  registerCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);
    // Create a per-check circuit breaker with reasonable defaults (can be tuned via config)
    const healthCfg = (this.config as any)?.health ?? {};
    const opts = {
      failureThreshold: healthCfg.failure_threshold ?? DEFAULT_CHECK_BREAKER_FAILURE_THRESHOLD,
      resetTimeout: healthCfg.reset_timeout_ms ?? DEFAULT_CHECK_BREAKER_RESET_TIMEOUT_MS,
      halfOpenSuccessThreshold: healthCfg.half_open_success_threshold ??
        DEFAULT_CHECK_BREAKER_HALF_OPEN_SUCCESS_THRESHOLD,
    };
    this.checkBreakers.set(check.name, new CircuitBreaker(opts));
  }

  /**
   * Perform all registered health checks and return overall status
   */
  @LogMethod(new EventLogger({ prefix: "[HealthCheck]" }), "health.check_all")
  async checkHealth(): Promise<HealthReport> {
    const results: Record<string, HealthCheckResult> = {};
    let hasFailure = false;
    let hasWarning = false;

    // Run all checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(
      async ([name, check]) => {
        const start = performance.now();

        try {
          const breaker = this.checkBreakers.get(name);

          // Build a timed execution promise that enforces the check timeout and clears the timer
          const timedExecution = async () => {
            let timer: number | undefined;
            try {
              const p = check.check();
              const timeoutP = new Promise<never>((_, reject) => {
                timer = setTimeout(
                  () => reject(new Error(`Health check '${name}' timed out after ${this.checkTimeoutMs}ms`)),
                  this.checkTimeoutMs,
                );
              });
              return await Promise.race([p, timeoutP]);
            } finally {
              if (typeof timer !== "undefined") clearTimeout(timer);
            }
          };

          const result = breaker ? await breaker.execute(() => timedExecution()) : await timedExecution();

          const duration = performance.now() - start;
          results[name] = {
            ...result,
            duration_ms: Math.round(duration),
          };

          if (result.status === HealthCheckVerdict.FAIL) {
            if (check.critical) {
              hasFailure = true;
            } else {
              hasWarning = true;
            }
          } else if (result.status === HealthCheckVerdict.WARN) {
            hasWarning = true;
          }
        } catch (error) {
          const duration = performance.now() - start;
          results[name] = {
            status: HealthCheckVerdict.FAIL,
            message: error instanceof Error ? error.message : String(error),
            duration_ms: Math.round(duration),
          };

          if (check.critical) {
            hasFailure = true;
          } else {
            hasWarning = true;
          }
        }
      },
    );

    await Promise.allSettled(checkPromises);

    return {
      status: hasFailure ? HealthStatus.UNHEALTHY : hasWarning ? HealthStatus.DEGRADED : HealthStatus.HEALTHY,
      timestamp: new Date().toISOString(),
      version: this.version,
      uptime_seconds: Math.floor((Date.now() - this.startTime) / MS_PER_SECOND),
      checks: results,
    };
  }

  /**
   * Check the health of a specific provider by name with caching.
   * @param providerName The name of the provider to check
   * @returns True if the provider is healthy, false otherwise
   */
  @LogMethod(new EventLogger({ prefix: "[HealthCheck]" }), "health.check_provider")
  async checkProvider(providerName: string): Promise<boolean> {
    // ... existing implementation ...
    const now = Date.now();
    const cached = this.healthCache.get(providerName);

    // Return cached result if still valid
    if (cached && cached.expiresAt > now) {
      return cached.result.status === HealthCheckVerdict.PASS;
    }

    const check = this.checks.get(providerName);
    if (!check) {
      return true; // Provider not registered for health checks - assume healthy
    }

    try {
      const breaker = this.checkBreakers.get(providerName);
      const timed = async () => {
        let timer: number | undefined;
        try {
          const p = check.check();
          const timeoutP = new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error(`Provider health check timed out after ${this.checkTimeoutMs}ms`)),
              this.checkTimeoutMs,
            );
          });
          return await Promise.race([p, timeoutP]);
        } finally {
          if (typeof timer !== "undefined") clearTimeout(timer);
        }
      };

      const result = breaker ? await breaker.execute(() => timed()) : await timed();

      // Cache the result
      this.healthCache.set(providerName, {
        result,
        expiresAt: now + this.cacheTtlMs,
      });

      return result.status === HealthCheckVerdict.PASS;
    } catch (error) {
      // Cache failed result too to avoid repeated failures
      const failedResult: HealthCheckResult = {
        status: HealthCheckVerdict.FAIL,
        message: error instanceof Error ? error.message : String(error),
      };

      this.healthCache.set(providerName, {
        result: failedResult,
        expiresAt: now + this.cacheTtlMs,
      });

      return false;
    }
  }
}

/**
 * Database connectivity health check
 */
export class DatabaseHealthCheck implements HealthCheck {
  name = "database";
  critical = true;

  constructor(private db: DatabaseService) {}

  async check(): Promise<HealthCheckResult> {
    const start = performance.now();

    try {
      // Simple query to verify connectivity (breaker-protected)
      const result = await this.db.preparedGet<{ health_check: number }>("SELECT 1 as health_check");

      const duration = performance.now() - start;

      if (result && result.health_check === 1) {
        return {
          status: HealthCheckVerdict.PASS,
          metadata: {
            response_time_ms: Math.round(duration),
          },
          duration_ms: Math.round(duration),
        };
      } else {
        return {
          status: HealthCheckVerdict.FAIL,
          message: "Database returned unexpected result",
          duration_ms: Math.round(duration),
        };
      }
    } catch (error) {
      const duration = performance.now() - start;
      return await Promise.resolve({
        status: HealthCheckVerdict.FAIL,
        message: `Database health check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Math.round(duration),
      });
    }
  }
}

/**
 * LLM provider availability health check
 */
export class LLMProviderHealthCheck implements HealthCheck {
  name = "llm_provider";
  critical = false; // Can operate without LLM (mock mode)

  constructor(private provider: IModelProvider) {}

  async check(): Promise<HealthCheckResult> {
    const start = performance.now();

    try {
      // Test with minimal prompt
      await this.provider.generate("health check", {
        max_tokens: 10,
      });

      const duration = performance.now() - start;

      return {
        status: HealthCheckVerdict.PASS,
        metadata: {
          response_time_ms: Math.round(duration),
        },
        duration_ms: Math.round(duration),
      };
    } catch (error) {
      const duration = performance.now() - start;
      return {
        status: HealthCheckVerdict.FAIL,
        message: `LLM provider health check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Math.round(duration),
      };
    }
  }
}

/**
 * Disk space availability health check
 */
export class DiskSpaceHealthCheck implements HealthCheck {
  name = "disk_space";
  critical = true;

  constructor(
    private path: string,
    private thresholds: { warn: number; critical: number },
  ) {}

  async check(): Promise<HealthCheckResult> {
    const start = performance.now();

    try {
      // Use df command to get disk usage information
      const command = new Deno.Command("df", {
        args: ["-BG", this.path],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout, stderr } = await command.output();

      if (code !== 0) {
        const errorText = new TextDecoder().decode(stderr);
        throw new Error(`df command failed: ${errorText}`);
      }

      const output = new TextDecoder().decode(stdout);
      const lines = output.trim().split("\n");

      if (lines.length < 2) {
        throw new Error("Unexpected df output format");
      }

      // Parse the second line (skip header)
      const fields = lines[1].trim().split(/\s+/);
      if (fields.length < 5) {
        throw new Error("Unexpected df output format");
      }

      // df -BG shows sizes in 1G blocks, use percentage column
      const usePercent = parseInt(fields[4].replace("%", ""));

      const duration = performance.now() - start;

      if (usePercent >= this.thresholds.critical) {
        return {
          status: HealthCheckVerdict.FAIL,
          message: `Disk space critically low: ${usePercent}% used`,
          metadata: {
            path: this.path,
            used_percent: usePercent,
            warn_threshold: this.thresholds.warn,
            critical_threshold: this.thresholds.critical,
          },
          duration_ms: Math.round(duration),
        };
      } else if (usePercent >= this.thresholds.warn) {
        return {
          status: HealthCheckVerdict.WARN,
          message: `Disk space low: ${usePercent}% used`,
          metadata: {
            path: this.path,
            used_percent: usePercent,
            warn_threshold: this.thresholds.warn,
            critical_threshold: this.thresholds.critical,
          },
          duration_ms: Math.round(duration),
        };
      } else {
        return {
          status: HealthCheckVerdict.PASS,
          metadata: {
            path: this.path,
            used_percent: usePercent,
            warn_threshold: this.thresholds.warn,
            critical_threshold: this.thresholds.critical,
          },
          duration_ms: Math.round(duration),
        };
      }
    } catch (error) {
      const duration = performance.now() - start;
      return {
        status: HealthCheckVerdict.FAIL,
        message: `Disk space check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Math.round(duration),
      };
    }
  }
}

/**
 * Memory usage health check
 */
export class MemoryHealthCheck implements HealthCheck {
  name = "memory";
  critical = true;

  constructor(private thresholds: { warn: number; critical: number }) {}

  async check(): Promise<HealthCheckResult> {
    const start = performance.now();

    try {
      const usage = Deno.memoryUsage();
      const usedBytes = usage.heapUsed;
      const totalBytes = usage.heapTotal;

      const usedMB = usedBytes / 1024 / 1024;
      const totalMB = totalBytes / 1024 / 1024;
      const usedPercent = (usedBytes / totalBytes) * 100;

      const duration = performance.now() - start;

      if (usedPercent >= this.thresholds.critical) {
        return Promise.resolve({
          status: HealthCheckVerdict.FAIL,
          message: `Memory usage critically high: ${usedPercent.toFixed(1)}% used`,
          metadata: {
            used_mb: Math.round(usedMB),
            total_mb: Math.round(totalMB),
            used_percent: Math.round(usedPercent * 10) / 10,
          },
          duration_ms: Math.round(duration),
        });
      } else if (usedPercent >= this.thresholds.warn) {
        return Promise.resolve({
          status: HealthCheckVerdict.WARN,
          message: `Memory usage high: ${usedPercent.toFixed(1)}% used`,
          metadata: {
            used_mb: Math.round(usedMB),
            total_mb: Math.round(totalMB),
            used_percent: Math.round(usedPercent * 10) / 10,
          },
          duration_ms: Math.round(duration),
        });
      } else {
        return await Promise.resolve({
          status: HealthCheckVerdict.PASS,
          metadata: {
            used_mb: Math.round(usedMB),
            total_mb: Math.round(totalMB),
            used_percent: Math.round(usedPercent * 10) / 10,
          },
          duration_ms: Math.round(duration),
        });
      }
    } catch (error) {
      const duration = performance.now() - start;
      return await Promise.resolve({
        status: HealthCheckVerdict.FAIL,
        message: `Memory check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Math.round(duration),
      });
    }
  }
}

/**
 * Initialize health checks for the service
 */
export function initializeHealthChecks(
  db: DatabaseService,
  provider: IModelProvider,
  config: Config,
): HealthCheckService {
  const health = new HealthCheckService(DEFAULT_MCP_VERSION, config);

  health.registerCheck(new DatabaseHealthCheck(db));
  health.registerCheck(new LLMProviderHealthCheck(provider));
  health.registerCheck(
    new DiskSpaceHealthCheck(config.system.root, {
      warn: health.memoryWarnPercent,
      critical: health.memoryCriticalPercent,
    }),
  );
  health.registerCheck(
    new MemoryHealthCheck({
      warn: health.memoryWarnPercent,
      critical: health.memoryCriticalPercent,
    }),
  );

  return health;
}

// expose circuit state for checks for testing/inspection
export interface HealthCheckServiceWithInspection extends HealthCheckService {
  getCheckCircuitState(name: string): string | null;
}

// Add runtime method on prototype for inspection
(HealthCheckService.prototype as any).getCheckCircuitState = function (name: string) {
  const cb = (this as any).checkBreakers?.get(name) as CircuitBreaker | undefined;
  return cb ? cb.getState() : null;
};

/**
 * HTTP endpoint handler for health checks
 */
export async function handleHealthCheck(
  _req: Request,
  health: HealthCheckService,
): Promise<Response> {
  // Build a middleware pipeline to add timing, error handling, and logging
  const pipelineModule = await import("./middleware/pipeline.ts");
  const MiddlewarePipeline = pipelineModule
    .MiddlewarePipeline as typeof import("./middleware/pipeline.ts").MiddlewarePipeline;
  const pipeline = new MiddlewarePipeline<any>();

  // Error handling middleware: ensure any thrown errors produce a 503 JSON response
  pipeline.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      const errorResponse = {
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date().toISOString(),
        version: DEFAULT_MCP_VERSION,
        uptime_seconds: 0,
        checks: {},
        error: err instanceof Error ? err.message : String(err),
      };

      ctx.res = new Response(JSON.stringify(errorResponse, null, 2), {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });
    }
  });

  // Timing/metrics middleware: measure duration and attach X-Response-Time-ms header
  pipeline.use(async (ctx, next) => {
    const start = (typeof performance !== "undefined") ? performance.now() : Date.now();
    await next();
    const duration = Math.round(((typeof performance !== "undefined") ? performance.now() : Date.now()) - start);

    if (ctx.res instanceof Response) {
      const headers = new Headers(ctx.res.headers);
      headers.set("X-Response-Time-ms", String(duration));
      // preserve cache-control if present
      ctx.res = new Response(ctx.res.body, { status: ctx.res.status, headers });
    }
  });

  // Logging middleware: lightweight console logging for request lifecycle
  pipeline.use(async (ctx, next) => {
    try {
      console.debug("[health] request start", { url: ctx.req.url });
      await next();
      console.debug("[health] request end", { status: ctx.res?.status });
    } catch (e) {
      console.error("[health] request error", e instanceof Error ? e.message : String(e));
      throw e;
    }
  });

  // Execute pipeline with a handler that performs the actual health check and builds the response
  const context: any = { req: _req, health, res: undefined };

  await pipeline.execute(context, async () => {
    const status = await health.checkHealth();

    // Return appropriate HTTP status code based on health status
    let httpStatus = 200;
    if (status.status === HealthStatus.UNHEALTHY) {
      httpStatus = 503; // Service Unavailable
    } else if (status.status === HealthStatus.DEGRADED) {
      httpStatus = 200; // Still OK but with warnings
    }

    context.res = new Response(JSON.stringify(status, null, 2), {
      status: httpStatus,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });
  });

  return context.res as Response;
}
