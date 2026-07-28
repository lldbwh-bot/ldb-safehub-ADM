CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash TEXT PRIMARY KEY,
  username_norm TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  FOREIGN KEY (username_norm) REFERENCES app_users(username_norm)
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_active
  ON app_sessions (username_norm, expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS app_records (
  dataset TEXT NOT NULL,
  record_id TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (dataset, record_id)
);

CREATE INDEX IF NOT EXISTS idx_app_records_dataset_branch_active
  ON app_records (dataset, branch, deleted_at, updated_at);

CREATE TABLE IF NOT EXISTS app_dataset_revisions (
  dataset TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS browser_imports (
  import_id TEXT PRIMARY KEY,
  username_norm TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL UNIQUE,
  counts_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(counts_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (username_norm) REFERENCES app_users(username_norm)
);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('0004_central_data_api');

INSERT INTO app_metadata (key, value, updated_at)
VALUES ('schema_version', '0004_central_data_api', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;
