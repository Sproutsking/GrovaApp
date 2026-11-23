type WebPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type WebPushOptions = {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
  ttl: number;
  urgency: "very-low" | "low" | "normal" | "high";
};

type WebPushResult = {
  ok: boolean;
  status: number;
  expired: boolean;
  body: string;
};

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function encodeBase64Url(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function concat(...values: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(values.reduce((length, value) => length + value.length, 0));
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
}

function uint32BE(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    return false;
  }

  const host = url.hostname.toLowerCase();
  return [
    "fcm.googleapis.com",
    "push.services.mozilla.com",
    "push.apple.com",
    "notify.windows.com",
  ].some((domain) => host === domain || host.endsWith(`.${domain}`));
}

async function hkdf(
  inputKey: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", inputKey, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function importVapidPrivateKey(value: string, extractable = false): Promise<CryptoKey> {
  const normalized = value.replace(/\\n/g, "\n").trim();
  const pemMatch = normalized.match(
    /^-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----$/,
  );
  const raw = pemMatch
    ? Uint8Array.from(atob(pemMatch[1].replace(/\s/g, "")), (character) => character.charCodeAt(0))
    : decodeBase64Url(normalized);

  if (raw[0] === 0x30) {
    return crypto.subtle.importKey(
      "pkcs8",
      raw,
      { name: "ECDSA", namedCurve: "P-256" },
      extractable,
      ["sign"],
    );
  }

  if (raw.length !== 32) {
    throw new Error("VAPID private key must be a 32-byte P-256 key or PKCS#8 private key");
  }

  const pkcs8Header = new Uint8Array([
    0x30, 0x41,
    0x02, 0x01, 0x00,
    0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    0x04, 0x27,
    0x30, 0x25,
    0x02, 0x01, 0x01,
    0x04, 0x20,
  ]);
  return crypto.subtle.importKey(
    "pkcs8",
    concat(pkcs8Header, raw),
    { name: "ECDSA", namedCurve: "P-256" },
    extractable,
    ["sign"],
  );
}

export async function inspectVapidKeyPair(
  publicKeyValue: string,
  privateKeyValue: string,
): Promise<{ publicKeyValid: boolean; privateKeyParses: boolean; keysMatch: boolean }> {
  try {
    const publicKeyBytes = decodeBase64Url(publicKeyValue);
    if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
      return { publicKeyValid: false, privateKeyParses: false, keysMatch: false };
    }
    await crypto.subtle.importKey(
      "raw",
      publicKeyBytes,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
  } catch {
    return { publicKeyValid: false, privateKeyParses: false, keysMatch: false };
  }

  let privateKey: CryptoKey;
  try {
    privateKey = await importVapidPrivateKey(privateKeyValue, true);
  } catch {
    return { publicKeyValid: true, privateKeyParses: false, keysMatch: false };
  }

  try {
    const jwk = await crypto.subtle.exportKey("jwk", privateKey);
    const publicKeyBytes = decodeBase64Url(publicKeyValue);
    const privateX = jwk.x ? decodeBase64Url(jwk.x) : new Uint8Array();
    const privateY = jwk.y ? decodeBase64Url(jwk.y) : new Uint8Array();
    const keysMatch = privateX.length === 32
      && privateY.length === 32
      && publicKeyBytes.subarray(1, 33).every((byte, index) => byte === privateX[index])
      && publicKeyBytes.subarray(33, 65).every((byte, index) => byte === privateY[index]);
    return { publicKeyValid: true, privateKeyParses: true, keysMatch };
  } catch {
    return { publicKeyValid: true, privateKeyParses: true, keysMatch: false };
  }
}

export async function validateVapidKeyPair(
  publicKeyValue: string,
  privateKeyValue: string,
): Promise<boolean> {
  const status = await inspectVapidKeyPair(publicKeyValue, privateKeyValue);
  return status.publicKeyValid && status.privateKeyParses && status.keysMatch;
}

async function buildVapidJwt(endpoint: string, options: WebPushOptions): Promise<string> {
  const url = new URL(endpoint);
  const encodeObject = (value: object) =>
    encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
  const issuedAt = Math.floor(Date.now() / 1000);
  const signingInput = [
    encodeObject({ typ: "JWT", alg: "ES256" }),
    encodeObject({
      aud: `${url.protocol}//${url.host}`,
      exp: issuedAt + 12 * 60 * 60,
      sub: options.vapidSubject,
    }),
  ].join(".");
  const key = await importVapidPrivateKey(options.vapidPrivateKey);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(signingInput),
    ),
  );
  return `${signingInput}.${encodeBase64Url(signature)}`;
}

async function encryptPayload(
  subscription: WebPushSubscription,
  payload: string,
): Promise<Uint8Array> {
  const clientPublicKey = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  if (clientPublicKey.length !== 65 || clientPublicKey[0] !== 0x04 || authSecret.length !== 16) {
    throw new Error("Legacy push subscription has invalid encryption keys");
  }

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey),
  );
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      serverKeyPair.privateKey,
      256,
    ),
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const info = concat(
    new TextEncoder().encode("WebPush: info\0"),
    clientPublicKey,
    serverPublicKey,
  );
  const inputKey = await hkdf(sharedSecret, authSecret, info, 32);
  const contentKey = await hkdf(
    inputKey,
    salt,
    new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdf(
    inputKey,
    salt,
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    12,
  );

  const plaintext = concat(new TextEncoder().encode(payload), new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext),
  );
  return concat(salt, uint32BE(4096), new Uint8Array([serverPublicKey.length]), serverPublicKey, ciphertext);
}

export async function sendWebPush(
  subscription: WebPushSubscription,
  payload: string,
  options: WebPushOptions,
): Promise<WebPushResult> {
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    return { ok: false, status: 400, expired: false, body: "Unsupported push endpoint" };
  }
  const vapidPublicKey = decodeBase64Url(options.vapidPublicKey);
  if (vapidPublicKey.length !== 65 || vapidPublicKey[0] !== 0x04) {
    return { ok: false, status: 500, expired: false, body: "Invalid VAPID public key" };
  }

  try {
    const [jwt, encryptedPayload] = await Promise.all([
      buildVapidJwt(subscription.endpoint, options),
      encryptPayload(subscription, payload),
    ]);
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": String(options.ttl),
        "Urgency": options.urgency,
        "Authorization": `vapid t=${jwt},k=${options.vapidPublicKey}`,
      },
      body: encryptedPayload,
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.text().catch(() => "")).slice(0, 200);
    return {
      ok: response.ok,
      status: response.status,
      expired: response.status === 404 || response.status === 410,
      body,
    };
  } catch (error) {
    console.error(
      "[WebPush] Delivery failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return {
      ok: false,
      status: 0,
      expired: false,
      body: "Web Push delivery failed",
    };
  }
}
