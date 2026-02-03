/**
 * Changeset Registry Service
 *
 * Manages changesets created by agents during plan execution.
 * Provides database-backed tracking with approval workflow.
 */

import type { DatabaseService } from "./db.ts";
import type { EventLogger } from "./event_logger.ts";
import {
  type Changeset,
  type ChangesetFilters,
  ChangesetSchema,
  type RegisterChangesetInput,
  RegisterChangesetSchema,
} from "../schemas/changeset.ts";
import { ChangesetStatus } from "../enums.ts";

export class ChangesetRegistry {
  constructor(
    private db: DatabaseService,
    private logger: EventLogger,
  ) {}

  /**
   * Register a new changeset created by an agent
   */
  async register(input: RegisterChangesetInput): Promise<string> {
    // Validate input
    const validated = RegisterChangesetSchema.parse(input);

    // Generate UUID for changeset
    const id = crypto.randomUUID();
    const created = new Date().toISOString();
    const status = ChangesetStatus.PENDING;

    // Insert into database
    const sql = `
      INSERT INTO changesets (
        id, trace_id, portal, branch, repository, status, description,
        commit_sha, files_changed, created, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.preparedRun(sql, [
      id,
      validated.trace_id,
      validated.portal,
      validated.branch,
      validated.repository,
      status,
      validated.description,
      validated.commit_sha || null,
      validated.files_changed,
      created,
      validated.created_by,
    ]);

    // Log to Activity Journal
    await this.logger.info("changeset.created", validated.branch, {
      changeset_id: id,
      trace_id: validated.trace_id,
      portal: validated.portal,
      branch: validated.branch,
      repository: validated.repository,
      created_by: validated.created_by,
      files_changed: validated.files_changed,
    }, validated.trace_id);

    return id;
  }

  /**
   * Create a new changeset with branch creation in specified repository
   * Higher-level API that combines branch creation and registration
   *
   * @param traceId - Trace ID for the changeset (must be valid UUID)
   * @param portal - Portal name (or null for workspace)
   * @param branch - Branch name (already created by GitService)
   * @param repository - Absolute path to git repository
   * @returns Changeset ID
   */
  async createChangeset(
    traceId: string,
    portal: string | null,
    branch: string,
    repository: string,
  ): Promise<string> {
    // Register changeset using the register method
    return await this.register({
      trace_id: traceId,
      portal: portal,
      branch,
      repository,
      description: `Changeset for ${branch}`,
      created_by: "agent", // TODO: Get from execution context
      files_changed: 0,
    });
  }

  /**
   * Get diff for a changeset from its repository
   *
   * @param changesetId - Changeset ID
   * @returns Git diff output
   */
  async getDiff(changesetId: string): Promise<string> {
    const changeset = await this.get(changesetId);
    if (!changeset) {
      throw new Error(`Changeset not found: ${changesetId}`);
    }

    // Get the default branch (main/master/etc)
    const branchCmd = new Deno.Command("git", {
      args: ["branch", "--show-current"],
      cwd: changeset.repository,
      stdout: "piped",
      stderr: "piped",
    });

    const branchResult = await branchCmd.output();
    const _currentBranch = new TextDecoder().decode(branchResult.stdout).trim();

    // Try to get first commit (root) as base
    const rootCmd = new Deno.Command("git", {
      args: ["rev-list", "--max-parents=0", "HEAD"],
      cwd: changeset.repository,
      stdout: "piped",
      stderr: "piped",
    });

    const rootResult = await rootCmd.output();
    const rootCommit = new TextDecoder().decode(rootResult.stdout).trim().split("\n")[0];

    // Run git diff from root commit to HEAD
    const cmd = new Deno.Command("git", {
      args: ["diff", rootCommit, "HEAD"],
      cwd: changeset.repository,
      stdout: "piped",
      stderr: "piped",
    });

    const { stdout, stderr, code } = await cmd.output();

    if (code !== 0) {
      const error = new TextDecoder().decode(stderr);
      throw new Error(`Git diff failed: ${error}`);
    }

    return new TextDecoder().decode(stdout);
  }

  /**
   * Get changeset by ID
   */
  async get(id: string): Promise<Changeset | null> {
    const sql = `SELECT * FROM changesets WHERE id = ?`;
    const row = await this.db.preparedGet(sql, [id]);

    if (!row) return null;
    return ChangesetSchema.parse(row);
  }

  /**
   * Get changeset by branch name
   */
  async getByBranch(branch: string): Promise<Changeset | null> {
    const sql = `SELECT * FROM changesets WHERE branch = ?`;
    const row = await this.db.preparedGet(sql, [branch]);
    if (!row) return null;
    return ChangesetSchema.parse(row);
  }

  /**
   * List changesets with optional filters
   */
  async list(filters?: ChangesetFilters): Promise<Changeset[]> {
    let sql = `SELECT * FROM changesets WHERE 1=1`;
    const params: Array<string | number> = [];

    if (filters?.trace_id) {
      sql += ` AND trace_id = ?`;
      params.push(filters.trace_id);
    }

    if (filters?.portal) {
      sql += ` AND portal = ?`;
      params.push(filters.portal);
    }

    if (filters?.status) {
      sql += ` AND status = ?`;
      params.push(filters.status);
    }

    if (filters?.created_by) {
      sql += ` AND created_by = ?`;
      params.push(filters.created_by);
    }

    sql += ` ORDER BY created DESC`;

    const rows = await this.db.preparedAll<any>(sql, params as unknown[]);
    return rows.map((row) => ChangesetSchema.parse(row));
  }

  /**
   * Update changeset status
   */
  async updateStatus(
    id: string,
    status: ChangesetStatus,
    user?: string,
    reason?: string,
  ): Promise<void> {
    // Get existing changeset
    const changeset = await this.get(id);
    if (!changeset) {
      throw new Error(`Changeset not found: ${id}`);
    }

    const timestamp = new Date().toISOString();

    let sql = `UPDATE changesets SET status = ?`;
    const params: Array<string | number | null> = [status];

    if (status === ChangesetStatus.APPROVED) {
      sql = `UPDATE changesets SET status = ?, approved_at = ?, approved_by = ? WHERE id = ?`;
      params.push(timestamp, user || null, id);

      // Log approval
      await this.logger.info("changeset.approved", changeset.branch, {
        changeset_id: id,
        trace_id: changeset.trace_id,
        portal: changeset.portal,
        branch: changeset.branch,
        approved_by: user,
        approved_at: timestamp,
      }, changeset.trace_id);
    } else if (status === ChangesetStatus.REJECTED) {
      sql = `UPDATE changesets SET status = ?, rejected_at = ?, rejected_by = ?, rejection_reason = ? WHERE id = ?`;
      params.push(timestamp, user || null, reason || null, id);

      // Log rejection
      await this.logger.info("changeset.rejected", changeset.branch, {
        changeset_id: id,
        trace_id: changeset.trace_id,
        portal: changeset.portal,
        branch: changeset.branch,
        rejected_by: user,
        rejected_at: timestamp,
        rejection_reason: reason,
      }, changeset.trace_id);
    } else {
      sql += ` WHERE id = ?`;
      params.push(id);
    }

    await this.db.preparedRun(sql, params as unknown[]);
  }

  /**
   * Get all changesets for a specific trace
   */
  async getByTrace(trace_id: string): Promise<Changeset[]> {
    return await this.list({ trace_id });
  }

  /**
   * Get pending changesets for a portal
   */
  async getPendingForPortal(portal: string): Promise<Changeset[]> {
    return await this.list({ portal, status: ChangesetStatus.PENDING });
  }

  /**
   * Count changesets by status
   */
  async countByStatus(status: ChangesetStatus): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM changesets WHERE status = ?`;
    const row = await this.db.preparedGet<{ count: number }>(sql, [status]);
    return row?.count || 0;
  }

  /**
   * Delete a changeset (for testing/cleanup only)
   */
  async delete(id: string): Promise<void> {
    const sql = `DELETE FROM changesets WHERE id = ?`;
    await this.db.preparedRun(sql, [id]);
  }
}
