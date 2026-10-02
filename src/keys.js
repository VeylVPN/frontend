const b64 = (bytes) => btoa(String.fromCharCode(...bytes));

export async function generateKeypair() {
  const pair = await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { privateKey: b64(pkcs8.slice(-32)), publicKey: b64(raw) };
}

export function supportsX25519() {
  return Boolean(globalThis.crypto?.subtle);
}
