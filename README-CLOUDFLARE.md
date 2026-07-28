# LDB SafeHub — Cloudflare Production and UAT

## Environment map

| Environment | Git branch | Worker | Domain | D1 | R2 |
| --- | --- | --- | --- | --- | --- |
| Production | `main` | `ldb-safehub-prod` | `https://ldb-adm-safehub.com` | `ldb-safehub-prod` | `ldb-safehub-prod-files` |
| UAT / Demo | `uat` | `ldb-safehub-demo` | `https://demo.ldb-adm-safehub.com` | `ldb-safehub-demo` | `ldb-safehub-demo-files` |

The two environments use different D1 databases and R2 buckets. Never point UAT
bindings at Production resources.

## Current backend foundation

- The Worker serves the Vite single-page application.
- Requests under `/api/*` run through the Worker before static asset handling.
- `GET /api/health` verifies D1 and R2 connectivity.
- `GET /api/version` identifies the active environment.
- Unknown API routes return a JSON `404`; browser routes fall back to `index.html`.
- D1 migration `0001_backend_foundation.sql` creates metadata, audit-event,
  and file-object metadata tables.
- R2 buckets are private Worker bindings. No public bucket URL is configured.

This foundation does **not** yet migrate the application's existing browser
`localStorage` transaction data into D1. Production multi-user CRUD,
authentication, authorization, attachment upload/download, and data migration
must be implemented as the next backend phase before the browser data model can
be treated as a central multi-user database.

## Local verification

```bash
npm ci
npm run lint
npm test
npm run test:worker
npm run build:web
npx wrangler deploy --dry-run --env=""
npx wrangler deploy --dry-run --env uat
```

## Database migrations

```bash
npm run cf:migrate:prod
npm run cf:migrate:uat
```

Migrations are forward-only. Back up production data before destructive schema
changes, and never copy UAT data into Production without an approved migration.

## Manual deployment

```bash
npm run deploy:prod
npm run deploy:uat
```

After deployment, verify:

```bash
curl https://ldb-adm-safehub.com/api/health
curl https://demo.ldb-adm-safehub.com/api/health
```

Expected `environment` values are `production` and `uat`, respectively, with
both `services.d1` and `services.r2` equal to `ok`.

## Rebuilding `wrangler.jsonc`

The committed configuration contains the current Cloudflare D1 resource IDs.
To regenerate it intentionally:

```powershell
$env:CLOUDFLARE_PROD_D1_ID = "production-d1-id"
$env:CLOUDFLARE_UAT_D1_ID = "uat-d1-id"
npm run cf:config
npm run cf:types
```

Do not commit API tokens, OAuth credentials, passwords, or secret values.
