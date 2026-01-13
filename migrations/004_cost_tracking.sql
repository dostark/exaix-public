-- up
CREATE TABLE IF NOT EXISTS provider_costs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL NOT NULL DEFAULT 0.0,
  timestamp DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_provider_costs_provider ON provider_costs(provider);
CREATE INDEX IF NOT EXISTS idx_provider_costs_timestamp ON provider_costs(timestamp);

-- down
DROP INDEX IF EXISTS idx_provider_costs_timestamp;
DROP INDEX IF EXISTS idx_provider_costs_provider;
DROP TABLE IF EXISTS provider_costs;
