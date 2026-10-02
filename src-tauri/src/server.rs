use serde::Serialize;
use serde_json::{json, Value};
use std::io::Read;
use std::time::{Duration, Instant};
use veyl_core::api::base_url;

const RESPONSE_LIMIT: u64 = 256 * 1024;
const TOKEN_LIFETIME: Duration = Duration::from_secs(50 * 60);

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Failure {
    pub code: String,
    pub message: String,
    pub status: u16,
}

impl Failure {
    pub fn new(code: &str, message: &str, status: u16) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            status,
        }
    }

    pub fn local(message: impl Into<String>) -> Self {
        Self {
            code: String::new(),
            message: message.into(),
            status: 0,
        }
    }

    fn unreachable() -> Self {
        Self::new("UNREACHABLE", "Cannot reach that server", 0)
    }

    fn invalid() -> Self {
        Self::new("INVALID_RESPONSE", "Invalid server response", 0)
    }
}

pub struct Token {
    key: String,
    value: String,
    until: Instant,
}

pub fn check_server(server: &str) -> Result<String, Failure> {
    let base = base_url(server);
    let rest = base
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    let ok = !rest.is_empty()
        && rest.len() <= 253
        && rest
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | ':' | '[' | ']'));
    if ok {
        Ok(base)
    } else {
        Err(Failure::new(
            "INVALID_SERVER",
            "Enter a server address like vpn.example.com",
            0,
        ))
    }
}

pub fn check_device_id(id: &str) -> Result<(), Failure> {
    let ok = !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if ok {
        Ok(())
    } else {
        Err(Failure::new("DEVICE_NOT_FOUND", "unknown device", 404))
    }
}

pub fn failure(status: u16, body: &Value) -> Failure {
    let code = body["code"]
        .as_str()
        .filter(|c| !c.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| {
            match status {
                404 => "NOT_FOUND",
                429 => "TOO_MANY_REQUESTS",
                500..=599 => "INTERNAL_ERROR",
                _ => "REQUEST_FAILED",
            }
            .to_string()
        });
    let message = body["error"]
        .as_str()
        .filter(|m| !m.is_empty())
        .unwrap_or("Request failed")
        .to_string();
    Failure {
        code,
        message,
        status,
    }
}

fn parse(response: ureq::Response) -> Result<Value, Failure> {
    if response.status() == 204 {
        return Ok(Value::Null);
    }
    let mut text = String::new();
    response
        .into_reader()
        .take(RESPONSE_LIMIT)
        .read_to_string(&mut text)
        .map_err(|_| Failure::invalid())?;
    serde_json::from_str(&text).map_err(|_| Failure::invalid())
}

fn read(result: Result<ureq::Response, ureq::Error>) -> Result<Value, Failure> {
    match result {
        Ok(response) => parse(response),
        Err(ureq::Error::Status(status, response)) => {
            let body = parse(response).unwrap_or(Value::Null);
            Err(failure(status, &body))
        }
        Err(_) => Err(Failure::unreachable()),
    }
}

pub fn send(
    method: &str,
    server: &str,
    path: &str,
    token: Option<&str>,
    body: Option<Value>,
) -> Result<Value, Failure> {
    let base = check_server(server)?;
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(15))
        .redirects(0)
        .build();
    let mut request = agent.request(method, &format!("{base}{path}"));
    if let Some(t) = token {
        request = request.set("Authorization", &format!("Bearer {t}"));
    }
    read(match body {
        Some(b) => request.send_json(b),
        None => request.call(),
    })
}

pub fn info(server: &str) -> Result<Value, Failure> {
    send("GET", server, "/v1/info", None, None)
}

pub fn redeem(server: &str, invite: &str, password: &str) -> Result<String, Failure> {
    let v = send(
        "POST",
        server,
        "/v1/register",
        None,
        Some(json!({ "invite": invite.trim(), "password": password })),
    )?;
    v["account"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(Failure::invalid)
}

fn token_key(server: &str, account: &str) -> String {
    format!("{}\n{}", base_url(server), account)
}

fn issue(server: &str, account: &str, password: &str) -> Result<Token, Failure> {
    let v = send(
        "POST",
        server,
        "/v1/auth/token",
        None,
        Some(json!({ "account": account, "password": password })),
    )?;
    let value = v["access_token"]
        .as_str()
        .filter(|t| t.starts_with("vey_") && t.len() <= 128)
        .ok_or_else(Failure::invalid)?
        .to_string();
    Ok(Token {
        key: token_key(server, account),
        value,
        until: Instant::now() + TOKEN_LIFETIME,
    })
}

pub fn authorized<F>(
    cache: &mut Option<Token>,
    server: &str,
    account: &str,
    password: &str,
    call: F,
) -> Result<Value, Failure>
where
    F: Fn(&str) -> Result<Value, Failure>,
{
    let key = token_key(server, account);
    let fresh = cache
        .as_ref()
        .is_some_and(|t| t.key == key && Instant::now() < t.until);
    if !fresh {
        *cache = Some(issue(server, account, password)?);
    }
    let token = cache.as_ref().map(|t| t.value.clone()).unwrap_or_default();
    match call(&token) {
        Err(f) if f.code == "INVALID_ACCESS_TOKEN" => {
            *cache = Some(issue(server, account, password)?);
            let token = cache.as_ref().map(|t| t.value.clone()).unwrap_or_default();
            call(&token)
        }
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_hosts_and_rejects_paths() {
        assert_eq!(
            check_server("vpn.example.com").unwrap(),
            "https://vpn.example.com"
        );
        assert_eq!(
            check_server("http://127.0.0.1:8080/").unwrap(),
            "http://127.0.0.1:8080"
        );
        assert!(check_server("https://[2001:db8::1]:443").is_ok());
        assert!(check_server("").is_err());
        assert!(check_server("vpn.example.com/v1?x=1").is_err());
        assert!(check_server("user@vpn.example.com").is_err());
        assert!(check_server("vpn example.com").is_err());
    }

    #[test]
    fn validates_device_ids() {
        assert!(check_device_id("9c1e0b7f4a2d6e83").is_ok());
        assert!(check_device_id("").is_err());
        assert!(check_device_id("../me").is_err());
        assert!(check_device_id(&"a".repeat(65)).is_err());
    }

    #[test]
    fn maps_error_envelopes() {
        let f = failure(
            409,
            &json!({"error": "device limit reached", "code": "MAX_DEVICES_REACHED"}),
        );
        assert_eq!(f.code, "MAX_DEVICES_REACHED");
        assert_eq!(f.message, "device limit reached");
        assert_eq!(f.status, 409);
        assert_eq!(failure(429, &Value::Null).code, "TOO_MANY_REQUESTS");
        assert_eq!(failure(502, &Value::Null).code, "INTERNAL_ERROR");
        assert_eq!(failure(400, &json!({"code": ""})).code, "REQUEST_FAILED");
    }

    #[test]
    fn retries_once_with_a_new_token_after_revocation() {
        let mut cache = Some(Token {
            key: token_key("vpn.example.com", "1234"),
            value: "vey_old".into(),
            until: Instant::now() + TOKEN_LIFETIME,
        });
        let calls = std::cell::Cell::new(0);
        let out = authorized(&mut cache, "vpn.example.com", "1234", "pw", |t| {
            calls.set(calls.get() + 1);
            assert_eq!(t, "vey_old");
            Ok(json!({"ok": true}))
        })
        .unwrap();
        assert_eq!(out["ok"], true);
        assert_eq!(calls.get(), 1);
    }
}
