import * as CML from "@emurgo/cardano-message-signing";
import { blake2b } from "@noble/hashes/blake2.js";
import { parseAddress, toHex, verifyCip8Signature } from "./verification.ts";

async function createSignatureFixture() {
  const generatedKey = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  );
  if (!("publicKey" in generatedKey) || !("privateKey" in generatedKey)) {
    throw new Error("Ed25519 key-pair generation returned an invalid result.");
  }
  const keyPair = generatedKey;
  const publicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", keyPair.publicKey),
  );
  const paymentKeyHash = blake2b(publicKeyBytes, { dkLen: 28 });
  const addressBytes = new Uint8Array(29);
  addressBytes[0] = 0x61;
  addressBytes.set(paymentKeyHash, 1);
  const message =
    "app.xeevia.com wants you to sign in with your Cardano account";
  const payload = new TextEncoder().encode(message);
  const headers = CML.Headers.new(
    CML.ProtectedHeaderMap.new_empty(),
    CML.HeaderMap.new(),
  );
  const unsigned = CML.COSESign1.new(headers, payload, new Uint8Array(64));
  const sigStructure = unsigned.signed_data(addressBytes);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "Ed25519",
      keyPair.privateKey,
      Uint8Array.from(sigStructure.to_bytes()),
    ),
  );
  const signedMessage = CML.COSESign1.new(headers, payload, signature);
  const coseKey = CML.COSEKey.new(
    CML.Label.new_int(CML.Int.new_i32(1)),
  );
  coseKey.set_header(
    CML.Label.new_int(CML.Int.new_i32(-2)),
    CML.CBORValue.new_bytes(publicKeyBytes),
  );

  return {
    addressBytes,
    addressHex: toHex(addressBytes),
    expectedPaymentKeyHash: paymentKeyHash,
    keyHex: toHex(coseKey.to_bytes()),
    message,
    signatureHex: toHex(signedMessage.to_bytes()),
  };
}

Deno.test("Cardano CIP-8 verifies signed payload and address ownership", async () => {
  const fixture = await createSignatureFixture();
  const parsedAddress = parseAddress(fixture.addressHex);

  if (parsedAddress.canonicalAddress.length < 20) {
    throw new Error("Cardano address did not parse to Bech32.");
  }
  if (
    !await verifyCip8Signature(
      fixture.addressBytes,
      fixture.message,
      fixture.keyHex,
      fixture.signatureHex,
      fixture.expectedPaymentKeyHash,
    )
  ) {
    throw new Error("Valid Cardano CIP-8 signature was rejected.");
  }
});

Deno.test("Cardano CIP-8 rejects changed messages and unrelated payment keys", async () => {
  const fixture = await createSignatureFixture();

  if (
    await verifyCip8Signature(
      fixture.addressBytes,
      `${fixture.message}.`,
      fixture.keyHex,
      fixture.signatureHex,
      fixture.expectedPaymentKeyHash,
    )
  ) {
    throw new Error("A changed challenge message was accepted.");
  }

  if (
    await verifyCip8Signature(
      fixture.addressBytes,
      fixture.message,
      fixture.keyHex,
      fixture.signatureHex,
      new Uint8Array(28),
    )
  ) {
    throw new Error("A signature from an unrelated payment key was accepted.");
  }
});

Deno.test("Cardano address parsing accepts key-based Shelley address forms", async () => {
  const fixture = await createSignatureFixture();
  const enterprise = parseAddress(fixture.addressHex);
  const baseBytes = new Uint8Array(57);
  baseBytes[0] = 0x01;
  baseBytes.set(fixture.expectedPaymentKeyHash, 1);
  const pointerBytes = new Uint8Array(32);
  pointerBytes[0] = 0x41;
  pointerBytes.set(fixture.expectedPaymentKeyHash, 1);
  pointerBytes.set([0, 0, 0], 29);
  const base = parseAddress(toHex(baseBytes));
  const pointer = parseAddress(toHex(pointerBytes));

  if (
    enterprise.networkId !== 1 || base.networkId !== 1 ||
    pointer.networkId !== 1
  ) {
    throw new Error("Cardano network ID was parsed incorrectly.");
  }
  if (
    toHex(base.paymentKeyHash) !== toHex(fixture.expectedPaymentKeyHash) ||
    toHex(pointer.paymentKeyHash) !== toHex(fixture.expectedPaymentKeyHash)
  ) {
    throw new Error("Cardano payment key hash was parsed incorrectly.");
  }
  if (!enterprise.canonicalAddress.startsWith("addr1")) {
    throw new Error("Mainnet Cardano address was not Bech32 encoded.");
  }
});

Deno.test("Cardano address parsing rejects script and malformed pointer addresses", () => {
  const scriptAddress = new Uint8Array(29);
  scriptAddress[0] = 0x71;
  if (!throws(() => parseAddress(toHex(scriptAddress)))) {
    throw new Error(
      "A script address was accepted as a signing payment address.",
    );
  }

  const incompletePointer = new Uint8Array(30);
  incompletePointer[0] = 0x41;
  if (!throws(() => parseAddress(toHex(incompletePointer)))) {
    throw new Error("A malformed pointer address was accepted.");
  }
});

function throws(callback: () => unknown): boolean {
  try {
    callback();
    return false;
  } catch {
    return true;
  }
}
