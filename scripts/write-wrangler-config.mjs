import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const required = ["CLOUDFLARE_PROD_D1_ID"];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

const config = {
  $schema: "./node_modules/wrangler/config-schema.json",
  name: "ldb-safehub-prod",
  main: "worker/index.ts",
  compatibility_date: "2026-07-28",
  compatibility_flags: ["nodejs_compat"],
  workers_dev: true,
  routes: [
    {
      pattern: "ldb-adm-safehub.com",
      custom_domain: true,
    },
  ],
  assets: {
    directory: "./dist",
    binding: "ASSETS",
    not_found_handling: "single-page-application",
    run_worker_first: ["/api/*"],
  },
  vars: {
    APP_ENV: "production",
    APP_VERSION: "git-main",
  },
  d1_databases: [
    {
      binding: "DB",
      database_name: "ldb-safehub-prod",
      database_id: process.env.CLOUDFLARE_PROD_D1_ID.trim(),
      migrations_dir: "migrations",
    },
  ],
  r2_buckets: [
    {
      binding: "FILES",
      bucket_name: "ldb-safehub-prod-files",
    },
  ],
  observability: {
    enabled: true,
    logs: { head_sampling_rate: 1 },
    traces: { enabled: true, head_sampling_rate: 0.01 },
  },
};

const outputPath = path.resolve("wrangler.jsonc");
fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
