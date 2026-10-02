mod server;

use serde::Serialize;
use serde_json::{json, Value};
use server::{Failure, Token};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, RunEvent, State, WindowEvent, Wry};
use veyl_core::{api, keys, store, tunnel, DeviceList, Profile};

struct Tray {
    icon: TrayIcon<Wry>,
    status: MenuItem<Wry>,
    toggle: MenuItem<Wry>,
}

#[derive(Default)]
struct App {
    profile: Mutex<Option<Profile>>,
    token: Mutex<Option<Token>>,
    tray: Mutex<Option<Tray>>,
    close_to_tray: AtomicBool,
}

#[derive(Serialize)]
struct PublicProfile {
    server: String,
    account: String,
    device_id: String,
}

impl From<&Profile> for PublicProfile {
    fn from(p: &Profile) -> Self {
        Self {
            server: p.server.clone(),
            account: p.account.clone(),
            device_id: p.device_id.clone(),
        }
    }
}

fn data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("veyl"))
}

fn tunnel_dir(app: &tauri::AppHandle) -> PathBuf {
    data_dir(app).join("tunnel")
}

fn current(app: &tauri::AppHandle, state: &State<'_, App>) -> Result<Profile, String> {
    let mut guard = state.profile.lock().unwrap();
    if guard.is_none() {
        *guard = store::load(&data_dir(app));
    }
    guard.clone().ok_or_else(|| "Not signed in".to_string())
}

async fn blocking<T, F>(f: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

fn new_profile_text(
    server: &str,
    account: &str,
    password: &str,
    name: &str,
) -> Result<(String, String), String> {
    let m = keys::generate()?;
    let e = api::enroll(server, account, password, name, &m.csr_pem)?;
    let ovpn = keys::fill_profile(&e.profile, &m.key_pem)?;
    Ok((e.id, ovpn))
}

#[tauri::command]
fn get_profile(app: tauri::AppHandle, state: State<App>) -> Option<PublicProfile> {
    let mut guard = state.profile.lock().unwrap();
    if guard.is_none() {
        *guard = store::load(&data_dir(&app));
    }
    guard.as_ref().map(PublicProfile::from)
}

#[tauri::command]
async fn register(
    server: String,
    account: Option<String>,
    password: String,
) -> Result<String, String> {
    blocking(move || api::register(&server, account.as_deref(), &password)).await
}

#[tauri::command]
async fn login_check(
    server: String,
    account: String,
    password: String,
) -> Result<DeviceList, String> {
    blocking(move || api::devices(&server, &account, &password)).await
}

#[tauri::command]
async fn provision(
    app: tauri::AppHandle,
    state: State<'_, App>,
    server: String,
    account: String,
    password: String,
    name: String,
) -> Result<PublicProfile, String> {
    let dir = data_dir(&app);
    let profile = blocking(move || {
        let (device_id, ovpn) = new_profile_text(&server, &account, &password, &name)?;
        let p = Profile {
            server,
            account,
            password,
            device_id,
            ovpn,
        };
        store::save(&dir, &p)?;
        Ok(p)
    })
    .await?;
    let out = PublicProfile::from(&profile);
    *state.profile.lock().unwrap() = Some(profile);
    Ok(out)
}

#[tauri::command]
async fn list_devices(app: tauri::AppHandle, state: State<'_, App>) -> Result<DeviceList, String> {
    let p = current(&app, &state)?;
    blocking(move || api::devices(&p.server, &p.account, &p.password)).await
}

#[tauri::command]
async fn add_device_config(
    app: tauri::AppHandle,
    state: State<'_, App>,
    name: String,
) -> Result<String, String> {
    let p = current(&app, &state)?;
    blocking(move || new_profile_text(&p.server, &p.account, &p.password, &name).map(|r| r.1)).await
}

#[tauri::command]
async fn revoke_device(
    app: tauri::AppHandle,
    state: State<'_, App>,
    id: String,
) -> Result<(), String> {
    let p = current(&app, &state)?;
    let own = p.device_id == id;
    let dir = data_dir(&app);
    let tdir = tunnel_dir(&app);
    blocking(move || {
        api::revoke(&p.server, &p.account, &p.password, &id)?;
        if own {
            tunnel::disconnect(&tdir);
            store::clear(&dir);
        }
        Ok(())
    })
    .await?;
    if own {
        *state.profile.lock().unwrap() = None;
    }
    Ok(())
}

#[tauri::command]
async fn change_password(
    app: tauri::AppHandle,
    state: State<'_, App>,
    new_password: String,
) -> Result<(), String> {
    let p = current(&app, &state)?;
    let dir = data_dir(&app);
    let updated = blocking(move || {
        api::change_password(&p.server, &p.account, &p.password, &new_password)?;
        let mut q = p;
        q.password = new_password;
        store::save(&dir, &q)?;
        Ok(q)
    })
    .await?;
    *state.profile.lock().unwrap() = Some(updated);
    Ok(())
}

#[tauri::command]
async fn connect(app: tauri::AppHandle, state: State<'_, App>) -> Result<(), String> {
    let p = current(&app, &state)?;
    let dir = tunnel_dir(&app);
    blocking(move || tunnel::connect(&dir, &p.ovpn)).await
}

#[tauri::command]
async fn disconnect(app: tauri::AppHandle) -> Result<(), String> {
    let dir = tunnel_dir(&app);
    blocking(move || {
        tunnel::disconnect(&dir);
        Ok(())
    })
    .await
}

#[tauri::command]
async fn status() -> Result<tunnel::Status, String> {
    blocking(|| Ok(tunnel::status())).await
}

#[tauri::command]
async fn sign_out(
    app: tauri::AppHandle,
    state: State<'_, App>,
    revoke: bool,
) -> Result<(), String> {
    let dir = data_dir(&app);
    let tdir = tunnel_dir(&app);
    let profile = state
        .profile
        .lock()
        .unwrap()
        .take()
        .or_else(|| store::load(&dir));
    blocking(move || {
        tunnel::disconnect(&tdir);
        if let (true, Some(p)) = (revoke, profile.as_ref()) {
            let _ = api::revoke(&p.server, &p.account, &p.password, &p.device_id);
        }
        store::clear(&dir);
        Ok(())
    })
    .await
}

#[tauri::command]
fn window_control(window: tauri::Window, action: String) {
    match action.as_str() {
        "min" => {
            let _ = window.minimize();
        }
        "max" => {
            if window.is_maximized().unwrap_or(false) {
                let _ = window.unmaximize();
            } else {
                let _ = window.maximize();
            }
        }
        "close" => {
            let _ = window.close();
        }
        _ => {}
    }
}

async fn background<T, F>(f: F) -> Result<T, Failure>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, Failure> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| Failure::local(e.to_string()))?
}

fn signed_in(app: &tauri::AppHandle, state: &State<'_, App>) -> Result<Profile, Failure> {
    current(app, state).map_err(|e| Failure::new("NOT_SIGNED_IN", &e, 0))
}

fn with_token<F>(app: &tauri::AppHandle, state: &State<'_, App>, call: F) -> Result<Value, Failure>
where
    F: Fn(&str, &str) -> Result<Value, Failure>,
{
    let p = signed_in(app, state)?;
    let mut cache = state.token.lock().unwrap();
    server::authorized(&mut cache, &p.server, &p.account, &p.password, |t| {
        call(&p.server, t)
    })
}

#[tauri::command]
async fn server_info(
    app: tauri::AppHandle,
    state: State<'_, App>,
    server: Option<String>,
) -> Result<Value, Failure> {
    let target = match server {
        Some(s) => s,
        None => signed_in(&app, &state)?.server,
    };
    background(move || server::info(&target)).await
}

#[tauri::command]
async fn redeem_invite(
    server: String,
    invite: String,
    password: String,
) -> Result<String, Failure> {
    background(move || server::redeem(&server, &invite, &password)).await
}

#[tauri::command]
async fn revoke_with_credentials(
    server: String,
    account: String,
    password: String,
    id: String,
) -> Result<(), Failure> {
    server::check_device_id(&id)?;
    background(move || api::revoke(&server, &account, &password, &id).map_err(Failure::local)).await
}

#[tauri::command]
async fn account_info(app: tauri::AppHandle) -> Result<Value, Failure> {
    let handle = app.clone();
    background(move || {
        let state = handle.state::<App>();
        with_token(&handle, &state, |s, t| {
            server::send("GET", s, "/v1/me", Some(t), None)
        })
    })
    .await
}

#[tauri::command]
async fn set_dns_blocking(
    app: tauri::AppHandle,
    categories: Vec<String>,
) -> Result<Value, Failure> {
    if categories.len() > 16 || categories.iter().any(|c| c.len() > 32) {
        return Err(Failure::new(
            "INVALID_DNS_CATEGORY",
            "unknown dns blocking category",
            400,
        ));
    }
    let handle = app.clone();
    background(move || {
        let state = handle.state::<App>();
        with_token(&handle, &state, |s, t| {
            server::send(
                "PUT",
                s,
                "/v1/me/dns",
                Some(t),
                Some(json!({ "blocking": categories })),
            )
        })
    })
    .await
}

#[tauri::command]
async fn reset_dns_blocking(app: tauri::AppHandle) -> Result<Value, Failure> {
    let handle = app.clone();
    background(move || {
        let state = handle.state::<App>();
        with_token(&handle, &state, |s, t| {
            server::send("DELETE", s, "/v1/me/dns", Some(t), None)
        })
    })
    .await
}

#[tauri::command]
async fn rename_device(app: tauri::AppHandle, id: String, name: String) -> Result<Value, Failure> {
    server::check_device_id(&id)?;
    let handle = app.clone();
    background(move || {
        let state = handle.state::<App>();
        let path = format!("/v1/me/devices/{id}");
        with_token(&handle, &state, |s, t| {
            server::send("PATCH", s, &path, Some(t), Some(json!({ "name": name })))
        })
    })
    .await
}

#[tauri::command]
async fn delete_account(app: tauri::AppHandle, password: String) -> Result<(), Failure> {
    let handle = app.clone();
    background(move || {
        let state = handle.state::<App>();
        with_token(&handle, &state, |s, t| {
            server::send(
                "DELETE",
                s,
                "/v1/me",
                Some(t),
                Some(json!({ "password": password })),
            )
        })?;
        tunnel::disconnect(&tunnel_dir(&handle));
        store::clear(&data_dir(&handle));
        *state.profile.lock().unwrap() = None;
        *state.token.lock().unwrap() = None;
        Ok(())
    })
    .await
}

#[tauri::command]
fn openvpn_present() -> bool {
    let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".into());
    PathBuf::from(pf)
        .join("OpenVPN")
        .join("bin")
        .join("openvpn.exe")
        .exists()
}

#[tauri::command]
fn set_close_to_tray(state: State<App>, enabled: bool) {
    state.close_to_tray.store(enabled, Ordering::Relaxed);
}

fn clip(text: &str, max: usize) -> String {
    text.chars().take(max).collect()
}

#[tauri::command]
fn tray_status(state: State<App>, status: String, action: String, enabled: bool) {
    if let Some(tray) = state.tray.lock().unwrap().as_ref() {
        let status = clip(&status, 64);
        let _ = tray.status.set_text(&status);
        let _ = tray.toggle.set_text(clip(&action, 32));
        let _ = tray.toggle.set_enabled(enabled);
        let _ = tray.icon.set_tooltip(Some(format!("VeylVPN - {status}")));
    }
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn build_tray(app: &tauri::App) -> tauri::Result<Tray> {
    let status = MenuItem::with_id(app, "status", "Not connected", false, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "Connect", false, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Open VeylVPN", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit VeylVPN", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &status,
            &PredefinedMenuItem::separator(app)?,
            &toggle,
            &open,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    let mut builder = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .tooltip("VeylVPN")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => {
                let _ = app.emit_to("main", "tray-toggle", ());
            }
            "open" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    let icon = builder.build(app)?;
    Ok(Tray {
        icon,
        status,
        toggle,
    })
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_main(app)
        }))
        .plugin(tauri_plugin_opener::init())
        .manage(App::default())
        .setup(|app| {
            tunnel::cleanup(&tunnel_dir(app.handle()));
            if let Ok(tray) = build_tray(app) {
                *app.state::<App>().tray.lock().unwrap() = Some(tray);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.state::<App>().close_to_tray.load(Ordering::Relaxed) {
                    api.prevent_close();
                    let _ = window.hide();
                    return;
                }
                tunnel::cleanup(&tunnel_dir(window.app_handle()));
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_profile,
            register,
            login_check,
            provision,
            list_devices,
            add_device_config,
            revoke_device,
            change_password,
            connect,
            disconnect,
            status,
            sign_out,
            window_control,
            server_info,
            redeem_invite,
            revoke_with_credentials,
            account_info,
            set_dns_blocking,
            reset_dns_blocking,
            rename_device,
            delete_account,
            openvpn_present,
            set_close_to_tray,
            tray_status
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Veyl");
    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            tunnel::cleanup(&tunnel_dir(handle));
        }
    });
}
