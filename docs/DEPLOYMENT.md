# LDB SafeHub deployment

## Repository branches

- `main`: production deployment source.

The previous `uat` Demo/UAT branch and `demo.ldb-adm-safehub.com` deployment
have been retired. Production is the only active hosted environment.

## Cloudflare Worker settings

| Setting | Production |
| --- | --- |
| Branch | `main` |
| Worker | `ldb-safehub-prod` |
| Domain | `ldb-adm-safehub.com` |
| Build command | `npm run build:web` |
| Deploy command | `wrangler deploy` |
| Static assets | `dist` |
| D1 database | `ldb-safehub-prod` |
| R2 bucket | `ldb-safehub-prod-files` |

## Data and authentication boundary

Production data is stored centrally in Cloudflare D1. Uploaded file metadata is
stored in D1 and file objects are stored in Cloudflare R2. Source code stays in
GitHub; transaction records, passwords, repair history, exports, and
attachments must not be committed to Git.

## Local verification

```powershell
npm ci
npm run lint
npm test
npm run test:worker
npm run build:web
npx wrangler deploy --dry-run --env=""
```
