use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub server: String,
    pub account: String,
    pub public_key: String,
    pub conf: String,
}

fn file(dir: &Path) -> PathBuf {
    dir.join("profile.bin")
}

pub fn save(dir: &Path, p: &Profile) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let plain = serde_json::to_vec(p).map_err(|e| e.to_string())?;
    let sealed = seal(&plain)?;
    let path = file(dir);
    fs::write(&path, sealed).map_err(|e| e.to_string())?;
    restrict(&path);
    Ok(())
}

pub fn load(dir: &Path) -> Option<Profile> {
    let sealed = fs::read(file(dir)).ok()?;
    let plain = unseal(&sealed).ok()?;
    serde_json::from_slice(&plain).ok()
}

pub fn clear(dir: &Path) {
    let _ = fs::remove_file(file(dir));
}

#[cfg(unix)]
fn restrict(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
}

#[cfg(not(unix))]
fn restrict(_: &Path) {}

#[cfg(not(windows))]
fn seal(data: &[u8]) -> Result<Vec<u8>, String> {
    Ok(data.to_vec())
}

#[cfg(not(windows))]
fn unseal(data: &[u8]) -> Result<Vec<u8>, String> {
    Ok(data.to_vec())
}

#[cfg(windows)]
fn seal(data: &[u8]) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{CryptProtectData, CRYPT_INTEGER_BLOB};
    unsafe {
        let input = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut out = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };
        let ok = CryptProtectData(
            &input,
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            0,
            &mut out,
        );
        if ok == 0 {
            return Err("Could not encrypt profile".into());
        }
        let v = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        LocalFree(out.pbData as _);
        Ok(v)
    }
}

#[cfg(windows)]
fn unseal(data: &[u8]) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB};
    unsafe {
        let input = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut out = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };
        let ok = CryptUnprotectData(
            &input,
            std::ptr::null_mut(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            0,
            &mut out,
        );
        if ok == 0 {
            return Err("Could not decrypt profile".into());
        }
        let v = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        LocalFree(out.pbData as _);
        Ok(v)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_and_clear() {
        let dir = std::env::temp_dir().join(format!("veyl-test-{}", std::process::id()));
        let p = Profile {
            server: "s".into(),
            account: "1234".into(),
            public_key: "k".into(),
            conf: "c".into(),
        };
        save(&dir, &p).unwrap();
        let back = load(&dir).unwrap();
        assert_eq!(back.account, "1234");
        clear(&dir);
        assert!(load(&dir).is_none());
        let _ = fs::remove_dir_all(&dir);
    }
}
