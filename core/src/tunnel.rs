use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread::sleep;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const NAME: &str = "veyl";
const MSI_URL: &str = "https://download.wireguard.com/windows-client/wireguard-amd64-1.1.1.msi";
const MSI_SHA256: &str = "7bfed60ad61b785c914b38b61555a975488e1d3ec472dbfb2fcdf498fca75242";
const SIGNER: &str = "WireGuard LLC";

#[derive(Debug, Default, Serialize, PartialEq)]
pub struct Status {
    pub up: bool,
    pub rx: u64,
    pub tx: u64,
}

fn wg_dir() -> PathBuf {
    let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".into());
    PathBuf::from(pf).join("WireGuard")
}

fn wireguard_exe() -> PathBuf {
    wg_dir().join("wireguard.exe")
}

fn wg_exe() -> PathBuf {
    wg_dir().join("wg.exe")
}

fn run(program: &Path, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new(program);
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let out = cmd.output().ok()?;
    if out.status.success() {
        Some(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        None
    }
}

fn ensure_installed() -> Result<(), String> {
    if wireguard_exe().exists() {
        return Ok(());
    }
    let resp = ureq::get(MSI_URL)
        .timeout(Duration::from_secs(120))
        .call()
        .map_err(|_| "Could not download WireGuard".to_string())?;
    let mut buf = Vec::new();
    resp.into_reader()
        .take(20 * 1024 * 1024)
        .read_to_end(&mut buf)
        .map_err(|_| "Could not download WireGuard".to_string())?;
    if format!("{:x}", Sha256::digest(&buf)) != MSI_SHA256 {
        return Err("WireGuard download failed verification".into());
    }
    let msi = std::env::temp_dir().join("veyl-wireguard.msi");
    fs::write(&msi, &buf).map_err(|e| e.to_string())?;
    let script = format!(
        "$s = Get-AuthenticodeSignature -LiteralPath '{}'; if ($s.Status -eq 'Valid' -and $s.SignerCertificate.Subject -like '*{}*') {{ exit 0 }} else {{ exit 1 }}",
        msi.display(),
        SIGNER
    );
    let ps = PathBuf::from("powershell.exe");
    if run(&ps, &["-NoProfile", "-NonInteractive", "-Command", &script]).is_none() {
        let _ = fs::remove_file(&msi);
        return Err("WireGuard installer signature check failed".into());
    }
    let msiexec = PathBuf::from("msiexec.exe");
    let _ = run(
        &msiexec,
        &["/i", &msi.display().to_string(), "/qn", "/norestart"],
    );
    let _ = fs::remove_file(&msi);
    if wireguard_exe().exists() {
        Ok(())
    } else {
        Err("WireGuard installation failed".into())
    }
}

fn conf_path(dir: &Path) -> PathBuf {
    dir.join(format!("{NAME}.conf"))
}

pub fn connect(dir: &Path, conf: &str) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("Connecting is only supported on Windows".into());
    }
    ensure_installed()?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let path = conf_path(dir);
    let exe = wireguard_exe();
    let _ = run(&exe, &["/uninstalltunnelservice", NAME]);
    fs::write(&path, conf).map_err(|e| e.to_string())?;
    if run(
        &exe,
        &["/installtunnelservice", &path.display().to_string()],
    )
    .is_none()
    {
        let _ = fs::remove_file(&path);
        return Err("Could not start the tunnel. Run Veyl as administrator.".into());
    }
    for _ in 0..20 {
        if status().up {
            return Ok(());
        }
        sleep(Duration::from_millis(500));
    }
    Ok(())
}

pub fn disconnect(dir: &Path) {
    if cfg!(windows) && wireguard_exe().exists() {
        let _ = run(&wireguard_exe(), &["/uninstalltunnelservice", NAME]);
    }
    let _ = fs::remove_file(conf_path(dir));
}

pub fn parse_transfer(out: &str) -> (u64, u64) {
    let f: Vec<&str> = out.split_whitespace().collect();
    (
        f.get(1).and_then(|v| v.parse().ok()).unwrap_or(0),
        f.get(2).and_then(|v| v.parse().ok()).unwrap_or(0),
    )
}

pub fn parse_handshake(out: &str) -> u64 {
    out.split_whitespace()
        .nth(1)
        .and_then(|v| v.parse().ok())
        .unwrap_or(0)
}

pub fn is_up(handshake: u64, now: u64) -> bool {
    handshake == 0 || now.saturating_sub(handshake) < 180
}

pub fn status() -> Status {
    if !cfg!(windows) || !wg_exe().exists() {
        return Status::default();
    }
    let Some(t) = run(&wg_exe(), &["show", NAME, "transfer"]) else {
        return Status::default();
    };
    let hs = run(&wg_exe(), &["show", NAME, "latest-handshakes"])
        .map(|o| parse_handshake(&o))
        .unwrap_or(0);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (rx, tx) = parse_transfer(&t);
    Status {
        up: is_up(hs, now),
        rx,
        tx,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_transfer() {
        assert_eq!(parse_transfer("abc=\t1234\t567\n"), (1234, 567));
        assert_eq!(parse_transfer(""), (0, 0));
    }

    #[test]
    fn handshake_freshness() {
        assert_eq!(parse_handshake("abc=\t1700000000\n"), 1_700_000_000);
        assert!(is_up(0, 1_700_000_000));
        assert!(is_up(1_700_000_000, 1_700_000_100));
        assert!(!is_up(1_700_000_000, 1_700_000_500));
    }
}
