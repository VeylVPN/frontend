# Veyl frontend

Minimal web app for the Veyl self-hosted VPN. Enter your account number, add a device, and scan the QR code with the WireGuard app or download the config.

Keys are generated in the browser with WebCrypto (X25519). The private key never leaves the page and is never sent to the server.

    npm install
    npm run dev
    npm run build

Build output in `dist/` is served by the backend: pass its path to `deploy/install.sh`.
