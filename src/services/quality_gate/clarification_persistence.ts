/**
 * @module ClarificationPersistence
 * @path src/services/quality_gate/clarification_persistence.ts
 * @description Persistence helpers for clarification sessions. Saves and loads
 * IClarificationSession as `<request-basename>_clarification.json` alongside
 * the request `.md` file, using atomic write (tmp + rename) for safety.
 * @architectural-layer Services
 * @dependencies [src/shared/schemas/clarification_session.ts]
 * @related-files [src/services/quality_gate/mod.ts, src/services/quality_gate/clarification_engine.ts]
 */

import { basename, dirname, extname, join } from "@std/path";
import { ClarificationSessionSchema, type IClarificationSession } from "../../shared/schemas/clarification_session.ts";

// ---------------------------------------------------------------------------
// Path derivation
// ---------------------------------------------------------------------------

/**
 * Derives the clarification JSON path from a request `.md` path.
 *
 * Example: `Workspace/Requests/my_request.md`
 *       →  `Workspace/Requests/my_request_clarification.json`
 */
function deriveClarificationPath(requestFilePath: string): string {
  const dir = dirname(requestFilePath);
  const ext = extname(requestFilePath);
  const base = basename(requestFilePath, ext);
  return join(dir, `${base}_clarification.json`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persists a clarification session as JSON, writing atomically via a `.tmp`
 * file that is renamed into place on success.
 */
export async function saveClarification(
  requestFilePath: string,
  session: IClarificationSession,
): Promise<void> {
  const jsonPath = deriveClarificationPath(requestFilePath);
  const tmpPath = `${jsonPath}.tmp`;
  const content = JSON.stringify(session, null, 2);

  await Deno.writeTextFile(tmpPath, content);
  await Deno.rename(tmpPath, jsonPath);
}

/**
 * Loads a previously saved clarification session. Returns `null` when the file
 * does not exist or cannot be parsed / validated against the schema.
 */
export async function loadClarification(
  requestFilePath: string,
): Promise<IClarificationSession | null> {
  const jsonPath = deriveClarificationPath(requestFilePath);

  let raw: string;
  try {
    raw = await Deno.readTextFile(jsonPath);
  } catch {
    return null;
  }

  try {
    const json = JSON.parse(raw) as unknown;
    return ClarificationSessionSchema.parse(json);
  } catch {
    return null;
  }
}
