UPDATE app_users
SET allowed_tabs_json = CASE
  WHEN status = 'Admin' THEN
    '["dashboard","pm","inspections","incidents","assessment","approvals","tracking","repairs","accounts"]'
  ELSE
    '["dashboard","pm","inspections","incidents","assessment","approvals","tracking","repairs"]'
END,
updated_at = CURRENT_TIMESTAMP
WHERE json_valid(allowed_tabs_json) = 0
   OR json_type(allowed_tabs_json) <> 'array'
   OR json_array_length(allowed_tabs_json) = 0;

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('0003_repair_allowed_tabs');

INSERT INTO app_metadata (key, value, updated_at)
VALUES ('schema_version', '0003_repair_allowed_tabs', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;
