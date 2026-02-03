/**
 * Artifact Registry Service
 *
 * Manages analysis artifacts produced by read-only agents.
 * Stores artifacts as markdown files with YAML frontmatter in Memory/Execution/.
 */

import { join } from "@std/path";
import { parse as parseYaml, stringify as stringifyYaml } from "@std/yaml";
import type { DatabaseService } from "./db.ts";
import type { Artifact, ArtifactFilters, ArtifactFrontmatter, ArtifactWithContent } from "../schemas/artifact.ts";

/**
 * Generate short ID for artifacts
 */
function shortId(): string {
  return crypto.randomUUID().split("-")[0];
}

/**
 * Service for managing read-only agent artifacts
 */
export class ArtifactRegistry {
  constructor(private db: DatabaseService) {}

  /**
   * Create new artifact from agent execution
   */
  async createArtifact(
    requestId: string,
    agent: string,
    content: string,
    portal?: string,
  ): Promise<string> {
    const artifactId = `artifact-${shortId()}`;
    const filePath = join("Memory", "Execution", `${artifactId}.md`);
    const created = new Date().toISOString();

    // Ensure Memory/Execution directory exists
    await Deno.mkdir(join("Memory", "Execution"), { recursive: true });

    // Create frontmatter
    const frontmatter: ArtifactFrontmatter = {
      status: "pending",
      type: "analysis",
      agent,
      portal: portal || null,
      created,
      request_id: requestId,
    };

    // Write file with frontmatter + content
    const fileContent = `---\n${stringifyYaml(frontmatter)}---\n\n${content}`;
    await Deno.writeTextFile(filePath, fileContent);

    // Save to database
    await this.db.preparedRun(
      `INSERT INTO artifacts (id, status, type, agent, portal, created, request_id, file_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [artifactId, "pending", "analysis", agent, portal || null, created, requestId, filePath],
    );

    return artifactId;
  }

  /**
   * Update artifact status (approve/reject)
   */
  async updateStatus(
    artifactId: string,
    status: "approved" | "rejected",
    reason?: string,
  ): Promise<void> {
    const artifact = await this.getArtifactRecord(artifactId);

    // Read current content
    const fullContent = await Deno.readTextFile(artifact.file_path);

    // Parse frontmatter
    const match = fullContent.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
    if (!match) {
      throw new Error(`Invalid artifact format: ${artifactId}`);
    }

    const frontmatter = parseYaml(match[1]) as ArtifactFrontmatter;
    const body = match[2];

    // Update frontmatter
    frontmatter.status = status;

    // Write updated file
    const updated = `---\n${stringifyYaml(frontmatter)}---\n\n${body}`;
    await Deno.writeTextFile(artifact.file_path, updated);

    // Update database
    const now = new Date().toISOString();
    await this.db.preparedRun(
      `UPDATE artifacts SET status = ?, updated = ?, rejection_reason = ? WHERE id = ?`,
      [status, now, reason || null, artifactId],
    );
  }

  /**
   * Get artifact with content
   */
  async getArtifact(artifactId: string): Promise<ArtifactWithContent> {
    const artifact = await this.getArtifactRecord(artifactId);

    // Read file content
    const content = await Deno.readTextFile(artifact.file_path);

    // Parse to extract body
    const match = content.match(/^---\n[\s\S]*?\n---\n\n([\s\S]*)$/);
    const body = match ? match[1] : "";

    return {
      ...artifact,
      content,
      body,
    };
  }

  /**
   * Get artifact database record
   */
  private async getArtifactRecord(artifactId: string): Promise<Artifact> {
    const rows = await this.db.preparedAll<{
      id: string;
      status: string;
      type: string;
      agent: string;
      portal: string | null;
      created: string;
      updated: string | null;
      request_id: string;
      file_path: string;
      rejection_reason: string | null;
    }>(
      `SELECT id, status, type, agent, portal, created, updated, request_id, file_path, rejection_reason
       FROM artifacts WHERE id = ?`,
      [artifactId],
    );

    if (rows.length === 0) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }

    const row = rows[0];

    return {
      id: row.id,
      status: row.status as "pending" | "approved" | "rejected",
      type: row.type as "analysis" | "report" | "diagram",
      agent: row.agent,
      portal: row.portal,
      created: row.created,
      updated: row.updated,
      request_id: row.request_id,
      file_path: row.file_path,
      rejection_reason: row.rejection_reason,
    };
  }

  /**
   * List artifacts with filters
   */
  async listArtifacts(filters?: ArtifactFilters): Promise<Artifact[]> {
    let query = `SELECT id, status, type, agent, portal, created, updated, request_id, file_path, rejection_reason
                 FROM artifacts WHERE 1=1`;
    const params: (string | null)[] = [];

    if (filters?.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    if (filters?.agent) {
      query += ` AND agent = ?`;
      params.push(filters.agent);
    }

    if (filters?.portal !== undefined) {
      query += ` AND portal = ?`;
      params.push(filters.portal);
    }

    if (filters?.type) {
      query += ` AND type = ?`;
      params.push(filters.type);
    }

    query += ` ORDER BY created DESC`;

    const rows = await this.db.preparedAll<{
      id: string;
      status: string;
      type: string;
      agent: string;
      portal: string | null;
      created: string;
      updated: string | null;
      request_id: string;
      file_path: string;
      rejection_reason: string | null;
    }>(query, params);

    return rows.map((row) => ({
      id: row.id,
      status: row.status as "pending" | "approved" | "rejected",
      type: row.type as "analysis" | "report" | "diagram",
      agent: row.agent,
      portal: row.portal,
      created: row.created,
      updated: row.updated,
      request_id: row.request_id,
      file_path: row.file_path,
      rejection_reason: row.rejection_reason,
    }));
  }
}
