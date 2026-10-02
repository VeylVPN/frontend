use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub public_key: String,
    pub address4: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Enroll {
    pub address4: String,
    pub address6: String,
    pub server_public_key: String,
    pub endpoint: String,
    pub dns: String,
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

pub fn post(server: &str, path: &str, body: Value) -> Result<Value, String> {
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(15))
        .redirects(0)
        .build();
    let url = format!("{}{}", base_url(server), path);
    match agent.post(&url).send_json(body) {
        Ok(r) => r
            .into_json::<Value>()
            .map_err(|_| "Invalid server response".to_string()),
        Err(ureq::Error::Status(_, r)) => {
            let v = r.into_json::<Value>().unwrap_or(Value::Null);
            Err(v["error"].as_str().unwrap_or("Request failed").to_string())
        }
        Err(_) => Err("Cannot reach that server".to_string()),
    }
}

pub fn enroll(server: &str, account: &str, public_key: &str) -> Result<Enroll, String> {
    let v = post(
        server,
        "/v1/enroll",
        json!({ "account": account, "public_key": public_key }),
    )?;
    serde_json::from_value(v).map_err(|_| "Invalid server response".to_string())
}

pub fn devices(server: &str, account: &str) -> Result<Vec<Device>, String> {
    let v = post(server, "/v1/devices", json!({ "account": account }))?;
    serde_json::from_value(v).map_err(|_| "Invalid server response".to_string())
}

pub fn revoke(server: &str, account: &str, public_key: &str) -> Result<(), String> {
    post(
        server,
        "/v1/revoke",
        json!({ "account": account, "public_key": public_key }),
    )
    .map(|_| ())
}

pub fn build_config(private_key: &str, e: &Enroll) -> String {
    format!(
        "[Interface]\nPrivateKey = {}\nAddress = {}, {}\nDNS = {}\n\n[Peer]\nPublicKey = {}\nAllowedIPs = 0.0.0.0/0, ::/0\nEndpoint = {}\nPersistentKeepalive = 25\n",
        private_key, e.address4, e.address6, e.dns, e.server_public_key, e.endpoint
    )
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
    fn config_has_full_tunnel() {
        let e = Enroll {
            address4: "10.66.0.2/32".into(),
            address6: "fd66:66:66::2/128".into(),
            server_public_key: "SPK".into(),
            endpoint: "vpn.example.com:51820".into(),
            dns: "10.66.0.1,fd66:66:66::1".into(),
        };
        let c = build_config("PRIV", &e);
        assert!(c.contains("PrivateKey = PRIV"));
        assert!(c.contains("AllowedIPs = 0.0.0.0/0, ::/0"));
        assert!(c.contains("Endpoint = vpn.example.com:51820"));
    }
}
