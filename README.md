# LDB SafeHub

> Deployment source for the LDB SafeHub browser preview. See
> [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the Production and Demo/UAT
> branch strategy and the current browser-storage limitations.

ລະບົບຄວາມປອດໄພ ແລະ ບຳລຸງຮັກສາອາຄານ LDB SafeHub.

## One-click Windows preview

Double-click `Start-LDB-SafeHub.cmd`. The launcher starts the local web server and opens `http://127.0.0.1:3000/` in the default browser.

Opening `index.html` through a `file://` address redirects to the same local server. The launcher must be running because browsers cannot start the Node.js server from an HTML file.

## Single-file offline preview

Build the complete browser preview as one file:

```powershell
npm run build:single
```

Distribute or double-click only `release/LDB-SafeHub.html`. It contains the application JavaScript, CSS, imported master data, and image assets and does not require the local server. Keep the file at a stable path so browser-local storage remains associated with the same file location.

## Always-on Windows preview

Run the installer once to build SafeHub and register a hidden per-user Scheduled Task:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-LDB-SafeHub-AutoStart.ps1
```

SafeHub then starts after Windows sign-in and remains available at `http://127.0.0.1:3000/`. Closing the browser does not stop the server, and the task does not open a browser automatically.

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
```

Server logs are written to `autostart.out.log` and `autostart.err.log` in the project directory.

To remove only the Windows auto-start task:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Uninstall-LDB-SafeHub-AutoStart.ps1
```

## Command-line setup

Prerequisite: Node.js.

```powershell
npm ci
npm run dev
```

Then open `http://127.0.0.1:3000/`.

## Verification

```powershell
npm run lint
npm run build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\launcher-smoke.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\standalone-entry-smoke.ps1
```
