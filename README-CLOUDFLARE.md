# LDB SafeHub — Cloudflare Production

## Environment map

| Environment | Git branch | Worker | Domain | D1 | R2 |
| --- | --- | --- | --- | --- | --- |
| Production | `main` | `ldb-safehub-prod` | `https://ldb-adm-safehub.com` | `ldb-safehub-prod` | `ldb-safehub-prod-files` |

Demo/UAT has been retired. Do not recreate `demo.ldb-adm-safehub.com`,
`ldb-safehub-demo`, `ldb-safehub-demo-files`, or a `uat` deployment branch
unless the project is explicitly re-approved.

## Current backend foundation

- The Worker serves the Vite single-page application.
- Requests under `/api/*` run through the Worker before static asset handling.
- `GET /api/health` verifies D1 and R2 connectivity.
- `GET /api/version` identifies the active Production version.
- Unknown API routes return a JSON `404`; browser routes fall back to `index.html`.
- D1 stores central application records and audit metadata.
- R2 stores uploaded file objects through private Worker bindings.

## Local verification

```bash
npm ci
npm run lint
npm test
npm run test:worker
npm run build:web
npx wrangler deploy --dry-run --env=""
```

## Database migrations

```bash
npm run cf:migrate:prod
```

Migrations are forward-only. Back up production data before destructive schema
changes.

## Manual deployment

```bash
npm run deploy:prod
```

After deployment, verify:

```bash
curl https://ldb-adm-safehub.com/api/health
```

Expected `environment` is `production`, with both `services.d1` and
`services.r2` equal to `ok`.

## Rebuilding `wrangler.jsonc`

The committed configuration contains the current Cloudflare D1 resource ID.
To regenerate it intentionally:

```powershell
$env:CLOUDFLARE_PROD_D1_ID = "production-d1-id"
npm run cf:config
npm run cf:types
```

Do not commit API tokens, OAuth credentials, passwords, or secret values.
