/**
 * Activity Repository
 *
 * Repository pattern implementation for activity/event data access.
 * Abstracts database operations from business logic.
 */

import type { ActivityRecord, DatabaseService } from "../services/db.ts";

/**
 * Domain entity representing an activity/event
 */
export interface Activity {
  id: string;
  traceId: string;
  actor: string | null;
  agentId: string | null;
  actionType: string;
  target: string | null;
  payload: Record<string, unknown>;
  timestamp: string;
}

/**
 * Activity logging request (without generated fields)
 */
export interface LogActivityRequest {
  actor: string;
  actionType: string;
  target: string | null;
  payload?: Record<string, unknown>;
  traceId?: string;
  agentId?: string | null;
}

/**
 * Repository interface for activity data access
 */
export interface ActivityRepository {
  /**
   * Log an activity/event
   */
  logActivity(request: LogActivityRequest): Promise<void>;

  /**
   * Get activities by trace ID
   */
  getActivitiesByTraceId(traceId: string): Promise<Activity[]>;

  /**
   * Get activities by action type
   */
  getActivitiesByActionType(actionType: string): Promise<Activity[]>;

  /**
   * Get recent activities
   */
  getRecentActivities(limit?: number): Promise<Activity[]>;
}

/**
 * Database implementation of ActivityRepository
 */
export class DatabaseActivityRepository implements ActivityRepository {
  constructor(private db: DatabaseService) {}

  async logActivity(request: LogActivityRequest): Promise<void> {
    this.db.logActivity(
      request.actor,
      request.actionType,
      request.target,
      request.payload ?? {},
      request.traceId,
      request.agentId,
    );

    // Wait for the activity to be flushed to ensure it's persisted
    // This is important for tests and immediate reads
    await this.db.waitForFlush();
  }

  async getActivitiesByTraceId(traceId: string): Promise<Activity[]> {
    const records = this.db.getActivitiesByTrace(traceId);
    return await records.map(this.mapRecordToActivity);
  }

  async getActivitiesByActionType(actionType: string): Promise<Activity[]> {
    const records = this.db.getActivitiesByActionType(actionType);
    return await records.map(this.mapRecordToActivity);
  }

  async getRecentActivities(limit: number = 100): Promise<Activity[]> {
    const records = await this.db.getRecentActivity(limit);
    return records.map(this.mapRecordToActivity);
  }

  /**
   * Map database record to domain entity
   */
  private mapRecordToActivity(record: ActivityRecord): Activity {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(record.payload);
    } catch {
      // If payload is malformed, return empty object
      payload = {};
    }

    return {
      id: record.id,
      traceId: record.trace_id,
      actor: record.actor,
      agentId: record.agent_id,
      actionType: record.action_type,
      target: record.target,
      payload,
      timestamp: record.timestamp,
    };
  }
}
