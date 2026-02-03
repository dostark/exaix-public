-- up
-- Migration 007: Rename changesets table to reviews
-- Phase 36: Semantic clarity - "review" better describes unified workflow for git changesets + artifacts

-- Rename table (SQLite 3.25.0+ supports ALTER TABLE RENAME)
ALTER TABLE changesets RENAME TO reviews;

-- Drop old indexes
DROP INDEX IF EXISTS idx_changesets_trace_id;
DROP INDEX IF EXISTS idx_changesets_status;
DROP INDEX IF EXISTS idx_changesets_portal;
DROP INDEX IF EXISTS idx_changesets_created_by;
DROP INDEX IF EXISTS idx_changesets_branch;

-- Recreate indexes with new naming
CREATE INDEX IF NOT EXISTS idx_reviews_trace_id ON reviews(trace_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_portal ON reviews(portal);
CREATE INDEX IF NOT EXISTS idx_reviews_created_by ON reviews(created_by);
CREATE INDEX IF NOT EXISTS idx_reviews_branch ON reviews(branch);

-- down
-- Rollback: Rename reviews back to changesets

-- Rename table back
ALTER TABLE reviews RENAME TO changesets;

-- Drop new indexes
DROP INDEX IF EXISTS idx_reviews_trace_id;
DROP INDEX IF EXISTS idx_reviews_status;
DROP INDEX IF EXISTS idx_reviews_portal;
DROP INDEX IF EXISTS idx_reviews_created_by;
DROP INDEX IF EXISTS idx_reviews_branch;

-- Recreate original indexes
CREATE INDEX IF NOT EXISTS idx_changesets_trace_id ON changesets(trace_id);
CREATE INDEX IF NOT EXISTS idx_changesets_status ON changesets(status);
CREATE INDEX IF NOT EXISTS idx_changesets_portal ON changesets(portal);
CREATE INDEX IF NOT EXISTS idx_changesets_created_by ON changesets(created_by);
CREATE INDEX IF NOT EXISTS idx_changesets_branch ON changesets(branch);
