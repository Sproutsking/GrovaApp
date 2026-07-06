const ENCRYPTION_KEY = Deno.env.get("TOKEN_ENCRYPTION_KEY") ?? "";
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const IV_LENGTH = 12;

function ensureSecret() {
  if (!ENCRYPTION_KEY) {
    throw new Error("Missing TOKEN_ENCRYPTION_KEY environment variable");
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function getAesKey(): Promise<CryptoKey> {
  ensureSecret();
  const keyBytes = base64ToBytes(ENCRYPTION_KEY);
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptString(value: string): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await getAesKey();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    TEXT_ENCODER.encode(value),
  );
  const buffer = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  buffer.set(iv, 0);
  buffer.set(new Uint8Array(ciphertext), IV_LENGTH);
  return buffer;
}

export async function decryptString(value: Uint8Array | string): Promise<string> {
  const bytes = typeof value === "string" ? base64ToBytes(value) : value;
  if (bytes.length <= IV_LENGTH) {
    throw new Error("Encrypted value is too short");
  }
  const iv = bytes.slice(0, IV_LENGTH);
  const ciphertext = bytes.slice(IV_LENGTH);
  const key = await getAesKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return TEXT_DECODER.decode(plaintext);
}

export function encodeEncryptedValue(value: Uint8Array): string {
  return bytesToBase64(value);
}

export function decodeEncryptedValue(value: string): Uint8Array {
  return base64ToBytes(value);
}
