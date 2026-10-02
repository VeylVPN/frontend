# VeylVPN for Windows

The Windows app and web client for a self-hosted VeylVPN server. Enter your server's address, sign in with your account number and password, press Connect.

## Features

- One-click connect on a live dotted globe built from Natural Earth data, with clear states for connecting, protected, reconnecting, disconnecting and errors
- Session timer, data received and sent, and live rates read from OpenVPN
- Account number and password sign-in, no email
- Guided onboarding that checks your server first and adapts to its sign-up mode: open, invite codes, or account numbers from the admin
- If your account is at its device limit, remove a device right from the sign-in screen
- See every device on your account, which ones are online right now, rename them and remove any of them instantly
- Add phones and other computers with a downloadable OpenVPN profile
- Content blocking per account (ads, trackers, malware, adult, gambling, social media) through your server's resolver
- Server page with protocol, TCP fallback, post-quantum key exchange, platform, version and your account's status
- Kill switch: all traffic outside the tunnel is blocked while connected
- Mini player: minimize the window or click the tray icon for a compact player that connects, disconnects and shows your status, timer and speeds
- System tray with status, connect and disconnect, plus optional close to tray
- Recognizes VeylVPN partner networks (currently CentrixNodes, AS206533) from your VPN exit address
- Diagnostics you can copy without exposing your account number, password or keys
- Every device has its own certificate, generated on that device; the server never sees a private key
- Profile and password stored encrypted with Windows DPAPI; the private key and password never enter the web layer
- Native Rust core on Tauri: a few MB installer, low memory, no bundled browser
- The same build runs as a web client when your server hosts it with `veyl serve -static`

## How it works

```
VeylVPN server (VeylVPN/backend)          OpenVPN client
          │  HTTPS /v1/*                         │ management socket
          ▼                                      ▼
core/  Rust: API client, keys, DPAPI store, tunnel and kill switch   (unchanged)
src-tauri/  Tauri shell: IPC commands, token client for the newer API, tray, window
          │  invoke()
          ▼
src/backend/   native.ts (Tauri) · web.ts (same-origin fetch) · fixture.ts (dev only)
src/adapters/  validate untrusted responses into domain types, map errors
src/stores/    connection state machine, session, devices, partner detection, preferences
src/components, src/pages   the interface
```

The core generates the device key and certificate request, talks to your server, stores the profile and controls the tunnel. The web layer only draws the interface.

It drives the official OpenVPN community client. On first connect it downloads OpenVPN from swupdate.openvpn.net, checks the SHA-256 against a pinned value and the Authenticode signature, then installs it. The app requests administrator rights because creating a network tunnel requires them.

## Partner network detection

After the tunnel is up, the app asks RIPE NCC's public RIPEstat service for the VPN exit address and the network that announces it, then compares the ASN with `src/partners/registry.ts`. The requests travel through the tunnel, so RIPE only sees your server's address. Results stay in memory. It never runs while disconnected and never blocks the connection. Turn it off under Settings, Privacy.

When the VeylVPN website's domain is set in `src/lib/links.ts` (`SITE_URL`), the app uses the website's own `/api/connection` instead. Add that origin to `connect-src` in `src-tauri/tauri.conf.json` at the same time.

## Download

Push a tag such as `v0.1.0` and GitHub Actions builds `Veyl_<version>_x64-setup.exe` and attaches it to the release. Unsigned builds trigger a Windows SmartScreen warning; signing needs a code-signing certificate.

## Develop

Requirements: Node.js 24, pnpm 12, Rust stable, and on Windows the WebView2 runtime that ships with Windows 10 and 11.

    pnpm install
    pnpm dev            web client on http://localhost:5173, proxies /v1 to VEYL_API (default http://127.0.0.1:8080)
    pnpm app            the Windows app with hot reload
    pnpm dist:win       installer
    pnpm typecheck
    pnpm lint
    pnpm test
    cargo test --workspace

`pnpm dev` and `pnpm build` download the Satoshi font from Fontshare and check its SHA-256; the font is not committed because its licence does not allow redistributing it through a repository.

To see every screen without a server, open the dev server with a fixture, for example `http://localhost:5173/?fixture=home`. Fixtures exist only in development builds and are never bundled. Combine flags with commas: `first-run`, `limit`, `closed`, `offline`, `expired`, `orphaned`, `install`, `connect-error`, `slow`, `drop`, `reconnect`, `partner`, `partner-v6`, `lookup-fail`, `web`. Add `&connect` to connect on load.

`pnpm landmask` regenerates `src/components/connection/landmask.ts` from the Natural Earth 110m land data in `world-atlas` (checksum pinned).

See [docs/integration.md](docs/integration.md) for what the app uses from the server and the Rust core, and [docs/brand.md](docs/brand.md) for how the design follows the website.
