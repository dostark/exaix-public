-- Migration 006: Artifacts Table
-- Created: 2026-02-03
-- Description: Add artifacts table for tracking read-only agent analysis outputs

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  type TEXT NOT NULL CHECK (type IN ('analysis', 'report', 'diagram')),
  agent TEXT NOT NULL,
  portal TEXT,
  created TEXT NOT NULL,
  updated TEXT,
  request_id TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  rejection_reason TEXT
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_artifacts_status ON artifacts(status);
CREATE INDEX IF NOT EXISTS idx_artifacts_agent ON artifacts(agent);
CREATE INDEX IF NOT EXISTS idx_artifacts_portal ON artifacts(portal);
CREATE INDEX IF NOT EXISTS idx_artifacts_request_id ON artifacts(request_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_created ON artifacts(created DESC);
