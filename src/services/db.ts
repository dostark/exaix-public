import { Database } from "@db/sqlite";
import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import type { Config } from "../config/schema.ts";

interface LogEntry {
  activityId: string;
  traceId: string;
  actor: string;
  agentId: string | null;
  actionType: string;
  target: string | null;
  payload: string;
  timestamp: string;
}

/** Activity record returned from database queries */
export interface ActivityRecord {
  id: string;
  trace_id: string;
  actor: string | null;
  agent_id: string | null;
  action_type: string;
  target: string | null;
  payload: string;
  timestamp: string;
  count?: number; // For aggregation queries
}

export class DatabaseService {
  private db: Database;
  private logQueue: LogEntry[] = [];
  private flushTimer: number | null = null;
  private readonly FLUSH_INTERVAL_MS: number;
  private readonly MAX_BATCH_SIZE: number;
  private isClosing = false;

  constructor(config: Config) {
    const dbDir = join(config.system.root, config.paths.runtime);
    const dbPath = join(dbDir, "journal.db");

    // Ensure database directory exists (fixes CI issues with temp directories)
    ensureDir(dbDir);

    this.db = new Database(dbPath);
    // Enable configured SQLite features
    this.db.exec(`PRAGMA journal_mode = ${config.database.sqlite.journal_mode};`);
    this.db.exec(`PRAGMA foreign_keys = ${config.database.sqlite.foreign_keys ? "ON" : "OFF"};`);
    this.db.exec(`PRAGMA busy_timeout = ${config.database.sqlite.busy_timeout_ms};`);

    // Load batch configuration
    this.FLUSH_INTERVAL_MS = config.database.batch_flush_ms;
    this.MAX_BATCH_SIZE = config.database.batch_max_size;
  }

  /**
   * Get the raw Database instance
   */
  get instance(): Database {
    return this.db;
  }

  /**
   * Log an activity to the journal (non-blocking, batched writes)
   */
  logActivity(
    actor: string,
    actionType: string,
    target: string | null,
    payload: Record<string, unknown>,
    traceId?: string,
    agentId?: string | null,
  ) {
    if (this.isClosing) {
      console.warn("Cannot log activity: DatabaseService is closing");
      return;
    }

    const entry: LogEntry = {
      activityId: crypto.randomUUID(),
      traceId: traceId || crypto.randomUUID(),
      actor,
      agentId: agentId || null,
      actionType,
      target,
      payload: JSON.stringify(payload),
      timestamp: new Date().toISOString(),
    };

    this.logQueue.push(entry);

    // Flush immediately if batch size exceeded
    if (this.logQueue.length >= this.MAX_BATCH_SIZE) {
      this.flush();
    } else if (!this.flushTimer) {
      // Schedule flush after interval
      this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL_MS);
    }
  }

  /**
   * Wait for all pending log entries to be flushed
   * Returns a promise that resolves when the queue is empty
   */
  async waitForFlush(): Promise<void> {
    // If there's nothing queued, return immediately
    if (this.logQueue.length === 0) return;

    // Trigger flush if scheduled
    this.flush();

    // Wait for queue to be empty using exponential backoff
    let attempts = 0;
    const maxAttempts = 20; // Max 2 seconds (100ms * 20)
    while (this.logQueue.length > 0 && attempts < maxAttempts) {
      await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));
      attempts++;
      if (this.logQueue.length > 0) {
        // Small delay if queue is still not empty
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // One more microtask to ensure writes completed
    await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));
  }

  /**
   * Execute a function within a transaction with retry logic
   */
  /**
   * Execute database operations with retry logic for transient failures
   * @private
   */
  private async retryTransaction<T>(
    callback: () => T,
    options: RetryOptions = {},
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 100,
      maxDelay = 5000,
      backoffFactor = 2,
      jitter = true,
    } = options;

    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        // Execute the callback synchronously within a transaction
        this.db.exec("BEGIN IMMEDIATE TRANSACTION");
        const result = callback();
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        // Rollback on error
        try {
          this.db.exec("ROLLBACK");
        } catch {
          // Ignore rollback errors
        }

        const lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        // Check if this is a retryable error (database locked)
        const isRetryable = lastError.message.includes("database is locked") ||
          lastError.message.includes("database table is locked");

        if (!isRetryable || attempt > maxRetries) {
          throw lastError;
        }

        // Calculate delay with exponential backoff
        let delay = baseDelay * Math.pow(backoffFactor, attempt - 1);

        // Add jitter to prevent thundering herd
        if (jitter) {
          delay = delay * (0.5 + Math.random() * 0.5); // ±50% jitter
        }

        // Cap maximum delay
        delay = Math.min(delay, maxDelay);

        // Non-blocking delay
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Log retry attempt (if logger available)
        console.debug(`Database retry attempt ${attempt}/${maxRetries} after ${delay}ms delay: ${lastError.message}`);
      }
    }

    throw new Error("Unreachable code");
  }

  /**
   * Execute batch insert with transaction handling
   * @private
   */
  private async executeBatchInsert(batch: LogEntry[], context: string): Promise<void> {
    try {
      await this.retryTransaction(() => {
        for (const entry of batch) {
          this.db.exec(
            `INSERT INTO activity (id, trace_id, actor, agent_id, action_type, target, payload, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              entry.activityId ?? null,
              entry.traceId ?? null,
              entry.actor ?? null,
              entry.agentId ?? null,
              entry.actionType ?? null,
              entry.target ?? null,
              entry.payload ?? null,
              entry.timestamp ?? null,
            ],
          );
        }
      });
    } catch (error) {
      console.error(`Failed to flush ${batch.length} activity logs (${context}):`, error);
    }
  }

  /**
   * Flush pending log entries to database
   */
  private flush() {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.logQueue.length === 0) return;

    const batch = this.logQueue.splice(0);

    // Write asynchronously without blocking
    queueMicrotask(async () => {
      await this.executeBatchInsert(batch, "flush");
    });
  }

  /**
   * Close the database connection and flush pending logs
   */
  async close(): Promise<void> {
    this.isClosing = true;

    // Flush any remaining logs before closing
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.logQueue.length > 0) {
      const batch = this.logQueue.splice(0);
      await this.executeBatchInsert(batch, "close");
    }

    this.db.close();
  }

  /**
   * Query activities by trace_id (for testing/debugging)
   */
  getActivitiesByTrace(traceId: string): ActivityRecord[] {
    const stmt = this.db.prepare(
      `SELECT id, trace_id, actor, agent_id, action_type, target, payload, timestamp
       FROM activity
       WHERE trace_id = ?
       ORDER BY timestamp`,
    );

    return stmt.all(traceId) as unknown as ActivityRecord[];
  }

  /**
   * Query activities by action_type (for testing/debugging)
   */
  getActivitiesByActionType(actionType: string): ActivityRecord[] {
    const stmt = this.db.prepare(
      `SELECT id, trace_id, actor, agent_id, action_type, target, payload, timestamp
       FROM activity
       WHERE action_type = ?
       ORDER BY timestamp`,
    );

    return stmt.all(actionType) as unknown as ActivityRecord[];
  }

  /**
   * Query recent activities (for testing/debugging)
   */
  async getRecentActivity(limit: number = 100): Promise<ActivityRecord[]> {
    // Flush pending logs before querying
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.logQueue.length > 0) {
      const batch = this.logQueue.splice(0);
      await this.executeBatchInsert(batch, "getRecentActivity");
    }

    const stmt = this.db.prepare(
      `SELECT id, trace_id, actor, agent_id, action_type, target, payload, timestamp
       FROM activity
       ORDER BY timestamp DESC
       LIMIT ?`,
    );

    return stmt.all(limit) as unknown as ActivityRecord[];
  }

  /**
   * Query activity journal with flexible filters
   */
  async queryActivity(filter: JournalFilterOptions): Promise<ActivityRecord[]> {
    // Flush pending logs before querying
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.logQueue.length > 0) {
      const batch = this.logQueue.splice(0);
      await this.executeBatchInsert(batch, "queryActivity");
    }

    // Build SELECT clause
    let selectClause = `SELECT `;
    if (filter.distinct) {
      selectClause += `DISTINCT ${filter.distinct}`;
    } else if (filter.count) {
      selectClause += `action_type, COUNT(*) as count`;
    } else {
      selectClause += `id, trace_id, actor, agent_id, action_type, target, payload, timestamp`;
    }

    // Build WHERE clause
    const whereParts: string[] = [];
    const params: (string | number)[] = [];

    if (filter.orConditions && filter.orConditions.length > 0) {
      // Handle OR conditions
      const orParts: string[] = [];
      for (const orFilter of filter.orConditions) {
        const orWhere = this.buildWhereClause(orFilter, params);
        if (orWhere) {
          orParts.push(`(${orWhere})`);
        }
      }
      if (orParts.length > 0) {
        whereParts.push(`(${orParts.join(' OR ')})`);
      }
    } else {
      // Handle single condition
      const where = this.buildWhereClause(filter, params);
      if (where) {
        whereParts.push(where);
      }
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    let query = `${selectClause} FROM activity ${whereClause}`;

    // Add GROUP BY for count queries
    if (filter.count) {
      query += ` GROUP BY action_type`;
    }

    query += ` ORDER BY timestamp DESC`;
    query += ` LIMIT ?`;
    params.push(filter.limit || 50);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as unknown as ActivityRecord[];
  }

  private buildWhereClause(filter: JournalFilterOptions, params: (string | number)[]): string {
    const conditions: string[] = [];

    if (filter.traceId) {
      conditions.push(`trace_id = ?`);
      params.push(filter.traceId);
    }

    if (filter.actionType) {
      if (filter.actionType.includes('%')) {
        conditions.push(`action_type LIKE ?`);
      } else {
        conditions.push(`action_type = ?`);
      }
      params.push(filter.actionType);
    }

    if (filter.agentId) {
      conditions.push(`agent_id = ?`);
      params.push(filter.agentId);
    }

    if (filter.payload) {
      conditions.push(`payload LIKE ?`);
      params.push(filter.payload);
    }

    if (filter.actor) {
      conditions.push(`actor = ?`);
      params.push(filter.actor);
    }

    if (filter.target) {
      conditions.push(`target = ?`);
      params.push(filter.target);
    }

    if (filter.since) {
      conditions.push(`timestamp > ?`);
      params.push(filter.since);
    }

    return conditions.join(' AND ');
  }
}

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
}

/**
 * Filter options for querying activity journal
 */
export interface JournalFilterOptions {
  traceId?: string;
  actionType?: string;
  agentId?: string;
  limit?: number;
  since?: string; // ISO date string
  payload?: string; // LIKE pattern
  actor?: string;
  target?: string;
  distinct?: string; // field name for DISTINCT
  count?: boolean; // if true, return count aggregation
  orConditions?: JournalFilterOptions[]; // OR conditions
}
