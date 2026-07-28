# LDB SafeHub deployment

## Repository branches

- `main`: production deployment source.
- `uat`: Demo/UAT deployment source.

Use two Cloudflare Pages projects or two independently configured deployments.
Each environment must have its own hostname. Browser storage is isolated by
hostname, so Production and UAT records do not mix.

## Cloudflare Pages settings

| Setting | Production | Demo/UAT |
| --- | --- | --- |
| Branch | `main` | `uat` |
| Build command | `npm run build:web` | `npm run build:web` |
| Build output | `dist` | `dist` |
| Node.js | `22` | `22` |

The `public/_redirects` file enables SPA fallback routing.

## Data and authentication boundary

This repository contains a browser-only preview. Records are stored in
`localStorage`; they are not shared between users or browsers. The committed
account is a non-sensitive UAT demonstration account:

- Username: `demo_admin`
- Password: `UAT-DEMO-ONLY`

Do not use that account for a live production system. Before production use,
replace client-side authentication and browser storage with a server-side
authentication service and a central database. Never commit real passwords,
transaction exports, attachments, or repair history to Git.

## Local verification

```powershell
npm ci
npm run lint
npm test
npm run build:web
```
