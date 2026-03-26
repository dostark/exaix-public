-- up
-- Phase 54: add actor_type, agent_kind, identity_id to activity table
-- agent_id column is kept; it now means the runtime agent (AgentRunner, etc.)
-- identity_id is the new column for the LLM identity blueprint reference
-- actor_type distinguishes between user, mcp, service actors per GLOSSARY.md

ALTER TABLE activity ADD COLUMN actor_type TEXT;
ALTER TABLE activity ADD COLUMN agent_kind TEXT;
ALTER TABLE activity ADD COLUMN identity_id TEXT;

-- Backfill: before Phase 54, agent_id held identity references.
-- Copy those values into identity_id so historical data is not lost.
UPDATE activity SET identity_id = agent_id WHERE agent_id IS NOT NULL;

-- Add index for identity_id queries
CREATE INDEX IF NOT EXISTS idx_activity_identity ON activity(identity_id);
CREATE INDEX IF NOT EXISTS idx_activity_actor_type ON activity(actor_type);
CREATE INDEX IF NOT EXISTS idx_activity_agent_kind ON activity(agent_kind);

-- down
-- Note: SQLite does not support DROP COLUMN directly.
-- To reverse this migration, you would need to recreate the table without these columns.
-- This is intentionally left as a no-op for safety.
-- In practice, you would:
-- 1. CREATE TABLE activity_new (...) without the new columns
-- 2. INSERT INTO activity_new SELECT ... FROM activity
-- 3. DROP TABLE activity
-- 4. ALTER TABLE activity_new RENAME TO activity
