const enc = new TextEncoder();

const concat = (...arrs) => {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
};

const lenBytes = (n) => {
  if (n < 128) return Uint8Array.of(n);
  const bytes = [];
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
};

const der = (tag, ...parts) => {
  const body = concat(...parts);
  return concat(Uint8Array.of(tag), lenBytes(body.length), body);
};

const derInt = (bytes) => {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  let v = bytes.slice(i);
  if (v[0] & 0x80) v = concat(Uint8Array.of(0), v);
  return der(0x02, v);
};

const ecdsaDer = (raw) => der(0x30, derInt(raw.slice(0, 32)), derInt(raw.slice(32)));

const pem = (label, bytes) => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const body = btoa(bin).match(/.{1,64}/g).join("\n");
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
};

export async function generateDeviceKey() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const cn = der(0x30, der(0x31, der(0x30, Uint8Array.of(0x06, 0x03, 0x55, 0x04, 0x03), der(0x0c, enc.encode("veyl")))));
  const info = der(0x30, Uint8Array.of(0x02, 0x01, 0x00), cn, spki, Uint8Array.of(0xa0, 0x00));
  const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, info));
  const algo = der(0x30, Uint8Array.of(0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02));
  const sig = der(0x03, Uint8Array.of(0), ecdsaDer(raw));
  return {
    csr: pem("CERTIFICATE REQUEST", der(0x30, info, algo, sig)),
    privateKey: pem("PRIVATE KEY", pkcs8),
  };
}

export function fillProfile(profile, privateKey) {
  return profile.replace("__PRIVATE_KEY__", privateKey.trim());
}

export const supportsKeys = () => Boolean(globalThis.crypto?.subtle);
