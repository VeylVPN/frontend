# Veyl

Windows app and web client for a self-hosted Veyl VPN server. Enter your server's domain, sign in with your account number and password, press Connect.

## Features

- One-tap connect with a live pixel status wave: orange when exposed, green when protected
- Session timer, data received and live speed
- Account number and password sign-in, no email
- Create an account on your own server, or claim a number your server admin gave you
- See every device on your account, which ones are online right now, and remove any of them instantly
- Add phones and other computers with a downloadable OpenVPN profile (up to 5 devices)
- Every device has its own certificate, generated on that device; the server never sees a private key
- Kill switch: all traffic outside the tunnel is blocked while connected
- Profile and password stored encrypted with Windows DPAPI; the private key and password never enter the web layer
- Native Rust core on Tauri: a few MB installer, low memory, no bundled browser
- Web version served by the backend for quick setup from any browser

## How it works

The app is a Tauri shell around a Rust core (`core/`). The core generates the device key and certificate request, talks to your server, stores the profile and controls the tunnel; the web layer only draws the interface.

It drives the official OpenVPN community client. On first connect it downloads OpenVPN from swupdate.openvpn.net, checks the SHA-256 against a pinned value and the Authenticode signature, then installs it. The app requests administrator rights because creating a network tunnel requires them.

## Download

Push a tag such as `v0.1.0` and GitHub Actions builds `Veyl_<version>_x64-setup.exe` and attaches it to the release. Unsigned builds trigger a Windows SmartScreen warning; signing needs a code-signing certificate.

## Develop

    npm install
    npm run dev
    npm run app
    npm run dist:win
    cargo test -p veyl-core

`npm run dev` serves the web client and proxies `/v1` to a backend at `VEYL_API` (default http://127.0.0.1:8080). `npm run app` and `npm run dist:win` need Rust and, on Windows, the WebView2 runtime that ships with Windows 10 and 11.
