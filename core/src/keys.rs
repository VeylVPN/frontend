use rcgen::{CertificateParams, KeyPair};

pub const KEY_PLACEHOLDER: &str = "__PRIVATE_KEY__";

pub struct Material {
    pub key_pem: String,
    pub csr_pem: String,
}

pub fn generate() -> Result<Material, String> {
    let key = KeyPair::generate().map_err(|_| "Could not generate key".to_string())?;
    let params = CertificateParams::new(Vec::<String>::new())
        .map_err(|_| "Could not generate key".to_string())?;
    let csr = params
        .serialize_request(&key)
        .map_err(|_| "Could not generate key".to_string())?
        .pem()
        .map_err(|_| "Could not generate key".to_string())?;
    Ok(Material {
        key_pem: key.serialize_pem(),
        csr_pem: csr,
    })
}

pub fn fill_profile(profile: &str, key_pem: &str) -> Result<String, String> {
    let key = key_pem.trim();
    let mut found = false;
    let mut out: Vec<&str> = Vec::new();
    for line in profile.lines() {
        if line.trim() == KEY_PLACEHOLDER {
            found = true;
            out.push(key);
        } else {
            out.push(line);
        }
    }
    if !found {
        return Err("Invalid profile from server".to_string());
    }
    let mut s = out.join("\n");
    s.push('\n');
    Ok(s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_pem_pair() {
        let m = generate().unwrap();
        assert!(m.key_pem.contains("PRIVATE KEY"));
        assert!(m.csr_pem.contains("CERTIFICATE REQUEST"));
        let n = generate().unwrap();
        assert_ne!(m.key_pem, n.key_pem);
    }

    #[test]
    fn substitutes_placeholder_line() {
        let p = "client\n<key>\n__PRIVATE_KEY__\n</key>\n<tls-crypt>\nx\n</tls-crypt>\n";
        let out = fill_profile(
            p,
            "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
        )
        .unwrap();
        assert!(!out.contains(KEY_PLACEHOLDER));
        assert!(out.contains(
            "<key>\n-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n</key>"
        ));
        assert!(out.ends_with("</tls-crypt>\n"));
    }

    #[test]
    fn missing_placeholder_is_error() {
        assert!(fill_profile("client\n", "k").is_err());
    }
}
