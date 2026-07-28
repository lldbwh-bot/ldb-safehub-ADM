CREATE TABLE IF NOT EXISTS app_users (
  username_norm TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Admin', 'User')),
  branch TEXT NOT NULL,
  image TEXT,
  allowed_tabs_json TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_users_branch_active
  ON app_users (branch, active);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('0002_app_users');

INSERT INTO app_metadata (key, value, updated_at)
VALUES ('schema_version', '0002_app_users', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;
