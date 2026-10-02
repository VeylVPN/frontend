use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, RunEvent, State, WindowEvent};
use veyl_core::{api, keys, store, tunnel, DeviceList, Profile};

#[derive(Default)]
struct App {
    profile: Mutex<Option<Profile>>,
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
        "close" => {
            let _ = window.close();
        }
        _ => {}
    }
}

pub fn run() {
    let app = tauri::Builder::default()
        .manage(App::default())
        .setup(|app| {
            tunnel::cleanup(&tunnel_dir(app.handle()));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
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
            window_control
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Veyl");
    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            tunnel::cleanup(&tunnel_dir(handle));
        }
    });
}
