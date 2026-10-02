use base64::{engine::general_purpose::STANDARD, Engine};
use rand_core::OsRng;
use x25519_dalek::{PublicKey, StaticSecret};

pub struct Keypair {
    pub private: String,
    pub public: String,
}

pub fn generate() -> Keypair {
    let secret = StaticSecret::random_from_rng(OsRng);
    let public = PublicKey::from(&secret);
    Keypair {
        private: STANDARD.encode(secret.to_bytes()),
        public: STANDARD.encode(public.as_bytes()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_are_32_bytes_and_distinct() {
        let a = generate();
        let b = generate();
        assert_eq!(STANDARD.decode(&a.private).unwrap().len(), 32);
        assert_eq!(STANDARD.decode(&a.public).unwrap().len(), 32);
        assert_ne!(a.private, b.private);
    }

    #[test]
    fn public_matches_private() {
        let k = generate();
        let raw: [u8; 32] = STANDARD.decode(&k.private).unwrap().try_into().unwrap();
        let derived = PublicKey::from(&StaticSecret::from(raw));
        assert_eq!(STANDARD.encode(derived.as_bytes()), k.public);
    }
}
