use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State, WindowEvent};
use veyl_core::{api, keys, store, tunnel, Profile};

#[derive(Default)]
struct App {
    profile: Mutex<Option<Profile>>,
}

#[derive(Serialize)]
struct PublicProfile {
    server: String,
    account: String,
    public_key: String,
}

impl From<&Profile> for PublicProfile {
    fn from(p: &Profile) -> Self {
        Self {
            server: p.server.clone(),
            account: p.account.clone(),
            public_key: p.public_key.clone(),
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

#[tauri::command]
fn get_profile(app: tauri::AppHandle, state: State<App>) -> Option<PublicProfile> {
    let mut guard = state.profile.lock().unwrap();
    if guard.is_none() {
        *guard = store::load(&data_dir(&app));
    }
    guard.as_ref().map(PublicProfile::from)
}

#[tauri::command]
async fn api_post(server: String, path: String, body: Value) -> Result<Value, String> {
    if !matches!(path.as_str(), "/v1/devices" | "/v1/revoke") {
        return Err("Not allowed".into());
    }
    tauri::async_runtime::spawn_blocking(move || api::post(&server, &path, body))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn provision(
    app: tauri::AppHandle,
    state: State<'_, App>,
    server: String,
    account: String,
) -> Result<PublicProfile, String> {
    let dir = data_dir(&app);
    let profile = tauri::async_runtime::spawn_blocking(move || -> Result<Profile, String> {
        let kp = keys::generate();
        let e = api::enroll(&server, &account, &kp.public)?;
        let conf = api::build_config(&kp.private, &e);
        let p = Profile {
            server,
            account,
            public_key: kp.public,
            conf,
        };
        store::save(&dir, &p)?;
        Ok(p)
    })
    .await
    .map_err(|e| e.to_string())??;
    let out = PublicProfile::from(&profile);
    *state.profile.lock().unwrap() = Some(profile);
    Ok(out)
}

#[tauri::command]
async fn new_device_config(state: State<'_, App>) -> Result<String, String> {
    let (server, account) = {
        let g = state.profile.lock().unwrap();
        let p = g.as_ref().ok_or("Not signed in")?;
        (p.server.clone(), p.account.clone())
    };
    tauri::async_runtime::spawn_blocking(move || {
        let kp = keys::generate();
        let e = api::enroll(&server, &account, &kp.public)?;
        Ok(api::build_config(&kp.private, &e))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn connect(app: tauri::AppHandle, state: State<'_, App>) -> Result<(), String> {
    let conf = state
        .profile
        .lock()
        .unwrap()
        .as_ref()
        .map(|p| p.conf.clone())
        .ok_or("Not signed in")?;
    let dir = tunnel_dir(&app);
    tauri::async_runtime::spawn_blocking(move || tunnel::connect(&dir, &conf))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn disconnect(app: tauri::AppHandle) -> Result<(), String> {
    let dir = tunnel_dir(&app);
    tauri::async_runtime::spawn_blocking(move || tunnel::disconnect(&dir))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn status() -> Result<tunnel::Status, String> {
    tauri::async_runtime::spawn_blocking(tunnel::status)
        .await
        .map_err(|e| e.to_string())
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
    tauri::async_runtime::spawn_blocking(move || {
        tunnel::disconnect(&tdir);
        if let (true, Some(p)) = (revoke, profile.as_ref()) {
            let _ = api::revoke(&p.server, &p.account, &p.public_key);
        }
        store::clear(&dir);
    })
    .await
    .map_err(|e| e.to_string())
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
    tauri::Builder::default()
        .manage(App::default())
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                tunnel::disconnect(&tunnel_dir(window.app_handle()));
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_profile,
            api_post,
            provision,
            new_device_config,
            connect,
            disconnect,
            status,
            sign_out,
            window_control
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Veyl");
}
