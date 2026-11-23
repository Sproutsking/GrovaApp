import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  createDecipheriv,
  createECDH,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import {
  inspectVapidKeyPair,
  sendWebPush,
  validateVapidKeyPair,
} from "./webPush.ts";

const encode = (value) => Buffer.from(value).toString("base64url");
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("sends a standards-shaped aes128gcm Web Push record that decrypts", async () => {
  const clientKey = createECDH("prime256v1");
  clientKey.generateKeys();
  const vapidKey = createECDH("prime256v1");
  vapidKey.generateKeys();
  const auth = randomBytes(16);
  const payload = JSON.stringify({ title: "Test", data: { type: "dm" } });
  let captured;

  globalThis.fetch = async (endpoint, request) => {
    captured = { endpoint, request };
    return new Response("", { status: 201 });
  };

  const result = await sendWebPush(
    {
      endpoint: "https://fcm.googleapis.com/fcm/send/test",
      p256dh: encode(clientKey.getPublicKey(null, "uncompressed")),
      auth: encode(auth),
    },
    payload,
    {
      vapidPublicKey: encode(vapidKey.getPublicKey(null, "uncompressed")),
      vapidPrivateKey: encode(vapidKey.getPrivateKey()),
      vapidSubject: "mailto:test@example.com",
      ttl: 60,
      urgency: "high",
    },
  );

  assert.equal(result.ok, true);
  const headers = new Headers(captured.request.headers);
  assert.equal(headers.get("Content-Encoding"), "aes128gcm");
  assert.match(headers.get("Authorization"), /^vapid t=.+,k=.+$/);

  const record = Buffer.from(captured.request.body);
  const salt = record.subarray(0, 16);
  assert.equal(record.readUInt32BE(16), 4096);
  const publicKeyLength = record[20];
  assert.equal(publicKeyLength, 65);
  const serverPublicKey = record.subarray(21, 21 + publicKeyLength);
  const encrypted = record.subarray(21 + publicKeyLength);
  const sharedSecret = clientKey.computeSecret(serverPublicKey);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    clientKey.getPublicKey(null, "uncompressed"),
    serverPublicKey,
  ]);
  const inputKey = Buffer.from(
    hkdfSync("sha256", sharedSecret, auth, keyInfo, 32),
  );
  const contentKey = Buffer.from(
    hkdfSync("sha256", inputKey, salt, "Content-Encoding: aes128gcm\0", 16),
  );
  const nonce = Buffer.from(
    hkdfSync("sha256", inputKey, salt, "Content-Encoding: nonce\0", 12),
  );
  const decipher = createDecipheriv("aes-128-gcm", contentKey, nonce);
  decipher.setAuthTag(encrypted.subarray(-16));
  const plaintext = Buffer.concat([
    decipher.update(encrypted.subarray(0, -16)),
    decipher.final(),
  ]);
  assert.deepEqual(plaintext, Buffer.concat([Buffer.from(payload), Buffer.from([0x02])]));
});

test("rejects non-provider endpoints before making an outbound request", async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response("", { status: 201 });
  };

  const result = await sendWebPush(
    { endpoint: "https://127.0.0.1/admin", p256dh: "", auth: "" },
    "{}",
    {
      vapidPublicKey: "",
      vapidPrivateKey: "",
      vapidSubject: "mailto:test@example.com",
      ttl: 60,
      urgency: "normal",
    },
  );

  assert.equal(result.status, 400);
  assert.equal(fetchCalled, false);
});

test("validates the VAPID public and private keys as a pair", async () => {
  const matchingKey = createECDH("prime256v1");
  matchingKey.generateKeys();
  const otherKey = createECDH("prime256v1");
  otherKey.generateKeys();

  assert.equal(
    await validateVapidKeyPair(
      encode(matchingKey.getPublicKey(null, "uncompressed")),
      encode(matchingKey.getPrivateKey()),
    ),
    true,
  );
  assert.equal(
    await validateVapidKeyPair(
      encode(matchingKey.getPublicKey(null, "uncompressed")),
      encode(otherKey.getPrivateKey()),
    ),
    false,
  );
  assert.deepEqual(
    await inspectVapidKeyPair(
      encode(matchingKey.getPublicKey(null, "uncompressed")),
      encode(otherKey.getPrivateKey()),
    ),
    { publicKeyValid: true, privateKeyParses: true, keysMatch: false },
  );
});

test("marks gone push subscriptions as expired", async () => {
  const clientKey = createECDH("prime256v1");
  clientKey.generateKeys();
  const vapidKey = createECDH("prime256v1");
  vapidKey.generateKeys();
  globalThis.fetch = async () => new Response("", { status: 410 });

  const result = await sendWebPush(
    {
      endpoint: "https://fcm.googleapis.com/fcm/send/test",
      p256dh: encode(clientKey.getPublicKey(null, "uncompressed")),
      auth: encode(randomBytes(16)),
    },
    "{}",
    {
      vapidPublicKey: encode(vapidKey.getPublicKey(null, "uncompressed")),
      vapidPrivateKey: encode(vapidKey.getPrivateKey()),
      vapidSubject: "mailto:test@example.com",
      ttl: 60,
      urgency: "normal",
    },
  );

  assert.equal(result.expired, true);
});
