const LEGACY_DEFAULT_KEY = "xeevia-2fa-default-key-change-me";
const VERSION_PREFIX = "v2";

export function getConfiguredTwoFactorKey(): string | null {
  return Deno.env.get("TWO_FA_ENCRYPTION_KEY") ?? null;
}

export function requireStrongTwoFactorKey(key: string | null): string {
  if (!key || key === LEGACY_DEFAULT_KEY || key.length < 32) {
    throw new Error("TWO_FA_ENCRYPTION_KEY must be configured with at least 32 characters.");
  }
  return key;
}

async function deriveEncryptionKey(key: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export async function encryptTwoFactorSecret(secret: string, key: string): Promise<string> {
  const cryptoKey = await deriveEncryptionKey(requireStrongTwoFactorKey(key));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    new TextEncoder().encode(secret),
  );
  return `${VERSION_PREFIX}:${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptTwoFactorSecret(
  encryptedSecret: string,
  key: string | null,
): Promise<{ secret: string; legacy: boolean }> {
  if (encryptedSecret.startsWith(`${VERSION_PREFIX}:`)) {
    const parts = encryptedSecret.split(":");
    if (parts.length !== 3 || !parts[1] || !parts[2]) {
      throw new Error("Stored authenticator secret has an invalid format.");
    }
    const cryptoKey = await deriveEncryptionKey(requireStrongTwoFactorKey(key));
    const iv = new Uint8Array(fromBase64(parts[1]));
    const ciphertext = new Uint8Array(fromBase64(parts[2]));
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer },
      cryptoKey,
      ciphertext.buffer,
    );
    return { secret: new TextDecoder().decode(plaintext), legacy: false };
  }

  const legacyKeys = key && key !== LEGACY_DEFAULT_KEY
    ? [key, LEGACY_DEFAULT_KEY]
    : [key || LEGACY_DEFAULT_KEY];
  const decoded = atob(encryptedSecret);
  for (const legacyKey of legacyKeys) {
    const secret = Array.from(decoded, (char, index) =>
      String.fromCharCode(char.charCodeAt(0) ^ legacyKey.charCodeAt(index % legacyKey.length))
    ).join("");
    if (/^[A-Z2-7]{16,64}$/.test(secret)) {
      return { secret, legacy: true };
    }
  }
  throw new Error("Stored authenticator secret could not be decrypted.");
}
