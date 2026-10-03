# Backend integration

What the app can do comes from two places that this interface does not change: the VeylVPN server (`VeylVPN/backend`, its public API under `/v1/`) and the Rust core in `core/` (tunnel, kill switch, keys, DPAPI storage, the original API client). `src-tauri/` only adds thin IPC commands, the tray and window behavior on top.

## Capability inventory

| Feature | Backend | Source | In the app | Status |
| --- | --- | --- | --- | --- |
| Connect | Yes | `core::tunnel::connect`, IPC `connect` | Orb, tray | Integrated |
| Disconnect, cancel | Yes | `core::tunnel::disconnect`, IPC `disconnect` | Orb, pill, tray | Integrated |
| Connection state | `off`, `connecting`, `connected` | IPC `status` (OpenVPN `state`) | `src/stores/machine.ts` adds reconnecting, disconnecting, error and slow | Integrated |
| First connect installs OpenVPN | Yes | `core::tunnel` | IPC `openvpn_present` shows "Setting up OpenVPN" | Integrated |
| Received, sent | Yes | IPC `status` (`load-stats`) | Cards, rates from real deltas | Integrated (sent was unused before) |
| Session duration | Measured | First connected status | Timer | Integrated |
| Server identity, version, platform | Yes | `GET /v1/info`, IPC `server_info` | Server page, sidebar, onboarding | Integrated (new) |
| Protocol, port, TCP fallback | Yes | `GET /v1/info` | Server page, cards | Integrated (new) |
| Post-quantum key exchange | Requested flag | `GET /v1/info` | Server page | Integrated (new) |
| Server reachability | Yes | `GET /v1/info` | Sidebar, notices, retry | Integrated (new) |
| Sign in | Yes | IPC `login_check`, `provision` | Onboarding | Integrated |
| Create account (open), claim number | Yes | IPC `register` | Onboarding, adapts to sign-up mode | Integrated |
| Invite codes | Yes | `POST /v1/register` with `invite`, IPC `redeem_invite` | Onboarding | Integrated (new) |
| Free a device slot during sign-in | Yes | `POST /v1/revoke`, IPC `revoke_with_credentials` | Device limit screen | Integrated (new) |
| Account status, expiry, device count | Yes | `GET /v1/me`, IPC `account_info` | Server page, notices | Integrated (new) |
| Devices and online status | Yes | IPC `list_devices` | Devices page | Integrated |
| Add a device profile | Yes | IPC `add_device_config` | Shown once, download or copy | Integrated |
| Rename a device | Yes | `PATCH /v1/me/devices/{id}`, IPC `rename_device` | Devices page | Integrated (new) |
| Remove a device | Yes | IPC `revoke_device` | Devices page | Integrated |
| Change password | Yes | IPC `change_password` | Settings | Integrated |
| Delete account | Yes | `DELETE /v1/me`, IPC `delete_account` | Settings, password required | Integrated (new) |
| DNS content blocking | Per account | `PUT` and `DELETE /v1/me/dns` | Settings, reconnect to apply | Integrated (new) |
| Kill switch | Always on while connected | `core::tunnel` firewall rules | Settings explains it | Shown, not switchable |
| Auto-connect | No server setting | Frontend preference calls `connect` at launch | Settings | Integrated |
| Close to tray | No | IPC `set_close_to_tray`, tray in `src-tauri` | Settings | Integrated (new, opt-in) |
| Tray status and toggle | No | `src-tauri` tray, `tray_status`, `tray-toggle` event | Tray menu | Integrated (new) |
| Mini player | No | `mini` window, IPC `set_mini_player`, `mini_open`, `mini_hide`, events `mini-state` and `mini-request` | Shown on minimize and tray click, Settings switch | Integrated (new, on by default) |
| Single instance | No | `tauri-plugin-single-instance` | Second launch focuses the window | Integrated (new) |
| VPN exit IP and ASN | Not in backend | RIPEstat through the tunnel | Cards, Server page, diagnostics | Integrated (opt-out) |
| Partner network | Not in backend | `src/partners/registry.ts` | Badge, details, diagnostics | Integrated |
| Diagnostics | Composed | Real state only, no secrets | Settings, copy | Integrated |
| Updates | No updater | GitHub releases | Link in About | Link only |
| Server list, multiple servers | No | `core::store` keeps one profile | One server per install | Requires backend work |
| Tunnel IP, server IP, handshake phases | OpenVPN reports them | `core::tunnel` discards them | Not shown | Requires backend work |
| Kill switch toggle, LAN access, IPv6 choice | No | | Not shown | Requires backend work |
| Ping, server load, location | No | | Not shown | Not available |
| Logs | No logs by design | | Not shown | Not applicable |
| Launch at sign-in | No | App requires elevation | Not shown | Requires an elevated scheduled task |
| Notifications | No | | Tray tooltip carries status | Not added |

## Frontend prepared, backend support required

- Tunnel IP, the server IP OpenVPN connected to, and phases such as `WAIT`, `AUTH` and `GET_CONFIG`: add fields to `core::tunnel::Status`. The adapter in `src/adapters/connection.ts` and the stage already have room for them.
- More than one server per install: `core::store` needs a profile list.
- Kill switch, LAN access and IPv6 choices: `core::tunnel` would need settings.
- VeylVPN-owned exit lookup: the website's `/api/connection` already returns the caller's IP and ASN. Set `SITE_URL` in `src/lib/links.ts` and allow that origin in `connect-src`.

## Notes

- `productName` stays `Veyl` so the installer keeps the `Veyl_<version>_x64-setup.exe` name the website download page and docs use. The window title is `VeylVPN`.
- Legacy core commands return plain error text, so `src/adapters/errors.ts` maps those messages to the server's documented codes. New commands return `{ code, message, status }`.
- Access tokens for the newer endpoints live in Rust memory only and are refreshed once on `INVALID_ACCESS_TOKEN`.
