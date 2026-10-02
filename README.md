# Veyl

Windows app and web client for a self-hosted Veyl VPN server. Enter your server's domain and your account number, press Connect.

## Features

- One-tap connect with a live pixel status wave: orange when exposed, green when protected
- Session timer, data received and live speed
- Account number sign-in, no email or password
- Works with any Veyl server on your own domain
- Kill switch: all traffic outside the tunnel is blocked while connected
- Add phones and other computers with a QR code (up to 5 devices)
- Keys generated on your device; the private key never leaves it
- Profile stored encrypted with Windows DPAPI
- Disconnects cleanly on exit
- Web version served by the backend for quick setup from any browser

## How it works

The app drives the official WireGuard for Windows tunnel service. On first connect it installs WireGuard from download.wireguard.com and verifies the Microsoft Authenticode signature before running it. The installer asks for administrator rights because creating a network tunnel requires them.

## Download

Releases build on GitHub Actions: push a tag such as `v0.1.0` and the signed-or-unsigned `Veyl-Setup-<version>.exe` is attached to the release. Unsigned builds trigger a Windows SmartScreen warning; signing needs a code-signing certificate.

## Develop

    npm install
    npm run dev
    npm run app
    npm run dist:win

`npm run dev` serves the web client and proxies `/v1` to a backend at `VEYL_API` (default http://127.0.0.1:8080). `npm run dist:win` builds the installer and should be run on Windows or in CI.
