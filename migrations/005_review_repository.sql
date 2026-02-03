-- up
-- Migration 005: Add repository column to reviews
-- Tracks the git repository path for portal-based reviews

ALTER TABLE reviews ADD COLUMN repository TEXT NOT NULL DEFAULT '';

-- Index for repository lookups
CREATE INDEX IF NOT EXISTS idx_reviews_repository ON reviews(repository);

-- down
-- SQLite doesn't support DROP COLUMN, so we would need to recreate the table
-- For development, this is acceptable as a no-op
-- ALTER TABLE reviews DROP COLUMN repository;
