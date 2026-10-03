use rand_core::{OsRng, RngCore};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread::sleep;
use std::time::Duration;

const MSI_URL: &str =
    "https://swupdate.openvpn.net/community/releases/OpenVPN-2.6.22-I001-amd64.msi";
const MSI_SHA256: &str = "1e1bb9a712990d1b2b961de7e8df3384964e4fb6f6776a100840f0d9a82ed507";
const SIGNER: &str = "OpenVPN";
const RULE: &str = "VeylKillSwitch";
const TUNNEL_RANGES: &str = "10.8.0.0/24,10.9.0.0/24,fd88:88:88::/64,fd88:88:89::/64";
const PROFILE_FILE: &str = "veyl.ovpn";
const PASSWORD_FILE: &str = "veyl.mgmt";

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum State {
    Off,
    Connecting,
    Connected,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Status {
    pub state: State,
    pub rx: u64,
    pub tx: u64,
}

impl Default for Status {
    fn default() -> Self {
        Status {
            state: State::Off,
            rx: 0,
            tx: 0,
        }
    }
}

struct Session {
    child: Child,
    port: u16,
    password: String,
    dir: PathBuf,
}

static SESSION: Mutex<Option<Session>> = Mutex::new(None);

fn openvpn_exe() -> PathBuf {
    let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".into());
    PathBuf::from(pf)
        .join("OpenVPN")
        .join("bin")
        .join("openvpn.exe")
}

#[cfg(windows)]
fn command(program: &Path) -> Command {
    use std::os::windows::process::CommandExt;
    let mut cmd = Command::new(program);
    cmd.creation_flags(0x0800_0000);
    cmd
}

#[cfg(not(windows))]
fn command(program: &Path) -> Command {
    Command::new(program)
}

fn run(program: &Path, args: &[String]) -> Option<String> {
    let out = command(program)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .ok()?;
    if out.status.success() {
        Some(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        None
    }
}

fn strings(args: &[&str]) -> Vec<String> {
    args.iter().map(|s| s.to_string()).collect()
}

fn ensure_installed() -> Result<(), String> {
    if openvpn_exe().exists() {
        return Ok(());
    }
    let resp = ureq::get(MSI_URL)
        .timeout(Duration::from_secs(180))
        .call()
        .map_err(|_| "Could not download OpenVPN".to_string())?;
    let mut buf = Vec::new();
    resp.into_reader()
        .take(40 * 1024 * 1024)
        .read_to_end(&mut buf)
        .map_err(|_| "Could not download OpenVPN".to_string())?;
    if format!("{:x}", Sha256::digest(&buf)) != MSI_SHA256 {
        return Err("OpenVPN download failed verification".into());
    }
    let msi = std::env::temp_dir().join("veyl-openvpn.msi");
    fs::write(&msi, &buf).map_err(|e| e.to_string())?;
    let script = signature_script(&msi.display().to_string());
    let ps = PathBuf::from("powershell.exe");
    let checked = run(
        &ps,
        &strings(&["-NoProfile", "-NonInteractive", "-Command", &script]),
    );
    if checked.is_none() {
        let _ = fs::remove_file(&msi);
        return Err("OpenVPN installer signature check failed".into());
    }
    let _ = run(
        &PathBuf::from("msiexec.exe"),
        &strings(&["/i", &msi.display().to_string(), "/qn", "/norestart"]),
    );
    let _ = fs::remove_file(&msi);
    if openvpn_exe().exists() {
        Ok(())
    } else {
        Err("OpenVPN installation failed. Run Veyl as administrator.".into())
    }
}

pub fn signature_script(path: &str) -> String {
    format!(
        "$s = Get-AuthenticodeSignature -LiteralPath '{}'; if ($s.Status -eq 'Valid' -and $s.SignerCertificate.Subject -like '*{}*') {{ exit 0 }} else {{ exit 1 }}",
        path.replace('\'', "''"),
        SIGNER
    )
}

pub fn kill_switch_enable_commands(openvpn: &str) -> Vec<Vec<String>> {
    let name = format!("name={RULE}");
    vec![
        vec![
            "advfirewall".into(),
            "firewall".into(),
            "add".into(),
            "rule".into(),
            name.clone(),
            "dir=out".into(),
            "action=allow".into(),
            format!("program={openvpn}"),
            "enable=yes".into(),
        ],
        vec![
            "advfirewall".into(),
            "firewall".into(),
            "add".into(),
            "rule".into(),
            name.clone(),
            "dir=out".into(),
            "action=allow".into(),
            format!("localip={TUNNEL_RANGES}"),
            "enable=yes".into(),
        ],
        vec![
            "advfirewall".into(),
            "firewall".into(),
            "add".into(),
            "rule".into(),
            name.clone(),
            "dir=out".into(),
            "action=allow".into(),
            "remoteip=127.0.0.1".into(),
            "enable=yes".into(),
        ],
        vec![
            "advfirewall".into(),
            "firewall".into(),
            "add".into(),
            "rule".into(),
            name,
            "dir=out".into(),
            "action=allow".into(),
            "protocol=udp".into(),
            "localport=68".into(),
            "remoteport=67".into(),
            "enable=yes".into(),
        ],
        strings(&[
            "advfirewall",
            "set",
            "allprofiles",
            "firewallpolicy",
            "blockinbound,blockoutbound",
        ]),
    ]
}

pub fn kill_switch_disable_commands() -> Vec<Vec<String>> {
    vec![
        strings(&[
            "advfirewall",
            "set",
            "allprofiles",
            "firewallpolicy",
            "blockinbound,allowoutbound",
        ]),
        strings(&[
            "advfirewall",
            "firewall",
            "delete",
            "rule",
            &format!("name={RULE}"),
        ]),
    ]
}

fn netsh(cmds: &[Vec<String>]) -> bool {
    let exe = PathBuf::from("netsh.exe");
    let mut ok = true;
    for c in cmds {
        ok &= run(&exe, c).is_some();
    }
    ok
}

fn kill_switch_on(openvpn: &Path) -> bool {
    if !cfg!(windows) {
        return true;
    }
    kill_switch_off();
    let ok = netsh(&kill_switch_enable_commands(&openvpn.display().to_string()));
    if !ok {
        kill_switch_off();
    }
    ok
}

fn kill_switch_off() {
    if cfg!(windows) {
        netsh(&kill_switch_disable_commands());
    }
}

pub fn parse_state_name(name: &str) -> State {
    match name.trim() {
        "CONNECTED" => State::Connected,
        "EXITING" | "" => State::Off,
        _ => State::Connecting,
    }
}

pub fn parse_state_output(out: &str) -> State {
    out.lines()
        .map(str::trim)
        .filter(|l| !l.starts_with('>') && !l.starts_with("SUCCESS") && *l != "END")
        .rfind(|l| l.contains(','))
        .and_then(|l| l.split(',').nth(1))
        .map(parse_state_name)
        .unwrap_or(State::Connecting)
}

pub fn parse_load_stats(out: &str) -> (u64, u64) {
    let line = out
        .lines()
        .map(str::trim)
        .find(|l| l.contains("bytesin="))
        .unwrap_or("");
    let line = line.trim_start_matches("SUCCESS:").trim();
    let mut rx = 0;
    let mut tx = 0;
    for part in line.split(',') {
        if let Some(v) = part.trim().strip_prefix("bytesin=") {
            rx = v.parse().unwrap_or(0);
        } else if let Some(v) = part.trim().strip_prefix("bytesout=") {
            tx = v.parse().unwrap_or(0);
        }
    }
    (rx, tx)
}

pub fn openvpn_args(profile: &Path, port: u16, pwfile: &Path) -> Vec<String> {
    vec![
        "--config".into(),
        profile.display().to_string(),
        "--management".into(),
        "127.0.0.1".into(),
        port.to_string(),
        pwfile.display().to_string(),
        "--management-query-passwords".into(),
        "no".into(),
    ]
}

fn random_hex(bytes: usize) -> String {
    let mut b = vec![0u8; bytes];
    OsRng.fill_bytes(&mut b);
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn free_port() -> Result<u16, String> {
    let l = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).map_err(|e| e.to_string())?;
    let port = l.local_addr().map_err(|e| e.to_string())?.port();
    Ok(port)
}

fn restrict(path: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
}

fn remove_files(dir: &Path) {
    let _ = fs::remove_file(dir.join(PROFILE_FILE));
    let _ = fs::remove_file(dir.join(PASSWORD_FILE));
}

fn manage(port: u16, password: &str, commands: &[&str]) -> Option<Vec<String>> {
    let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    let stream = TcpStream::connect_timeout(&addr, Duration::from_secs(2)).ok()?;
    stream.set_read_timeout(Some(Duration::from_secs(3))).ok()?;
    stream
        .set_write_timeout(Some(Duration::from_secs(3)))
        .ok()?;
    let mut writer = stream.try_clone().ok()?;
    let mut reader = BufReader::new(stream);
    writer.write_all(format!("{password}\n").as_bytes()).ok()?;
    let mut line = String::new();
    loop {
        line.clear();
        reader.read_line(&mut line).ok().filter(|n| *n > 0)?;
        if line.contains("FAILURE") {
            return None;
        }
        if line.contains("SUCCESS: password is correct") {
            break;
        }
    }
    let mut outputs = Vec::new();
    for c in commands {
        writer.write_all(format!("{c}\n").as_bytes()).ok()?;
        let mut acc = String::new();
        loop {
            line.clear();
            reader.read_line(&mut line).ok().filter(|n| *n > 0)?;
            let t = line.trim();
            if t.starts_with('>') {
                continue;
            }
            if t == "END" {
                break;
            }
            acc.push_str(t);
            acc.push('\n');
            if t.starts_with("SUCCESS:") || t.starts_with("ERROR:") {
                break;
            }
        }
        outputs.push(acc);
    }
    let _ = writer.write_all(b"quit\n");
    Some(outputs)
}

fn poll(port: u16, password: &str) -> Option<Status> {
    let out = manage(port, password, &["state", "load-stats"])?;
    let state = parse_state_output(&out[0]);
    let (rx, tx) = parse_load_stats(&out[1]);
    Some(Status { state, rx, tx })
}

pub fn connect(dir: &Path, ovpn: &str) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("Connecting is only supported on Windows".into());
    }
    ensure_installed()?;
    disconnect(dir);
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let profile = dir.join(PROFILE_FILE);
    let pwfile = dir.join(PASSWORD_FILE);
    let password = random_hex(24);
    let port = free_port()?;
    fs::write(&profile, ovpn).map_err(|e| e.to_string())?;
    restrict(&profile);
    fs::write(&pwfile, &password).map_err(|e| e.to_string())?;
    restrict(&pwfile);
    let exe = openvpn_exe();
    if !kill_switch_on(&exe) {
        remove_files(dir);
        return Err("Could not enable the kill switch. Run Veyl as administrator.".into());
    }
    let child = command(&exe)
        .args(openvpn_args(&profile, port, &pwfile))
        .current_dir(dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
    let child = match child {
        Ok(c) => c,
        Err(_) => {
            kill_switch_off();
            remove_files(dir);
            return Err("Could not start OpenVPN. Run Veyl as administrator.".into());
        }
    };
    *SESSION.lock().unwrap() = Some(Session {
        child,
        port,
        password: password.clone(),
        dir: dir.to_path_buf(),
    });
    for _ in 0..60 {
        sleep(Duration::from_millis(500));
        let exited = {
            let mut g = SESSION.lock().unwrap();
            match g.as_mut() {
                Some(s) => s.child.try_wait().map(|r| r.is_some()).unwrap_or(true),
                None => true,
            }
        };
        if exited {
            disconnect(dir);
            return Err("Could not connect. Run Veyl as administrator.".into());
        }
        if let Some(s) = poll(port, &password) {
            if s.state == State::Connected {
                let _ = fs::remove_file(&profile);
                return Ok(());
            }
        }
    }
    Ok(())
}

pub fn disconnect(dir: &Path) {
    let session = SESSION.lock().unwrap().take();
    if let Some(mut s) = session {
        let _ = s.child.kill();
        let _ = s.child.wait();
        remove_files(&s.dir);
    }
    remove_files(dir);
    kill_switch_off();
}

pub fn cleanup(dir: &Path) {
    disconnect(dir);
}

pub fn status() -> Status {
    let (port, password) = {
        let mut g = SESSION.lock().unwrap();
        let Some(s) = g.as_mut() else {
            return Status::default();
        };
        if s.child.try_wait().map(|r| r.is_some()).unwrap_or(true) {
            let dir = s.dir.clone();
            drop(g);
            disconnect(&dir);
            return Status::default();
        }
        (s.port, s.password.clone())
    };
    poll(port, &password).unwrap_or(Status {
        state: State::Connecting,
        rx: 0,
        tx: 0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn state_names() {
        assert_eq!(parse_state_name("CONNECTED"), State::Connected);
        assert_eq!(parse_state_name("WAIT"), State::Connecting);
        assert_eq!(parse_state_name("RECONNECTING"), State::Connecting);
        assert_eq!(parse_state_name("EXITING"), State::Off);
    }

    #[test]
    fn state_output() {
        let out = "1700000000,CONNECTED,SUCCESS,10.8.0.2,1.2.3.4,1194,,\r\nEND\r\n";
        assert_eq!(parse_state_output(out), State::Connected);
        let out = ">INFO:hello\n1700000000,GET_CONFIG,,,,,,\nEND\n";
        assert_eq!(parse_state_output(out), State::Connecting);
        assert_eq!(parse_state_output(""), State::Connecting);
    }

    #[test]
    fn load_stats() {
        assert_eq!(
            parse_load_stats("SUCCESS: nclients=0,bytesin=1234,bytesout=567\n"),
            (1234, 567)
        );
        assert_eq!(parse_load_stats("ERROR: nope"), (0, 0));
    }

    #[test]
    fn kill_switch_commands() {
        let on = kill_switch_enable_commands("C:\\Program Files\\OpenVPN\\bin\\openvpn.exe");
        assert!(on.iter().all(|c| c[0] == "advfirewall"));
        assert!(on.iter().any(
            |c| c.contains(&"program=C:\\Program Files\\OpenVPN\\bin\\openvpn.exe".to_string())
        ));
        assert!(on.iter().any(|c| c.contains(
            &"localip=10.8.0.0/24,10.9.0.0/24,fd88:88:88::/64,fd88:88:89::/64".to_string()
        )));
        assert!(!on.iter().any(|c| c.contains(&"delete".to_string())));
        assert!(on
            .last()
            .unwrap()
            .contains(&"blockinbound,blockoutbound".to_string()));
        assert!(on
            .iter()
            .filter(|c| c.contains(&"action=allow".to_string()))
            .all(|c| c.contains(&"name=VeylKillSwitch".to_string())));
        let off = kill_switch_disable_commands();
        assert!(off[0].contains(&"blockinbound,allowoutbound".to_string()));
        assert!(off[1].contains(&"name=VeylKillSwitch".to_string()));
    }

    #[test]
    fn openvpn_command_line() {
        let a = openvpn_args(Path::new("a.ovpn"), 4242, Path::new("pw"));
        assert_eq!(
            a,
            vec![
                "--config",
                "a.ovpn",
                "--management",
                "127.0.0.1",
                "4242",
                "pw",
                "--management-query-passwords",
                "no"
            ]
        );
    }

    #[test]
    fn signature_script_checks_signer() {
        let s = signature_script("C:\\a'b.msi");
        assert!(s.contains("*OpenVPN*"));
        assert!(s.contains("a''b.msi"));
    }

    #[test]
    fn helpers() {
        assert_eq!(random_hex(24).len(), 48);
        assert_ne!(random_hex(8), random_hex(8));
        assert!(free_port().unwrap() > 0);
    }

    #[test]
    fn management_roundtrip() {
        let l = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let port = l.local_addr().unwrap().port();
        let t = std::thread::spawn(move || {
            let (s, _) = l.accept().unwrap();
            let mut w = s.try_clone().unwrap();
            let mut r = BufReader::new(s);
            w.write_all(b"ENTER PASSWORD:").unwrap();
            let mut line = String::new();
            r.read_line(&mut line).unwrap();
            assert_eq!(line.trim(), "secret");
            w.write_all(b"SUCCESS: password is correct\r\n>INFO:x\r\n")
                .unwrap();
            line.clear();
            r.read_line(&mut line).unwrap();
            w.write_all(b"1,CONNECTED,SUCCESS,10.8.0.2,,,,\r\nEND\r\n")
                .unwrap();
            line.clear();
            r.read_line(&mut line).unwrap();
            w.write_all(b"SUCCESS: nclients=0,bytesin=10,bytesout=20\r\n")
                .unwrap();
        });
        let s = poll(port, "secret").unwrap();
        t.join().unwrap();
        assert_eq!(
            s,
            Status {
                state: State::Connected,
                rx: 10,
                tx: 20
            }
        );
    }
}
