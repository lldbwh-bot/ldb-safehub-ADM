ALTER TABLE app_users ADD COLUMN password_raw TEXT;

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0005_app_users_password_raw');

INSERT INTO app_metadata (key, value, updated_at)
VALUES ('schema_version', '0005_app_users_password_raw', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;
