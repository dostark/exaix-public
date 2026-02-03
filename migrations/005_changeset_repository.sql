-- up
-- Migration 005: Add repository column to changesets
-- Tracks the git repository path for portal-based changesets

ALTER TABLE changesets ADD COLUMN repository TEXT NOT NULL DEFAULT '';

-- Index for repository lookups
CREATE INDEX IF NOT EXISTS idx_changesets_repository ON changesets(repository);

-- down
-- SQLite doesn't support DROP COLUMN, so we would need to recreate the table
-- For development, this is acceptable as a no-op
-- ALTER TABLE changesets DROP COLUMN repository;
