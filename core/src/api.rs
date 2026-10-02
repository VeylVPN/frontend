use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub created: u64,
    pub online: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeviceList {
    pub limit: u32,
    pub devices: Vec<Device>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Enroll {
    pub id: String,
    pub profile: String,
}

pub fn base_url(server: &str) -> String {
    let s = server.trim().trim_end_matches('/');
    if s.starts_with("http://") || s.starts_with("https://") {
        s.to_string()
    } else {
        format!("https://{s}")
    }
}

pub fn host(server: &str) -> String {
    let b = base_url(server);
    b.trim_start_matches("https://")
        .trim_start_matches("http://")
        .to_string()
}

pub fn error_message(status: u16, body: &Value) -> String {
    if let Some(m) = body["error"].as_str() {
        if !m.is_empty() {
            return m.to_string();
        }
    }
    match status {
        401 => "invalid credentials".to_string(),
        404 => "Not found".to_string(),
        409 => "Conflict".to_string(),
        429 => "Too many attempts, try again later".to_string(),
        500..=599 => "Server error".to_string(),
        _ => "Request failed".to_string(),
    }
}

pub fn post(server: &str, path: &str, body: Value) -> Result<Value, String> {
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(20))
        .redirects(0)
        .build();
    let url = format!("{}{}", base_url(server), path);
    match agent.post(&url).send_json(body) {
        Ok(r) => r
            .into_json::<Value>()
            .map_err(|_| "Invalid server response".to_string()),
        Err(ureq::Error::Status(code, r)) => {
            let v = r.into_json::<Value>().unwrap_or(Value::Null);
            Err(error_message(code, &v))
        }
        Err(_) => Err("Cannot reach that server".to_string()),
    }
}

pub fn register(server: &str, account: Option<&str>, password: &str) -> Result<String, String> {
    let mut body = json!({ "password": password });
    if let Some(a) = account.filter(|a| !a.trim().is_empty()) {
        body["account"] = json!(a.trim());
    }
    let v = post(server, "/v1/register", body)?;
    v["account"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid server response".to_string())
}

pub fn devices(server: &str, account: &str, password: &str) -> Result<DeviceList, String> {
    let v = post(
        server,
        "/v1/devices",
        json!({ "account": account, "password": password }),
    )?;
    serde_json::from_value(v).map_err(|_| "Invalid server response".to_string())
}

pub fn enroll(
    server: &str,
    account: &str,
    password: &str,
    name: &str,
    csr_pem: &str,
) -> Result<Enroll, String> {
    let v = post(
        server,
        "/v1/enroll",
        json!({ "account": account, "password": password, "name": name, "csr": csr_pem }),
    )?;
    serde_json::from_value(v).map_err(|_| "Invalid server response".to_string())
}

pub fn revoke(server: &str, account: &str, password: &str, id: &str) -> Result<(), String> {
    post(
        server,
        "/v1/revoke",
        json!({ "account": account, "password": password, "id": id }),
    )
    .map(|_| ())
}

pub fn change_password(
    server: &str,
    account: &str,
    password: &str,
    new_password: &str,
) -> Result<(), String> {
    post(
        server,
        "/v1/password",
        json!({ "account": account, "password": password, "new_password": new_password }),
    )
    .map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalises_server() {
        assert_eq!(base_url("vpn.example.com/"), "https://vpn.example.com");
        assert_eq!(base_url("http://1.2.3.4:8080"), "http://1.2.3.4:8080");
        assert_eq!(host("https://vpn.example.com"), "vpn.example.com");
    }

    #[test]
    fn maps_error_bodies() {
        assert_eq!(
            error_message(401, &json!({"error": "invalid credentials"})),
            "invalid credentials"
        );
        assert_eq!(
            error_message(409, &json!({"error": "device limit reached"})),
            "device limit reached"
        );
        assert_eq!(
            error_message(429, &Value::Null),
            "Too many attempts, try again later"
        );
        assert_eq!(error_message(502, &Value::Null), "Server error");
        assert_eq!(error_message(400, &json!({"error": ""})), "Request failed");
    }

    #[test]
    fn parses_device_list() {
        let v = json!({"limit":5,"devices":[{"id":"ab","name":"pc","created":1,"online":true}]});
        let l: DeviceList = serde_json::from_value(v).unwrap();
        assert_eq!(l.limit, 5);
        assert!(l.devices[0].online);
    }
}
